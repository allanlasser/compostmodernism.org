# Production Dockerfile for SvelteKit (Node adapter)
FROM node:20.14.0-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20.14.0-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.env.production ./.env.production

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "build"]
