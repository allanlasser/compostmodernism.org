# CLAUDE.md

Working context for Claude Code sessions in this repository.

## Where to look first

- **README.md** — architectural overview of the running app: stack, repo layout,
  data flow, API surface. Start here to orient.
- **SPEC.md** — design document. The intent behind the architecture; consult when
  a change might cross a design boundary.
- **PLAN.md** — phase-by-phase TDD build log. Each phase has red→green test cycles
  and a checkpoint. The convention section at the top is binding.
- **NOTES.md** — gotchas and lessons collected while building. New entries go on
  top. Read before debugging anything that "should work."
- **DEPLOY.md** — one-time bootstrap checklist for the VPS. Not relevant for
  day-to-day work; relevant when standing up a fresh environment.

## Living documents

These five files are not write-once artifacts. They are project memory and
they must stay in sync with the running code. Update them *in the same
commit* as the code change that makes them stale — a follow-up "docs"
commit a week later is how drift starts.

Triggers, by document:

- **PLAN.md** — when starting a new feature, add a phase (or sub-section
  under an existing phase) with the red→green test cycles you intend to
  run and a checkpoint list. PLAN is your working contract before code,
  not a retrospective. Mark checkpoints as you complete them. If the plan
  changes mid-flight, edit the plan rather than letting it diverge silently.
- **SPEC.md** — when the design intent changes (a new post type, a different
  storage boundary, a new auth path), update the relevant SPEC section before
  or alongside the implementation. SPEC answers "why is it this way"; if
  reality and SPEC disagree, future you can't tell which one is the bug.
- **README.md** — when the architecture, stack, repo layout, or API surface
  changes, update the corresponding section. Adding a route means updating
  the API table. Adding a dependency means updating the Stack table.
  Renaming a top-level directory means updating the Repository layout block.
- **NOTES.md** — when you hit a non-obvious failure mode, a surprising
  platform behavior, or a "we tried X and it didn't work because Y" moment,
  add an entry on top. The bar is "would a future session waste time
  rediscovering this?" — if yes, write it down.
- **DEPLOY.md** — when the bootstrap procedure changes (new secret, new
  mount, new one-time command), update the checklist. Also strike through
  or remove steps that no longer apply.
- **CLAUDE.md** (this file) — when a working convention changes or a new
  cross-cutting practice emerges, update it. Keep it tight; everything here
  is loaded into every session.

If a doc update would be large, do it as its own commit *immediately after*
the code commit, with a message that references what made it necessary.
Don't defer.

## Working practices

### Red-green-refactor TDD

Every code change goes test-first. Write a failing test, then the minimum code
to pass it, then refactor without breaking tests. PLAN.md phases are organized
this way and the existing test files (`*.test.ts` next to each source file)
follow the pattern. New work should too.

When a phase has a checkpoint list (PLAN.md), do not begin the next phase until
every box is checked.

### Incremental commits

Prefer small, well-scoped commits over large ones. The git log reads as a
phase-by-phase ledger (slug → db → API → routes → admin → export → Docker) and
should keep reading that way. One logical change per commit. Commit messages
follow the existing style: imperative mood, sentence case, no trailing period
(`git log --oneline` to skim).

Never commit unless the user asks. Never amend; always make a new commit if
something needs fixing.

### TypeScript by default

Source files, test files, and scripts are `.ts`. PLAN.md and SPEC.md sometimes
show `.js` examples — that's leftover from earlier drafts; default to TypeScript.
The one exception is `svelte.config.js`, which stays JS by SvelteKit convention.

### Validation at API boundaries

Every API route handler validates incoming data with `zod.safeParse` before
touching business logic. JSON bodies parse directly; `FormData` bodies go
through `Object.fromEntries` first. Invalid input returns `400` with
`{ error }`. See any file under `src/routes/api/**/+server.ts` for the pattern.

### Tests

- Unit tests live next to source: `src/lib/slug.test.ts`, etc.
- Database tests use `createDb(':memory:')`. Never write to `posts.db` from a test.
- R2 (`@aws-sdk/client-s3`), `sharp`, and `$env/dynamic/private` are mocked at the
  module level using `vi.mock`. Look at `src/routes/api/upload/upload.test.ts`
  for the pattern.
- Component tests use `@testing-library/svelte` with `happy-dom`.
- Run the full suite with `npm test`. It must stay green.

### Schema migrations

Schema lives in `migrations/NNN_*.sql`, applied by `src/lib/migrate.ts` on every
`createDb()` call. **Never edit a committed migration.** Add a new file with the
next numeric prefix. If a change isn't purely additive, update affected query
functions in `db.ts` and their tests in the same commit. See PLAN.md §Schema
Migrations for the full convention.

### Comments and docs

Default to writing no comments. Add one only when the *why* is non-obvious — a
hidden constraint, a workaround, a subtle invariant. Don't narrate *what* the
code does; well-named identifiers handle that. Don't reference the current task
or PR in comments; that context belongs in commit messages and rots in code.

Do not create new markdown files unless asked. If you need to record a lesson,
append to NOTES.md.

## Common commands

```sh
npm run dev       # vite dev server, http://localhost:5173
npm test          # vitest run, full suite
npm run test:watch
npm run check     # svelte-check (TypeScript across .ts and .svelte)
npm run build     # production bundle into build/
npm run seed      # fixture data into posts.db (idempotent)
```

## Gotchas worth knowing up front

- **Restart the dev server after wiping `posts.db`.** Ghost-inode trap; see
  NOTES.md for the full explanation. Symptom: seed succeeds, browser shows
  stale data, no error anywhere.
- **`createDb()` runs migrations every time.** Dev and prod use the same path.
  Restarting the dev server applies any pending migration files.
- **Caddy is not in this project's `docker-compose.yml`.** It runs in a
  separate `~/gateway/` stack on the VPS; this repo's `Caddyfile` is
  bind-mounted in. Local dev does not involve Caddy at all.
- **The admin session cookie value *is* the admin password.** There is no
  sessions table. Checked via `crypto.timingSafeEqual` in `src/lib/auth.ts`.
