# compostmodernism.org — Implementation Plan

Red-green TDD with vitest throughout. Each phase ends with a checkpoint: all tests pass and the feature is manually verified before moving on.

---

## Conventions

- **Red** — write the failing test first
- **Green** — write the minimum code to pass it
- **Refactor** — clean up without breaking tests
- **Language:** TypeScript by default. Source files are `.ts`, components use `<script lang="ts">`, tests are `.test.ts`. `svelte.config.js` conventionally stays `.js` (toolchain loads it pre-TS); `vite.config.ts` imports `defineConfig` from `vitest/config` so the `test` key is typed.
- **Validation:** All API route handlers validate incoming data with [Zod](https://zod.dev) using `safeParse`. JSON bodies are parsed directly; `FormData` bodies are converted with `Object.fromEntries` before parsing. Invalid input returns a `400` before any business logic runs.
- Test files live next to the code they test: `src/lib/slug.test.ts`, etc.
- Database tests use an in-memory SQLite instance (`new Database(':memory:')`)
- R2 and sharp are mocked at the module level
- **Schema:** Versioned SQL files in `migrations/`. `createDb()` runs the
  migration runner (`src/lib/migrate.ts`) on every connection, applying any
  files newer than `PRAGMA user_version`. See the **Schema Migrations**
  section below.

---

## Phase 1 — Project Scaffold

**Goal:** `npm test` runs vitest and `npm run build` produces a Node bundle.

### Steps

The scaffold is written by hand (not via `sv create`) because the repo root already
contains `PLAN.md`, `SPEC.md`, `README.md`, `devlog/`, etc., and the interactive
scaffolder won't run cleanly into a non-empty directory.

1. Write `package.json` with `"type": "module"` and the dependencies from SPEC §1
   plus TypeScript tooling: `typescript`, `@types/node`, `@types/better-sqlite3`,
   `svelte-check`, `tslib`, `vitest`, `@vitest/coverage-v8`.
2. Write `svelte.config.js` (JS, per SvelteKit convention) using
   `@sveltejs/adapter-node` with `out: 'build'`.
3. Write `vite.config.ts` with the sveltekit plugin and vitest config. Include the
   triple-slash reference so the `test` key type-checks:
   ```ts
   /// <reference types="vitest" />
   import { sveltekit } from '@sveltejs/kit/vite';
   import { defineConfig } from 'vite';

   export default defineConfig({
     plugins: [sveltekit()],
     test: { environment: 'node' }
   });
   ```
4. Write `tsconfig.json` extending `./.svelte-kit/tsconfig.json` with `strict: true`,
   `allowJs: true`, `checkJs: true`, `moduleResolution: 'bundler'`.
5. Write `src/app.html`, `src/app.d.ts` (App namespace declaration), and a
   placeholder `src/routes/+page.svelte`.
6. Add scripts to `package.json`:
   ```json
   "dev": "vite dev",
   "build": "vite build",
   "start": "node build/index.js",
   "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
   "test": "vitest run --passWithNoTests",
   "test:watch": "vitest"
   ```
   `--passWithNoTests` is required so the checkpoint succeeds before any tests
   exist (vitest's default is to fail on zero tests).
7. Create `.env.example` with all required variables (see SPEC §9). `.env` is
   already in `.gitignore`.
8. `npm install`.

### Checkpoint 1

- [ ] `npm test` — exits 0 (no tests yet, but vitest resolves)
- [ ] `npm run build` — produces `build/` directory
- [ ] `node build/index.js` — server starts on port 3000
- [ ] `npm run check` — svelte-check finds 0 errors

---

## Phase 2 — Slug Utilities

**Goal:** Pure helper functions fully covered by tests.

File: `src/lib/slug.ts`
Tests: `src/lib/slug.test.ts`

### Red → Green cycles

#### `slugify`
```
test: "Hello, World!" → "hello-world"
test: leading/trailing hyphens stripped
test: consecutive spaces/underscores collapse to single hyphen
test: empty string returns empty string
```

#### `hashSlug`
```
test: returns 8-character hex string
test: same timestamp always returns same hash (deterministic)
test: different timestamps return different hashes
```

#### `dateParts`
```
test: timestamp → { year, month, day } with zero-padded month/day
test: UTC boundary — midnight UTC on Jan 1 stays in Jan, not Dec 31
```

#### `permalink`
```
test: titled post → /2024/07/01/hello-world
test: untitled post → /2024/07/01/<8-char-hash>
```

### Checkpoint 2

- [ ] `npm test` — all slug tests pass
- [ ] No implementation beyond what the tests require

---

## Phase 3 — Database Layer

**Goal:** All db query functions covered by tests against an in-memory SQLite instance.

Files: `scripts/init-db.ts`, `src/lib/db.ts`
Tests: `src/lib/db.test.ts`

Scripts are run in production via `tsx` (added as a dev dep at this phase) or
pre-compiled — decide before Phase 8 deploy. Default to `tsx scripts/init-db.ts`
locally and document the production runner in Phase 8.

### Setup

Export a `createDb(path)` factory from `db.ts` so tests can inject `':memory:'`.
The default export remains `createDb(join(process.cwd(), 'posts.db'))`. Define a
`PostRow` / `Post` interface and a `Tag` interface in `src/lib/db.ts` and use them
as return types — don't lean on `any`.

### Red → Green cycles

#### Schema (tested implicitly via query tests)
```
test: db initialises without error
test: posts, tags, post_tags tables exist
test: foreign key constraints are enforced
```

#### `insertPost`
```
test: plain post (no title, no url) — stores body, generates hash slug
test: titled post — slug derived from title via slugify
test: link post — requires url AND title
test: slug collision — appends -2, -3, etc.
test: tags array — inserts tag rows and join rows
test: empty tags array — no tag rows inserted
```

#### `getPosts`
```
test: returns posts in reverse-chronological order
test: default limit 50 — inserting 60 posts returns 50
test: each row is hydrated with .tags array and .date alias
```

#### `getPostBySlug`
```
test: returns hydrated post when slug exists
test: returns null when slug does not exist
```

#### `getPostsByTag`
```
test: returns only posts with the given tag slug
test: returns null for unknown tag (no 404 — that's the route's job)
```

#### `getAllTags`
```
test: returns tags sorted by post count descending
test: count field reflects actual join-table rows
```

#### `updatePost`
```
test: updates body, title, url in place
test: slug never changes on update
test: tags param replaces existing tags
test: omitting tags param leaves existing tags unchanged
```

#### `deletePost`
```
test: removes from database and tag joins
test: after deleting, can create a post with same slug
test: does not delete related tags
```

### Checkpoint 3

- [ ] `npm test` — all db tests pass
- [ ] `npx tsx scripts/init-db.ts` — creates `posts.db` without error
- [ ] Manual smoke test: insert a post via Node REPL, read it back

---

## Phase 4 — API Endpoints

**Goal:** All three endpoints tested with request/response mocks; no real DB or R2 calls.

Tests use vitest with `Request` / `Response` globals (available in vitest's node env via
the SvelteKit test helpers, or constructed directly).

Files:
- `src/routes/api/post/+server.ts`
- `src/routes/api/post/[slug]/+server.ts`
- `src/routes/api/upload/+server.ts`
- `src/routes/api/session/+server.ts`

Tests:
- `src/routes/api/post/post.test.ts`
- `src/routes/api/post/[slug]/edit.test.ts`
- `src/routes/api/upload/upload.test.ts`
- `src/routes/api/session/session.test.ts`

Each test file mocks `$lib/db` and `$env/dynamic/private` at the module level.

### Red → Green cycles

#### `POST /api/post`
```
test: missing Authorization → 401
test: wrong Bearer token → 401
test: missing body → 400
test: url without title → 400
test: valid plain post → 201 + { ok, permalink }
test: valid link post → 201 + { ok, permalink }
test: tags passed through to insertPost
```

#### `PATCH /api/post/[slug]`
```
test: unauthorized → 401
test: unknown slug → 404
test: partial update — unset fields fall back to existing values
test: url without title → 400
test: valid update → 200 { ok: true }
```

#### `POST /api/upload`
```
test: unauthorized → 401
test: missing image field → 400
test: valid upload → calls sharp pipeline → calls uploadToR2 → returns { ok, url }
  (sharp and uploadToR2 are mocked; assert they were called with correct args)
```

#### `POST /api/session`
```
test: wrong password → 401
test: correct password → 200 + sets httpOnly session cookie
```

### Checkpoint 4

- [ ] `npm test` — all endpoint tests pass
- [ ] Dev server (`npm run dev`) running — curl each endpoint manually

---

## Phase 5 — SvelteKit Routes

**Goal:** Server-side load functions tested; Svelte components render correct markup.

Test server loaders with plain function calls (they are just async functions).
Test Svelte components with `@testing-library/svelte`.

```bash
npm i -D @testing-library/svelte @testing-library/happy-dom happy-dom
```

Add to vitest config:
```js
environment: 'happy-dom'  // for component tests only — use environmentMatchGlobs
```

### Red → Green cycles

#### Feed loader (`+page.server.ts`)
```
test: returns { feed } with permalink on each post
test: feed is in reverse-chronological order (delegated to getPosts)
```

#### Feed page (`+page.svelte`)
```
test: link post renders external <a> with → marker
test: titled post renders <h2> without external link
test: plain post renders body <p> only, no heading
test: tags render as /tag/[slug] links
test: permalink renders as <time> wrapped in link
```

#### Single post loader (`[year]/[month]/[day]/[slug]/+page.server.ts`)
```
test: valid slug with correct date → returns post
test: unknown slug → throws 404
test: mismatched date parts → returns redirect to canonical URL
```

#### Single post page (`[year]/[month]/[day]/[slug]/+page.svelte`)
```
test: link post renders <h1> with external link
test: titled post renders <h1> without link
test: plain post renders no heading
```

#### Tag feed loader (`tag/[slug]/+page.server.ts`)
```
test: known tag → returns { tag, feed }
test: empty results → throws 404
```

#### Single tag page (`tag/[slug]/+page.svelte`)
```
test: tag feed renders tag name as h1
test: renders posts for tag
```

### Checkpoint 5

- [ ] `npm test` — all route tests pass
- [ ] Dev server: visit `/`, `/tag/[slug]`, and a permalink — all render correctly

---

## Phase 6 — Admin UI

**Goal:** Auth guard tested; admin page renders login form when unauthenticated and post
list when authenticated.

Files: `src/routes/admin/+page.server.ts`, `src/routes/admin/+page.svelte`
Tests: `src/routes/admin/admin.test.ts`

### Red → Green cycles

#### Admin loader
```
test: missing session cookie → redirect to /admin?auth=required
test: wrong session value → redirect
test: correct session → returns { posts } list
```

#### Admin page (component)
```
test: data.posts absent → renders login form, no post list
test: data.posts present → renders post list, no login form
test: each post renders as <details> with title/body preview
test: image uploader section present when authenticated
```

#### Save flow (integration, no real fetch)
```
test: clicking Save calls PATCH /api/post/[slug] with form field values
test: successful save shows "Saved ✓" for 2 seconds
```

### Checkpoint 6

- [ ] `npm test` — all admin tests pass
- [ ] Dev server: visit `/admin` — login form shows; log in — post list shows
- [ ] Edit a post body and save — change persists on page reload

---

## Phase 7 — Export & Backup Script

**Goal:** Export logic unit-tested; R2 upload mocked.

File: `scripts/export-and-backup.ts`
Tests: `scripts/export-and-backup.test.ts`

### Red → Green cycles

#### Markdown generation
```
test: post with all fields → correct YAML frontmatter + body
test: post without title or url → frontmatter omits those keys
test: post with tags → tags rendered as YAML list
test: permalink in frontmatter is absolute URL
```

#### File writing (mock fs)
```
test: output path follows archive/YYYY/MM/DD/slug.md pattern
test: directory created recursively before write
test: re-run overwrites existing file (idempotent)
```

#### R2 backup (mock S3Client)
```
test: PutObjectCommand called with correct bucket, key, and db buffer
test: key follows backups/posts-YYYY-MM-DD.db pattern
```

### Checkpoint 7

- [ ] `npm test` — all export/backup tests pass
- [ ] `npx tsx scripts/export-and-backup.ts` (with real `.env`) — creates files in `archive/`

---

## Phase 8 — Docker & Deployment

No automated tests for infra config — verified by inspection and smoke test.

### Steps

1. Write `Dockerfile` per SPEC §9 — two-stage build (builder runs
   `npm ci && npm run build && npm prune --omit=dev`; runtime copies
   `node_modules/`, `build/`, `migrations/`, `scripts/`, `src/`,
   `package.json`, `tsconfig.json`). **Must include
   `COPY migrations/`** so the runner can find the SQL files at
   container start.
2. Write `docker-compose.yml` per SPEC §9 — no host ports; joins the
   external `web` network shared with the Caddy gateway.
3. Write `Caddyfile` per SPEC §10 — `reverse_proxy compostmodernism:3000`,
   `request_body max_size 20MB`. Mounted into the gateway as
   `compostmodernism.org.caddy`.
4. Write `.github/workflows/deploy.yml` per SPEC §11 — two jobs (build
   gate + ssh-action that runs `git pull && docker compose up -d --build`).
   Trigger is `blog-engine` during bring-up; flip to `main` once stable.
5. Promote `tsx` from devDeps → deps so production scripts
   (`init-db.ts`, `export-and-backup.ts`) run under `npx tsx` in the
   container. Resolves the deferred Phase 3 follow-up.

### Checkpoint 8

- [ ] `docker build .` succeeds locally on Mac (catches toolchain bugs
      before they bite the VPS)
- [ ] On the VPS, after first-time bootstrap: server boots, `migrate()`
      applies `001_init.sql`, `PRAGMA user_version` becomes 1
- [ ] Adding a new migration and redeploying — file applies on next
      boot, version bumps, no manual step required
- [ ] Push to `blog-engine` — GitHub Actions deploys successfully to VPS
- [ ] `https://compostmodernism.org` loads over TLS
- [ ] Cut over: flip workflow trigger from `blog-engine` to `main` once
      the deploy mechanics are proven; merge `blog-engine` → `main`

---

## Phase Order Summary

| Phase | Files | Gate |
|-------|-------|------|
| 1 | Project scaffold | `npm run build` works |
| 2 | `src/lib/slug.ts` | Slug tests green |
| 3 | `scripts/init-db.ts`, `src/lib/db.ts` | DB tests green |
| 4 | `src/routes/api/**` | Endpoint tests green |
| 5 | `src/routes/**` (public) | Route tests green |
| 6 | `src/routes/admin/**` | Admin tests green |
| 7 | `scripts/export-and-backup.ts` | Export tests green |
| 8 | Docker, Caddy, CI | Manual deploy smoke test |
| 9 | `images` + `post_images` tables, `recordImage`, `setPostImages` | Ledger tests green |

Each phase depends on the previous one being at checkpoint. Do not begin Phase N+1 until Phase N's checkbox list is fully checked off.

---

## Phase 9 — Image Ledger

**Goal:** Every `/api/upload` records a row in `images`; every post create/update
links the post to images whose R2 keys appear in the body.

Additive over the live schema — uses `CREATE TABLE IF NOT EXISTS` so the
already-deployed `posts.db` migrates cleanly when `init-db.ts` is re-run.

Files touched:
- `scripts/init-db.ts` — append `images` and `post_images` table definitions
- `src/lib/db.ts` — add `recordImage`, `setPostImages`, `ImageRow`; call
  `setPostImages` from `insertPost` and `updatePost`
- `src/routes/api/upload/+server.ts` — call `recordImage(key)` after `uploadToR2`

Tests touched:
- `src/lib/db.test.ts` — new describe blocks for the ledger functions
- `src/routes/api/upload/upload.test.ts` — assert `recordImage` is called

### Red → Green cycles

#### Schema migration
```
test: re-running init on an existing db is idempotent (no errors, no data loss)
test: post deletion cascades to post_images, leaves images intact
```

#### `recordImage`
```
test: first call inserts a row with the given key and uploaded_at = Date.now()
test: second call with same key returns the existing row (idempotent on key)
test: title/alt/caption/credit default to null
```

#### `setPostImages`
```
test: body containing one R2 URL → one post_images row
test: body containing two distinct R2 URLs → two rows
test: body containing the same URL twice → one row (dedup)
test: body containing a URL not in images table → silently skipped
test: body containing no R2 URLs → no rows
test: re-running replaces existing rows (delete-then-insert)
test: respects R2_PUBLIC_URL — URLs from other hosts are ignored
test: matches the URL inside markdown image syntax `![alt](url)`
```

#### Integration with `insertPost` / `updatePost`
```
test: insertPost with body referencing a recorded image creates the join row
test: updatePost replacing the body removes stale image links and adds new ones
test: updatePost that doesn't change the body leaves join rows intact
  (or: deterministically rebuilds them — pick whichever the implementation does
  and lock it in)
```

#### Upload endpoint
```
test: successful upload calls recordImage with the generated key
test: recordImage is called with the same key used in the returned URL
```

### Checkpoint 9

- [ ] `npm test` — all ledger tests pass
- [ ] `npx tsx scripts/init-db.ts` against an existing `posts.db` — no errors, new
      tables present (`sqlite3 posts.db '.schema images'`)
- [ ] Manual smoke test: upload an image via `/api/upload`, then POST a post whose
      body includes the returned URL — `SELECT * FROM post_images` shows the link

---

## Schema Migrations

Cross-cutting subsystem added after Phase 9. The DB schema is no longer a
constant inside `db.ts`; it lives in versioned SQL files that the runner
applies on demand.

### Files

- `migrations/NNN_short_description.sql` — one file per schema change.
  `001_init.sql` is the baseline (the previous `SCHEMA` constant, extracted
  verbatim).
- `src/lib/migrate.ts` — the runner (~30 lines). Reads `PRAGMA user_version`,
  filters files matching `^\d{3}_.+\.sql$`, sorts by the numeric prefix, and
  applies each file inside its own `db.transaction(() => { exec sql; bump
  version })`.
- `src/lib/migrate.test.ts` — covers the runner contract: fresh DB, partial
  DB, no-op at latest, numeric (not lexical) ordering, non-matching files
  ignored, transactional rollback, missing-dir error.

### Convention

- **Never edit a committed migration.** Always add a new one — `002_*.sql`
  for the next change, etc. Past migrations are immutable history.
- File names use a three-digit prefix so lexical sort matches numeric sort up
  to 999 migrations.
- A migration that fails part-way through rolls back atomically; the version
  is not advanced unless every statement succeeds. On the next run, the
  runner retries the same file.
- Each migration applies in its own transaction. If file 003 fails after 002
  succeeded, 002 stays applied (`user_version = 2`). You fix 003, deploy,
  and only 003 retries.

### Workflow

1. Add `migrations/NNN_short_description.sql`.
2. If the change isn't purely additive (column added/dropped, type changed),
   update the affected `db.ts` query functions and their tests in the same
   commit so `db.test.ts` still passes against the new schema.
3. Apply locally: `npx tsx scripts/init-db.ts`, or just restart the dev
   server — `createDb()` runs `migrate()` on every connection.
4. In production: a container restart applies pending migrations
   automatically. See Phase 8 checkpoint.

### What this replaces

Previously: a single `SCHEMA` const in `db.ts`, applied via `raw.exec(SCHEMA)`
on every `createDb()`. Idempotent for `CREATE TABLE IF NOT EXISTS` but unable
to handle `ALTER TABLE`, data migrations, or any non-additive change without
hand-running SQL on the VPS. Phase 9's ledger went through that mechanism;
every change after Phase 9 goes through `migrations/`.

---

## Phase 10 — Admin CMS Expansion

**Goal:** Turn `/admin` from a single accordion page into a full content
management surface: create posts, edit on standalone routes from a
paginated table, browse the image ledger as a table with metadata edit,
copy-URL, replace, and delete actions. Adds a second posting channel
alongside iOS Shortcuts.

Design decisions confirmed with the user:

- Single shared `PostForm.svelte` (mode prop), used by create and edit.
- Dedicated `/admin/login` route; `+layout.server.ts` redirects there.
- Image delete also removes the R2 object (add `deleteFromR2`).
- When an image is referenced by posts, the **replace** flow uploads new
  bytes to the same R2 key — URLs unchanged, no post-body edits needed.
  Hard delete is still available with confirm + usage list.

Sub-phases follow red→green TDD, one commit cluster per sub-phase.

### 10.1 Auth layout + login route + sign-out

- `src/routes/admin/+layout.server.ts` — redirects to `/admin/login`
  unless authed; returns `{ authed: true }` otherwise. Allows
  `/admin/login` through with `{ authed: false }`; redirects authed
  visitors away from login.
- `src/routes/admin/+layout.svelte` — renders `AdminNav` when authed.
- `src/lib/components/admin/AdminNav.svelte` — Posts / Images links and a
  Sign out button (`DELETE /api/session`).
- `src/routes/admin/login/+page.svelte` — sign-in form posting to
  `POST /api/session`, navigates to `/admin` on success.
- `DELETE /api/session` — clears the `session` cookie.

Tests:

- `src/routes/admin/layout.server.test.ts` — six cases covering the auth
  matrix (no/wrong/correct session × `/admin` vs `/admin/login` vs deeper
  child path).
- `src/routes/api/session/session.test.ts` — DELETE clears the cookie.
- `src/lib/components/admin/AdminNav.svelte.test.ts` — renders links;
  sign-out triggers fetch DELETE and navigates.
- `src/routes/admin/login/page.svelte.test.ts` — input + button render;
  submit posts the password; 401 shows error and clears the field.
- `src/routes/admin/layout.svelte.test.ts` — nav visible only when
  `data.authed === true`.

Checkpoint 10.1:

- [x] All new tests green; full suite stays at 167 tests passing.
- [x] `npm run check` clean.
- [ ] Manual: sign out from any admin sub-page returns to `/admin/login`;
      visiting `/admin/login` while authed redirects to `/admin`.

### 10.2 Shared schemas + DB pagination

- `src/lib/schemas.ts` — extract `postInputSchema` and `postUpdateSchema`
  from the existing API route files; add `imageMetadataSchema`.
- Refactor `src/routes/api/post/+server.ts` and
  `src/routes/api/post/[slug]/+server.ts` to import from `$lib/schemas`
  (no behaviour change; tests stay green).
- `src/lib/db.ts` — extend `getPosts({ limit, offset })`; add
  `countPosts()`.
- DB tests for offset and count.

### 10.3 Posts table at `/admin/posts`

- `src/lib/components/admin/PostsTable.svelte` — rows: preview/title,
  date, tags, actions (View, Edit, Delete placeholder until 10.6).
- `src/routes/admin/posts/+page.server.ts` — reads `?page`, fetches the
  slice and total count.
- `src/routes/admin/posts/+page.svelte` — renders the table with
  pagination controls.
- `src/routes/admin/+page.server.ts` — drop the accordion data load and
  redirect to `/admin/posts`. (The accordion `+page.svelte` becomes
  unreachable; cleanup in 10.10.)

### 10.4 Standalone edit route + `PostForm` component

- `src/lib/components/admin/PostForm.svelte` — `mode: 'create' | 'edit'`,
  optional `initial`, `onSuccess` callback. Client-side `safeParse`
  against the shared Zod schema; per-field error messages; submits via
  fetch.
- `src/routes/admin/posts/[slug]/+page.server.ts` — load by slug or 404.
- `src/routes/admin/posts/[slug]/+page.svelte` — renders `<PostForm
  mode="edit" />` with a View link.

### 10.5 Create new post

- `src/routes/admin/posts/new/+page.svelte` — `<PostForm mode="create"
  />`.
- Extend `POST /api/post` response to include `slug`; client navigates
  to `/admin/posts/[new-slug]` on success.

### 10.6 Delete post endpoint + UI

- `DELETE /api/post/[slug]` — auth, 404, 200.
- Delete buttons (with confirm) in `PostsTable` rows and on the edit
  page; navigate back to `/admin/posts` on success.

### 10.7 Image DB helpers + `deleteFromR2`

- `src/lib/db.ts` — `getImages({ limit, offset })`, `countImages()`,
  `getImageById(id)`, `getPostsForImage(imageId)`, `updateImage(id,
  metadata)`, `deleteImage(id)` (returns the deleted key).
- `src/lib/r2.ts` — `deleteFromR2(key)` using `DeleteObjectCommand`.
- Tests using in-memory db and the existing R2 mock pattern from
  `upload.test.ts`.

### 10.8 Image API endpoints

- `GET /api/images` — paginated list, includes `usage_count` and public
  URL per row.
- `PATCH /api/images/[id]` — validates against `imageMetadataSchema`.
- `DELETE /api/images/[id]` — when `usage_count > 0` and no
  `?force=true`, return 409 with the list of referencing post slugs.
  Otherwise delete R2 object then DB row.
- `POST /api/images/[id]/replace` — multipart upload, reuses the Sharp
  pipeline from `/api/upload`, writes back to the same R2 key, bumps
  `uploaded_at`. Returns the unchanged URL.

### 10.9 Image gallery UI at `/admin/images`

- `src/lib/components/admin/ImagesTable.svelte` — thumbnail, key,
  uploaded date, usage count, metadata preview, actions (Copy URL,
  Edit, Replace, Delete).
- Inline metadata edit expands a row with title/alt/caption/credit
  inputs that PATCH the row.
- Replace uses a hidden file input.
- Delete confirm names the referencing posts; if usage > 0, the dialog
  highlights "Replace instead" as the safer primary action.

### 10.10 Cleanup + docs

- Remove the accordion editor from `src/routes/admin/+page.svelte` (now
  an unreachable redirect target). Delete the accordion-specific
  component tests.
- Update SPEC.md (admin section), README.md (API table + route map),
  and append a NOTES.md entry on the same-key replace flow and browser
  caching.

### Checkpoint 10 (overall)

- [x] `npm test` — full suite green (241 tests)
- [x] `npm run check` — 0 errors
- [ ] Manual end-to-end per the plan-file verification list

---

## Phases 11, 11.1, 12 — Inline Edit / Compose (rolled back)

These three phases — per-post inline Edit, the rail-chrome split, and
the inline "+ New post" composer on the feed — were built (commits
`efa8c24`, `5875b3c`) and then reverted in commit `7d50b6f`
("Clean up code and frontend").

**Why rolled back.** Plain links to `/admin/posts/[slug]` and
`/admin/posts/new` proved sufficient in practice. The inline affordances
added per-component state, multiple bindable props on `PostForm`, and a
parallel render path inside `FeedItem` — overkill for the editing volume
involved, and a maintenance tax on every future change to the public
read view.

**What survives:**

- `PostForm.svelte` keeps `imageModalOpen` / `submitting` / `saved` as
  bindable props (harmless), the slug input (used by Phase 13's rename),
  and the Insert-image modal flow.
- `ImageUploadModal.svelte` stays in use from the standalone admin
  edit/create pages.
- `FeedItem.svelte` is back to a simple `{ item, rail? }` component; the
  single-post page uses the `rail` snippet to inject an admin "Edit" link
  when `page.data.admin` is true.
- Tests were rewritten in the same sweep to describe the simpler
  components (see commit history around the rollback).

**Lesson logged in NOTES.md:** inline editing is a feature whose cost
shows up later — in test churn and prop sprawl — not at first sight.

---

## Phase 13 — Slug Redirect Ledger

**Goal:** Cool URIs don't change — but when they have to, they redirect. A
`slug_redirects` table records every old path a post used to live at; the
single-post route loader consults it on 404 and issues a 301 to the post's
current canonical URL.

### Design decisions (locked before coding)

- **Store the whole path tuple**, not just the slug. Columns are
  `(old_year, old_month, old_day, old_slug)` so a date correction is the same
  mechanism as a slug rename. `UNIQUE` on the tuple; the most recent claim wins
  via `ON CONFLICT DO UPDATE SET post_id = excluded.post_id`.
- **Rows point to `post_id`, not to a path string.** Renaming again automatically
  fixes prior redirects because they resolve through the post — no chain
  walking, no UPDATE fan-out. Rename loops are impossible by construction.
- **Cascade on post delete.** `ON DELETE CASCADE` removes ledger rows when the
  target post goes away. Better an honest 404 than a redirect into the void.
- **Ledger writes happen in `updatePost`**, inside the same logical operation
  as the slug/date change. Can't end up with a renamed post and no redirect.
- **Slug collisions on rename are a route-layer concern.** `updatePost` trusts
  its input; the PATCH handler pre-checks uniqueness and returns 409 with a
  clear error before calling into the DB layer.
- **Initial publish never writes a ledger row** — the old URL never existed.
- **Live route always wins.** If a new post takes a slug that's also in the
  ledger, the live route is served; the stale ledger row becomes unreachable
  but does no harm.
- **Date editing is in scope for the schema** (we store the full tuple) but
  out of scope for the UI in this phase — only slug edits get an input. The
  ledger is forward-compatible if/when a date input is added.

### Files

- `migrations/002_slug_redirects.sql` *(new)* — the table + index.
- `src/lib/db.ts` — extend `PostUpdate` with `slug?: string` and
  `created_at?: number`; have `updatePost` write a `slug_redirects` row when
  either changes; add `getPostByOldPath({ year, month, day, slug })` for the
  route loader; add `slugTaken(slug)` helper used by the PATCH route's
  collision check.
- `src/lib/schemas.ts` — add `slug` (optional, slugified-format) to
  `postUpdateSchema`.
- `src/routes/api/post/[slug]/+server.ts` — handle the rename branch:
  validate, check collision (409), forward to `updatePost`.
- `src/routes/[year]/[month]/[day]/[slug]/+page.server.ts` — on 404, consult
  `getPostByOldPath`; if hit, `redirect(301, permalink(post))`.
- `src/lib/components/admin/PostForm.svelte` — slug input visible only in
  `edit` mode; help text warns "Changing this leaves a 301 redirect behind."
- Tests next to each touched source file.

### 13.1 — Migration + DB ledger functions

#### Red → Green cycles

`migrations/002_slug_redirects.sql` (covered via `src/lib/db.test.ts`):
```
test: slug_redirects table exists with expected columns
test: UNIQUE constraint on (old_year, old_month, old_day, old_slug)
test: deleting a post cascades to its slug_redirects rows
test: migration is idempotent against an existing db (runs once, version bumps)
```

`recordSlugRedirect(oldPath, postId)` *(internal helper)*:
```
test: inserts a row when none exists
test: same tuple + same post_id → no-op (no extra row, no error)
test: same tuple + different post_id → row's post_id is updated (last claim wins)
```

`getPostByOldPath({ year, month, day, slug })`:
```
test: returns the hydrated post when a ledger row points to it
test: returns null when no ledger row matches
test: returns null when the ledger row's post has been deleted (cascade gone)
```

`slugTaken(slug)`:
```
test: returns true when a post exists with that slug
test: returns false when no post exists with that slug
test: does not consider ledger rows (only live posts)
```

`updatePost` rename branch:
```
test: passing the same slug → no ledger row written
test: passing a different slug → posts.slug updated, ledger row records OLD tuple
test: passing a new created_at → posts.created_at updated, ledger row records OLD tuple
test: passing both new slug AND new created_at → single ledger row with OLD tuple
test: caller is responsible for collision check (db.ts does not enforce uniqueness)
test: existing body/title/url/tags update behaviour unchanged
```

#### Checkpoint 13.1

- [x] `npm test` — 15 new db tests green; full db suite at 69 tests passing.
- [ ] `npx tsx scripts/init-db.ts` against an existing `posts.db` — migration
      applies, `PRAGMA user_version` bumps to 2, no data loss. *(manual)*

### 13.2 — Schema + PATCH route

#### Red → Green cycles

`postUpdateSchema` (in `src/lib/schemas.test.ts`):
```
test: accepts optional slug matching /^[a-z0-9-]+$/
test: rejects slug with spaces, uppercase, or other invalid chars
test: accepts optional created_at as positive integer (ms epoch)
```

`PATCH /api/post/[slug]` (in `src/routes/api/post/[slug]/edit.test.ts`):
```
test: rename to an unused slug → 200 + { ok, slug: newSlug }
test: rename to slug already used by another post → 409 + { error }
test: rename to the same slug → 200, no-op (no ledger row)
test: rename + body update in one request → both applied, ledger written
test: created_at update writes ledger row for old date
test: unchanged created_at → no ledger row
test: invalid slug format → 400 (zod)
```

#### Checkpoint 13.2

- [x] `npm test` — 4 new schema tests + 6 new PATCH tests green; existing PATCH
      suite updated to match `{ ok, slug }` response shape and still passes.

### 13.3 — Route loader lookup on 404

#### Red → Green cycles

`src/routes/[year]/[month]/[day]/[slug]/page.server.test.ts`:
```
test: live post at correct path → returns post (unchanged behaviour)
test: live post at wrong date → 301 to canonical (unchanged behaviour)
test: no live post but ledger hit → 301 to current canonical URL of target post
test: ledger hit but target post deleted → 404 (cascade removed the row)
test: no live post, no ledger hit → 404
test: ledger lookup uses ALL four path parts, not just slug
  (a renamed post with the same slug at a different date does not match)
```

#### Checkpoint 13.3

- [x] `npm test` — 4 new loader tests green; existing 3 still pass.

### 13.4 — Admin UI: slug input on edit

#### Red → Green cycles

`PostForm.svelte.test.ts`:
```
test: create mode → no slug input rendered
test: edit mode → slug input rendered, prefilled with current slug
test: edit mode → help text mentions redirect behaviour
test: changing slug → PATCH payload includes new slug
test: 409 response → form shows "That slug is already in use" inline
```

#### Checkpoint 13.4

- [x] `npm test` — 6 new PostForm slug-input tests green; one existing
      positional `pre-fills inputs` test was migrated to label-based selectors
      so the new slug input doesn't shift sibling positions.
- [ ] `npm run check` — Phase-13 surface introduces no new type errors; 8
      pre-existing errors from the in-progress Phase 11/12 UI work remain.

### Checkpoint 13 (overall)

- [x] `npm test` — Phase-13 surface (34 new tests) all green; no regressions
      to previously-passing tests. (The 32 pre-existing failures from the
      unfinished Phase 11/12 UI work are unrelated to Phase 13.)
- [x] `npm run check` — Phase-13 code introduces no new type errors.
- [ ] Manual browser pass (per CLAUDE.md feedback memory):
  - rename a published post via `/admin/posts/[slug]`; visit the OLD URL →
    301 lands on the new canonical URL.
  - try to rename to a slug already used by another post → inline error,
    no DB change.
  - delete the renamed post → old URL now 404s (no orphan redirect).
  - confirm date-mismatch redirect still works on a non-renamed post.

---

## Phase 14 — Image Lightbox

Clicking an `<img>` inside a post body should expand it into a centered
lightbox sized to fit a 90vw × 90vh box (the image keeps its aspect ratio,
so portrait and landscape both fit). The animation runs from the image's
in-document position to the lightbox using the FLIP technique (First →
Last → Invert → Play). Clicking the image, clicking the backdrop, or
pressing Escape returns the image to its place.

All post body HTML is rendered through `FeedItem.svelte` (used by the home
feed, single-post permalink, and tag feed routes), so this is a single
component to touch. Images are stored at one size (Sharp 1600px WebP), so
the lightbox enlarges the same `<img>` rather than swapping sources.

### Files

- New: `src/lib/components/Lightbox.svelte`
- New: `src/lib/components/Lightbox.svelte.test.ts`
- Modified: `src/lib/components/FeedItem.svelte` (delegated click handler
  on `.body`, lightbox state, source-image hide via `data-lightbox-source`)
- Modified: `src/lib/components/FeedItem.svelte.test.ts`

### Red → Green cycles

`Lightbox.svelte.test.ts`:
```
test: renders <img> with given src and alt
test: clicking the image calls onClose
test: clicking the backdrop calls onClose
test: Escape keydown calls onClose
test: dialog has role="dialog" and aria-modal="true"
test: prefers-reduced-motion: reduce → mounts directly in "open" phase
```

`FeedItem.svelte.test.ts` additions:
```
test: clicking an <img> inside .body opens the lightbox (role=dialog)
test: clicking an <img> nested in an <a> does not open the lightbox
test: after onClose, the dialog is removed from the document
```

Implementation notes:

- Target size: compute `targetW × targetH` from `naturalWidth/Height` and
  `window.innerWidth/Height * 0.9`. Width-limited vs height-limited
  decides which axis hits 90vw or 90vh.
- FLIP: render the lightbox `<img>` `position: fixed` at its target size,
  apply an inverse translate+scale on the first frame, then transition to
  `transform: translate(-50%, -50%)` for the playing phase.
- `happy-dom` does not implement layout, so unit tests assert on phase
  class names (`is-opening`, `is-open`) rather than measured transforms.
  The actual animation is verified by hand.
- Lock body scroll (`overflow: hidden` on `documentElement`) while open
  so the source rect can't drift under the close animation.
- Honor `prefers-reduced-motion: reduce` by skipping the opening phase.

### Checkpoint 14

- [x] `npm test` — 9 new tests (7 Lightbox + 3 FeedItem additions for
      a total of 294/294 green); no regressions.
- [x] `npm run check` — 0 errors, 0 warnings across 1016 files.
- [x] Manual browser pass (Playwright):
  - Home feed: landscape image (1600×1200) opened to 966×724.5 at
    viewport 1200×805 (height-limited to 90vh, aspect preserved).
  - Portrait image (1200×1600) opened to 543.375×724.5 (also
    height-limited, width 0.75×).
  - Escape, backdrop click, and image click all close cleanly; on close
    `html.style.overflow` is restored and the `data-lightbox-source`
    marker is removed so the source image is visible again.
  - Resize to 600×900 while open → image rescaled to 540×720
    (width-limited at the narrower viewport) in place, no glitch.
  - `/2026/05/16/0fc950b1` permalink and `/tag/kitchen` both open the
    lightbox correctly (shared FeedItem).
  - Image wrapped in `<a>` (DOM-injected): click triggered link
    navigation, the lightbox did not open.
  - FLIP confirmed via MutationObserver: first frame applied
    `translate(calc(-50% - 104px), calc(-50% + 63px)) scale(0.555)`
    (inverse of source rect), next frame `translate(-50%, -50%)`. CSS
    `transition: transform 280ms` animates between.
  - `prefers-reduced-motion: reduce` short-circuit covered by
    `Lightbox.svelte.test.ts` rather than browser emulation.

### Potential future upgrades

Captured here so the ideas aren't lost; not in scope for Phase 14.

- Multi-image gallery with arrow-key navigation between images in the
  same post.
- Pinch-to-zoom inside the lightbox.
- Higher-resolution variant served on open. Would require revisiting the
  Sharp pipeline in `src/routes/api/upload/+server.ts` to emit a second
  variant and threading the alternate URL through `Post.body`.
- Visible caption rendered from `alt` text inside the lightbox UI. The
  `aria-label` already carries it for assistive tech, so this is a pure
  visual-design decision.

---

## Phase 15 — RSS Feed

**Goal:** A full-text RSS 2.0 feed at `/feeds/posts.xml`, generated with the
`feed` library. Each item carries `content:encoded` with the rendered post
HTML. For link posts, `<link>` points to the external URL while `<guid>` is
the canonical permalink — readers identify entries by permalink even when the
click-through is external.

Files touched:
- `package.json` — add `feed` runtime dep
- `src/routes/feeds/posts.xml/+server.ts` — new endpoint; exports `GET` and
  a `_buildFeed(posts, siteUrl)` helper (underscore prefix is required by
  SvelteKit's `+server.ts` export validator)
- `src/routes/feeds/posts.xml/posts.test.ts` — unit tests covering all three
  post types
- `src/app.html` — `<link rel="alternate" type="application/rss+xml">` for
  reader auto-discovery
- `.env.example` — add `SITE_URL` with the canonical origin as default
- `static/` — newly created directory; favicon and any other static assets
  land here

### Red → Green cycles

#### Endpoint contract
```
test: GET returns 200 with Content-Type: application/rss+xml; charset=utf-8
test: emits an RSS 2.0 channel skeleton (xml prolog, <rss>, <channel>, <title>)
test: handles an empty post list (no <item>, channel still valid)
```

#### Post-type rendering (the requirements)
```
test: link post — <link> is external URL, <guid> is the permalink
test: titled post — <link> and <guid> are both the permalink
test: plain post (null title) — date-derived <title>, permalink for link + guid
test: full-text content as HTML in content:encoded (marked output round-trips)
test: items appear in the order getPosts() returned (newest first)
test: trailing slash in SITE_URL is normalised
test: tags emitted as <category> elements
```

### Design decisions

- **Site origin is an env var, not `event.url.origin`.** Behind a reverse
  proxy (Caddy), the request origin reported to adapter-node is whatever
  proxy-header config the adapter is given — by default just
  `http://localhost:3000`. RSS items need absolute URLs that don't drift
  with the request, so the feed reads `$SITE_URL` (default
  `https://compostmodernism.org`).
- **`_buildFeed` over `GET` for testability.** The `_` prefix is mandatory:
  SvelteKit's route-export validator rejects anything else at request time.
  See NOTES.md for the gotcha — vitest + svelte-check both let
  non-prefixed exports through.
- **Full-text feed.** No truncation; `marked` is already rendering the same
  HTML for the on-site post pages, so the bytes are identical.
- **`<guid isPermaLink="false">`.** The `feed` library sets this attribute
  automatically when `guid` is passed explicitly. The permalink IS a real
  URL, but treating the GUID as opaque identity (not a fetchable link) is
  the safer convention — readers won't try to refetch the permalink to
  resolve duplicates, they'll just match the string.

### Checkpoint

- [x] All 10 new tests green
- [x] Full suite green (308 tests pass)
- [x] `npm run check` clean
- [x] Manual browser pass: `curl /feeds/posts.xml` returns 200 with seeded
      posts; the link post (`Why I love Svelte`) carries
      `<link>https://svelte.dev/blog/runes</link>` paired with
      `<guid>…/why-i-love-svelte</guid>`
- [x] `<link rel="alternate" …>` present on `/` and single-post pages
- [ ] Favicon dropped into `static/favicon.png` (user-supplied)

---

## Deferred Follow-ups

Items punted from earlier phases. Address before final deploy unless noted.

- **npm audit triage (Phase 1, resolved 2026-05-20):** `npm audit fix`
  in May 2026 bumped `svelte` (SSR XSS via spread attributes, ReDoS,
  DOM clobbering, promise serialization) and `devalue` (DoS via
  sparse-array deserialization) — both runtime-reachable, both fixed
  in-range. A follow-up branch (`deps-vite-vitest-upgrade`) then took
  the semver-major bumps: `vite 5 → 8`, `vitest 1 → 4`,
  `@vitest/coverage-v8 1 → 4`, `@sveltejs/vite-plugin-svelte 4 → 7`,
  clearing the dev-server CORS (esbuild) and path-traversal (vite)
  advisories. Cookie is held at `^0.7.0` via a `package.json#overrides`
  block — SvelteKit 2 still ships the older transitive pin, and the
  override is the upstream-recommended workaround until SvelteKit 3.
  `npm audit` now reports 0 vulnerabilities.
- **Script runtime (from Phase 3):** Decide between `tsx` at runtime vs a
  pre-compile step for `scripts/*.ts` in the Docker image. Resolve in Phase 8.
  (Less urgent than before — the server's own boot path runs migrations via
  `createDb()`, so `scripts/init-db.ts` is only needed for one-off CLI use.)
