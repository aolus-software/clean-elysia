import { db, DbTransaction, permissions } from "@database";
import { defaultSort } from "@default";
import { UnprocessableEntityError } from "@errors";
import { t } from "@i18n";
import {
	DatatableType,
	FilterField,
	filterFieldNames,
	PaginationResponse,
	PermissionList,
	PermissionSelectOptions,
	SortDirection,
} from "@types";
import { DatatableToolkit } from "@utils";
import { and, asc, desc, eq, gte, ilike, lte, not, or, SQL } from "drizzle-orm";
import { NotFoundError } from "elysia";

/* Keys are the API-facing sort names (camelCase, aligned with the shared
   defaultSort constant); values are the snake_case Drizzle columns they map
   onto. */
const permissionOrderableColumns = {
	id: permissions.id,
	name: permissions.name,
	group: permissions.group,
	createdAt: permissions.created_at,
	updatedAt: permissions.updated_at,
};

/* The ?sort= and filter[...] values this repository accepts. Exported so the
   module can document them in OpenAPI from one source of truth rather than
   restating the list. An unrecognised value is rejected, not ignored. */
export const permissionSortableFields = Object.keys(permissionOrderableColumns);
export const permissionFilterableFields: FilterField[] = [
	"name",
	"group",
	{ field: "createdAt", kind: "date" },
	{ field: "updatedAt", kind: "date" },
];

/* Example value per non-enum filter key, rendered as the concrete sample in
   /docs. */
export const permissionFilterExample: Record<string, string> = {
	name: "user list",
	group: "user",
	createdAt: "2024-01-01,2024-12-31",
	updatedAt: "2024-01-01,2024-12-31",
};

export const PermissionRepository = () => {
	const dbInstance = db;

	return {
		db: dbInstance,
		getDb: (tx?: DbTransaction) => tx || dbInstance.$cache,

		findAll: async (
			queryParam: DatatableType,
			tx?: DbTransaction,
		): Promise<PaginationResponse<PermissionList>> => {
			const database = tx || dbInstance;

			const page: number = queryParam.page || 1;
			const limit: number = queryParam.perPage || 10;
			const search: string | undefined = queryParam.search;
			const orderBy: string = queryParam.sort ? queryParam.sort : defaultSort;
			const orderDirection: SortDirection = queryParam.sortDirection
				? queryParam.sortDirection
				: "desc";
			const filter: Record<string, boolean | string | Date> | null =
				queryParam.filter || null;
			const offset = (page - 1) * limit;

			DatatableToolkit.assertFilterKeys(
				filter,
				filterFieldNames(permissionFilterableFields),
			);
			DatatableToolkit.assertFilterEnums(filter, permissionFilterableFields);

			let whereCondition: SQL | undefined;

			if (search) {
				whereCondition = or(
					ilike(permissions.name, `%${search}%`),
					ilike(permissions.group, `%${search}%`),
				);
			}

			/* Every matching filter is ANDed together. Assigning to a single
			   accumulator here instead would let the last matching block overwrite
			   the earlier ones — which is exactly what happened when both `name` and
			   `group` were passed: only `group` applied. */
			const filterClauses: (SQL | undefined)[] = [];
			if (filter) {
				if (filter.name) {
					filterClauses.push(
						ilike(permissions.name, `%${filter.name.toString()}%`),
					);
				}

				if (filter.group) {
					filterClauses.push(
						ilike(permissions.group, `%${filter.group.toString()}%`),
					);
				}

				if (filter.createdAt) {
					const { from, to } = DatatableToolkit.filterDateRange(
						filter.createdAt,
						"createdAt",
					);
					filterClauses.push(
						gte(permissions.created_at, from),
						lte(permissions.created_at, to),
					);
				}

				if (filter.updatedAt) {
					const { from, to } = DatatableToolkit.filterDateRange(
						filter.updatedAt,
						"updatedAt",
					);
					filterClauses.push(
						gte(permissions.updated_at, from),
						lte(permissions.updated_at, to),
					);
				}
			}

			const finalWhereCondition: SQL | undefined = and(
				whereCondition,
				...filterClauses,
			);

			const orderColumn = DatatableToolkit.parseSort(
				permissionOrderableColumns,
				orderBy,
			);

			const rawData = await database.query.permissions.findMany({
				where: finalWhereCondition,
				orderBy:
					orderDirection === "asc" ? asc(orderColumn) : desc(orderColumn),
				columns: {
					id: true,
					name: true,
					group: true,
					created_at: true,
					updated_at: true,
				},
				limit,
				offset,
			});

			const totalCount = await database.$count(
				permissions,
				finalWhereCondition,
			);

			return {
				data: rawData,
				meta: {
					page,
					limit,
					totalCount,
				},
			};
		},

		getDetail: async (
			id: string,
			tx?: DbTransaction,
		): Promise<PermissionList> => {
			const database = tx || dbInstance;
			const permission = await database.query.permissions.findFirst({
				where: and(eq(permissions.id, id)),
				columns: {
					id: true,
					name: true,
					group: true,
					created_at: true,
					updated_at: true,
				},
			});

			if (!permission) {
				throw new NotFoundError(t("permission.notFound"));
			}

			return permission;
		},

		create: async (
			data: { name: string[]; group: string },
			tx?: DbTransaction,
		): Promise<void> => {
			const database = tx || dbInstance;
			const permissionNames: string[] = data.name.map(
				(name) => `${data.group} ${name}`,
			);

			const existingPermissions = await database.query.permissions.findMany({
				where: or(
					...permissionNames.map((name) => ilike(permissions.name, name)),
				),
			});

			if (existingPermissions.length > 0) {
				throw new UnprocessableEntityError(t("permission.someExists"), [
					{
						field: "name",
						message: t("permission.someExistsList", {
							names: existingPermissions.map((perm) => perm.name).join(", "),
						}),
					},
				]);
			}

			const insertedData = data.name.map((name) => ({
				name: `${data.group} ${name}`,
				group: data.group,
			}));

			await database.insert(permissions).values(insertedData);
		},

		update: async (
			id: string,
			data: { name: string; group: string },
			tx?: DbTransaction,
		): Promise<void> => {
			const database = tx || dbInstance;
			const permission = await database.query.permissions.findFirst({
				where: eq(permissions.id, id),
			});

			if (!permission) {
				throw new NotFoundError(t("permission.notFound"));
			}

			const isPermissionNameAlreadyExist = await database
				.select()
				.from(permissions)
				.where(
					and(eq(permissions.name, data.name), not(eq(permissions.id, id))),
				)
				.limit(1);

			if (isPermissionNameAlreadyExist.length > 0) {
				throw new UnprocessableEntityError(t("permission.nameExists"), [
					{
						field: "name",
						message: t("permission.nameExists"),
					},
				]);
			}

			await database
				.update(permissions)
				.set({
					name: data.name,
					group: data.group,
				})
				.where(eq(permissions.id, id));
		},

		delete: async (id: string, tx?: DbTransaction): Promise<void> => {
			const database = tx || dbInstance;
			const permission = await database.query.permissions.findFirst({
				where: eq(permissions.id, id),
			});

			if (!permission) {
				throw new NotFoundError(t("permission.notFound"));
			}

			await database.delete(permissions).where(eq(permissions.id, id));
		},

		selectOptions: async (
			tx?: DbTransaction,
		): Promise<PermissionSelectOptions[]> => {
			const database = tx || dbInstance;
			const dataPermissions = await database.query.permissions.findMany({
				columns: { id: true, name: true, group: true },
			});
			const grouped: Record<string, PermissionSelectOptions["permissions"]> =
				{};
			dataPermissions.forEach((perm) => {
				if (!grouped[perm.group]) grouped[perm.group] = [];
				grouped[perm.group].push(perm);
			});
			return Object.entries(grouped).map(([group, permissionData]) => ({
				group,
				permissions: permissionData,
			}));
		},
	};
};
