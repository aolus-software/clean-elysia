## What does this change?

<!-- One or two sentences. What is different after this PR that was not true before? -->

## Why?

<!-- The problem being solved. Link the issue if there is one: Closes #123 -->

## Type of change

- [ ] `feat` — new feature, module, or endpoint
- [ ] `fix` — bug fix
- [ ] `refactor` — restructuring, no behaviour change
- [ ] `docs` — documentation only
- [ ] `chore` — config, dependencies, tooling
- [ ] `db` — schema or migration change

## Checklist

<!-- The repo's standards live in .claude/rules/ and CLAUDE.md. Consult the relevant rule before ticking. -->

- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (see `.github/CONTRIBUTING.md`).
- [ ] `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run build` pass locally.
- [ ] Layering respected: route `index.ts` (HTTP only) → `service.ts` (logic, transactions, cache, queue dispatch) → repository (SQL only). Routes never import `db` (`.claude/rules/modules.md`, `.claude/rules/repositories.md`).
- [ ] Shared code lives in the right `src/libs/<bucket>/` and is re-exported from that bucket's `index.ts` barrel; no relative imports across modules (`.claude/rules/shared-code.md`).
- [ ] Imports use path aliases (`@base @bull @cache @config @database @default @errors @guards @mailer @plugins @repositories @types @utils @modules`), never `../../libs/...`.
- [ ] No `any` (`no-explicit-any` is an error); explicit return and parameter types; unused params prefixed `_`.
- [ ] Every promise is `await`ed or `void`ed (`no-floating-promises` is an error).
- [ ] No `console.*` — used the structured `log` from `@utils` (pino).
- [ ] New/changed routes declare `body` / `query` / `params` TypeBox schemas from the module's `schema.ts`, and every field has a `description` and `examples` (`.claude/rules/openapi.md`).
- [ ] New/changed routes declare `response: commonResponse(...)` / `commonPaginatedResponse(...)` with an `include` array listing **every** status code the route can actually return, plus `detail: { summary, description }`.
- [ ] Successful responses go through `ResponseToolkit.success(...)` / `.created(...)`; failures `throw` an error class from `@errors` — no hand-crafted envelopes, no `set.status = 4xx` + return.
- [ ] Authorization is applied in `beforeHandle` via `PermissionGuard.canActivate(user, [...])` / `RoleGuard.canActivate(...)`, never inline in the handler. Public modules set `security: []` in the module `detail`.
- [ ] New module registered in `src/modules/index.ts` (or its group parent); new repository re-exported from `src/libs/repositories/index.ts`.
- [ ] Any service that must resolve from the DI container is registered in `src/bootstrap.ts` with a unique camelCase key (`.claude/rules/di.md`).
- [ ] New queue/worker pairs share a queue name and payload type, reuse `RedisClient.getQueueRedisClient()`, and re-throw on failure so BullMQ retries (`.claude/rules/queue.md`).
- [ ] New user-facing strings added to **both** `src/libs/i18n/locales/en.json` and `id.json`, with `bun run i18n:keys` re-run and the generated keys committed.
- [ ] Any new env var added to `src/libs/config/env.config.ts` (envalid), surfaced through a `@config` object, and added to `.env.example` and `docs/CONFIGURATION.md` — never read `process.env` directly.
- [ ] Docs my change makes wrong are fixed **in this PR** (`README.md`, `CLAUDE.md`, `docs/`, the matching `.claude/rules/` file).

## Database changes

<!-- Delete this section if the PR touches no schema. -->

- [ ] Schema edited in `src/libs/database/postgres/schema/`.
- [ ] Migration generated and applied with `make db-generate` + `make db-migrate` (or `make reset`), and the generated files in `src/libs/database/postgres/migrations/` are committed — CI fails if `bun run db:generate` produces a diff.
- [ ] No already-applied migration was hand-edited.
- [ ] Migration reviewed for destructive operations (dropped columns, narrowed types, lost data).
- [ ] Soft-deleted rows still filtered — reads start from `isNull(<table>.deleted_at)`.
- [ ] Seed data in `src/libs/database/postgres/seed/` updated if the new shape needs it.

## How was this tested?

<!--
There is no test runner configured in this repo, so say what you actually exercised:
commands run, endpoints hit, request/response bodies observed. "It builds" is not testing.
-->

## Screenshots or output

<!-- Optional: request/response bodies, /docs screenshots, worker logs. -->
