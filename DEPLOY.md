# First-Deploy Action Items

Bootstrap checklist for the initial deploy to cornhill. Once everything
is green, this file can be archived or left as historical context.

---

## 1. Generate the deploy SSH key (laptop)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/cornhill_deploy -N "" -C "gha-deploy@compostmodernism"
```

- `-N ""` = passphraseless (required for CI).
- Files land at `~/.ssh/cornhill_deploy` (private) and
  `~/.ssh/cornhill_deploy.pub` (public).

## 2. Authorize the public half on cornhill

```bash
ssh cornhill 'cat >> ~/.ssh/authorized_keys' < ~/.ssh/cornhill_deploy.pub
```

Then `ssh cornhill` and edit `~/.ssh/authorized_keys` to prepend
restrictions to the new line so a leaked secret can't be repurposed:

```
no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... gha-deploy@compostmodernism
```

Verify:

```bash
ssh -i ~/.ssh/cornhill_deploy cornhill 'whoami && hostname'
```

## 3. Add three GitHub Secrets

Repo settings → Secrets and variables → Actions → New repository secret.

| Name | Value |
|---|---|
| `VPS_HOST` | Hostname or IP that `ssh cornhill` resolves to (see `~/.ssh/config`). |
| `VPS_USER` | Username on cornhill. |
| `VPS_SSH_KEY` | `cat ~/.ssh/cornhill_deploy` — the **private** key, full BEGIN→END text. |

## 4. Set up `.env` on cornhill

```bash
ssh cornhill
cd ~/sites/compostmodernism.org
git fetch origin && git checkout main && git pull
cp .env.example .env
nano .env
```

Fill in `POST_SECRET`, `ADMIN_PASSWORD`, and all four `R2_*` values
(same values as your local `.env`).

## 5. Mount the Caddyfile in the gateway (one-time)

Add this line under `services.caddy.volumes:` in
`~/gateway/docker-compose.yml`:

```yaml
- ~/sites/compostmodernism.org/Caddyfile:/etc/caddy/sites/compostmodernism.org.caddy:ro
```

Then:

```bash
cd ~/gateway && docker compose up -d
```

## 6. DNS

Confirm `compostmodernism.org` (A record) points at cornhill's IP.
If using Cloudflare's proxy (orange cloud), set SSL mode to
**Full (strict)** so Caddy can issue its own Let's Encrypt cert.

### Short-URL alias: `cmpst.org`

Per-post short URLs are served via the alias domain `cmpst.org`. The app
itself only ever handles requests on `compostmodernism.org` — Cloudflare
rewrites the host at the edge, so no Caddyfile changes are needed.

1. **Add `cmpst.org` as a zone in Cloudflare**, update the registrar
   (Hover) nameservers to Cloudflare's assigned pair.
2. **Placeholder DNS record** so the zone has something to attach rules to.
   `A cmpst.org 192.0.2.1` (RFC 5737 test address), proxied (orange cloud).
   The address is never reached — the redirect rule fires first.
3. **Single Redirect rule** (Rules → Redirect Rules → Create):
   - **When incoming requests match**:
     `(http.host eq "cmpst.org" and starts_with(http.request.uri.path, "/p/"))`
   - **Then**: Dynamic redirect, expression
     `concat("https://compostmodernism.org", http.request.uri.path)`,
     status `301`, Preserve query string: on.
4. **Apex catch-all** (recommended): a second rule for
   `http.host eq "cmpst.org"` (any path) → `https://compostmodernism.org`
   so visiting the bare short domain doesn't 404.
5. **SSL/TLS mode**: `Full (strict)`, matching the main zone.

## 7. Bootstrap the app container

```bash
cd ~/sites/compostmodernism.org
touch posts.db
docker compose up -d
```

The first `createDb()` call inside the running container applies all
pending migrations. `scripts/init-db.ts` is available for explicit CLI
seeding but isn't required.

## 8. First real deploy

Push `main` to GitHub. The Actions workflow runs build + test + deploy.
Watch the Actions tab for failures; SSH logs surface at the "Run deploy
script over SSH" step.

## 9. Smoke test

- `https://compostmodernism.org` loads over TLS.
- Sign in at `/admin` — login + post list render.
- Upload an image via `/admin` — succeeds, URL is reachable.
- Edit and save a post — change persists.
- `docker logs compostmodernism` is quiet.

## 10. Import the Sanity backlog (one-time)

Run on cornhill after the deploy that ships migration `004` (it applies on boot).
The imported posts land as drafts, so the live site doesn't change until step 7.

1. Add `SANITY_PROJECT`, `SANITY_DATASET` and `SANITY_TOKEN` (a read-only
   **Viewer** token) to `.env` on cornhill, then `docker compose up -d` so the
   container picks them up. The `R2_*` values are already there.
2. `@sanity/client` is a devDependency and the image prunes dev deps. Don't use
   `npm install --no-save @sanity/client` here: npm sees the package already
   declared in `package.json`, reports "up to date", and installs nothing. Install
   it into a scratch directory and copy over only the packages that are missing.
   The copy lasts until the next redeploy, which is what you want:
   ```
   docker exec -i compostmodernism sh <<'EOF'
   rm -rf /tmp/sc && mkdir /tmp/sc && cd /tmp/sc
   npm init -y >/dev/null 2>&1 && npm install @sanity/client >/dev/null 2>&1
   cd node_modules
   for d in *; do
     case "$d" in
       @*) mkdir -p "/app/node_modules/$d"
           for s in "$d"/*; do [ -e "/app/node_modules/$s" ] || cp -r "$s" "/app/node_modules/$s"; done ;;
       *)  [ -e "/app/node_modules/$d" ] || cp -r "$d" "/app/node_modules/$d" ;;
     esac
   done
   cd /app && node -e 'import("@sanity/client").then(() => console.log("client ok"))'
   rm -rf /tmp/sc
   EOF
   ```
   Expect `client ok`.
3. Back up first, and confirm the file exists before continuing. This takes a
   snapshot with SQLite's own backup API, which is safe while the app is running
   (it is a separate, pre-import copy; the nightly `export-and-backup.ts` zip is
   not a substitute):
   ```
   docker exec -i compostmodernism node - <<'EOF'
   const D = require('better-sqlite3');
   const out = '/app/archive/posts.pre-sanity-import-' + new Date().toISOString().replace(/[:.]/g, '-') + '.db';
   new D('posts.db', { readonly: true }).backup(out).then(() => {
     const b = new D(out, { readonly: true });
     console.log(out, b.pragma('integrity_check', { simple: true }), 'posts', b.prepare('select count(*) n from posts').get().n);
   });
   EOF
   ls -l archive/
   ```
   Expect `ok` and the post count you started with.
4. Dry run, then the real import. Call `tsx` directly: the `npm run` aliases pass
   `--env-file=.env`, and the container has no `.env` file (Compose injects the
   variables).
   ```
   docker exec compostmodernism npx tsx scripts/import-sanity.ts --dry-run
   docker exec compostmodernism npx tsx scripts/import-sanity.ts
   ```
   The image ledger is empty here, so every image and PDF is re-uploaded to the
   same R2 keys (identical bytes, harmless but slow). Posts whose slug already
   exists are skipped, never overwritten.
5. Validate:
   ```
   docker exec compostmodernism npx tsx scripts/validate-import.ts
   ```
   Expect all passed, 0 failed.
6. Spot-check that drafts are hidden: a draft permalink such as
   `/2025/01/06/clip` should 404 and not appear in `/` or `/feeds/posts.xml`.
7. Publish: `docker exec compostmodernism npx tsx scripts/publish-drafts.ts`
   (`--dry-run` to preview, `--before YYYY-MM-DD` to publish in stages).
8. Remove the `SANITY_*` lines from `.env` and revoke the token in the Sanity
   console.

If it goes wrong, restore `posts.db` from the zip taken in step 3.

---

## After everything works

- Add the nightly cron on cornhill. The log lives in the home directory because
  cron runs as `allan`, who can't create files in `/var/log`; if the redirect
  fails, the shell never starts `docker exec` and nothing is logged.
  ```
  mkdir -p /home/allan/logs
  0 3 * * * docker exec compostmodernism npx tsx scripts/export-and-backup.ts >> /home/allan/logs/compostmodernism-backup.log 2>&1
  ```
  (The `mkdir` is a shell command; only the `0 3 * * *` line goes in the crontab.)
  Then run the job once by hand and confirm `archive/YYYY-MM-DD.zip` exists and
  R2 has `backups/YYYY-MM-DD.zip`.
- Set a Cloudflare R2 lifecycle rule expiring `backups/` after 90 days.

---

## Migrating cornhill to a fresh host (Ubuntu 18.04 → 24.04)

The old Linode is Ubuntu 18.04 (EOL) on Docker 18.09 with 1 GB RAM / 25 GB disk.
Rather than hop four LTS releases in place, build a new 24.04 Linode (2 GB / 50 GB,
same region), move the state across, flip DNS, and keep the old box powered off as
the rollback. Nothing on the old host changes until step 3.

### 0. Before touching anything

- [ ] Linode Backups snapshot of the old host is **complete** (not just started).
- [ ] The latest `archive/YYYY-MM-DD.zip` exists and R2 has the matching
  `backups/` object. This is the restore path if everything else goes wrong.
- [ ] allanlasser/co-op.computer#62 is ready to merge (all checks green): it pins
  the compose project name to `coop` and moves the deploy path and commands to
  `~/sites/co-op.computer` / `docker compose`. The server's uncommitted drift was
  checked: its `docker-compose.prod.yml` matches #62 apart from the pin, and
  `Caddyfile.prod` is byte-identical to `main`'s, so nothing needs committing.
- `~/sites/allanlasser.com` is an older copy; that site is hosted on Vercel and
  is not migrated.

### 1. Build the new host (old host stays live)

1. Create the Linode: Ubuntu 24.04 LTS, 2 GB, 50 GB, same region, your SSH key.
2. As root: create `allan` with `sudo` and your key, set the hostname to
   `cornhill`, then disable password and root SSH login
   (`PasswordAuthentication no`, `PermitRootLogin no`).
3. `ufw`: default deny incoming; allow `22/tcp`, `80/tcp`, `443/tcp`, `443/udp`.
   Docker's published ports bypass `ufw` through its own iptables chain, so
   publish only what the gateway needs.
4. `unattended-upgrades` on. Cap logs: `SystemMaxUse=200M` in
   `/etc/systemd/journald.conf`, and `{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}`
   in `/etc/docker/daemon.json`. The old host's `/var/log` had grown to 2.6 GB.
5. Install Docker Engine from Docker's apt repository (`docker-ce`, `docker-compose-plugin`,
   `docker-buildx-plugin`) and add `allan` to the `docker` group.
6. `docker network create web`.
7. `docker login ghcr.io` with a token that has `read:packages`, so the co-op
   images pull.
8. Clone both repos into `~/sites/` (`compostmodernism.org`, `co-op.computer`) and
   copy `~/gateway/` across. Stream the secrets host to host, never printing them,
   and compare `sha256sum` on both ends: `compostmodernism.org/.env` and
   `co-op.computer/.env.production` (mode 600).
9. Edit the gateway's `docker-compose.yml` mount for the co-op Caddyfile to
   `/home/allan/sites/co-op.computer/Caddyfile.prod`.
10. **Server → GitHub.** `deploy.sh` and the co-op workflow run `git pull` on the
    host, so it needs read access. Generate one ed25519 key per repo
    (`~/.ssh/compostmodernism_deploy`, `~/.ssh/coop_deploy`, no passphrase), add each
    public half under the repo's Settings → Deploy keys with write access **off**
    (GitHub accepts a given key on only one repo), and give each repo an
    `~/.ssh/config` alias (`github-compostmodernism`, `github-coop`) with
    `IdentitiesOnly yes`. Point each checkout's `origin` at its alias and confirm
    `ssh -T git@<alias>` greets the right repo.
11. **CI → server.** Copy the GitHub Actions lines from the old host's
    `~/.ssh/authorized_keys` (`github-actions-*`, `gha-deploy@compostmodernism`) to
    the new host's, options intact. Without them Actions cannot SSH in. After the
    first deploys, check `/var/log/auth.log` for which fingerprints are used and
    drop the rest.

### 2. Rehearse the restore (old host still live)

Restore into the new host while the old one keeps serving. This proves the data
moves and the backup is restorable before you depend on either.

- co-op: start only `postgres`, stream `pg_dump -Fc` from the old container into
  `pg_restore --clean --if-exists --no-owner` on the new one, and compare exact
  row counts per table. Make the comparison fail on empty input; an
  empty-vs-empty `diff` passes.
- Volumes (`coop_backend_media`, `coop_backend_static`, `gateway_caddy_data`):
  create them with Compose's labels
  (`--label com.docker.compose.project=<proj> --label com.docker.compose.volume=<name>`),
  stream `tar` through an Alpine container (`:ro` on the old side), then compare a
  `sha256sum` over every file.
- compostmodernism: unzip `posts.db` from the latest `archive/*.zip`, run
  `PRAGMA integrity_check`, and confirm the post count matches the live site.
- Start the gateway, `redis`, `backend`, `frontend` and the app, then test with
  `curl --resolve`. `curl` verifies the certificate chain, so a 200 also proves the
  restored certs are valid.
- **Do not start `celery-worker` or `celery-beat`, and do not run
  `export-and-backup.ts`.** The celery services run on a schedule with the real
  Mailgun key and could send newsletters twice; the backup job would overwrite
  today's `backups/` object in R2 with the rehearsal database.
- `/robots.txt` is a 404 at the origin and 200 on the live site: Cloudflare injects
  its managed robots.txt at the edge. It is not a regression.

### 3. Cutover (a short maintenance window)

On the **old** host:

1. Snapshot the compostmodernism database with SQLite's backup API (same snippet
   as §10 step 3, writing to `archive/posts.cutover.db`) so the copy is
   consistent, then `docker compose stop` in `~/sites/compostmodernism.org`.
2. co-op: dump Postgres, then stop the stack:
   ```
   docker exec coop-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > coop.dump
   ```
   Archive the media and static volumes:
   ```
   for v in coop_backend_media coop_backend_static gateway_caddy_data; do
     docker run --rm -v $v:/v -v "$PWD":/b alpine tar czf /b/$v.tgz -C /v .
   done
   ```
   `gateway_caddy_data` carries the issued certificates, so the new gateway doesn't
   have to reissue them.

Copy `coop.dump`, the three tarballs, `posts.cutover.db` (as `posts.db`) and
`archive/` to the new host with `rsync`. On the **new** host:

3. Create and fill the volumes (names must match exactly; the gateway declares
   `coop_backend_static` and `coop_backend_media` as `external: true`):
   ```
   for v in coop_backend_media coop_backend_static; do docker volume create $v; done
   ```
   Unpack each tarball into its volume with the reverse `docker run ... tar xzf`.
   Restore `gateway_caddy_data` the same way into the volume the gateway compose
   file creates (`docker compose up --no-start` first).
4. `docker compose up -d postgres` in `~/sites/co-op.computer`, wait until healthy,
   then `pg_restore --clean --if-exists -U ... -d ... < coop.dump`.
5. Bring everything up: the gateway, then co-op, then compostmodernism. Use
   `docker compose`, not `docker-compose`. Start `celery-worker` and `celery-beat`
   only now, after every container on the old host is stopped.
6. Before touching DNS, test the new host directly:
   ```
   curl --resolve compostmodernism.org:443:<NEW_IP> https://compostmodernism.org/ -I
   curl --resolve co-op.computer:443:<NEW_IP> https://co-op.computer/ -I
   ```
   Then run the §9 smoke test against it.
7. Flip DNS: in Cloudflare, point the A records for `compostmodernism.org`,
   `www`, and `co-op.computer` at the new IP. (`cmpst.org` points at a
   placeholder address and doesn't change.)
8. Point CI at the new host, in this order:
   1. Set `VPS_HOST` to the new IP in both GitHub repos.
   2. On the new host, put the co-op checkout on `main`
      (`git checkout -B main origin/main`). Its `origin` pull would otherwise try
      to merge `main` into the feature branch. Do **not** delete
      `Caddyfile.prod` first: it is already tracked and identical, and the
      gateway bind-mounts it (see NOTES.md for what deleting it does).
   3. Merge co-op.computer#62; its deploy job is the first end-to-end check of the
      new host.
   4. Merge the PR that changes `scripts/deploy.sh` to `docker compose` here. Before
      this, a push to `main` here would deploy to the host with the old command.
9. Reinstall the one cron job from "After everything works" above. Run it by hand
   and confirm the zip and the R2 object.

**Rollback:** point DNS back at the old IP and `docker compose start` the stacks
on the old host. Nothing there was modified.

### 4. Decommission (one week later)

- Power off the old Linode for a week and watch for surprises. Then delete it, the
  Backups snapshot, and the `cornhill` entry in `~/.ssh/config` (or repoint it).
- Retired on purpose, not migrated: `icecast2` (unreachable, blocked by `ufw`),
  `nginx` (installed but not running), `certbot` (Caddy issues certificates),
  and `scripts/langoliers.rb` (silent since June 2022). Revoke the Twitter/X API
  keys that were hardcoded in it.
