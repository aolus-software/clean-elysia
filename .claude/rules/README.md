# Project Rules

Coding rules for the `clean-elysia` codebase (Bun + Elysia + Drizzle + PostgreSQL). Each file is a
focused, enforceable contract — read the relevant one before writing code in that area.

Rules here carry **no** frontmatter; the scope is stated in the table below and in each file's
opening line.

## Always in scope

These apply to **every** change, regardless of which files it touches. Read them first.

| Rule | Scope |
| ---- | ----- |
| [contradiction-halt.md](./contradiction-halt.md) | A request that contradicts a rule, the architecture, or a security invariant is reported and halted — never silently implemented or worked around. Lists the issues already on record |
| [documentation.md](./documentation.md) | A doc your change makes wrong is fixed in the **same** change; lists every doc that must stay in sync |
| [audit-findings.md](./audit-findings.md) | How an audit finding is written: five blocks, plain language, severity by consequence, CONFIRMED vs SUSPECT — the writing contract for [`/audit-flow`](../commands/audit-flow.md) |

## Layer rules

| Rule | Applies to |
| ---- | ---------- |
| [modules.md](./modules.md) | `src/modules/<name>/` — the three-file layout (`index.ts` routes, `schema.ts` TypeBox, `service.ts` plain object), `baseApp` / `AuthPlugin` composition, guards in `beforeHandle` |
| [repositories.md](./repositories.md) | `src/libs/repositories/*.repository.ts` — factory functions, optional `tx?: DbTransaction`, the `isNull(<table>.deleted_at)` soft-delete filter, sort allow-listing |
| [shared-code.md](./shared-code.md) | `src/libs/<bucket>/` — which bucket a thing belongs in, the alias table, barrel exports, and the no-cross-module-imports rule |
| [di.md](./di.md) | `src/libs/plugins/core/container.ts` and `src/bootstrap.ts` — when to reach for the DI container instead of a direct import, and where registration lives |

## Cross-cutting concerns

| Rule | Applies to |
| ---- | ---------- |
| [openapi.md](./openapi.md) | Route `detail` metadata, TypeBox schemas, and `commonResponse(..., { include })` — the spec is generated from route declarations by `DocsPlugin`, never hand-written |
| [queue.md](./queue.md) | `src/bull/` — one queue and one worker per file, the shared Redis connection, typed payloads, and re-throwing so BullMQ retries |

## How to use

- These rules complement `CLAUDE.md` — they don't replace it.
- When a rule conflicts with `CLAUDE.md`, the **rule file wins** (it is more specific).
- Don't introduce a new pattern without updating the relevant rule first — that is
  [documentation.md](./documentation.md), and a new rule must be added to this index.
- Slash commands live in [`../commands/`](../commands/): `/commit` and `/audit-flow` (the latter
  governed by [audit-findings.md](./audit-findings.md)).

## Not covered by a rule yet

Patterns that exist in the code but have no written rule. Worth knowing before you assume the
codebase is silent on them:

- **Errors and responses** — `ResponseToolkit.success/created` for success, throw
  `BadRequestError` / `UnprocessableEntityError` / `NotFoundError` / `UnauthorizedError` /
  `ForbiddenError` / `RateLimitError` from `@errors` for failure, mapped by `ErrorHandlerPlugin`.
  The sibling `clean-elysia-prisma` has this written up as `errors-and-responses.md`.
- **Validation** — TypeBox schema conventions beyond what [openapi.md](./openapi.md) covers.
- **Imports and naming** — alias order, file suffixes, symbol casing. Currently only described in
  `CLAUDE.md`.
- **Plugins** — naming and composition order for `src/libs/plugins/`.
- **Commits** — the Conventional Commit workflow lives in [`../commands/commit.md`](../commands/commit.md)
  rather than a rule file.
