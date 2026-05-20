# compostmodernism.org

A small personal blog. SvelteKit + SQLite, deployed in Docker behind a shared
Caddy gateway. Posts are written from iOS Shortcuts or a password-protected
`/admin` page; images and nightly DB backups land in Cloudflare R2; the
canonical post archive is exported nightly to markdown files.

`PLAN.md` is the phase-by-phase build log. `SPEC.md` is the design document.
This file is the architectural overview — what the running app actually is.

## Stack

| Concern | Choice |
|---|---|
| Framework | SvelteKit 2 (Svelte 5 runes) |
| Adapter | `@sveltejs/adapter-node` |
| Data store | SQLite via `better-sqlite3` (single file: `posts.db`) |
| Schema management | Versioned SQL files in `migrations/`, applied by `src/lib/migrate.ts` on every connection |
| Image pipeline | `sharp` — EXIF stripped, max 1600×1600, converted to WebP |
| Object storage | Cloudflare R2 via `@aws-sdk/client-s3` (images + nightly DB backups) |
| Markdown | `marked` (rendered server-side at request time) |
| Validation | `zod` `safeParse` on every API route |
| Tests | `vitest` + `@testing-library/svelte` + `happy-dom`, 150+ tests across the codebase |
| Container | Docker + Docker Compose (no host ports — joins external `web` network) |
| TLS / routing | Caddy, running in a separate gateway container; this repo only ships a `Caddyfile` that the gateway mounts |
| CI/CD | GitHub Actions: build + test, then SSH `git pull && docker compose up -d --build` |

## Repository layout

```
.
├── src/
│   ├── lib/
│   │   ├── db.ts            # createDb() + all query functions (typed PostRow/Post/Tag/ImageRow)
│   │   ├── migrate.ts       # Runs pending migrations/*.sql per PRAGMA user_version
│   │   ├── slug.ts          # slugify, hashSlug, dateParts, permalink
│   │   ├── markdown.ts      # marked wrapper used by feed + post pages
│   │   ├── auth.ts          # timing-safe Bearer token + session cookie check
│   │   ├── r2.ts            # S3Client + uploadToR2()
│   │   ├── schemas.ts       # Shared zod schemas (postInputSchema, postUpdateSchema, imageMetadataSchema)
│   │   └── components/      # FeedItem, Dateline, TagList + admin/ (PostForm, PostsTable, ImagesTable, ImageUploadModal, AdminNav, SignOut)
│   ├── routes/
│   │   ├── +layout.{server.ts,svelte}     # Site chrome, session detection
│   │   ├── +page.{server.ts,svelte}       # Feed (reverse-chronological)
│   │   ├── [year]/[month]/[day]/[slug]/   # Single-post permalink
│   │   ├── tag/[slug]/                    # Tag feed
│   │   ├── admin/                         # Login, posts table + new/edit pages, images table
│   │   └── api/
│   │       ├── post/+server.ts            # POST  — create
│   │       ├── post/[slug]/+server.ts     # PATCH — edit
│   │       ├── upload/+server.ts          # POST  — image to R2 (also records in image ledger)
│   │       └── session/+server.ts         # POST  — admin login → httpOnly cookie
│   ├── hooks.server.ts                    # Bridges $env/dynamic/private into process.env for scripts
│   ├── app.html, app.css, app.d.ts
├── scripts/
│   ├── init-db.ts                # One-shot: open posts.db so migrations run
│   ├── export-and-backup.ts      # Nightly markdown export → archive/, then DB → R2
│   ├── seed.ts                   # Local-only fixture data
│   └── fixtures.ts
├── migrations/
│   └── 001_init.sql              # Baseline schema: posts, tags, post_tags, images, post_images
├── Dockerfile                    # Two-stage; runtime stage includes migrations/, scripts/, build/, node_modules/
├── docker-compose.yml            # One service, joins external `web` network — no host ports
├── Caddyfile                     # reverse_proxy compostmodernism:3000 — mounted into the gateway
├── .github/workflows/deploy.yml  # Build/test gate → SSH deploy on push to blog-engine
├── DEPLOY.md                     # One-time bootstrap checklist for cornhill
├── PLAN.md                       # Phase-by-phase TDD plan
└── SPEC.md                       # Design spec
```

## How it fits together

### Post lifecycle

1. **Create** — `POST /api/post` with `Authorization: Bearer $POST_SECRET`. Zod validates
   the body. `insertPost` (in `src/lib/db.ts`) derives a slug (from the title via
   `slugify`, or an 8-char hash via `hashSlug` for untitled posts), handles slug
   collisions by appending `-2`, `-3`, …, writes tag join rows, and calls
   `setPostImages` to record any R2 URLs found inside the markdown body.
2. **Read** — the feed loader calls `getPosts` (default limit 50, reverse-chronological,
   hydrated with `tags` and a `date` alias). Each post is rendered by `FeedItem.svelte`,
   which switches on link/titled/plain.
3. **Edit** — `/admin/posts/[slug]` issues `PATCH /api/post/[slug]`. Omitted fields
   keep their old values; the body re-runs `setPostImages` to rebuild image join
   rows. A slug *can* be changed: the old `(year, month, day, slug)` tuple is
   recorded in `slug_redirects` and the single-post loader 301s old URLs to the
   post's new canonical path on next visit.
4. **Archive** — nightly cron runs `scripts/export-and-backup.ts`: writes
   `archive/YYYY/MM/DD/slug.md` with YAML frontmatter for every post (idempotent —
   re-runs overwrite), then `PutObject`s `posts.db` to R2 under
   `backups/posts-YYYY-MM-DD.db`.

### Post types

Inspired by Daring Fireball and Kottke. All three are the same row shape; `+page.svelte` switches
on which fields are present:

- **Link post** — `url` + `title` → title links externally, marker `→` rendered.
- **Titled post** — `title` only → `<h2>` heading.
- **Plain post** — body only, no heading.

### Schema and migrations

The schema lives in `migrations/NNN_*.sql`. `createDb()` calls `migrate()` on every
connection: it reads `PRAGMA user_version`, sorts files by their numeric prefix, and
applies each newer file inside its own transaction (rolling back atomically on failure,
bumping `user_version` only when every statement in the file succeeds). Dev and prod
use the same path — restart the dev server and pending migrations apply.

**Never edit a committed migration.** Always add a new one. See PLAN.md §Schema
Migrations for the convention.

The image ledger (`images` + `post_images`) is part of the baseline `001_init.sql`.
Every successful `/api/upload` calls `recordImage(key)`; every post create/update
calls `setPostImages(postId, body)` which scans the body for R2 URLs (respecting
`R2_PUBLIC_URL`) and rebuilds the join rows. The ledger lets future tooling answer
"which posts reference this image?" and "which images are orphaned?".

The slug-redirect ledger (`slug_redirects`, migration `002`) records every
`(old_year, old_month, old_day, old_slug)` tuple a post used to live at. Rows point
to `post_id` (not a path string), so successive renames automatically resolve to
the post's current canonical URL via a single JOIN — no chain walking. The
single-post route loader (`src/routes/[year]/[month]/[day]/[slug]/+page.server.ts`)
consults the ledger only when the live slug lookup misses; a hit becomes a 301 to
the post's current `permalink`. `ON DELETE CASCADE` cleans up ledger rows when a
post is deleted, so stale redirects can't outlive their targets.

### Auth

Two paths, both checking against `process.env`:

- **API write endpoints** — `Authorization: Bearer $POST_SECRET`, used by iOS Shortcuts.
- **Admin UI** — `POST /api/session` with `$ADMIN_PASSWORD` sets an httpOnly session
  cookie. `admin/+page.server.ts` checks the cookie and either renders the login form
  or the post list.

Both checks use `crypto.timingSafeEqual` (see `src/lib/auth.ts`). There is no user
table, no sessions table, no auth library — the cookie value is the secret itself.

### Storage boundaries

- **`posts.db`** — single SQLite file, baked into the container's working directory.
  Volume-mounted in `docker-compose.yml` so it survives redeploys.
- **Cloudflare R2** — two prefixes in one bucket: `images/` (public, served at
  `R2_PUBLIC_URL`) and `backups/` (private, 90-day lifecycle rule).
- **`archive/`** — git-tracked markdown export. Source of truth if `posts.db` is ever
  lost; not currently re-imported on boot, but the format is stable enough to do so.

## Local development

```sh
cp .env.example .env       # fill in POST_SECRET, ADMIN_PASSWORD, R2_* values
npm install
npm run dev                # http://localhost:5173 — migrations run on first connection
npm test                   # vitest, ~150 tests, runs against in-memory SQLite
npm run check              # svelte-check
npm run seed               # populate posts.db with fixtures (idempotent)
```

A `posts.db` file appears in the repo root on first run; it's gitignored.

## Deployment

CI/CD: pushing to `blog-engine` runs `.github/workflows/deploy.yml`, which gates on
`npm run check && npm test && npm run build` and then SSHes to the VPS to
`git pull && docker compose up -d --build`. After bring-up stabilizes, the trigger
will move to `main`.

Caddy is **not** part of this project's compose stack. It runs in a separate
`~/gateway/` stack on the VPS; this repo's `Caddyfile` is bind-mounted into that
container as a per-site config.

First-time bootstrap (SSH keys, GitHub Secrets, gateway mount, container init) is
documented step-by-step in `DEPLOY.md`.

## API

All write endpoints require `Authorization: Bearer $POST_SECRET` unless noted. All
responses are JSON. All bodies are validated with `zod.safeParse`; invalid input
returns `400` before any DB or R2 call.

### `POST /api/session`

Authenticates the admin. Sets an `httpOnly` session cookie on success.

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ error }` | Body missing or malformed |
| 401 | `{ error: "Unauthorized" }` | Wrong password |
| 200 | `{ ok: true }` | Authenticated |

**Request body:** `{ password: string }`

### `DELETE /api/session`

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ ok: true }` | Session cookie cleared (sign out) |

### `POST /api/post`

Creates a new post.

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ error: "Unauthorized" }` | Missing or wrong Bearer token |
| 400 | `{ error }` | Invalid body, or `url` provided without `title` |
| 201 | `{ ok: true, slug: string, permalink: string }` | Post created |

**Request body:** `{ body: string, title?: string, url?: string, tags?: string[] }`

### `PATCH /api/post/[slug]`

Updates an existing post. All fields are optional; omitted fields keep their
existing values. Passing `slug` or `created_at` moves the post: the old path
tuple is recorded in `slug_redirects` and future GETs on the old URL 301 to
the new canonical permalink.

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ error: "Unauthorized" }` | Missing or wrong Bearer token |
| 400 | `{ error }` | Invalid body, or `url` provided without `title` |
| 404 | `{ error: "Not found" }` | No post with that slug |
| 409 | `{ error }` | Requested `slug` is already in use by another post |
| 200 | `{ ok: true, slug: string }` | Post updated; `slug` is the current (post-rename) slug |

**Request body:** `{ body?: string, title?: string | null, url?: string | null, tags?: string[], slug?: string, created_at?: number }`

### `DELETE /api/post/[slug]`

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ error: "Unauthorized" }` | Missing or wrong Bearer token |
| 404 | `{ error: "Not found" }` | No post with that slug |
| 200 | `{ ok: true }` | Post deleted |

### `POST /api/upload`

Processes and uploads an image to R2. Resizes to ≤ 1600×1600 and converts to WebP.
Records the resulting key in the `images` ledger.

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ error: "Unauthorized" }` | Missing or wrong Bearer token |
| 400 | `{ error }` | `image` field missing or not a file |
| 500 | `{ error: "Image processing failed" }` | sharp pipeline threw |
| 500 | `{ error: "Upload failed" }` | R2 upload threw |
| 201 | `{ ok: true, url: string }` | Uploaded; `url` is the public R2 URL |

**Request body:** `multipart/form-data` with an `image` file field.

### `GET /api/images`

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ error: "Unauthorized" }` | Missing auth |
| 200 | `{ images: [...], page, perPage, total, totalPages }` | Paginated list of ledger rows; each row includes `url` and `usage_count` |

**Query params:** `?page=N` (default 1).

### `PATCH /api/images/[id]`

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ error: "Unauthorized" }` | Missing auth |
| 400 | `{ error }` | Invalid `id`, or invalid metadata payload |
| 404 | `{ error: "Not found" }` | Image id does not exist |
| 200 | `{ ok: true, image: { ... } }` | Metadata updated; row returned |

**Request body:** JSON object with optional `title`, `alt`, `caption`, `credit` (each string or `null`).

### `DELETE /api/images/[id]`

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ error: "Unauthorized" }` | Missing auth |
| 404 | `{ error: "Not found" }` | Image id does not exist |
| 409 | `{ error, posts: [{ slug, title }] }` | Image is referenced and `?force=true` was not passed — re-issue with `?force=true` to override |
| 500 | `{ error }` | R2 delete failed (DB row preserved) |
| 200 | `{ ok: true }` | R2 object deleted then DB row removed |

### `POST /api/images/[id]/replace`

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ error: "Unauthorized" }` | Missing auth |
| 400 | `{ error }` | Invalid id, or `image` field missing |
| 404 | `{ error: "Not found" }` | Image id does not exist |
| 500 | `{ error }` | Sharp pipeline or R2 upload threw |
| 200 | `{ ok: true, url: string }` | Bytes uploaded to the *same* R2 key; `uploaded_at` bumped. `url` is unchanged from the prior version, so posts referencing the image stay intact. |

**Request body:** `multipart/form-data` with an `image` file field.

## Admin UI

After signing in at `/admin/login`, the admin area exposes:

- `/admin/posts` — paginated table of every post with View / Edit / Delete actions.
- `/admin/posts/new` — composer for a new post (uses the shared `PostForm`).
- `/admin/posts/[slug]` — standalone editor for an existing post.
- `/admin/images` — image ledger as a table with thumbnail, usage count, and per-row Copy URL / Edit metadata / Replace / Delete actions.

Both posting channels share the same backend: the admin UI uses `fetch` against the same API endpoints that iOS Shortcuts hit.

When signed in, the public site shows two extra affordances (gated on the
root layout's `data.admin` flag, so unauthenticated readers see nothing
different):

- The site header gains an "Admin" link and a "Sign out" button in place of
  the byline.
- Each single-post page shows an "Edit" link in its right-hand rail that
  jumps to `/admin/posts/[slug]`.

Inline edit affordances on the feed and inline composer were tried and
rolled back; see `NOTES.md` for the post-mortem.

## References

- [allanlasser.com](https://github.com/allanlasser/allanlasser.com)
- [co-op.computer](https://github.com/allanlasser/co-op.computer)
- [A Working Library](https://aworkinglibrary.com)
- [Maggie Appleton](https://maggieappleton.com/)
- [Simon Willison](https://simonwillison.net)
