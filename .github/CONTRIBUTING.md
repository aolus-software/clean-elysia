# Contributing

Thanks for considering a contribution. This repository is a **starter template**, so changes are
judged by whether most projects built on it would benefit — not by whether they are useful in one
specific application.

## Before you start

Read these first; they are the source of truth for how code is written here:

- **`CLAUDE.md`** — bootstrap order, layering, the plugin chain, and the non-obvious behaviours worth
  knowing (DI registration, worker boot via `@bull`, the error → status mapping).
- **`.claude/rules/`** — area-scoped standards. Read the matching one before you touch that area:
  - `shared-code.md` — which `src/libs/<bucket>/` a shared thing belongs in, and the barrel rule
  - `modules.md` — the three-file feature module (`index.ts`, `schema.ts`, `service.ts`)
  - `repositories.md` — the factory-function repository shape and `tx?: DbTransaction`
  - `openapi.md` — the route metadata that generates `/docs`
  - `queue.md` — BullMQ queue/worker pairs under `src/bull/`
  - `di.md` — when to use the container instead of a direct import
- **`docs/`** — `CONFIGURATION.md` (env vars), `PLUGINS.md`, `ERROR_HANDLING.md`, `SECURITY.md`,
  `API_DOCUMENTATION.md`, `DEPLOYMENT.md`.
- `.github/copilot-instructions.md` has extended code-style examples that mirror the rules above.

For anything larger than a bug fix, open an issue first so the design can be agreed before you spend
time on it.

## Local setup

The runtime is **Bun**, not Node. Always use `bun run` / `bunx` — never `npm`, `pnpm`, or `yarn`.

```bash
git clone https://github.com/aolus-software/clean-elysia.git
cd clean-elysia
bun install
cp .env.example .env          # then fill in secrets
docker compose up -d postgres redis   # Postgres 18 + Redis 7 (add clickhouse if you need it)
make db-migrate               # apply migrations
make db-seed                  # superuser@example.com / password
make dev
```

The API listens on `APP_PORT` (default 3000). The Scalar API reference is at `/docs` (spec at
`/docs/openapi.json`) whenever `NODE_ENV` is not `production`.

Useful commands — every `make` target wraps the matching `bun run` script:

```bash
make help             # every available target
bun run dev           # hot-reload dev server
bun run lint          # eslint . --ext .ts,.js
bun run lint:fix
bun run format        # prettier --write .
bun run format:check  # prettier --check . (what CI runs)
bun run typecheck     # tsc --noEmit
bun run build         # bun build of src/index.ts
make db-generate      # drizzle-kit generate
make db-migrate       # drizzle-kit migrate
make db-push          # drizzle-kit push (dev only)
make db-studio        # drizzle-kit studio
make db-seed
make fresh            # db-drop + db-push + db-seed (dev only, destroys data)
make reset            # db-generate + db-migrate + db-seed
```

There is **no test runner configured**. Don't add `bun test` commands to docs or CI unless you are
also adding the tests and the runner in the same PR.

### Running the whole stack in Docker

```bash
make docker-up        # docker compose up -d --build
make docker-migrate   # build the migrator target and run migrations on the compose network
make docker-seed
make docker-logs      # tail app logs
make docker-ps
make docker-down
make docker-deploy    # git pull + build + up + migrate (server deploy)
```

`docker-migrate` derives the network name from the directory name
(`<dir>_app_network`); if you renamed the directory, pass `DOCKER_NETWORK=...`. Keep `.env` values
**unquoted** — `docker run --env-file` passes quotes literally. Inside compose, use service
hostnames (`postgres`, `redis`, `clickhouse`), not `localhost`.

## Coding standards

The full set is in `.claude/rules/`. The parts that come up most:

- **Style** — tabs, double quotes, semicolons, unix linebreaks (Prettier). Imports are sorted by
  `eslint-plugin-simple-import-sort`; let `bun run lint:fix` order them.
- **Types** — TypeScript `strict`, plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`. `no-explicit-any` is an **error**. Prefix intentionally-unused
  parameters with `_`.
- **Promises** — `no-floating-promises` is an error. Always `await` or `void`.
- **Logging** — never `console.*`; use the structured `log` (pino) from `@utils`. The only exceptions
  are the boot banners that already carry `eslint-disable-next-line`.
- **Path aliases** — `@base`, `@bull`, `@cache`, `@config`, `@database`, `@default`, `@errors`,
  `@guards`, `@mailer`, `@plugins`, `@repositories`, `@types`, `@utils`, `@modules`. Import from the
  bucket root, not a deep file, and never with a relative path that climbs out of a module.
- **File naming** — kebab-case, with the suffixes `.repository.ts`, `.service.ts`, `.plugin.ts`,
  `.config.ts`, and the fixed `schema.ts` inside modules.
- **Layering** — route `index.ts` handles HTTP only; `service.ts` owns business logic, transactions,
  cache invalidation, and queue dispatch; repositories own SQL and nothing else. Routes never import
  `db`; repositories never hash passwords, touch the cache, or open a transaction the caller did not
  supply.
- **Services are plain objects**, not classes. Repositories are **factory functions** invoked at each
  call site (`await UserRepository().findByEmail(email)`) — never destructured once at module scope.
- **Responses** — wrap successes in `ResponseToolkit.success(...)` / `.created(...)`; throw error
  classes from `@errors` for failures. Never set `set.status = 4xx` and return a payload — let
  `ErrorHandlerPlugin` map it.
- **Authorization** — apply guards in `beforeHandle`
  (`PermissionGuard.canActivate(user, ["user list"])`), never inline in the handler. Permission
  strings match the seeded RBAC data.
- **OpenAPI** — every route needs its TypeBox schemas, a `detail: { summary, description }`, and a
  `response: commonResponse(Schema, { include: [...] })` listing every status code it can really
  return. Public modules set `security: []` in the module `detail`.
- **Env** — never read `process.env` directly. Add the variable to the envalid schema in
  `src/libs/config/env.config.ts`, expose it through a `@config` object, and document it in
  `.env.example` and `docs/CONFIGURATION.md`.
- **i18n** — no hardcoded user-facing strings. Add the key to **both**
  `src/libs/i18n/locales/en.json` and `id.json`, then run `bun run i18n:keys` and commit the
  regenerated keys.

## Adding a feature module

1. Create `src/modules/<name>/{index.ts,schema.ts,service.ts}` — exactly those three files.
2. In `index.ts`: `new Elysia({ prefix: "/<name>", detail: { tags: [...] } }).use(baseApp)`, adding
   `.use(AuthPlugin)` for protected routes (don't use both on the same instance).
3. Register the module in `src/modules/index.ts` (or its group parent, e.g.
   `src/modules/settings/index.ts`).
4. New repositories go in `src/libs/repositories/` and must be re-exported from that folder's
   `index.ts`.
5. Register the service in `src/bootstrap.ts` only if something needs to `container.resolve(...)` it
   (see `.claude/rules/di.md` — direct imports are the norm).

## Database changes

Edit the schema in `src/libs/database/postgres/schema/`, then:

```bash
make db-generate   # writes a new migration into src/libs/database/postgres/migrations/
make db-migrate    # applies it
# or: make reset   # generate + migrate + seed
```

Commit the generated migration files. CI runs `bun run db:generate` and **fails if it produces a
diff** in `src/libs/database/postgres/migrations/`, then runs `db:migrate`, `drizzle-kit check`, and
`drizzle-kit introspect` against a real Postgres service.

Never hand-edit a migration that has already been applied. Review every generated migration for
destructive operations before committing. Most tables are soft-deleted — new read paths must start
from `isNull(<table>.deleted_at)`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), lowercase after the colon, imperative
mood, under 72 characters, no trailing period:

```
feat(users): add bulk status update endpoint
fix(auth): correct refresh token expiry handling
docs: document the docker deploy targets
chore: bump elysia to 1.4.28
```

Types used here: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `db`.

> **Warning — the pre-commit hook touches your database.** The Husky `pre-commit` hook runs, in
> order:
>
> ```sh
> bun install
> bun run format
> bun run lint:fix
> bunx drizzle-kit generate
> bunx drizzle-kit migrate
> bun run tsc --noEmit
> bun run build
> ```
>
> Two of those steps — `drizzle-kit generate` and `drizzle-kit migrate` — **write migration files and
> apply them against the `DATABASE_URL` in your `.env`**. Know what that URL points at before you
> commit; never let it point at a shared or production database. `bun install` can also rewrite
> `bun.lock`, and the whole pipeline takes a while.
>
> If you have already run format, lint, typecheck, and build yourself and your change touches no
> schema, `git commit --no-verify` is reasonable.

## Pull requests

1. Branch off `main`.
2. Keep the PR focused — one concern per PR.
3. Fill in the pull request template, including the checklist.
4. Make sure `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run build` pass.
   CI (`.github/workflows/ci.yml`) runs lint, prettier check, typecheck, the Drizzle migration checks
   against a real Postgres service, and the build.
5. Update the docs your change affects **in the same PR** — `README.md`, `CLAUDE.md`, the matching
   `.claude/rules/` file, `docs/CONFIGURATION.md` for new env vars, and the i18n catalogs for new
   strings.

## Reporting bugs and requesting features

Use the issue templates. Usage questions belong in
[Discussions](https://github.com/aolus-software/clean-elysia/discussions), not issues. Security
vulnerabilities go through [SECURITY.md](SECURITY.md) — never a public issue.

## License

By contributing, you agree that your contributions are licensed under the MIT License that covers
this repository.
