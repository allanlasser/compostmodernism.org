# compostmodernism.org

## Project Overview

A monorepo for the next-generation personal publishing system, inspired by zettelkasten, Kottke.org, and others. Core feature: "The Heap" — a Tumblr-style blog for quickly posting links, highlights, and notes.

### Technologies
- Docker (service management)
- NGINX (web server)
- Postgres (database)
- Drizzle (TypeScript ORM)
- SvelteKit + TypeScript (frontend)
- Storybook (component design)
- Markdown (content, docs)
- GitHub Actions (CI/CD)
- Vanilla CSS (styling)

### Key Decisions
- Monorepo structure
- Lucia authentication (with Drizzle/Postgres)
- Media storage: deferred
- Vanilla CSS for styling

## Implementation Plan

### 1. Project Structure & SvelteKit Scaffold
- [x] Create monorepo directories: `apps/`, `packages/`, `infra/`
- [x] Scaffold SvelteKit app in `apps/web` (with TypeScript, Prettier, ESLint, Node adapter, Drizzle/Postgres, Lucia, Storybook)
- [x] Add initial Storybook setup
- [x] Document all steps in this README

### 2. Web Server & Deployment
- [x] Add Dockerfile for SvelteKit app (Node server) in `apps/web/Dockerfile`
- [x] Add production-ready NGINX config in `infra/nginx/nginx.conf`
- [x] Add docker-compose.yml for production at project root (orchestrates SvelteKit app, Postgres, NGINX)
- [x] Add docker-compose.yml for local dev (already present in apps/web)
- [x] Set up environment variables and secrets for production using `.env.production` (SvelteKit) and `infra/db.env` (Postgres)
- [ ] Prepare GitHub Actions workflow for CI/CD and deployment to Linode VPS
- [ ] Document deployment process in README

## Deployment Process

1. **Build and push your code to your Linode VPS**
   - Use `git` to clone or pull the latest code to your VPS, or use `rsync`/`scp` to copy files.

2. **Set up environment variables and secrets**
   - Ensure `apps/web/.env.production` and `infra/db.env` are present and contain production values. Never commit secrets to a public repo.

3. **Build and start the stack with Docker Compose**
   - From the project root on your VPS, run:
     ```sh
     docker compose up --build -d
     ```
   - This will build the SvelteKit app, start the Node server, Postgres, and NGINX.

4. **Verify the deployment**
   - Visit your domain or server IP in a browser. NGINX should proxy requests to the SvelteKit app.
   - Check logs with:
     ```sh
     docker compose logs -f
     ```

5. **Update the stack**
   - Pull new code, rebuild, and restart:
     ```sh
     git pull
     docker compose up --build -d
     ```

### SSL (HTTPS) with Let's Encrypt
   - Use Let's Encrypt/certbot to generate SSL certificates:
     ```sh
     sudo systemctl stop nginx  # or stop any service using port 80
     sudo docker compose down   # if NGINX is running in Docker
     sudo certbot certonly --standalone -d compostmodernism.org
     ```
   - Certificates will be saved in `/etc/letsencrypt/live/compostmodernism.org/`.
   
   - Restart the stack:
     ```sh
     docker compose up --build -d
     ```
   - Your site will now be available over HTTPS.
   - To renew certificates, run:
     ```sh
     sudo certbot renew
     ```
   - (Optional) Set up a cron job for automatic renewal (Certbot usually does this by default).

### Continuous Deployment with GitHub Actions
   - This project uses GitHub Actions to automate deployment to the Linode VPS on every push to `main`.
   - The workflow is defined in `.github/workflows/deploy.yml` and:
     - Connects to the server via SSH using a private key stored in GitHub Secrets (`VPS_SSH_KEY`).
     - Runs the following commands on the server:
       - `docker-compose down`
       - `git pull`
       - `docker-compose up --build -d`
   - To set up:
     1. Generate an SSH key pair on your local machine:
        ```sh
        ssh-keygen -t ed25519 -C "github-actions-deploy"
        ```
     2. Add the public key to your server's `~/.ssh/authorized_keys`.
     3. Add the private key as the `VPS_SSH_KEY` secret in your GitHub repo.
     4. Add your server's IP and username as `VPS_SSH_HOST` and `VPS_SSH_USER` secrets.
     5. On every push to `main`, the workflow will deploy the latest code automatically.

## Environment Variables & Secrets

- SvelteKit app secrets are stored in `apps/web/.env.production`. Example:

  ```env
  DATABASE_URL=postgres://root:mysecretpassword@db:5432/compost
  LUCIA_SECRET=replace_this_with_a_secure_random_string
  NODE_ENV=production
  PORT=3000
  ```

- Postgres credentials are stored in `infra/db.env` and loaded by docker-compose. Example:

  ```env
  POSTGRES_USER=root
  POSTGRES_PASSWORD=mysecretpassword
  POSTGRES_DB=compost
  ```

- Both `.env.production` and `infra/db.env` are gitignored by default. Never commit production secrets to a public repository.

### 3. Database & ORM
- [ ] Set up Postgres in Docker
- [ ] Add Drizzle ORM to SvelteKit app
- [ ] Define `Clip` and `Source` models

### 4. Basic Features
- [ ] Public feed page for clips
- [ ] Protected route for adding new clips (JWT auth)

## References
- [allanlasser.com](https://github.com/allanlasser/allanlasser.com)
- [co-op.computer](https://github.com/allanlasser/co-op.computer)
- [A Working Library](https://aworkinglibrary.com)
- [Maggie Appleton](https://maggieappleton.com/)
- [Simon Willison](https://simonwillison.net)

---

_This README is the project memory. All major decisions, plans, and context should be captured here._
