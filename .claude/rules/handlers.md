# Rule: Route handlers (`src/modules/<name>/index.ts`)

Elysia has no controller class. The handler is the arrow function passed as the second argument to
`.get / .post / .patch / .delete`, and the third argument is the route's contract — schemas, guard,
`detail`, and `response`. Both halves matter; a handler with no contract is an undocumented,
unvalidated, ungated route.

## Responsibility

A handler does HTTP only: destructure the context, call **one** service method, wrap the result.
No conditionals on domain state, no data transformation, no `db` access.

```ts
.get(
	"/:id",
	async ({ params }) => {
		const result = await RoleService.findOne(params.id);
		return ResponseToolkit.success(result, "Role detail retrieved successfully", 200);
	},
	{
		beforeHandle: ({ user }) => {
			PermissionGuard.canActivate(user, ["role detail"]);
		},
		detail: {
			summary: "Get role detail",
			description: "Retrieve detailed information about a specific role. Requires 'role detail' permission.",
		},
		response: commonResponse(RoleListSchema, {
			include: [200, 400, 401, 403, 404, 500],
		}),
	},
)
```

If a handler needs an `if` that depends on the database, that logic belongs in the service.

## The context is destructured, never passed on

Destructure exactly what the handler uses from the Elysia context — `{ body }`, `{ params }`,
`{ query }`, `{ user }`, `{ set }`, `{ jwt }`. Never hand the whole context to a service: services
take primitives and DTOs and know nothing about HTTP. See [services.md](./services.md).

## Success responses

Every return goes through `ResponseToolkit` from `@utils`. The argument order is **data first**:

```ts
ResponseToolkit.success(data, message, status);              // status 200 | 201 | 202, default 200
ResponseToolkit.paginated(rows, meta, message);              // meta is { page, limit, totalCount }
```

- Create routes return `ResponseToolkit.success(null, "X created successfully", 201)` — the explicit
  `201` is required; the default is 200.
- Update and delete routes return `null` data with a 200.
- The envelope is `{ status, success, message, data }` — `status` appears in the body as well as being
  the HTTP status. Never hand-build that object.
- List routes that return a repository's `PaginationResponse<T>` pass it straight to
  `ResponseToolkit.success(result, ..., 200)` and declare `commonPaginatedResponse(...)`, because the
  repository already produced the `{ data, meta }` shape.

## Errors

Handlers **throw**; they never build an error response and never set a 4xx status by hand.

```ts
throw new NotFoundError("Role not found");
```

`ErrorHandlerPlugin` maps every error class from `@errors` to its status and envelope. There is no
try/catch in a handler — an uncaught domain error is the intended path. See
[errors-and-responses.md](./errors-and-responses.md).

## Every route declares its contract

The third argument must carry:

1. **`beforeHandle`** with a guard, for anything not public or self-scoped — see [rbac.md](./rbac.md).
2. **Input schemas** — `body`, `query`, `params` as applicable, imported from `./schema`. Not declared
   inline, except a trivial param object. See [validation.md](./validation.md).
3. **`response`** — `commonResponse(<DataSchema>, { include: [...] })` or
   `commonPaginatedResponse(<ItemSchema>, { include: [...] })`. The `include` array lists every status
   the route can actually return, no more and no less.
4. **`detail`** — `{ summary, description }`. The description names the permission requirement in
   words. See [openapi.md](./openapi.md).

## Module composition

- `export const <Name>Module = new Elysia({ prefix, detail: { tags, description } })`.
- `baseApp` (`src/base.ts`) is the global stack: `RequestPlugin`, `LocalePlugin`, `LoggerPlugin`,
  `PerformancePlugin`, `DiPlugin`, `BodyLimitPlugin`, `SecurityPlugin`. `AuthPlugin` is separate and
  does **not** include it — `src/libs/plugins/auth.plugin.ts` references neither `baseApp` nor `@base`.
- A module with both public and protected routes puts the public ones first, then `.use(AuthPlugin)`,
  then the rest — Elysia scopes the plugin to everything chained after it. `src/modules/auth/index.ts`
  is the pattern.
- Only `home` and `auth` chain `baseApp`; `profile` and all four `settings/*` modules chain
  `AuthPlugin` alone, and `src/server.ts` does not apply `baseApp` at the root either. That is fine:
  every plugin inside `baseApp` now declares `{ as: "global" }`, so its hooks reach every route in the
  app regardless of which module chained what. See [plugins.md](./plugins.md) — and note this was only
  made true on 2026-08-20; before that four of those plugins applied to nothing at all.
- Group routes with comment banners (`// === LOGIN ===`) as in `src/modules/auth/index.ts`. No JSDoc
  per handler.
- Services are imported statically at the top: `import { RoleService } from "./service"`. Never
  `await import(...)` inside a handler.

## Don't

- Don't `set.status = 404` and return a payload. Throw.
- Don't call two services from one handler unless the handler is genuinely orchestrating a
  cross-feature flow — and prefer moving that into a service.
- Don't import `db` or a repository into `index.ts`. Handlers go through the service.
- Don't declare `response` without wrapping in `commonResponse(...)` — `ResponseToolkit` adds the
  envelope, so a bare data schema will fail validation at runtime.
- Don't omit `detail` because the route "is obvious". It is the only source for `/docs`.
