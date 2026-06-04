# Bun + Elysia — multi-stage. Runs from source (Bun resolves tsconfig paths).
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# ===================================================
# Stage 1: Install dependencies (cached on lockfile)
# ===================================================
FROM base AS install
# dev deps (drizzle-kit, types, ...) — used by the dev image and migrations
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
# --ignore-scripts: skips the "prepare" lifecycle (husky install) — git hooks
# don't exist inside an image, and husky is a devDependency anyway.
RUN cd /temp/dev && bun install --frozen-lockfile --ignore-scripts

# prod-only deps — used by the release image
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production --ignore-scripts

# ===================================================
# Stage 2: Development (hot reload)
# ===================================================
FROM base AS development
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
ENV NODE_ENV=development
EXPOSE 3000/tcp
CMD ["bun", "run", "dev"]

# ===================================================
# Stage 3: Migrator (drizzle-kit needs dev deps)
#   docker build --target migrator -t clean-elysia:migrator .
#   docker run --rm --env-file .env clean-elysia:migrator
# ===================================================
FROM base AS migrator
COPY --from=install /temp/dev/node_modules node_modules
COPY src ./src
COPY tsconfig.json package.json drizzle.config.ts ./
ENV NODE_ENV=production
ENTRYPOINT ["bun", "run", "db:migrate"]

# ===================================================
# Stage 4: Production release (app only, prod deps)
# ===================================================
FROM base AS release
ENV NODE_ENV=production
COPY --from=install /temp/prod/node_modules node_modules
# Source + the files Bun needs to resolve aliases. No build step: src/index.ts
# is the entry and honours APP_CLUSTER_MODE / APP_REUSE_PORT at runtime.
COPY src ./src
COPY tsconfig.json package.json drizzle.config.ts ./
# pino writes to storage/logs/ relative to cwd — must exist and be writable
# by the non-root `bun` user.
RUN mkdir -p storage/logs && chown -R bun:bun storage

USER bun
EXPOSE 3000/tcp
ENTRYPOINT ["bun", "run", "src/index.ts"]
