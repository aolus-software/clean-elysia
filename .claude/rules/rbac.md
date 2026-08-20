# Rule: Authorization (RBAC)

Authentication and authorization are two separate steps and both are opt-in per route group.
`AuthPlugin` proves **who** the caller is. A guard in `beforeHandle` decides **what** they may do. A
route that has the first and not the second is authenticated but unauthorized — any logged-in user
can call it.

There is no framework-level default here: nothing scans routes and rejects the ungated ones. A new
route with no `beforeHandle` is open to every authenticated caller. That is the failure mode this
rule exists to prevent.

## The two guards

Both live in `src/libs/guards/` and are exported from `@guards`. Both are classes with a single
**static** method, and both **throw** `ForbiddenError` (403) rather than returning `false`:

```ts
PermissionGuard.canActivate(user, ["user list"]);   // requires every listed permission
RoleGuard.canActivate(user, ["superuser"]);         // requires every listed role
```

- `user` is the `UserInformation` that `AuthPlugin` puts on the context.
- Both guards **short-circuit for `superuser`**: if `user.roles` includes `"superuser"`, they return
  `true` before checking anything. Do not add a redundant `superuser` branch of your own.
- Both use `.every(...)`, so a multi-element array means AND, not OR. There is no built-in OR — if a
  route should accept either of two permissions, that is a signal the permission catalogue is wrong,
  not a reason to hand-roll a check.

## Where a guard goes

In the route's `beforeHandle`, never inside the handler body:

```ts
.get(
	"",
	async ({ query }) => { /* ... */ },
	{
		beforeHandle: ({ user }) => {
			PermissionGuard.canActivate(user, ["role list"]);
		},
		query: DatatableQueryParams,
		detail: { summary: "List all roles", description: "... Requires 'role list' permission." },
		response: commonPaginatedResponse(RoleListSchema, {
			include: [200, 400, 401, 403, 500],
		}),
	},
)
```

`beforeHandle` runs before validation-passed input reaches the handler, so a 403 costs no query. A
check inside the handler runs after the handler has already started doing work, and is easy to skip
on the next route someone adds by copy-paste.

## Permission names come from the seed, not from your imagination

`src/libs/database/postgres/seed/rbac.seed.ts` builds the whole catalogue as
`` `${group} ${permission}` `` over:

- groups: `user`, `role`, `permission`
- actions: `list`, `create`, `detail`, `edit`, `delete`

That is **15 permissions and no others**, and they are **space-separated** — `"user list"`, not
`user:list` and not `userList`. Seeded roles are `superuser` and `admin`.

A guard that names a string the seed does not produce fails closed: nobody can ever hold that
permission, so every non-superuser gets a 403 on a route that looks correctly gated. Grep the seed
before inventing a name.

If a route genuinely needs a permission outside the 15, extend `rbac.seed.ts` in the same change —
or gate it on `RoleGuard.canActivate(user, ["superuser"])` if it is a privilege-granting operation
(see below). Do not leave a route pointing at a permission that does not exist.

## Privilege-granting routes are gated on the role, not a permission

Routes that can escalate privilege or take over an account use `RoleGuard(["superuser"])`:

```ts
beforeHandle: ({ user }) => {
	RoleGuard.canActivate(user, ["superuser"]);
};
```

That covers `POST /settings/users/:id/reset-password` and the `select-options` endpoints today.
Gating password reset on `user edit` instead would let anyone holding an edit permission take over
any account, including a superuser's — the same escalation in a different costume.

## `403` must be in the response schema

A route with a `beforeHandle` guard can return 403, so `403` belongs in its
`commonResponse(..., { include: [...] })`. A route with no guard must **not** list `403` — the spec
would advertise a status nothing can produce. The reverse mistake is worse: a guarded route missing
`403` under-documents a real outcome.

## Checklist for a new protected route

- [ ] The module chains `.use(AuthPlugin)` above this route.
- [ ] The route has a `beforeHandle` calling `PermissionGuard` or `RoleGuard`.
- [ ] Every permission string it names exists in `rbac.seed.ts`.
- [ ] Privilege-granting or account-takeover routes use `RoleGuard(["superuser"])`.
- [ ] `403` (and `401`) are in the `include` array.
- [ ] The `detail.description` states the requirement in words, e.g. "Requires 'role list' permission."
- [ ] The route is added to the map in [routes.md](./routes.md).

## Don't

- Don't rely on the URL prefix for authorization. `/settings/**` is not a security boundary; only the
  per-route `beforeHandle` is.
- Don't inline `if (!user.permissions.includes(...)) throw ...` — use the guards, so the superuser
  bypass and the error shape stay in one place.
- Don't put a guard on the module-level Elysia instance and assume it covers the children. Guards are
  per-route here.
- Don't catch `ForbiddenError` to soften it into an empty list or a 200. A caller who may not read
  something gets a 403.
- Don't add a permission string without adding it to the seed in the same change.
