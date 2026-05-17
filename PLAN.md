# compostmodernism.org — Implementation Plan

Red-green TDD with vitest throughout. Each phase ends with a checkpoint: all tests pass and the feature is manually verified before moving on.

---

## Conventions

- **Red** — write the failing test first
- **Green** — write the minimum code to pass it
- **Refactor** — clean up without breaking tests
- **Language:** TypeScript by default. Source files are `.ts`, components use `<script lang="ts">`, tests are `.test.ts`. `svelte.config.js` conventionally stays `.js` (toolchain loads it pre-TS); `vite.config.ts` includes `/// <reference types="vitest" />` so the `test` key is typed.
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

## Deferred Follow-ups

Items punted from earlier phases. Address before final deploy unless noted.

- **npm audit (from Phase 1):** `npm install` at scaffold time reported 13
  vulnerabilities (3 low, 10 moderate), all transitive through SvelteKit/Vite
  tooling. Run `npm audit` and triage before Phase 8. If anything reachable from
  runtime code is affected, upgrade or pin; dev-only advisories can be
  documented and deferred.
- **Script runtime (from Phase 3):** Decide between `tsx` at runtime vs a
  pre-compile step for `scripts/*.ts` in the Docker image. Resolve in Phase 8.
  (Less urgent than before — the server's own boot path runs migrations via
  `createDb()`, so `scripts/init-db.ts` is only needed for one-off CLI use.)
