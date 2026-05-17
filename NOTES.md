# Development Notes

Gotchas, conventions, and lessons collected while building this codebase. New
entries go on top.

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
