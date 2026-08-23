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

## Where the checks live — the service owns them

**The repository queries; the service decides.** Fetch, check, then act:

- existence → `NotFoundError`
- uniqueness → `UnprocessableEntityError`
- anything else that needs database state → the service

```ts
export const RoleService = {
	findAll: async (
		queryParam: DatatableType,
	): Promise<PaginationResponse<RoleList>> => {
		return await RoleRepository().findAll(queryParam);
	},

	findOne: async (id: string) => {
		const role = await RoleRepository().getDetail(id);
		if (!role) {
			throw new NotFoundError(t("role.notFound"));
		}

		return role;
	},

	update: async (id: string, data: { name: string; permissionIds: string[] }) => {
		const role = await RoleRepository().findById(id);
		if (!role) {
			throw new NotFoundError(t("role.notFound"));
		}

		const existing = await RoleRepository().findByName(data.name, id);
		if (existing) {
			throw new UnprocessableEntityError(t("role.nameExists"), [
				{ field: "name", message: t("role.nameExistsFor", { name: data.name }) },
			]);
		}

		return await db.transaction(async (tx) => {
			return await RoleRepository().update(id, data, tx);
		});
	},
};
```

The repository's read methods return `null` for a miss — `getDetail`, `findById`, `findByName`,
`findLiveByEmail` — precisely so the service can decide the status. The repository has no opinion on
whether an operation should be allowed; it only validates the datatable inputs (sort field, sort
direction, filter keys) and throws `BadRequestError` for those.

Four rules follow, and each one has bitten this codebase:

- **Never split a check across both layers.** Two existence checks for one operation means two
  queries and two places to forget one.
- **`update` passes the record's own id as `excludeId`.** `findByName(data.name, id)` — without it,
  saving a record without renaming it rejects itself.
- **The throw owns its message.** The `t()` key lives wherever the throw lives, which is now the
  service. See rule 6 of [i18n.md](./i18n.md).
- **A multi-table write is a transaction, opened here.** `roles` + `role_permissions`,
  `users` + `user_roles`. The repository accepts `tx`; it never opens one.

**A uniqueness conflict is 422 everywhere — settled 2026-08-23.** `role`, `permission` and `user` all
throw `UnprocessableEntityError`, and so does the sibling `clean-elysia-prisma`. The semantics decided
it: the request is well-formed and fails a business rule, which is what 422 means. `user` previously
threw `BadRequestError` (400) for a duplicate email; that was a divergence, not a variant, and it is
gone. A new uniqueness check that reaches for 400 — or for 409, which no error class in this repo can
produce — is wrong.

Note what 422 does **not** cover: `BadRequestError` (400) is still correct for a malformed request the
schema could not reject, and for the repository's datatable guards (unknown sort field, unknown filter
key). Those are bad *input*, not a failed business rule.

## What still throws from a repository

Two throws in `user.repository.ts` stay, and they are **not** business rules — they are the
repository asserting that its own write behaved:

```ts
if (user.length === 0) {
	throw new BadRequestError(t("user.createFailed"), [ ... ]);
}
```

An `INSERT ... RETURNING` that comes back empty is a condition only the repository can observe, so
no service-side check could replace it. Everything a service *can* check, it does. Do not read these
two as licence to move an existence or uniqueness check back down.

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

Returns the detail shape. `getDetail` resolves to `null` for a miss; the service turns that into
`NotFoundError` so `null` never reaches the handler — the handler has no null branch.

```ts
findOne: async (id: string) => {
	const user = await UserRepository().getDetail(id);
	if (!user) {
		throw new NotFoundError(t("user.notFound"));
	}

	return user;
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
	roleIds: string[];
}) => {
	const existing = await UserRepository().findLiveByEmail(data.email);
	if (existing) {
		throw new BadRequestError(t("user.emailExists"), [
			{ field: "email", message: t("user.emailExists") },
		]);
	}

	await UserRepository().create(data);
},
```

Uniqueness is checked here, before the write. Note `findLiveByEmail` filters `deleted_at` — a
soft-deleted user's address is reusable, which is why the column carries no database-level unique
constraint and this check is the only thing enforcing it among live users.

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
		roleIds: string[];
	},
) => {
	const user = await UserRepository().findById(id);
	if (!user) {
		throw new NotFoundError(t("user.notFound"));
	}

	const existing = await UserRepository().findLiveByEmail(data.email, id);
	if (existing) {
		throw new BadRequestError(t("user.emailExists"), [
			{ field: "email", message: t("user.emailExists") },
		]);
	}

	return await UserRepository().update(id, data);
},
```

The second argument to `findLiveByEmail` excludes this record, so saving a user without changing
their address does not collide with itself.

`password` is deliberately absent from the update input — password changes go through the dedicated
`resetPassword` method, so a general update can never silently rewrite a credential.

## delete

Soft delete. `users` and the other soft-deletable tables carry `deleted_at`, and every read filters
on `isNull(<table>.deleted_at)` — so "delete" is an `update` that stamps the timestamp, never a SQL
`DELETE`. The repository owns that; the service just calls it.

```ts
delete: async (id: string) => {
	const user = await UserRepository().findById(id);
	if (!user) {
		throw new NotFoundError(t("user.notFound"));
	}

	return await UserRepository().delete(id);
},
```

## Beyond CRUD

Non-CRUD operations live in the same service object, after the five, and they are where real service
logic tends to appear — transactions, hashing, mail:

```ts
resetPassword: async (id: string, newPassword: string) => {
	const user = await UserService.findOne(id);
	const hashPassword = await Hash.generateHash(newPassword);

	await db.transaction(async (tx) => {
		await tx.update(users).set({ password: hashPassword }).where(eq(users.id, user.id));
	});
},

sendEmailVerification: async (id: string) => {
	const user = await UserService.findOne(id);
	const authMailService = new AuthMailService();
	await authMailService.sendVerificationEmail(user.id);
},
```

These call the service's own `findOne` rather than the repository, so the 404 on a bad id comes from
one place. Reaching for `UserRepository().getDetail` here would get `null` and no error.

## Imports

```ts
import { db, users, UserStatusEnum } from "@database";
import { BadRequestError } from "@errors";
import { t } from "@i18n";
import { AuthMailService } from "@mailer";
import { UserRepository } from "@repositories";
import { DatatableType, PaginationResponse, UserList } from "@types";
import { Hash } from "@utils";
import { eq } from "drizzle-orm";
import { NotFoundError } from "elysia";
```

Import only what the service actually uses. `BadRequestError` and `UnprocessableEntityError` come
from `@errors`; **`NotFoundError` comes from `elysia`**, not from `@errors` — both are caught by
`ErrorHandlerPlugin`, but the repositories and services here use the `elysia` one. Every service that
throws also imports `t` from `@i18n`, because the message belongs to the throw.

## Checklist

- [ ] Five methods named `findAll` / `findOne` / `create` / `update` / `delete`.
- [ ] Explicit types on every parameter; `findAll` returns `Promise<PaginationResponse<XList>>`.
- [ ] Existence and uniqueness checks live in the **service**, never the repository.
- [ ] `update` passes the record's own id to the uniqueness lookup as `excludeId`.
- [ ] Hashing and derived fields computed in the service, not the repository.
- [ ] Multi-table writes wrapped in `db.transaction` with `tx` threaded through.
- [ ] `delete` soft-deletes.
- [ ] No HTTP types, no `set`, no `console.*`.
