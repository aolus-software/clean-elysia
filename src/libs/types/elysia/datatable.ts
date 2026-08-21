import { defaultSort, paginationLength } from "@default";
import { SortDirection } from "@types";
import { t, TSchema } from "elysia";

export type DatatableType = {
	page: number;
	perPage: number;
	search?: string;
	sort?: string;
	sortDirection: SortDirection;
	filter?: Record<string, boolean | string | Date>;
};

/**
 * How the repository interprets a comma in this key's value. It changes the
 * meaning, so it is documented per key rather than assumed:
 *
 * - `id`   — comma-separated ids, matched with `IN`. Every id-ish key is this.
 * - `list` — comma-separated arbitrary values, matched with `IN`.
 * - `date` — a single ISO date (that whole day) or `start,end` for a range.
 *
 * Omitted means plain text: a comma is a literal character with no special
 * meaning, so the value is matched as-is.
 */
export type FilterFieldKind = "id" | "list" | "date";

/** An allowed filter key that carries more than just its name. */
export type FilterFieldEnum = {
	field: string;
	/**
	 * Every accepted value — pass `Object.values(...)` of the enum's const object
	 * from `@database` (e.g. `UserStatus`), never a hand-written list. See
	 * `schema.md` on the three-export enum pattern.
	 */
	enum: readonly string[];
	kind?: FilterFieldKind;
};

/** An allowed filter key with a comma convention but no fixed value set. */
export type FilterFieldTyped = {
	field: string;
	kind: FilterFieldKind;
};

/**
 * One entry in a repository's exported `<entity>FilterableFields`: a plain key
 * name, or an enum-typed key carrying its allowed values. The same array both
 * validates the `filter` query in the repository and drives the `/docs`
 * rendering, so the two cannot drift.
 */
export type FilterField = string | FilterFieldEnum | FilterFieldTyped;

/** The plain key names of a (possibly enum-carrying) allowed-filter list. */
export const filterFieldNames = (fields: readonly FilterField[]): string[] =>
	fields.map((f) => (typeof f === "string" ? f : f.field));

/** `{ key: allowedValues }` for the enum-typed entries of an allowed-filter list. */
const filterFieldEnumMap = (
	fields: readonly FilterField[],
): Record<string, readonly string[]> => {
	const map: Record<string, readonly string[]> = {};
	for (const f of fields) {
		if (typeof f !== "string" && "enum" in f) map[f.field] = f.enum;
	}
	return map;
};

/** `{ key: kind }` for the entries of an allowed-filter list that declare one. */
const filterFieldKindMap = (
	fields: readonly FilterField[],
): Record<string, FilterFieldKind> => {
	const map: Record<string, FilterFieldKind> = {};
	for (const f of fields) {
		if (typeof f !== "string" && f.kind) map[f.field] = f.kind;
	}
	return map;
};

type DatatableQueryOptions = {
	/**
	 * The `?sort=` values this endpoint's repository accepts. Pass the
	 * repository's exported `<entity>SortableFields` so the documented list
	 * cannot drift from the list that is actually enforced. When supplied, `sort`
	 * becomes a closed union — `/docs` renders it as a dropdown and an
	 * unrecognised value is rejected by validation (422) before the handler runs.
	 */
	sortFields?: readonly string[];
	/**
	 * The `filter[<key>]` names this endpoint's repository accepts. Pass the
	 * repository's exported `<entity>FilterableFields`. Entries are plain key
	 * strings, or `{ field, enum }` objects whose values render as a dropdown.
	 *
	 * **These are documentation only.** Elysia strips `filter[<key>]` query
	 * parameters before validation — they never reach this schema — so the
	 * repository is what enforces them, throwing `BadRequestError` (400) on an
	 * unknown key or an out-of-range enum value. See `DatatableToolkit.parseFilter`.
	 */
	filterFields?: readonly FilterField[];
	/**
	 * Example value per non-enum filter key, authored alongside the allow-list in
	 * the repository (its `<entity>FilterExample` map). Renders as the concrete
	 * sample in `/docs`. Enum keys take their example from the enum itself.
	 */
	filterExample?: Readonly<Record<string, string>>;
};

/**
 * Builds the shared pagination / search / sort / filter query schema for a list
 * route, documented against one entity's real allow-lists.
 *
 * Call it once per module and export the result from that module's `schema.ts`:
 *
 * ```ts
 * export const RoleQuerySchema = datatableQueryParams({
 * 	sortFields: roleSortableFields,
 * 	filterFields: roleFilterableFields,
 * });
 * ```
 *
 * Passing the repository's own exports is the point: `/docs` then shows exactly
 * the values the repository validates against, and a mismatch cannot produce a
 * rejection the reader had no way to predict.
 */
export const datatableQueryParams = ({
	sortFields,
	filterFields,
	filterExample,
}: DatatableQueryOptions = {}) => {
	const sortSchema: TSchema = sortFields?.length
		? t.Union(
				sortFields.map((field) => t.Literal(field)),
				{
					default: defaultSort,
					description: `Field to sort by. Allowed: ${sortFields.join(", ")}. Anything else is rejected with 422.`,
					examples: [defaultSort],
				},
			)
		: t.String({
				default: defaultSort,
				description: "Field to sort by.",
				examples: [defaultSort],
			});

	/* One typed property per allowed key, so /docs renders each filter with its
	   own type, example and — for enum keys — a dropdown of accepted values,
	   instead of one opaque description blob.

	   This is documentation, not validation: Elysia drops `filter[<key>]` query
	   parameters before the schema runs, so nothing here ever receives a value.
	   `DatatableToolkit.parseFilter` reads them off the raw URL and the
	   repository enforces both the key set and the enum ranges. */
	const enumMap = filterFields ? filterFieldEnumMap(filterFields) : {};
	const kindMap = filterFields ? filterFieldKindMap(filterFields) : {};
	const filterKeys = filterFields ? filterFieldNames(filterFields) : [];

	const exampleFor = (key: string): string =>
		enumMap[key]?.[0] ?? filterExample?.[key] ?? "value";

	/* Say what a comma means for this key, because it differs: a list of
	   alternatives for id/list/enum, but the two ends of a range for a date. */
	const commaNote = (key: string): string => {
		switch (kindMap[key]) {
			case "id":
				return " Comma-separate for multiple ids.";
			case "list":
				return " Comma-separate for multiple values.";
			case "date":
				return " A single ISO date matches that whole day; pass start,end for a range.";
			default:
				return "";
		}
	};

	const filterProperty = (key: string): TSchema => {
		const values = enumMap[key];
		if (values?.length) {
			return t.Optional(
				t.Union(
					values.map((value) => t.Literal(value)),
					{
						description: `One of: ${values.join(", ")}. Comma-separate for multiple.`,
						examples: [exampleFor(key)],
					},
				),
			);
		}
		return t.Optional(
			t.String({
				description: `Sent as filter[${key}]=<value>.${commaNote(key)}`,
				examples: [exampleFor(key)],
			}),
		);
	};

	const filterSchema = filterKeys.length
		? t.Optional(
				t.Object(
					Object.fromEntries(
						filterKeys.map((key) => [key, filterProperty(key)]),
					),
					{
						description: `Filters, sent as separate query parameters in the form filter[<key>]=<value> — not as a JSON object. Allowed keys: ${filterKeys.join(", ")}. Any other key is rejected with 400. Example: filter[${filterKeys[0]}]=${exampleFor(filterKeys[0])}`,
					},
				),
			)
		: t.Optional(
				t.Record(t.String(), t.String(), {
					description:
						"Filters, sent as separate query parameters in the form filter[<key>]=<value>.",
				}),
			);

	return t.Object({
		page: t.Optional(
			t.Number({
				default: 1,
				minimum: 1,
				description: "Page number, 1-based.",
				examples: [1],
			}),
		),
		perPage: t.Optional(
			t.Number({
				default: paginationLength,
				minimum: 1,
				description: `Rows per page (default: ${paginationLength}).`,
				examples: [paginationLength],
			}),
		),
		search: t.Optional(
			t.String({
				description:
					"Free-text search. Matched case-insensitively against this resource's searchable columns; see the endpoint description for which.",
				examples: ["admin"],
			}),
		),
		sort: t.Optional(sortSchema),
		sortDirection: t.Optional(
			t.Union([t.Literal("asc"), t.Literal("desc")], {
				default: "desc",
				description:
					"Sort direction (default: desc). Anything else is rejected with 422.",
				examples: ["asc"],
			}),
		),
		filter: filterSchema,
	});
};

/**
 * The undocumented datatable query shape, kept for routes that have no
 * entity-specific allow-list to advertise. Prefer `datatableQueryParams({...})`
 * with the repository's exported field lists — a list route that documents no
 * allowed sort or filter values is an incomplete route.
 */
export const DatatableQueryParams = datatableQueryParams();
