import { db, DbTransaction, userRoles, users, UserStatusEnum } from "@database";
import { defaultSort } from "@default";
import { BadRequestError, UnauthorizedError } from "@errors";
import {
	DatatableType,
	PaginationResponse,
	SortDirection,
	UserCreate,
	UserDetail,
	UserForAuth,
	UserInformation,
	UserList,
} from "@types";
import { Hash } from "@utils";
import {
	and,
	asc,
	desc,
	eq,
	exists,
	ilike,
	isNull,
	or,
	SQL,
} from "drizzle-orm";
import { NotFoundError } from "elysia";

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

			let filteredCondition: SQL | undefined = undefined;
			if (filter) {
				if (filter.status) {
					filteredCondition = and(
						whereCondition,
						eq(users.status, filter.status as UserStatusEnum),
					);
				}

				if (filter.name) {
					filteredCondition = and(
						whereCondition,
						ilike(users.name, `%${filter.name.toString()}%`),
					);
				}

				if (filter.email) {
					filteredCondition = and(
						whereCondition,
						ilike(users.email, `%${filter.email.toString()}%`),
					);
				}

				if (filter.role_id) {
					filteredCondition = and(
						whereCondition,
						exists(
							database
								.select()
								.from(userRoles)
								.where(
									and(
										eq(userRoles.user_id, users.id),
										eq(userRoles.role_id, filter.role_id as string),
									),
								),
						),
					);
				}
			}

			const finalWhereCondition: SQL | undefined = and(
				whereCondition,
				filteredCondition ? filteredCondition : undefined,
			);

			const validateOrderBy = {
				id: users.id,
				name: users.name,
				email: users.email,
				status: users.status,
				created_at: users.created_at,
				updated_at: users.updated_at,
			};

			type OrderableKey = keyof typeof validateOrderBy;
			const normalizedOrderBy: OrderableKey = (
				Object.keys(validateOrderBy) as OrderableKey[]
			).includes(orderBy as OrderableKey)
				? (orderBy as OrderableKey)
				: ("id" as OrderableKey);

			const orderColumn = validateOrderBy[normalizedOrderBy];

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

			// validate is the email exist
			const isEmailExist = await database
				.select()
				.from(users)
				.where(and(eq(users.email, data.email), isNull(users.deleted_at)))
				.limit(1);

			if (isEmailExist.length > 0) {
				throw new BadRequestError("Email already exists", [
					{
						field: "email",
						message: "Email already exists",
					},
				]);
			}

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

			if (data.role_ids && data.role_ids.length > 0) {
				if (user.length > 0) {
					const userId = user[0].id;
					const userRolesData: {
						user_id: string;
						role_id: string;
					}[] = data.role_ids.map((role_id) => ({
						user_id: userId,
						role_id: role_id,
					}));

					await database.insert(userRoles).values(userRolesData);
				}
			}

			if (user.length === 0) {
				throw new BadRequestError("Failed to create user", [
					{
						field: "user",
						message: "User creation failed",
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
				throw new BadRequestError("Failed to retrieve created user", [
					{
						field: "user",
						message: "User retrieval failed",
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

		getDetail: async (
			userId: string,
			tx?: DbTransaction,
		): Promise<UserDetail> => {
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
				throw new NotFoundError("User not found");
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
			const user = await database.query.users.findFirst({
				where: and(eq(users.id, userId), isNull(users.deleted_at)),
			});

			if (!user) {
				throw new NotFoundError("User not found");
			}

			await database
				.update(users)
				.set({
					name: data.name,
					email: data.email,
					status: data.status || user.status,
					remark: data.remark || user.remark,
				})
				.where(eq(users.id, userId));

			// remove all role or adding new role
			if (data.role_ids && data.role_ids.length > 0) {
				await database.delete(userRoles).where(eq(userRoles.user_id, userId));

				const userRolesData: {
					user_id: string;
					role_id: string;
				}[] = data.role_ids.map((role_id) => ({
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
			const user = await database.query.users.findFirst({
				where: and(eq(users.id, userId), isNull(users.deleted_at)),
			});

			if (!user) {
				throw new NotFoundError("User not found");
			}

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
				throw new UnauthorizedError("User not found");
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
		): Promise<UserForAuth> => {
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
				throw new BadRequestError("Validation error", [
					{
						field: "email",
						message: "Invalid email or password",
					},
				]);
			}

			return user;
		},
	};
};
