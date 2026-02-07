import { db, DbTransaction, rolePermissions, roles } from "@database";
import { defaultSort } from "@default";
import { UnprocessableEntityError } from "@errors";
import {
	DatatableType,
	PaginationResponse,
	RoleList,
	SortDirection,
} from "@types";
import { DatatableToolkit } from "@utils";
import { and, asc, desc, eq, ilike, ne, not, or, SQL } from "drizzle-orm";
import { NotFoundError } from "elysia";

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

			let whereCondition: SQL | undefined;
			if (search) {
				whereCondition = or(ilike(roles.name, `%${search}%`));
			}

			let filteredCondition: SQL | undefined = undefined;
			if (filter) {
				if (filter.name) {
					filteredCondition = and(
						whereCondition,
						ilike(roles.name, `%${filter.name.toString()}%`),
					);
				}
			}

			const finalWhereCondition: SQL | undefined = and(
				whereCondition,
				filteredCondition,
			);

			const orderColumn = DatatableToolkit.parseSort(
				{
					id: roles.id,
					name: roles.name,
					createdAt: roles.created_at,
					updatedAt: roles.updated_at,
				},
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
				throw new UnprocessableEntityError("Role name already exists", [
					{
						field: "name",
						message: `The role name for ${data.name} already exists`,
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
				throw new NotFoundError("Role not found");
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
				throw new NotFoundError("Role not found");
			}

			const isNameExists = await database.query.roles.findFirst({
				where: and(eq(roles.name, data.name), not(eq(roles.id, id))),
			});

			if (isNameExists) {
				throw new UnprocessableEntityError("Role name already exists", [
					{
						field: "name",
						message: `The role name for ${data.name} already exists`,
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
				throw new NotFoundError("Role not found");
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
