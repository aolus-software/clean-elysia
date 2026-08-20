# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

Runtime is **Bun** (not Node). Always prefer `bun run` / `bunx` over `npm`/`pnpm`/`yarn`.

```sh
bun install                  # install deps
bun run dev                  # hot-reload dev server on AppConfig.APP_PORT
bun run build                # bundle ./src/index.ts to dist/index.js (bun target)
bun run start                # run dist/index.js
bun run lint                 # eslint . --ext .ts,.js
bun run lint:fix
bun run format               # prettier --write .
bun run typecheck            # tsc --noEmit (strict; noUnusedLocals/Parameters on)
```

Database (Drizzle, PostgreSQL — schema at `src/libs/database/postgres/schema/index.ts`, migrations at `src/libs/database/postgres/migrations`):

```sh
bun run db:generate          # generate migration from schema diff
bun run db:migrate           # apply pending migrations
bun run db:push              # push schema directly (dev only)
bun run db:studio            # open Drizzle Studio
bun run db:seed              # runs src/libs/database/postgres/seed/index.ts
bun run db:clickhouse:migrate
bun run db:clickhouse:status
```

Combined workflows in the `Makefile`: `make fresh` (db:drop + db:push + db:seed), `make reset` (db:generate + db:migrate + db:seed).

No test runner is configured. Don't invent `bun test` commands unless tests have been added.

## Architecture

### Bootstrap order

1. `src/index.ts` calls `bootstrap()` (from `src/bootstrap.ts`) **before** building the Elysia app. `bootstrap()` registers every service into the DI container (`@plugins` → `container`). Any new service that resolves via `container.resolve(...)` must be registered there.
2. The root `Elysia` instance chains `DocsPlugin` → `ErrorHandlerPlugin` → `bootstraps` (the module tree from `src/modules/index.ts`) → `.listen(AppConfig.APP_PORT)`.
3. `src/base.ts` exports `baseApp` — a named Elysia instance (`name: "base-app"`) that bundles cross-cutting plugins (`RequestPlugin`, `LoggerPlugin`, `PerformancePlugin`, `DiPlugin`, `BodyLimitPlugin`, `SecurityPlugin`). Feature modules `.use(baseApp)` to inherit these. Auth-gated routes additionally `.use(AuthPlugin)`.

### Layering (clean architecture)

Each feature module under `src/modules/<name>/` contains:

- `index.ts` — Elysia route definitions, validation schemas wired in, and guards applied via `beforeHandle`.
- `schema.ts` — TypeBox schemas (`t.Object(...)`) for request/response.
- `service.ts` — business logic exported as a **plain object** with methods (not a class).

Data access lives in `src/libs/repositories/*.repository.ts`. Repositories are **factory functions** that return a methods object and accept an optional `tx?: DbTransaction` so the same method works inside `db.transaction(...)`.

```ts
export const UserRepository = () => {
	const dbInstance = db;
	return {
		getDb: (tx?: DbTransaction) => tx || dbInstance,
		findByEmail: async (email: string) => {
			/* ... */
		},
	};
};
```

Services call `Repository().method(...)` — note the invocation; the factory must be called each time, not destructured once.

### Authorization

`AuthPlugin` (`src/libs/plugins/auth.plugin.ts`) verifies the bearer JWT, loads the user (cache-aside via Redis with `UserInformationCacheKey`), and injects `user: UserInformation` into the route context. Apply per-endpoint authorization in `beforeHandle`:

```ts
beforeHandle: ({ user }) => {
	PermissionGuard.canActivate(user, ["user list"]);
};
```

`PermissionGuard` short-circuits to `true` if the user has the `superuser` role; otherwise every required permission must be present, else `ForbiddenError`. `RoleGuard` lives alongside it in `@guards`.

### Errors and responses

Throw custom errors from anywhere; `ErrorHandlerPlugin` maps them to status codes and the standard JSON shape:

- `BadRequestError` → 400 (carries a `field/message[]` array)
- `UnprocessableEntityError` → 422
- `NotFoundError` (note: import from `elysia` in some places, from `@errors` in others — both are caught)
- `UnauthorizedError` → 401, `ForbiddenError` → 403, `RateLimitError` → 429

Build successful responses with `ResponseToolkit.success(...)` / `.created(...)`. Wrap route response schemas with `commonResponse(schema, { include: [...] })` or `commonPaginatedResponse(...)` from `@utils`; the `include` array lists the status codes that should appear in the OpenAPI spec.

### Background jobs

`src/bull/` holds BullMQ queues (`queue/`) and workers (`worker/`). Importing anything from `@bull` triggers `src/bull/index.ts`, which side-effect-imports the worker registry — so workers boot whenever the module graph touches `@bull`. Mail sending goes through `SendMailQueue`; `AuthMailService` enqueues, the worker consumes.

### Databases

- PostgreSQL via `pg` + Drizzle (`src/libs/database/postgres/index.ts` exports `db`, `schema`, and `DbTransaction`).
- Redis via `ioredis` (`src/libs/database/redis/`), reused for both cache and BullMQ connections.
- ClickHouse is optional; migrations have their own script runner under `src/libs/database/clickhouse/scripts/migrate.ts`.

## Conventions (enforced by ESLint/Prettier)

- **Path aliases** (defined in `tsconfig.json` paths and resolved by Bun directly — no extra resolver). Always prefer the alias over relative paths:
  `@base`, `@bull`, `@cache`, `@config`, `@database`, `@default`, `@errors`, `@guards`, `@mailer`, `@plugins`, `@repositories`, `@types`, `@utils`, `@modules`.
- **Imports** are sorted by `eslint-plugin-simple-import-sort` — let lint:fix handle ordering rather than hand-sorting.
- **Quotes**: double; **semis**: required; **linebreaks**: unix; **indent**: tabs (Prettier-enforced, ESLint indent rule disabled).
- **File suffixes**: `.repository.ts`, `.service.ts`, `.plugin.ts`, `.config.ts`, `schema.ts`. Use kebab-case for filenames.
- `no-console` is a warning; use `log` from `@utils` (pino) for application logging. The only allowed `console.log` lines are the boot banners that already have `eslint-disable-next-line` comments.
- `no-explicit-any` is an error; `no-floating-promises` is an error — always `await` or `void` a returned promise.
- TypeScript `strict` is on plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. Prefix intentionally-unused params with `_`.

## Adding a new feature module

1. Create `src/modules/<name>/{index.ts,schema.ts,service.ts}`.
2. In `index.ts` build `new Elysia({ prefix: "/<name>", detail: { tags: [...] } }).use(baseApp).use(AuthPlugin)` (drop `AuthPlugin` for public endpoints), then chain routes.
3. If the service needs DI resolution, register it in `src/bootstrap.ts`.
4. Add the module to `src/modules/index.ts` so `bootstraps` picks it up.
5. New repositories go in `src/libs/repositories/` and must be re-exported from `src/libs/repositories/index.ts`.

## Project rules

Before touching the corresponding area, read the matching rule file:

- Where shared code lives (`src/libs/<bucket>/`) → `.claude/rules/shared-code.md`
- Feature modules (`index.ts` / `schema.ts` / `service.ts`) → `.claude/rules/modules.md`
- Repositories → `.claude/rules/repositories.md`
- OpenAPI / Swagger / route docs → `.claude/rules/openapi.md`
- BullMQ queues and workers (`src/bull/`) → `.claude/rules/queue.md`
- DI container usage → `.claude/rules/di.md`

## Docs

Deeper references live in `docs/`:

- `docs/CONFIGURATION.md` — env var reference
- `docs/PLUGINS.md` — every plugin's responsibility
- `docs/ERROR_HANDLING.md` — error class → status code matrix
- `docs/SECURITY.md`, `docs/API_DOCUMENTATION.md`

`.github/copilot-instructions.md` has extended code-style examples (repository/service/queue patterns) that mirror the conventions above.
