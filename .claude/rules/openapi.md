# Rule: OpenAPI / Swagger documentation

The API spec is generated from Elysia route metadata at runtime by `DocsPlugin` (`src/libs/plugins/docs.plugin.ts`, powered by `@elysiajs/openapi` with the Scalar provider). It's served at `/docs` and `/docs/openapi.json`, gated on a single flag: `enabled: AppConfig.ENABLE_API_DOCS`, from the `ENABLE_API_DOCS` environment variable.

That flag **defaults to `false`**, so an environment that never sets it cannot expose the schema, and it is deliberately **independent of `NODE_ENV`** — docs can be turned on for a staging box without pretending it is a development environment, and cannot be published by accident just by shipping with `NODE_ENV=staging`. It replaced an `APP_ENV !== "production"` check, which published the schema on every non-production deployment. Don't reintroduce an environment check alongside it; the flag is the whole switch.

You don't write OpenAPI YAML by hand. Every documentation field comes from how routes are declared.

## Mandatory per-module metadata

When defining `new Elysia({ prefix, detail })`, set `detail.tags` so all child routes inherit a tag:

```ts
new Elysia({
	prefix: "/users",
	detail: {
		tags: ["Settings/Users"],
		description: "APIs for managing users",
	},
});
```

Tag convention: top-level resources → single word (`Authentication`, `Profile`); nested resources → `Group/Subresource` (`Settings/Users`, `Settings/Roles`).

## Mandatory per-route metadata

Every `.get / .post / .patch / .delete` MUST declare:

1. **Validation schemas** — `body`, `query`, `params` as applicable. Schemas come from `./schema.ts` (TypeBox) and feed both runtime validation and the spec.
2. **`response`** — call `commonResponse(<DataSchema>, { include: [...] })` or `commonPaginatedResponse(...)` from `@utils`. The `include` array enumerates every status code this route can legitimately return:
   - `200` for successful GET/PATCH, `201` for POST that creates
   - `400` if input validation can fail in the service layer (e.g. duplicate email)
   - `401` if `AuthPlugin` is in use
   - `403` if any guard runs in `beforeHandle`
   - `404` if any path param resolves to a row that may not exist
   - `422` if business-rule validation can fail
   - `500` for list/detail endpoints where unexpected errors matter to consumers
3. **`detail`** — `{ summary, description }`. Summary is short (≤80 chars), description explains the auth/permission requirement and the side effects.

Example (from `settings/user/index.ts`):

```ts
.get(
  "",
  async ({ query }) => { /* ... */ },
  {
    beforeHandle: ({ user }) => {
      PermissionGuard.canActivate(user, ["user list"]);
    },
    query: DatatableQueryParams,
    detail: {
      summary: "List all users",
      description: "Retrieve a list of all users. Requires 'user list' permission.",
    },
    response: commonPaginatedResponse(UserListSchema, {
      include: [200, 400, 401, 403, 500],
    }),
  },
)
```

## TypeBox schemas

- Every field in a request/response schema gets `description` and at least one `examples` value — these become the property docs in `/docs`.
- Use semantic `format`: `t.String({ format: "email" })`, `t.String({ format: "uuid" })`, `t.String({ format: "date-time" })`. The Scalar UI renders these specially.
- Reuse domain enums: `t.Enum(UserStatus)` from `@database`, not a fresh `t.Union([t.Literal("active"), ...])`.
- Strong-password fields use `pattern: StrongPassword.source` from `@default`.

## Auth and security

`DocsPlugin` declares `security: [{ bearerAuth: [] }]` globally with a `bearerAuth` security scheme (`http` / `bearer` / JWT). On public modules, override per-module:

```ts
new Elysia({
	prefix: "/auth",
	detail: {
		tags: ["Authentication"],
		security: [], // <-- explicitly clear global bearer requirement
		description: "Authentication APIs",
	},
});
```

This is why `auth/index.ts` shows endpoints without a 🔒 in `/docs` and `settings/users/index.ts` does. Always set `security: []` on a module whose routes don't use `AuthPlugin`.

## Don't

- Don't hand-edit any `openapi.json` — there isn't one to edit.
- Don't add `tags` per route when a module-level `detail.tags` already applies.
- Don't omit `include` codes that the route can actually return — the spec lies if you do.
- Don't return `ResponseToolkit.success(data)` while declaring a `response: SomeRawSchema` — the toolkit wraps in `{ status, success, message, data }`, so always wrap the schema with `commonResponse(...)`.
