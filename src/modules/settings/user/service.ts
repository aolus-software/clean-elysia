import { db, users, UserStatusEnum } from "@database";
import { BadRequestError } from "@errors";
import { t } from "@i18n";
import { AuthMailService } from "@mailer";
import { UserRepository } from "@repositories";
import { DatatableType, PaginationResponse, UserList } from "@types";
import { Hash } from "@utils";
import { eq } from "drizzle-orm";
import { NotFoundError } from "elysia";

export const UserService = {
	findAll: async (
		queryParam: DatatableType,
	): Promise<PaginationResponse<UserList>> => {
		return await UserRepository().findAll(queryParam);
	},

	create: async (data: {
		name: string;
		email: string;
		password: string;
		status: UserStatusEnum;
		remarks?: string;
		role_ids: string[];
	}) => {
		const existing = await UserRepository().findLiveByEmail(data.email);
		if (existing) {
			throw new BadRequestError(t("user.emailExists"), [
				{
					field: "email",
					message: t("user.emailExists"),
				},
			]);
		}

		await UserRepository().create(data);
	},

	findOne: async (id: string) => {
		const user = await UserRepository().getDetail(id);
		if (!user) {
			throw new NotFoundError(t("user.notFound"));
		}

		return user;
	},

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
		const user = await UserRepository().findById(id);
		if (!user) {
			throw new NotFoundError(t("user.notFound"));
		}

		const existing = await UserRepository().findLiveByEmail(data.email, id);
		if (existing) {
			throw new BadRequestError(t("user.emailExists"), [
				{
					field: "email",
					message: t("user.emailExists"),
				},
			]);
		}

		return await UserRepository().update(id, data);
	},

	resetPassword: async (id: string, newPassword: string) => {
		const user = await UserService.findOne(id);

		const hashPassword = await Hash.generateHash(newPassword);
		await db.transaction(async (tx) => {
			await tx
				.update(users)
				.set({ password: hashPassword })
				.where(eq(users.id, user.id));
		});
	},

	sendEmailVerification: async (id: string) => {
		const user = await UserService.findOne(id);
		const authMailService = new AuthMailService();
		await authMailService.sendVerificationEmail(user.id);
	},

	sendResetPasswordEmail: async (id: string) => {
		const user = await UserService.findOne(id);
		const authMailService = new AuthMailService();
		await authMailService.sendResetPasswordEmail(user.id);
	},

	delete: async (id: string) => {
		const user = await UserRepository().findById(id);
		if (!user) {
			throw new NotFoundError(t("user.notFound"));
		}

		return await UserRepository().delete(id);
	},
};
