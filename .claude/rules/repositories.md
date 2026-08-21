# Rule: Repositories (`src/libs/repositories/*.repository.ts`)

Repositories are the **only** layer that talks to Drizzle directly. Services consume them; route handlers never import `db` for queries.

## Shape — factory function

A repository is a function that returns an object of methods. **Do not** export a class, singleton, or top-level method bag.

```ts
export const UserRepository = () => {
	const dbInstance = db;
	return {
		db: dbInstance,
		getDb: (tx?: DbTransaction) => tx || dbInstance,

		findByEmail: async (email: string): Promise<UserForAuth | null> => {
			const result = await dbInstance
				.select()
				.from(users)
				.where(eq(users.email, email))
				.limit(1);
			return result[0] || null;
		},
	};
};
```

Callers invoke the factory each time: `await UserRepository().findByEmail(email)`. Don't `const repo = UserRepository()` at module scope — the factory pattern exists so future DI overrides stay possible.

## Transaction support

Every mutating method (and read methods that participate in a transaction) accepts an optional `tx?: DbTransaction` and resolves the active connection at the top:

```ts
update: async (
	id: string,
	data: UserUpdate,
	tx?: DbTransaction,
): Promise<void> => {
	const database = tx || dbInstance;
	await database.update(users).set(data).where(eq(users.id, id));
};
```

`DbTransaction` is exported from `@database`. The convention is `const database = tx || dbInstance` at the top of the method, then use `database` throughout.

## Queries

- Use Drizzle's typed query builder. Prefer `db.query.<table>.findMany({ where, with, columns })` for relational reads; fall back to `select().from(...)` for joins/aggregates the relational API can't express.
- Compose `WHERE` clauses incrementally with `and(...)`, `or(...)`, `eq`, `ilike`, `isNull`, `exists` — keep a single `SQL | undefined` accumulator (see `UserRepository.findAll` in `user.repository.ts` for the pattern).
- **Soft delete**: most tables use `deleted_at` — every read starts with `let whereCondition: SQL | undefined = isNull(<table>.deleted_at);`. Don't forget this.
- **Datatable reads**: read pagination/search/sort from `DatatableType` (from `@types`). Default to
  `defaultSort` (`@default`) and `desc`. Never trust `queryParam.sort` or `queryParam.filter`
  directly — every list repository declares two allow-lists at **module scope** and exports both:

  ```ts
  /* Keys are the API-facing sort names (camelCase, aligned with the shared
     defaultSort constant); values are the snake_case Drizzle columns they map
     onto. */
  const roleOrderableColumns = {
  	id: roles.id,
  	name: roles.name,
  	createdAt: roles.created_at,
  	updatedAt: roles.updated_at,
  };

  export const roleSortableFields = Object.keys(roleOrderableColumns);
  export const roleFilterableFields = ["name"];
  ```

  `findAll` then calls `DatatableToolkit.assertFilterKeys(filter, roleFilterableFields)` before
  building the `WHERE`, and `DatatableToolkit.parseSort(roleOrderableColumns, orderBy)` for the
  `ORDER BY`. Both **throw** `BadRequestError` on an unrecognised value.

  The exports exist so the module's `schema.ts` can document the same lists through
  `datatableQueryParams({ sortFields, filterFields })` — see
  [validation.md](./validation.md). Passing anything other than the repository's own exports there
  re-opens the drift this is designed to prevent.

  **The keys are camelCase on purpose.** `defaultSort` is `"createdAt"`, so a map keyed
  `created_at` would never match the default — every unsorted request would be rejected, or silently
  reordered if the rejection is ever softened. Keep the map keys and `defaultSort` in the same
  vocabulary.

  **Enum-typed filter keys carry their values.** An entry in `<entity>FilterableFields` may be a
  plain key string or `{ field, enum }`, and a sibling `<entity>FilterExample` supplies samples for
  the rest:

  ```ts
  export const userFilterableFields: FilterField[] = [
  	{ field: "status", enum: Object.values(UserStatus) },
  	"name",
  	"email",
  	"role_id",
  ];

  export const userFilterExample: Record<string, string> = {
  	name: "jane",
  	email: "jane@example.com",
  	role_id: "550e8400-e29b-41d4-a716-446655440000",
  };
  ```

  One array drives three things: the key-set check
  (`DatatableToolkit.assertFilterKeys(filter, filterFieldNames(...))`), the enum-range check
  (`DatatableToolkit.assertFilterEnums(filter, ...)`), and the `/docs` rendering — an enum key
  becomes a dropdown, every other key shows its sample. Pass `Object.values(UserStatus)` from
  `@database` rather than restating the members, so a new enum value updates validation and docs
  together — see [schema.md](./schema.md) on the three-export enum pattern.

  **Filter values stay strings.** `DatatableToolkit.parseFilter` does not coerce them; only the
  repository knows whether a value is a scalar, a comma-separated list, or a `start,end` range. Split
  with `DatatableToolkit.filterValues(value)` and use `inArray(...)` for multi-value keys.
- **Counts**: use `database.$count(table, whereCondition)` alongside the paged `findMany` — run both inside `Promise.all([...])`.
- **Returning**: paginated reads return `PaginationResponse<T>` from `@types`. Detail/list item DTOs (`UserList`, `UserDetail`) are also in `@types` — define a new one there if the shape differs.

## Messages on a repository throw go through `t()`

Where a repository does throw, its message is a catalog key, not an English literal:

```ts
import { t } from "@i18n";

if (!role) {
	throw new NotFoundError(t("role.notFound"));
}

if (isNameExists) {
	throw new UnprocessableEntityError(t("role.nameExists"), [
		{ field: "name", message: t("role.nameExistsFor", { name: data.name }) },
	]);
}
```

This is a deliberate exception to the usual "no `t()` in a repository" principle, and it exists only
because **this repo puts the checks in the repository** — see
[services-crud.md](./services-crud.md) and rule 6 of [i18n.md](./i18n.md). A repository method that
only queries has no message to translate and should not import `@i18n`.

## Filters come off the raw URL, not the validated query

`filter[<key>]=<value>` is the wire format, and **Elysia never delivers it to the handler.** A route
that declares a `query` schema receives only the properties that schema names, and `filter[status]`
is not a valid property name — so the bracketed keys are stripped before validation runs. Elysia does
not fold them into a nested `filter` object either.

Two consequences, both load-bearing:

1. **`DatatableToolkit.parseFilter(query, request.url)` takes the URL** and reads the brackets from
   `new URL(url).searchParams`. The second argument is required precisely so a new list route cannot
   forget it — omitting it is a compile error, not a silently filter-less endpoint.
2. **The `filter` object in the query schema is documentation only.** It never receives a value, so it
   cannot validate one. Enum ranges and the key set are enforced in the repository
   (`assertFilterKeys` / `assertFilterEnums`), which is why an unknown key or a bad enum value is a
   **400** rather than a 422.

Do not "simplify" this by dropping the `url` argument and reading `query` alone. That is how filtering
silently stopped working before: `parseFilter` scanned `query` for keys starting with `filter[`, the
validated object never contained any, so `filter` was always `undefined` and no `where` branch ever
ran — on every list endpoint, with no error anywhere.

### Comma conventions per filter kind

A comma means different things depending on the key, so each key declares its `kind` and the
`/docs` description says which:

| `kind` | Comma means | Matched with |
| --- | --- | --- |
| `id` | several ids | `IN` — **never** a scalar equality |
| `list` | several arbitrary values | `IN` |
| `date` | the two ends of a range | `>= start-of-first-day AND <= end-of-last-day` |
| *(omitted)* | nothing — a literal comma | as-is |

```ts
export const userFilterableFields: FilterField[] = [
	{ field: "status", enum: Object.values(UserStatus) },
	"name",
	{ field: "role_id", kind: "id" },
	{ field: "createdAt", kind: "date" },
];
```

**Every id-ish key is `kind: "id"` and splits.** Assigning a raw value to a scalar is wrong even when
a single id is the common case — it silently makes multi-value input match nothing:

```ts
// WRONG — one id only, and a comma-separated value matches no row at all
eq(userRoles.role_id, filter.role_id as string)

// RIGHT
inArray(userRoles.role_id, DatatableToolkit.filterValues(filter.role_id))
```

**Date keys go through `DatatableToolkit.filterDateRange(value, key)`**, which returns an inclusive
`{ from, to }`. A single date matches **that whole day** — these are timestamp columns, so an equality
match on a bare date would almost never hit a row. The helper rejects an unparseable date, a reversed
range, and more than two parts with a 400; left unchecked those become `Invalid Date` and surface as a
500 or silently match nothing.

Do not hand-roll `new Date(...)` or `DateToolkit.parse(...)` per repository. The helper also carries the
timezone fix: a bare `YYYY-MM-DD` is read as wall-clock time in `APP_TIMEZONE`, not the host's
timezone, so the window lands on the calendar day the caller meant.

## What repositories should NOT do

- No `throw new BadRequestError(...)` for business rules. Throw `NotFoundError` from `elysia` when a row is genuinely missing; everything else belongs in the service.
- No cache reads/writes. Caching is the service's job (or `AuthPlugin`'s).
- No password hashing / JWT signing / mail sending. Repositories only own SQL.
- No cross-table orchestration that requires a transaction the caller didn't supply — if you need a transaction, accept `tx` and let the caller open it.

## File layout

- One repository per file: `<entity>.repository.ts`.
- Re-export from `src/libs/repositories/index.ts` so consumers `import { UserRepository } from "@repositories"`. Never import via relative path from outside `libs/repositories/`.
