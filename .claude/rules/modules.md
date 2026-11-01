# Rule: Feature modules (`src/modules/<name>/`)

Every feature module is a folder with **exactly three files**:

```
src/modules/<name>/
├── index.ts     # routes + validation wiring + guards
├── schema.ts    # TypeBox request/response schemas
└── service.ts   # business logic (plain object, not class)
```

Nested feature groups (e.g. `settings/user/`, `settings/role/`) follow the same shape. Group parents (`settings/index.ts`) only `.use(...)` their children — no routes there.

---

## `index.ts` — routes

- Export a `const <Name>Module = new Elysia({ prefix: "/<segment>", detail: { tags: [...] } })`.
- Chain `.use(baseApp)` **or** `.use(AuthPlugin)` (which extends auth context). Public endpoints get `baseApp`; protected ones get `AuthPlugin`. Don't double-use both on the same instance.
- Route handlers are arrow functions destructuring from Elysia context (`{ body, params, query, user, set, jwt }`). Don't `import` services dynamically — use the static `import { FooService } from "./service"` at the top.
- Wrap every successful return through `ResponseToolkit.success(...)` / `.created(...)` / etc. Never hand-craft `{ status, success, data }` objects.
- Throw `BadRequestError`/`NotFoundError`/`UnauthorizedError`/etc. from `@errors`. Never `set.status = 4xx` then return a payload — let `ErrorHandlerPlugin` do it.
- Apply authorization in `beforeHandle`:
  ```ts
  beforeHandle: ({ user }) => {
  	PermissionGuard.canActivate(user, ["user list"]);
  };
  ```
  Use `RoleGuard.canActivate(user, ["superuser"])` for role-gated routes. Never inline a permission check inside the handler — guards belong in `beforeHandle` so failures short-circuit before the handler runs.
- Every route **must** declare `body` / `query` / `params` schemas where applicable, plus `response: commonResponse(<DataSchema>, { include: [...] })` (or `commonPaginatedResponse`). The `include` array must list every status code the route can legitimately return (200/201, 400, 401, 403, 404, 422, 500 as relevant).
- Every route needs a `detail: { summary, description }` block — these flow into the OpenAPI spec.
- Group routes with comment banners (`// === LOGIN ===`) — match the existing style in `auth/index.ts`. No inline JSDoc on each handler.
- After defining a new module, **register it** in the appropriate parent `index.ts`:
  - Top-level → `src/modules/index.ts` (`bootstraps.use(<Name>Module)`)
  - Nested → its group parent (e.g. `src/modules/settings/index.ts`)

## `schema.ts` — validation

- Pure TypeBox via `import { t } from "elysia"`. No runtime logic in this file.
- Every field gets a `description` and at least one `examples` entry — these surface in `/docs`.
- Reuse domain enums from `@database` (`UserStatus`, etc.) via `t.Enum(UserStatus)` — don't redeclare string unions.
- Reuse shared patterns from `@default` (e.g. `StrongPassword.source` for password regexes).
- Export response schemas separately from request schemas. Don't inline schemas in `index.ts` except for trivial one-off bodies (see `profile/index.ts` PATCH).
- Naming: `<Entity>CreateSchema`, `<Entity>UpdateSchema`, `<Entity>ListSchema`, `<Entity>DetailSchema`, `<Action>ResponseSchema`.

## `service.ts` — business logic

- Export a **plain object literal**, never a class:
  ```ts
  export const FooService = {
    doThing: async (...) => { ... },
  };
  ```
- Service methods own orchestration: validation that depends on DB state, transactions, cache invalidation, queue dispatch. They call `Repository().method(...)` — invoke the factory **each call**, never destructure once.
- Wrap multi-step mutations in `db.transaction(async (tx) => { ... })` and pass `tx` down to repository methods. Anything that writes to ≥2 tables almost always needs a transaction.
- Use `BadRequestError` for invalid state, `UnprocessableEntityError` for input that fails business rules post-validation, `NotFoundError` (from `@errors`, never `elysia`, whose class is answered as "Route not found") for missing entities.
- Cache invalidation: when mutating user-shaped data, refresh `Cache.set(UserInformationCacheKey(userId), ...)` so `AuthPlugin` sees the new value on the next request.
- Log meaningful events with the structured `log` from `@utils`: `log.info({ userId, email }, "User logged in successfully")`. Never use `console.*`.
- If the service is reused outside its module, register it in `src/bootstrap.ts` so it can resolve from the DI container (see `rules/di.md`).
