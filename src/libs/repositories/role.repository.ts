import { db, DbTransaction, rolePermissions, roles } from "@database";
import { defaultSort } from "@default";
import { UnprocessableEntityError } from "@errors";
import { t } from "@i18n";
import {
	DatatableType,
	FilterField,
	filterFieldNames,
	PaginationResponse,
	RoleList,
	SortDirection,
} from "@types";
import { DatatableToolkit } from "@utils";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	ilike,
	lte,
	ne,
	not,
	or,
	SQL,
} from "drizzle-orm";
import { NotFoundError } from "elysia";

/* Keys are the API-facing sort names (camelCase, aligned with the shared
   defaultSort constant); values are the snake_case Drizzle columns they map
   onto. */
const roleOrderableColumns = {
	id: roles.id,
	name: roles.name,
	createdAt: roles.created_at,
	updatedAt: roles.updated_at,
};

/* The ?sort= and filter[...] values this repository accepts. Exported so the
   module can document them in OpenAPI from one source of truth rather than
   restating the list. An unrecognised value is rejected, not ignored. */
export const roleSortableFields = Object.keys(roleOrderableColumns);
export const roleFilterableFields: FilterField[] = [
	"name",
	{ field: "createdAt", kind: "date" },
	{ field: "updatedAt", kind: "date" },
];

/* Example value per non-enum filter key, rendered as the concrete sample in
   /docs. */
export const roleFilterExample: Record<string, string> = {
	name: "admin",
	createdAt: "2024-01-01,2024-12-31",
	updatedAt: "2024-01-01,2024-12-31",
};

export const RoleRepository = () => {
	const dbInstance = db;

	return {
		db: dbInstance,
		getDb: (tx?: DbTransaction) => tx || dbInstance.$cache,

		findAll: async (
			queryParam: DatatableType,
			tx?: DbTransaction,
		): Promise<PaginationResponse<RoleList>> => {
			const database = tx || dbInstance;

			const page: number = queryParam.page || 1;
			const limit: number = queryParam.perPage || 10;
			const search: string | null = queryParam.search || null;
			const orderBy: string = queryParam.sort ? queryParam.sort : defaultSort;
			const orderDirection: SortDirection = queryParam.sortDirection
				? queryParam.sortDirection
				: "desc";
			const filter: Record<string, boolean | string | Date> | null =
				queryParam.filter || null;
			const offset = (page - 1) * limit;

			DatatableToolkit.assertFilterKeys(
				filter,
				filterFieldNames(roleFilterableFields),
			);
			DatatableToolkit.assertFilterEnums(filter, roleFilterableFields);

			let whereCondition: SQL | undefined;
			if (search) {
				whereCondition = or(ilike(roles.name, `%${search}%`));
			}

			/* Every matching filter is ANDed together. Assigning to a single
			   accumulator here instead would let the last matching block overwrite
			   the earlier ones, silently dropping every filter but one. */
			const filterClauses: (SQL | undefined)[] = [];
			if (filter) {
				if (filter.name) {
					filterClauses.push(ilike(roles.name, `%${filter.name.toString()}%`));
				}

				if (filter.createdAt) {
					const { from, to } = DatatableToolkit.filterDateRange(
						filter.createdAt,
						"createdAt",
					);
					filterClauses.push(
						gte(roles.created_at, from),
						lte(roles.created_at, to),
					);
				}

				if (filter.updatedAt) {
					const { from, to } = DatatableToolkit.filterDateRange(
						filter.updatedAt,
						"updatedAt",
					);
					filterClauses.push(
						gte(roles.updated_at, from),
						lte(roles.updated_at, to),
					);
				}
			}

			const finalWhereCondition: SQL | undefined = and(
				whereCondition,
				...filterClauses,
			);

			const orderColumn = DatatableToolkit.parseSort(
				roleOrderableColumns,
				orderBy,
			);

			const result = await database.query.roles.findMany({
				where: finalWhereCondition,
				orderBy:
					orderDirection === "asc" ? asc(orderColumn) : desc(orderColumn),
				columns: {
					id: true,
					name: true,
					created_at: true,
					updated_at: true,
				},
				limit,
				offset,
			});

			const totalCount = await database.$count(roles, finalWhereCondition);

			return {
				data: result,
				meta: {
					page,
					limit,
					totalCount,
				},
			};
		},

		create: async (
			data: {
				name: string;
				permission_ids: string[];
			},
			tx?: DbTransaction,
		): Promise<void> => {
			const database = tx || dbInstance;

			const isNameExists = await database.query.roles.findFirst({
				where: eq(roles.name, data.name),
			});

			if (isNameExists) {
				throw new UnprocessableEntityError(t("role.nameExists"), [
					{
						field: "name",
						message: t("role.nameExistsFor", { name: data.name }),
					},
				]);
			}

			const role = await database
				.insert(roles)
				.values({
					name: data.name,
				})
				.returning({ id: roles.id })
				.execute();

			if (data.permission_ids.length > 0) {
				const rolePermissionsData = data.permission_ids.map((permissionId) => ({
					role_id: role[0].id,
					permission_id: permissionId,
				}));

				await dbInstance.insert(rolePermissions).values(rolePermissionsData);
			}
		},

		getDetail: async (id: string, tx?: DbTransaction) => {
			const database = tx || dbInstance;

			const role = await database.query.roles.findFirst({
				where: eq(roles.id, id),
				columns: {
					id: true,
					name: true,
					created_at: true,
					updated_at: true,
				},

				with: {
					role_permissions: {
						with: {
							permission: {
								columns: {
									id: true,
									name: true,
									group: true,
								},
							},
						},
					},
				},
			});

			if (!role) {
				throw new NotFoundError(t("role.notFound"));
			}

			const allPermissions = await database.query.permissions.findMany({
				columns: {
					id: true,
					name: true,
					group: true,
				},
			});

			return {
				id: role.id,
				name: role.name,
				created_at: role.created_at,
				updated_at: role.updated_at,
				permissions: allPermissions.reduce(
					(
						acc: {
							group: string;
							names: { id: string; name: string; is_assigned: boolean }[];
						}[],
						permission,
					) => {
						const isAssigned = role.role_permissions.some(
							(rp) => rp.permission.id === permission.id,
						);

						const group = permission.group || "Ungrouped";
						const nameEntry = {
							id: permission.id,
							name: permission.name,
							is_assigned: isAssigned,
						};

						const existingGroup = acc.find((g) => g.group === group);
						if (existingGroup) {
							existingGroup.names.push(nameEntry);
						} else {
							acc.push({ group, names: [nameEntry] });
						}

						return acc;
					},
					[],
				),
			};
		},

		update: async (
			id: string,
			data: { name: string; permission_ids: string[] },
			tx?: DbTransaction,
		): Promise<void> => {
			const database = tx || dbInstance;

			const role = await database.query.roles.findFirst({
				where: eq(roles.id, id),
			});

			if (!role) {
				throw new NotFoundError(t("role.notFound"));
			}

			const isNameExists = await database.query.roles.findFirst({
				where: and(eq(roles.name, data.name), not(eq(roles.id, id))),
			});

			if (isNameExists) {
				throw new UnprocessableEntityError(t("role.nameExists"), [
					{
						field: "name",
						message: t("role.nameExistsFor", { name: data.name }),
					},
				]);
			}

			await database
				.update(roles)
				.set({
					name: data.name,
				})
				.where(eq(roles.id, id))
				.execute();

			await database
				.delete(rolePermissions)
				.where(eq(rolePermissions.role_id, id))
				.execute();

			if (data.permission_ids.length > 0) {
				const rolePermissionsData = data.permission_ids.map((permissionId) => ({
					role_id: id,
					permission_id: permissionId,
				}));

				await database.insert(rolePermissions).values(rolePermissionsData);
			}
		},

		delete: async (id: string, tx?: DbTransaction): Promise<void> => {
			const database = tx || dbInstance;

			const role = await database.query.roles.findFirst({
				where: eq(roles.id, id),
			});

			if (!role) {
				throw new NotFoundError(t("role.notFound"));
			}

			await database
				.delete(rolePermissions)
				.where(eq(rolePermissions.role_id, id))
				.execute();

			await database.delete(roles).where(eq(roles.id, id)).execute();
		},

		selectOptions: async (): Promise<{ id: string; name: string }[]> => {
			const result = await dbInstance.query.roles.findMany({
				where: ne(roles.name, "superuser"),
				columns: {
					id: true,
					name: true,
				},
				orderBy: asc(roles.name),
			});

			return result;
		},
	};
};
