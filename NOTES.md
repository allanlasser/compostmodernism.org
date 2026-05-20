# Development Notes

Gotchas, conventions, and lessons collected while building this codebase. New
entries go on top.

---

## Helpers exported from `+server.ts` must start with `_`

Vitest happily imports `buildFeed` from a `+server.ts` file and the test
suite goes green — but the first real request to that route 500s with
`Invalid export 'buildFeed'`. SvelteKit only allows the HTTP method
handlers (`GET`, `POST`, …), a small set of config exports
(`prerender`, `trailingSlash`, `config`, `entries`, `fallback`), or
*anything prefixed with `_`*. The validator runs at request time, not
build time and not at type-check, so neither `npm test` nor `npm run
check` catches it.

Convention for this codebase: any helper you want to keep colocated in
the route file but also import from a test — prefix it with `_` and
re-alias on import (`import { _buildFeed as buildFeed } from './+server'`).

Caught during Phase 15 (RSS feed) on the manual browser pass. Reinforces
the standing rule that UI/route work isn't done until you've hit the
route in a browser.

---

## Inline editing was a tax we couldn't justify

Phases 11, 11.1, and 12 added per-post inline Edit and an inline "+ New post"
composer to the public feed. Two commits in (`efa8c24`, `5875b3c`), the cost
shape became obvious: `FeedItem` carried two render paths (read view + form),
`PostForm` grew five extra props (`onCancel`, `hideActions`, `formId`, plus
bindable `imageModalOpen` / `submitting` / `saved`), and the home page held
mutable feed state seeded via `untrack` to survive prop refreshes. Every
public-route component had to know about admin mode.

Commit `7d50b6f` ripped it out. Hosts now just link to
`/admin/posts/[slug]` and `/admin/posts/new`. The standalone admin pages
already render a `<PostForm>` and already handle every edge case (validation,
slug rename, delete, image upload). For the volume of editing this site sees,
one extra click is not a problem worth that much code.

If you find yourself reaching for inline editing again: measure the editing
volume first, and budget for the test churn (the rollback deleted ~7
component tests that were specifically about admin-aware rendering).

---

## Slug redirects point to `post_id`, not to a path string

`slug_redirects` rows store `(old_year, old_month, old_day, old_slug, post_id)`
and the route loader resolves the *current* canonical URL by joining through to
`posts` and calling `permalink(post)`. This is deliberate, and there's a
tempting wrong alternative worth being explicit about.

The wrong alternative is to store a destination path string (e.g.
`new_path: '/2026/05/19/greetings'`). It seems simpler — the loader can just
return the stored string — but it makes successive renames painful:
`foo → bar → baz` requires either walking the chain at request time (with a
loop guard for cycles) or running an UPDATE across every prior ledger row
each time you rename. Both are extra moving parts that can drift.

Pointing at `post_id` makes the chain collapse automatically: every redirect
through any old slug resolves to the post's *current* path via a single JOIN.
Cycles are impossible by construction (you can't follow a chain that doesn't
exist).

The trade is one extra JOIN per redirect lookup — cheap, and only on the 404
path. The lookup is indexed on the full tuple, so misses (the common case for
real 404s) are also cheap.

If you ever consider switching to path-string storage, re-read this and the
"chains" section of PLAN.md §Phase 13 first.

---

## Keep `node:*` imports out of any module the client may import

`src/lib/slug.ts` used to `import { createHash } from 'node:crypto'` for
`hashSlug()`. That was fine while `slug.ts` was only imported by server
code (db.ts, route loaders). Once Phase 11/12 made `slugify` and
`permalink` reachable from a `.svelte` component (for client-side
post-save updates and inline composing), Vite's client bundler tried to
include the whole module — `node:crypto` got externalized — and the
browser console showed:

> Module "node:crypto" has been externalized for browser compatibility.
> Cannot access "node:crypto.createHash" in client code.

The fix is to split: any module that may be imported from a `.svelte`
component must stay browser-safe. `hashSlug` now lives in `src/lib/hash.ts`
(Node-only, imported only by `db.ts`); `src/lib/slug.ts` is pure JS that
works in either environment.

When importing helpers into a Svelte component, eyeball the source: if
it has a top-level `node:*` import, it doesn't belong in client code
without a split.

---

## `+page.server.ts` and `+server.ts` reject unknown named exports

SvelteKit validates the exports of every `+page.server.ts`, `+layout.server.ts`,
and `+server.ts` module against a fixed whitelist. Anything else throws at
request time as `Error: Invalid export 'X' in src/routes/.../+page.server.ts`,
which surfaces as a generic 500 because SvelteKit hides the underlying
message in production-style responses.

Allowed unprefixed exports:

- `+page.server.ts` / `+layout.server.ts`: `load`, `actions`, `prerender`,
  `csr`, `ssr`, `trailingSlash`, `config`, `entries`.
- `+server.ts`: the HTTP method handlers (`GET`, `POST`, …), plus `prerender`,
  `csr`, `ssr`, `trailingSlash`, `config`, `entries`, `fallback`.

Anything else **must** be prefixed with `_` — those are treated as private
and skipped by the validator. Example we hit during Phase 10: a `PER_PAGE`
constant exported from `+page.server.ts` so tests could import it. The fix
is to rename to `_PER_PAGE` and update the test imports; SvelteKit then
leaves it alone. Validation only fires when the request actually hits the
route, so this is invisible in `npm test` (which imports the module
directly) and `npm run check` — only manual browser navigation surfaces it.

### Diagnosing the generic 500

Vite's dev log doesn't print these errors by default, and the response body
is just `{"message":"Internal Error"}`. To see the underlying exception,
add a `handleError` hook temporarily:

```ts
// src/hooks.server.ts
export const handleError: HandleServerError = ({ error, event }) => {
  console.error('[handleError]', event.url.pathname, error);
  return { message: 'Internal Error' };
};
```

Hit the failing route, read the dev-server log, then remove the hook.

---

## Image replace overwrites the same R2 key — beware browser/CDN caches

`POST /api/images/[id]/replace` uploads new bytes to the **same** R2 key as
the existing image. This is deliberate: the public URL is unchanged, so every
post that already references the image in its markdown body keeps working
without any rewrite. It's why the gallery's "Replace" action is the safe
default when an image is referenced by posts.

The tradeoff: browsers, intermediate caches, and any CDN in front of R2 may
keep serving the **old** bytes for as long as the response was cached. R2's
public bucket sets `ETag` from the object's MD5, so a conditional request
will revalidate — but a fresh GET that hits a cached copy won't notice the
swap.

Practical implications:

- After a replace, hard-refresh (Cmd-Shift-R) any page that displays the
  image before deciding whether the new bytes look right.
- If you ever put Cloudflare's CDN (or any caching layer) in front of R2,
  purge the affected URL after a replace, or move to versioned keys
  (`?v=<uploaded_at>`) so the URL changes on each replace.

If you genuinely want a *different* URL, use Delete (with `?force=true` if
the image is referenced) and re-upload via `POST /api/upload`, then update
the referencing posts.

---

## Ghost inodes: restart the dev server after wiping `posts.db`

Any workflow that deletes `posts.db` while a long-running process has it open
(e.g. `rm posts.db && tsx scripts/init-db.ts`) produces two files at the same
path. The dev server keeps writing to the *old* one and nothing complains
until you investigate why the UI doesn't reflect what's on disk.

### Why

On Unix-like systems (macOS included), a filename is just a pointer to an
**inode** that holds the actual bytes. `rm` removes the directory entry but
leaves the inode alive as long as any process holds an open file descriptor
on it. The OS only frees the inode when the last reference closes.

What happens during a wipe-and-reseed against a running dev server:

1. The dev server holds an open fd to **inode A** (the original `posts.db`).
2. `rm posts.db` unlinks the name from the directory. Inode A persists,
   reachable only through the server's fd.
3. `tsx scripts/init-db.ts` opens `posts.db` — the OS creates a fresh
   **inode B** because the name is unbound.
4. The seed script writes images + posts to inode B.
5. The dev server keeps writing to inode A through its still-valid fd.
6. The two never sync. They're separate files at "the same path."

Symptom: seed reports success, server reports success, browser shows stale
or empty data, no error appears anywhere.

### Fix

Restart the dev server (Ctrl-C in the terminal running `npm run dev`, then
`npm run dev` again). Killing the process drops the last reference to inode
A, the OS frees it, and the next start opens inode B.

### Broader pattern

Same principle applies to any file a long-running process has open: log
files, config files, SQLite databases, asset bundles. It's why `logrotate`
has `copytruncate` mode (rewrites the inode in place rather than swapping
it) and why most daemons accept `SIGHUP` to re-open their files. If you
must replace a file under a running process, plan to restart it.
