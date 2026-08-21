# Rule: The canonical CRUD service

A full CRUD service exposes five methods, matching the five routes in
[handlers-crud.md](./handlers-crud.md):

```ts
findAll: (queryParam: DatatableType) => Promise<PaginationResponse<XList>>
findOne: (id: string) => Promise<XDetail>
create:  (data: XCreateInput) => Promise<void | X>
update:  (id: string, data: XUpdateInput) => Promise<void | X>
delete:  (id: string) => Promise<void>
```

`src/modules/settings/role/service.ts` is the reference. Every method has an explicit parameter type;
`findAll` has an explicit return type.

## Where the checks live — read this before writing a new module

In **this** repo the repository owns the existence and uniqueness checks, and the CRUD service is a
thin pass-through:

```ts
export const RoleService = {
	findAll: async (
		queryParam: DatatableType,
	): Promise<PaginationResponse<RoleList>> => {
		return await RoleRepository().findAll(queryParam);
	},

	findOne: async (id: string) => {
		return await RoleRepository().getDetail(id);
	},

	update: async (id: string, data: { name: string; permission_ids: string[] }) => {
		return await RoleRepository().update(id, data);
	},
};
```

`RoleRepository().getDetail` throws `NotFoundError` when the row is missing; `create` and `update`
throw `UnprocessableEntityError` on a duplicate name. The service adds nothing.

**This is a known inconsistency.** It sits awkwardly with [repositories.md](./repositories.md), which
says a repository throws `NotFoundError` for a genuinely missing row and leaves *everything else* to
the service — uniqueness is a business rule, and it is currently enforced in the repository. Both
sibling repos (`clean-elysia-prisma`, `clean-nest-drizzle-pg`) do it the other way round: the service
fetches, checks, and throws, and the repository only queries.

Until that is settled deliberately:

- **Follow the module you are editing.** Do not half-migrate one module to the other pattern.
- **Never split a check across both layers.** Two existence checks for one operation means two
  queries and two places to forget one.
- **The repository's throw messages are catalog keys.** Because the throw lives there, so does the
  user-facing string: `t("role.notFound")`, not `"Role not found"`. See
  [repositories.md](./repositories.md) and rule 6 of [i18n.md](./i18n.md). If the checks ever move
  up into the services, the `t()` calls move with them.
- For a genuinely new module, prefer the sibling pattern — checks in the service — and say so in the
  PR, because it is the direction the rest of the workspace leans. Raise it rather than quietly
  diverging; that is [contradiction-halt.md](./contradiction-halt.md).

## findAll

Delegates to the repository with no added logic. The repository owns pagination, the soft-delete
filter, and the sort/filter allow-list.

```ts
findAll: async (
	queryParam: DatatableType,
): Promise<PaginationResponse<UserList>> => {
	return await UserRepository().findAll(queryParam);
},
```

The handler has already run `DatatableToolkit.parseFilter(query, request.url)`, so the service receives a parsed
`DatatableType` — do not re-parse it.

## findOne

Returns the detail shape. Whichever layer owns the check, a missing row raises `NotFoundError` and
never resolves to `null` reaching the handler — the handler has no null branch.

```ts
findOne: async (id: string) => {
	return await UserRepository().getDetail(id);
},
```

## create

Hash, derive, and transform in the service; let the write happen in one place. Password hashing is
`Hash.generateHash(...)` from `@utils` and belongs here, never in the repository or the handler.

```ts
create: async (data: {
	name: string;
	email: string;
	password: string;
	status: UserStatusEnum;
	remarks?: string;
	role_ids: string[];
}) => {
	await UserRepository().create(data);
},
```

The input type is written out explicitly rather than reusing the TypeBox schema's inferred type —
that is the existing convention. When the write touches more than one table (user + roles, user +
verification token), the repository method must accept a `tx` and the service opens the transaction.

## update

Same shape as create, with the id first. Re-check uniqueness only for fields that can change.

```ts
update: async (
	id: string,
	data: {
		name: string;
		email: string;
		status: UserStatusEnum;
		remarks?: string;
		role_ids: string[];
	},
) => {
	return await UserRepository().update(id, data);
},
```

`password` is deliberately absent from the update input — password changes go through the dedicated
`resetPassword` method, so a general update can never silently rewrite a credential.

## delete

Soft delete. `users` and the other soft-deletable tables carry `deleted_at`, and every read filters
on `isNull(<table>.deleted_at)` — so "delete" is an `update` that stamps the timestamp, never a SQL
`DELETE`. The repository owns that; the service just calls it.

```ts
delete: async (id: string) => {
	return await UserRepository().delete(id);
},
```

## Beyond CRUD

Non-CRUD operations live in the same service object, after the five, and they are where real service
logic tends to appear — transactions, hashing, mail:

```ts
resetPassword: async (id: string, newPassword: string) => {
	const user = await UserRepository().getDetail(id);
	const hashPassword = await Hash.generateHash(newPassword);

	await db.transaction(async (tx) => {
		await tx.update(users).set({ password: hashPassword }).where(eq(users.id, user.id));
	});
},

sendEmailVerification: async (id: string) => {
	const user = await UserRepository().getDetail(id);
	const authMailService = new AuthMailService();
	await authMailService.sendVerificationEmail(user.id);
},
```

Note `getDetail` is called first purely to make the operation 404 on a bad id before doing work.

## Imports

```ts
import { db, users, UserStatusEnum } from "@database";
import { AuthMailService } from "@mailer";
import { UserRepository } from "@repositories";
import { DatatableType, PaginationResponse, UserList } from "@types";
import { Hash } from "@utils";
import { eq } from "drizzle-orm";
```

Import only what the service actually uses. Errors come from `@errors`; `NotFoundError` is imported
from `elysia` in the repositories, so match whichever layer you are editing.

## Checklist

- [ ] Five methods named `findAll` / `findOne` / `create` / `update` / `delete`.
- [ ] Explicit types on every parameter; `findAll` returns `Promise<PaginationResponse<XList>>`.
- [ ] Existence and uniqueness checks live in exactly one layer, matching the module's existing style.
- [ ] Hashing and derived fields computed in the service, not the repository.
- [ ] Multi-table writes wrapped in `db.transaction` with `tx` threaded through.
- [ ] `delete` soft-deletes.
- [ ] No HTTP types, no `set`, no `console.*`.
