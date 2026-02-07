import { db, DbTransaction, permissions } from "@database";
import { defaultSort } from "@default";
import { UnprocessableEntityError } from "@errors";
import {
	DatatableType,
	PaginationResponse,
	PermissionList,
	PermissionSelectOptions,
	SortDirection,
} from "@types";
import { and, asc, desc, eq, ilike, not, or, SQL } from "drizzle-orm";
import { NotFoundError } from "elysia";

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

			let whereCondition: SQL | undefined;

			if (search) {
				whereCondition = or(
					ilike(permissions.name, `%${search}%`),
					ilike(permissions.group, `%${search}%`),
				);
			}

			let filteredCondition: SQL | undefined = undefined;
			if (filter) {
				if (filter.name) {
					filteredCondition = and(
						whereCondition,
						ilike(permissions.name, `%${filter.name.toString()}%`),
					);
				}

				if (filter.group) {
					filteredCondition = and(
						whereCondition,
						ilike(permissions.group, `%${filter.group.toString()}%`),
					);
				}
			}

			const finalWhereCondition: SQL | undefined = and(
				whereCondition,
				filteredCondition ? filteredCondition : undefined,
			);

			const validateOrderBy = {
				id: permissions.id,
				name: permissions.name,
				group: permissions.group,
				created_at: permissions.created_at,
				updated_at: permissions.updated_at,
			};

			type OrderableKey = keyof typeof validateOrderBy;
			const normalizedOrderBy: OrderableKey = (
				Object.keys(validateOrderBy) as OrderableKey[]
			).includes(orderBy as OrderableKey)
				? (orderBy as OrderableKey)
				: ("id" as OrderableKey);

			const orderColumn = validateOrderBy[normalizedOrderBy];

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
				throw new NotFoundError("Permission not found");
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
				throw new UnprocessableEntityError("Some permission already exists", [
					{
						field: "name",
						message: `Some permission is already exist ${existingPermissions.map((perm) => perm.name).join(", ")}`,
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
				throw new NotFoundError("Permission not found");
			}

			const isPermissionNameAlreadyExist = await database
				.select()
				.from(permissions)
				.where(
					and(eq(permissions.name, data.name), not(eq(permissions.id, id))),
				)
				.limit(1);

			if (isPermissionNameAlreadyExist.length > 0) {
				throw new UnprocessableEntityError("Permission name already exists", [
					{
						field: "name",
						message: "Permission name already exists",
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
				throw new NotFoundError("Permission not found");
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
