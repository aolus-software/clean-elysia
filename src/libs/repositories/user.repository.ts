import {
	db,
	DbTransaction,
	userRoles,
	users,
	UserStatus,
	UserStatusEnum,
} from "@database";
import { defaultSort } from "@default";
import { BadRequestError, UnauthorizedError } from "@errors";
import { t } from "@i18n";
import {
	DatatableType,
	FilterField,
	filterFieldNames,
	PaginationResponse,
	SortDirection,
	UserCreate,
	UserDetail,
	UserForAuth,
	UserInformation,
	UserList,
} from "@types";
import { DatatableToolkit, Hash } from "@utils";
import {
	and,
	asc,
	desc,
	eq,
	exists,
	gte,
	ilike,
	inArray,
	isNull,
	lte,
	not,
	or,
	SQL,
} from "drizzle-orm";

/* Keys are the API-facing sort names (camelCase, aligned with the shared
   defaultSort constant); values are the snake_case Drizzle columns they map
   onto. */
const userOrderableColumns = {
	id: users.id,
	name: users.name,
	email: users.email,
	status: users.status,
	createdAt: users.created_at,
	updatedAt: users.updated_at,
};

/* The ?sort= and filter[...] values this repository accepts. Exported so the
   module can document them in OpenAPI from one source of truth rather than
   restating the list. An unrecognised value is rejected, not ignored. */
export const userSortableFields = Object.keys(userOrderableColumns);
export const userFilterableFields: FilterField[] = [
	{ field: "status", enum: Object.values(UserStatus) },
	"name",
	"email",
	{ field: "roleId", kind: "id" },
	{ field: "createdAt", kind: "date" },
	{ field: "updatedAt", kind: "date" },
];

/* Example value per non-enum filter key, rendered as the concrete sample in
   /docs. Enum keys take their example from the enum. */
export const userFilterExample: Record<string, string> = {
	name: "jane",
	email: "jane@example.com",
	roleId: "550e8400-e29b-41d4-a716-446655440000",
	createdAt: "2024-01-01,2024-12-31",
	updatedAt: "2024-01-01,2024-12-31",
};

export const UserRepository = () => {
	const dbInstance = db;

	return {
		db: dbInstance,
		getDb: (tx?: DbTransaction) => tx || dbInstance.$cache,

		findAll: async (
			queryParam: DatatableType,
			tx?: DbTransaction,
		): Promise<PaginationResponse<UserList>> => {
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
				filterFieldNames(userFilterableFields),
			);
			DatatableToolkit.assertFilterEnums(filter, userFilterableFields);

			let whereCondition: SQL | undefined = isNull(users.deleted_at);
			if (search) {
				whereCondition = and(
					whereCondition,
					or(
						ilike(users.name, `%${search}%`),
						ilike(users.email, `%${search}%`),
						ilike(users.status, `%${search}%`),
					),
				);
			}

			/* Every matching filter is ANDed together. Assigning to a single
			   accumulator here instead would let the last matching block overwrite
			   the earlier ones, silently dropping every filter but one. */
			const filterClauses: (SQL | undefined)[] = [];
			if (filter) {
				if (filter.status) {
					filterClauses.push(
						inArray(
							users.status,
							DatatableToolkit.filterValues(filter.status) as UserStatusEnum[],
						),
					);
				}

				if (filter.name) {
					filterClauses.push(ilike(users.name, `%${filter.name.toString()}%`));
				}

				if (filter.email) {
					filterClauses.push(
						ilike(users.email, `%${filter.email.toString()}%`),
					);
				}

				if (filter.roleId) {
					filterClauses.push(
						exists(
							database
								.select()
								.from(userRoles)
								.where(
									and(
										eq(userRoles.user_id, users.id),
										inArray(
											userRoles.role_id,
											DatatableToolkit.filterValues(filter.roleId),
										),
									),
								),
						),
					);
				}

				if (filter.createdAt) {
					const { from, to } = DatatableToolkit.filterDateRange(
						filter.createdAt,
						"createdAt",
					);
					filterClauses.push(
						gte(users.created_at, from),
						lte(users.created_at, to),
					);
				}

				if (filter.updatedAt) {
					const { from, to } = DatatableToolkit.filterDateRange(
						filter.updatedAt,
						"updatedAt",
					);
					filterClauses.push(
						gte(users.updated_at, from),
						lte(users.updated_at, to),
					);
				}
			}

			const finalWhereCondition: SQL | undefined = and(
				whereCondition,
				...filterClauses,
			);

			const orderColumn = DatatableToolkit.parseSort(
				userOrderableColumns,
				orderBy,
			);

			const [data, totalCount] = await Promise.all([
				database.query.users.findMany({
					where: finalWhereCondition,
					orderBy:
						orderDirection === "asc" ? asc(orderColumn) : desc(orderColumn),
					limit,
					offset,
					columns: {
						id: true,
						name: true,
						email: true,
						status: true,
						remark: true,
						created_at: true,
						updated_at: true,
					},
					with: {
						user_roles: {
							columns: {
								role_id: true,
								user_id: true,
							},
							with: {
								role: {
									columns: {
										id: true,
										name: true,
									},
								},
							},
						},
					},
				}),
				database.$count(users, finalWhereCondition),
			]);

			const formattedData: UserList[] = data.map((user) => ({
				id: user.id,
				name: user.name,
				email: user.email,
				status: user.status,
				remark: user.remark,
				roles: user.user_roles.map((userRole) => userRole.role.name),
				created_at: user.created_at,
				updated_at: user.updated_at,
			}));

			return {
				data: formattedData,
				meta: {
					page,
					limit,
					totalCount,
				},
			};
		},

		create: async (
			data: UserCreate,
			tx?: DbTransaction,
		): Promise<UserDetail> => {
			const database = tx || dbInstance;

			const hashedPassword = await Hash.generateHash(data.password);
			const user = await database
				.insert(users)
				.values({
					name: data.name,
					email: data.email,
					password: hashedPassword,
					status: data.status || "active",
					remark: data.remark || null,
				})
				.returning();

			if (data.roleIds && data.roleIds.length > 0) {
				if (user.length > 0) {
					const userId = user[0].id;
					const userRolesData: {
						user_id: string;
						role_id: string;
					}[] = data.roleIds.map((role_id) => ({
						user_id: userId,
						role_id: role_id,
					}));

					await database.insert(userRoles).values(userRolesData);
				}
			}

			if (user.length === 0) {
				throw new BadRequestError(t("user.createFailed"), [
					{
						field: "user",
						message: t("user.createFailedDetail"),
					},
				]);
			}

			const userDetail = await database.query.users.findFirst({
				where: and(eq(users.id, user[0].id), isNull(users.deleted_at)),
				columns: {
					id: true,
					name: true,
					email: true,
					status: true,
					remark: true,
					created_at: true,
					updated_at: true,
				},
				with: {
					user_roles: {
						columns: {
							role_id: true,
							user_id: true,
						},
						with: {
							role: {
								columns: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			});

			if (!userDetail) {
				throw new BadRequestError(t("user.createRetrieveFailed"), [
					{
						field: "user",
						message: t("user.retrieveFailedDetail"),
					},
				]);
			}

			return {
				id: userDetail.id,
				name: userDetail.name,
				email: userDetail.email,
				status: userDetail.status,
				remark: userDetail.remark,
				roles: userDetail.user_roles.map((userRole) => ({
					id: userRole.role.id,
					name: userRole.role.name,
				})),
				created_at: userDetail.created_at,
				updated_at: userDetail.updated_at,
			};
		},

		findById: async (userId: string, tx?: DbTransaction) => {
			const database = tx || dbInstance;

			const user = await database.query.users.findFirst({
				where: and(eq(users.id, userId), isNull(users.deleted_at)),
			});

			return user || null;
		},

		/* Uniqueness lookup for the service's create/update checks. Only live
		   users count — a soft-deleted row's address is reusable, which is why the
		   column carries no database-level unique constraint. `excludeId` is the
		   record being updated, so saving it without changing the address does not
		   collide with itself. */
		findLiveByEmail: async (
			email: string,
			excludeId?: string,
			tx?: DbTransaction,
		) => {
			const database = tx || dbInstance;

			const user = await database.query.users.findFirst({
				where: excludeId
					? and(
							eq(users.email, email),
							isNull(users.deleted_at),
							not(eq(users.id, excludeId)),
						)
					: and(eq(users.email, email), isNull(users.deleted_at)),
			});

			return user || null;
		},

		getDetail: async (
			userId: string,
			tx?: DbTransaction,
		): Promise<UserDetail | null> => {
			const database = tx || dbInstance;
			const user = await database.query.users.findFirst({
				where: and(eq(users.id, userId), isNull(users.deleted_at)),

				columns: {
					id: true,
					name: true,
					email: true,
					status: true,
					remark: true,
					created_at: true,
					updated_at: true,
				},

				with: {
					user_roles: {
						columns: {
							role_id: true,
							user_id: true,
						},

						with: {
							role: {
								columns: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			});

			if (!user) {
				return null;
			}

			return {
				id: user.id,
				name: user.name,
				email: user.email,
				status: user.status,
				remark: user.remark,
				roles: user.user_roles.map((userRole) => ({
					id: userRole.role.id,
					name: userRole.role.name,
				})),
				created_at: user.created_at,
				updated_at: user.updated_at,
			};
		},

		update: async (
			userId: string,
			data: Omit<UserCreate, "password">,
			tx?: DbTransaction,
		): Promise<void> => {
			const database = tx || dbInstance;

			/* Only the fields the caller actually supplied are written, so an
			   omitted status or remark keeps whatever is stored. Reading the row
			   first to echo its own values back was the previous approach and cost
			   an extra query for the same result. */
			const changes: Partial<{
				name: string;
				email: string;
				status: UserStatusEnum;
				remark: string | null;
			}> = {
				name: data.name,
				email: data.email,
			};

			if (data.status) {
				changes.status = data.status;
			}

			if (data.remark) {
				changes.remark = data.remark;
			}

			await database.update(users).set(changes).where(eq(users.id, userId));

			// remove all role or adding new role
			if (data.roleIds && data.roleIds.length > 0) {
				await database.delete(userRoles).where(eq(userRoles.user_id, userId));

				const userRolesData: {
					user_id: string;
					role_id: string;
				}[] = data.roleIds.map((role_id) => ({
					user_id: userId,
					role_id,
				}));
				await database.insert(userRoles).values(userRolesData);
			} else {
				await database.delete(userRoles).where(eq(userRoles.user_id, userId));
			}
		},

		delete: async (userId: string, tx?: DbTransaction): Promise<void> => {
			const database = tx || dbInstance;

			await database
				.update(users)
				.set({ deleted_at: new Date() })
				.where(eq(users.id, userId));
		},

		UserInformation: async (
			userId: string,
			tx?: DbTransaction,
		): Promise<UserInformation> => {
			const database = tx || dbInstance;
			const user = await database.query.users.findFirst({
				where: and(
					eq(users.id, userId),
					eq(users.status, "active"),
					isNull(users.deleted_at),
				),

				columns: {
					id: true,
					email: true,
					name: true,
				},

				with: {
					user_roles: {
						columns: {
							role_id: true,
							user_id: true,
						},

						with: {
							role: {
								columns: {
									id: true,
									name: true,
								},
								with: {
									role_permissions: {
										columns: {
											role_id: true,
											permission_id: true,
										},
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
							},
						},
					},
				},
			});

			if (!user) {
				throw new UnauthorizedError(t("user.notFound"));
			}

			return {
				id: user.id,
				email: user.email,
				name: user.name,
				roles: user.user_roles.map((userRole) => userRole.role.name),
				permissions: user.user_roles.flatMap((userRole) =>
					userRole.role.role_permissions.map(
						(rolePermission) => rolePermission.permission.name,
					),
				),
			};
		},

		findByEmail: async (
			email: string,
			tx?: DbTransaction,
		): Promise<UserForAuth | null> => {
			const database = tx || dbInstance;
			const user = await database.query.users.findFirst({
				where: and(eq(users.email, email), isNull(users.deleted_at)),
				columns: {
					id: true,
					name: true,
					email: true,
					password: true,
					status: true,
					email_verified_at: true,
				},
			});

			if (!user) {
				return null;
			}

			return user;
		},
	};
};
