# syntax=docker/dockerfile:1.6

# ─── Builder ────────────────────────────────────────────────────────────────
# Compiles native deps (better-sqlite3, sharp) and runs the SvelteKit build.
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ vips-dev

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# ─── Runtime ────────────────────────────────────────────────────────────────
# Slim runtime — copies compiled deps + bundle from builder, no toolchain.
FROM node:20-alpine AS runtime
WORKDIR /app

# libvips runtime — sharp needs it even with prebuilt binaries on alpine
RUN apk add --no-cache vips

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY migrations/ ./migrations/

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "build/index.js"]
