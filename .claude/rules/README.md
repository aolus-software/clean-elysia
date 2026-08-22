# Project Rules

Coding rules for the `clean-elysia` codebase (Bun + Elysia + Drizzle + PostgreSQL). Each file is a
focused, enforceable contract — read the relevant one before writing code in that area.

Rules here carry **no** frontmatter; the scope is stated in the table below and in each file's
opening line.

## Always in scope

These apply to **every** change, regardless of which files it touches. Read them first.

| Rule | Scope |
| ---- | ----- |
| [contradiction-halt.md](./contradiction-halt.md) | A request that contradicts a rule, the architecture, or a security invariant is reported and halted — never silently implemented or worked around. Lists the invariants and known sharp edges |
| [documentation.md](./documentation.md) | A doc your change makes wrong is fixed in the **same** change; lists every doc that must stay in sync |
| [audit-findings.md](./audit-findings.md) | How an audit finding is written: five blocks, plain language, severity by consequence, CONFIRMED vs SUSPECT — the writing contract for [`/audit-flow`](../commands/audit-flow.md) |
| [clean-code.md](./clean-code.md) | Formatting, explicit types, no `any`, no `console.*`, comment density |
| [elysia.md](./elysia.md) | Layering (`handler → service → repository`), reuse-before-you-build, config and logging |

## Layer rules

Ordered outside-in, the way a request travels.

| Rule | Applies to |
| ---- | ---------- |
| [modules.md](./modules.md) | `src/modules/<name>/` — the three-file layout (`index.ts` routes, `schema.ts` TypeBox, `service.ts` plain object) and how modules compose |
| [handlers.md](./handlers.md) | `src/modules/<name>/index.ts` — what a route handler may do, the `ResponseToolkit` envelope, the four things every route must declare |
| [handlers-crud.md](./handlers-crud.md) | `src/modules/<name>/index.ts` — the canonical five-route CRUD module and its status codes |
| [validation.md](./validation.md) | `src/modules/<name>/schema.ts` — TypeBox request/response schemas, naming, formats, what never appears in a response |
| [services.md](./services.md) | `src/modules/<name>/service.ts` — plain-object services, transaction ownership, cache invalidation, error vocabulary |
| [services-crud.md](./services-crud.md) | `src/modules/<name>/service.ts` — the canonical five-method CRUD service, which **owns the existence and uniqueness checks** |
| [repositories.md](./repositories.md) | `src/libs/repositories/*.repository.ts` — factory functions, optional `tx?: DbTransaction`, the `isNull(<table>.deleted_at)` soft-delete filter, sort allow-listing |
| [schema.md](./schema.md) | `src/libs/database/postgres/schema/` — Drizzle tables, the three-export enum pattern, relations, the `schema` object registration step, migrations |
| [shared-code.md](./shared-code.md) | `src/libs/<bucket>/` — which bucket a thing belongs in, the alias table, barrel exports, and the no-cross-module-imports rule |
| [di.md](./di.md) | `src/libs/plugins/core/container.ts` and `src/bootstrap.ts` — when to reach for the DI container instead of a direct import, and where registration lives |
| [plugins.md](./plugins.md) | `src/libs/plugins/` — plugin naming, `baseApp` composition order, what a plugin may not do |

## Cross-cutting concerns

| Rule | Applies to |
| ---- | ---------- |
| [rbac.md](./rbac.md) | Authorization — `PermissionGuard` / `RoleGuard` in `beforeHandle`, the seeded permission vocabulary, why an ungated route is open by default |
| [routes.md](./routes.md) | Path composition, verb conventions, and the **live route map** with the guard on every route |
| [errors-and-responses.md](./errors-and-responses.md) | The success envelope, the six error classes and their statuses, and matching `commonResponse(..., { include })` to what a route can really return |
| [openapi.md](./openapi.md) | Route `detail` metadata, tags, `security: []` on public modules — the spec is generated from route declarations by `DocsPlugin`, never hand-written |
| [i18n.md](./i18n.md) | `t()` from `@i18n`, the `en`/`id` catalogues, the generated key type, no hardcoded user-facing strings |
| [mail.md](./mail.md) | Queued mail via `AuthMailService`, templates and their locale variants, `{{var}}` substitution |
| [rate-limiting.md](./rate-limiting.md) | The global limiter inside `SecurityPlugin`, and why its numbers are hardcoded |
| [queue.md](./queue.md) | `src/bull/` — one queue and one worker per file, the shared Redis connection, typed payloads, and re-throwing so BullMQ retries |
| [imports-and-naming.md](./imports-and-naming.md) | Path aliases, import order, file and symbol naming |
| [commit.md](./commit.md) | Conventional Commits, what runs before a commit, what never gets committed |

## How to use

- These rules complement `CLAUDE.md` — they don't replace it.
- When a rule conflicts with `CLAUDE.md`, the **rule file wins** (it is more specific).
- Don't introduce a new pattern without updating the relevant rule first — that is
  [documentation.md](./documentation.md), and a new rule must be added to this index.
- Slash commands live in [`../commands/`](../commands/): `/commit` and `/audit-flow` (the latter
  governed by [audit-findings.md](./audit-findings.md)).

## Known tensions between these rules

Recorded deliberately rather than resolved by fiat, because resolving it is a code change. Raise it
rather than picking a side silently — [contradiction-halt.md](./contradiction-halt.md).

- **The status code for a uniqueness conflict is not uniform.** `role` and `permission` throw
  `UnprocessableEntityError` (422); `user` throws `BadRequestError` (400) for a duplicate email. The
  sibling `clean-elysia-prisma` uses 400 for all three. Both are defensible, and the `include` arrays
  on the affected routes already match whichever one each module throws — so aligning them is a
  public API change plus an OpenAPI change, not a cleanup. Preserve the module's existing class;
  raise the question rather than deciding it in passing. See
  [services-crud.md](./services-crud.md).

### Resolved: where CRUD checks live

**The service owns existence and uniqueness checks; the repository only queries.** This was an open
tension between [repositories.md](./repositories.md) and the code — the repositories threw
`NotFoundError` *and* `UnprocessableEntityError`, leaving the CRUD services as pass-throughs, while
both sibling repos did the opposite.

It is settled in favour of the service, and not merely by majority: a repository that throws
`NotFoundError` imported from `elysia` makes the persistence layer depend on the web framework, which
is the one thing the layering exists to prevent.

Consequences, all now reflected in the rules:

- Repository reads return `null`; the service turns that into a 404 — [repositories.md](./repositories.md).
- The `t()` calls moved up with the throws — [i18n.md](./i18n.md) rule 6.
- Services own the transaction around multi-table writes — [services-crud.md](./services-crud.md).
