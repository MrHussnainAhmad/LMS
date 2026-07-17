FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Dedicated lightweight runtime for the receipt-only worker. It intentionally
# retains TypeScript tooling so it can execute the existing shared source directly.
FROM deps AS push-receipt-worker
WORKDIR /app
COPY . .
ENV NODE_ENV production
CMD ["./node_modules/.bin/tsx", "scripts/push-receipt-worker.ts"]

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Install postgresql-client for pg_isready.
RUN apk add --no-cache postgresql-client

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
# Copy schema and config for migrations
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/drizzle.config.ts ./

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Overlay only the migration packages into the standalone app's real
# node_modules directory, so Node can resolve Drizzle Kit's dependencies.
COPY --from=deps /app/node_modules/@drizzle-team/ ./node_modules/@drizzle-team/
COPY --from=deps /app/node_modules/@esbuild-kit/ ./node_modules/@esbuild-kit/
COPY --from=deps /app/node_modules/@esbuild/ ./node_modules/@esbuild/
COPY --from=deps /app/node_modules/drizzle-kit/ ./node_modules/drizzle-kit/
COPY --from=deps /app/node_modules/drizzle-orm/ ./node_modules/drizzle-orm/
COPY --from=deps /app/node_modules/esbuild/ ./node_modules/esbuild/
COPY --from=deps /app/node_modules/tsx/ ./node_modules/tsx/
COPY --from=deps /app/node_modules/get-tsconfig/ ./node_modules/get-tsconfig/
COPY --from=deps /app/node_modules/resolve-pkg-maps/ ./node_modules/resolve-pkg-maps/
COPY --from=deps /app/node_modules/pg/ ./node_modules/pg/
COPY --from=deps /app/node_modules/pg-cloudflare/ ./node_modules/pg-cloudflare/
COPY --from=deps /app/node_modules/pg-connection-string/ ./node_modules/pg-connection-string/
COPY --from=deps /app/node_modules/pg-int8/ ./node_modules/pg-int8/
COPY --from=deps /app/node_modules/pg-pool/ ./node_modules/pg-pool/
COPY --from=deps /app/node_modules/pg-protocol/ ./node_modules/pg-protocol/
COPY --from=deps /app/node_modules/pg-types/ ./node_modules/pg-types/
COPY --from=deps /app/node_modules/pgpass/ ./node_modules/pgpass/
COPY --from=deps /app/node_modules/postgres-array/ ./node_modules/postgres-array/
COPY --from=deps /app/node_modules/postgres-bytea/ ./node_modules/postgres-bytea/
COPY --from=deps /app/node_modules/postgres-date/ ./node_modules/postgres-date/
COPY --from=deps /app/node_modules/postgres-interval/ ./node_modules/postgres-interval/
COPY --from=deps /app/node_modules/split2/ ./node_modules/split2/
COPY --from=deps /app/node_modules/xtend/ ./node_modules/xtend/
COPY --from=deps /app/node_modules/buffer-from/ ./node_modules/buffer-from/
COPY --from=deps /app/node_modules/source-map/ ./node_modules/source-map/
COPY --from=deps /app/node_modules/source-map-support/ ./node_modules/source-map-support/

# Copy entrypoint
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
# Normalize Windows CRLF line endings so Alpine can interpret the script's shebang.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

ENTRYPOINT ["/bin/sh", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
