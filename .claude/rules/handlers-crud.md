# Rule: The canonical CRUD module

A full CRUD resource is five routes in one `index.ts`, in this order, each with a guard, schemas, a
`response`, and a `detail`. `src/modules/settings/role/index.ts` is the reference implementation —
copy its shape rather than inventing a new one.

| Route | Verb + path | Service method | Permission | Success |
| ----- | ----------- | -------------- | ---------- | ------- |
| list   | `GET ""`        | `findAll(queryParam)` | `<group> list`   | 200 |
| create | `POST ""`       | `create(body)`        | `<group> create` | 201 |
| detail | `GET "/:id"`    | `findOne(params.id)`  | `<group> detail` | 200 |
| update | `PATCH "/:id"`  | `update(id, body)`    | `<group> edit`   | 200 |
| delete | `DELETE "/:id"` | `delete(params.id)`   | `<group> delete` | 200 |

Collection paths are `""`, not `"/"` — the module `prefix` already carries the segment. Permission
strings use the seeded `<group> <action>` vocabulary; `edit` is the update action, not `update`. See
[rbac.md](./rbac.md).

## List

Parse the datatable query with `DatatableToolkit.parseFilter(query, request.url)` and hand the result straight to
the service. The repository returns `PaginationResponse<T>`, so pass it through unchanged and declare
`commonPaginatedResponse`.

```ts
.get(
	"",
	async ({ query, request }) => {
		const queryParam = DatatableToolkit.parseFilter(query, request.url);
		const result = await RoleService.findAll(queryParam);

		return ResponseToolkit.success(result, "Role list retrieved successfully", 200);
	},
	{
		beforeHandle: ({ user }) => {
			PermissionGuard.canActivate(user, ["role list"]);
		},
		query: RoleQuerySchema,
		detail: {
			summary: "List all roles",
			description: "Retrieve a list of all roles. Requires 'role list' permission.",
		},
		response: commonPaginatedResponse(RoleListSchema, {
			include: [200, 400, 401, 403, 422, 500],
		}),
	},
)
```

`RoleQuerySchema` is built in the module's own `schema.ts` from
`datatableQueryParams({ sortFields, filterFields })`, passing the repository's exported allow-lists —
`roleSortableFields` and `roleFilterableFields`. Do not redeclare page/perPage/search/sort/filter per
module, and do not fall back to the bare `DatatableQueryParams` from `@types`: a list route that
advertises no allowed sort values or filter keys is an incomplete route. See
[validation.md](./validation.md) and [repositories.md](./repositories.md).

Two codes are always in the `include` for a list route:

- `422` — `sort` and `sortDirection` are closed unions in the schema, so an unrecognised value is
  rejected by validation before the handler runs.
- `400` — filter keys arrive as separate flat query parameters (`filter[name]=x`) that the schema
  cannot name, so the repository's `assertFilterKeys` is what rejects an unknown one.

## Create

Returns `null` data with an explicit `201`.

```ts
.post(
	"",
	async ({ body }) => {
		await RoleService.create(body);
		return ResponseToolkit.success(null, "Role created successfully", 201);
	},
	{
		beforeHandle: ({ user }) => {
			PermissionGuard.canActivate(user, ["role create"]);
		},
		body: CreateRoleSchema,
		detail: {
			summary: "Create a new role",
			description: "Create a new role with the provided details. Requires 'role create' permission.",
		},
		response: commonResponse(t.Null(), {
			include: [201, 400, 401, 403, 500],
		}),
	},
)
```

The `201` must appear in three places and agree: the third argument to `ResponseToolkit.success`, the
`include` array, and the route's documented status. `ResponseToolkit.created(data, message)` is an
equivalent shorthand — pick one style per module and stay with it.

No `404` on create; no `422` unless the service throws `UnprocessableEntityError` for a business rule.

## Detail

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
		detail: { summary: "Get role detail", description: "... Requires 'role detail' permission." },
		response: commonResponse(RoleListSchema, {
			include: [200, 400, 401, 403, 404, 500],
		}),
	},
)
```

`404` enters the `include` from here on: every `:id` route can miss.

## Update

Same shape as create, plus the `:id` and `404`, and status 200.

```ts
.patch(
	"/:id",
	async ({ params, body }) => {
		await RoleService.update(params.id, body);
		return ResponseToolkit.success(null, "Role updated successfully", 200);
	},
	{
		beforeHandle: ({ user }) => {
			PermissionGuard.canActivate(user, ["role edit"]);
		},
		body: UpdateRoleSchema,
		detail: { summary: "Update role", description: "... Requires 'role edit' permission." },
		response: commonResponse(t.Null(), {
			include: [200, 400, 401, 403, 404, 500],
		}),
	},
)
```

`UpdateRoleSchema` is a separate schema, not a reuse of `CreateRoleSchema` — see
[validation.md](./validation.md).

## Delete

```ts
.delete(
	"/:id",
	async ({ params }) => {
		await RoleService.delete(params.id);
		return ResponseToolkit.success(null, "Role deleted successfully", 200);
	},
	{
		beforeHandle: ({ user }) => {
			PermissionGuard.canActivate(user, ["role delete"]);
		},
		detail: { summary: "Delete role", description: "... Requires 'role delete' permission." },
		response: commonResponse(t.Null(), {
			include: [200, 400, 401, 403, 404, 500],
		}),
	},
)
```

Delete returns 200 with a message, not 204 — the envelope always has a body.

## Status codes by route

| Route  | `include` |
| ------ | --------- |
| list   | `[200, 400, 401, 403, 422, 500]` |
| create | `[201, 400, 401, 403, 500]` |
| detail | `[200, 400, 401, 403, 404, 500]` |
| update | `[200, 400, 401, 403, 404, 500]` |
| delete | `[200, 400, 401, 403, 404, 500]` |

Add `422` on any route whose service throws `UnprocessableEntityError`. Drop `401` and `403` only on a
route that is genuinely public. Never list a code the route cannot produce, and never omit one it can.

## Sub-resource actions

Actions beyond CRUD hang off the id — `POST "/:id/reset-password"`,
`POST "/:id/send-verification-email"`. They keep the parent resource's permission unless they grant
privilege, in which case they use `RoleGuard(["superuser"])`. Add them **after** the five CRUD routes
in the chain, and add them to the map in [routes.md](./routes.md).

## Checklist

- [ ] Five routes, in list / create / detail / update / delete order.
- [ ] Collection paths are `""`; item paths are `"/:id"`.
- [ ] Every route has a `beforeHandle` naming a seeded permission.
- [ ] `PATCH` uses the `edit` action, not `update`.
- [ ] Create returns 201 in both the toolkit call and the `include`.
- [ ] `:id` routes list `404`; list routes list `400`.
- [ ] Every route has `detail.summary` and `detail.description`, the latter naming the permission.
- [ ] The module is composed into its parent and the routes are in [routes.md](./routes.md).
