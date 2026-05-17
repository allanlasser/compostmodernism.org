# First-Deploy Action Items

Bootstrap checklist for the initial deploy of `blog-engine` to cornhill.
Once everything green, this file can be archived or left as historical
context.

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
git fetch origin && git checkout blog-engine && git pull
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

## 7. Bootstrap the app container

```bash
cd ~/sites/compostmodernism.org
touch posts.db
docker compose run --rm app npx tsx scripts/init-db.ts
docker compose up -d
```

## 8. First real deploy

Push `blog-engine` to GitHub. The Actions workflow runs build + test
+ deploy. Watch the Actions tab for failures; SSH logs surface at the
"SSH + git pull + docker compose up" step.

## 9. Smoke test

- `https://compostmodernism.org` loads over TLS.
- Sign in at `/admin` — login + post list render.
- Upload an image via `/admin` — succeeds, URL is reachable.
- Edit and save a post — change persists.
- `docker logs compostmodernism` is quiet.

---

## After everything works

- Flip GHA trigger from `blog-engine` to `main`
  (`.github/workflows/deploy.yml:5`).
- Merge `blog-engine` → `main`.
- Add the nightly cron on cornhill:
  ```
  0 3 * * * docker exec compostmodernism npx tsx scripts/export-and-backup.ts >> /var/log/compostmodernism-backup.log 2>&1
  ```
- Set a Cloudflare R2 lifecycle rule expiring `backups/` after 90 days.
