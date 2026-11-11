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
cd ~/gateway && docker-compose up -d
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
docker-compose up -d
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
3. Back up first, and confirm the file exists before continuing. Don't use
   `scripts/export-and-backup.ts` for this until #13 is fixed (it fails on a
   missing `adm-zip`). SQLite's own backup API is safe while the app is running:
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

- Add the nightly cron on cornhill:
  ```
  0 3 * * * docker exec compostmodernism npx tsx scripts/export-and-backup.ts >> /var/log/compostmodernism-backup.log 2>&1
  ```
- Set a Cloudflare R2 lifecycle rule expiring `backups/` after 90 days.
