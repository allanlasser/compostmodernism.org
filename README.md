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
- Custom JWT authentication (with Drizzle/Postgres)
- Media storage: deferred
- Vanilla CSS for styling

## Implementation Plan

### 1. Project Structure & SvelteKit Scaffold
- [x] Create monorepo directories: `apps/`, `packages/`, `infra/`
- [ ] Scaffold SvelteKit app in `apps/web`
- [ ] Add initial Storybook setup
- [ ] Document all steps in this README

### 2. Web Server & Deployment
- [ ] Add Dockerfiles for SvelteKit, Postgres, NGINX
- [ ] Add docker-compose for local dev
- [ ] Prepare GitHub Actions workflow for CI/CD

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
