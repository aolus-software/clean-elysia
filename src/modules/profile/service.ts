import { Cache, UserInformationCacheKey } from "@cache";
import { db, users } from "@database";
import { NotFoundError, UnprocessableEntityError } from "@errors";
import { t } from "@i18n";
import { UserRepository } from "@repositories";
import { UserInformation } from "@types";
import { Hash, log } from "@utils";
import { eq } from "drizzle-orm";

export const ProfileService = {
	updateProfile: async (
		userId: string,
		data: { name: string; email: string },
	): Promise<UserInformation> => {
		const user = await UserRepository().getDetail(userId);
		if (!user) {
			throw new NotFoundError("User not found");
		}

		if (data.email !== user.email) {
			const existingUser = await UserRepository().findByEmail(data.email);
			if (existingUser) {
				throw new UnprocessableEntityError("Validation error", [
					{
						field: "email",
						message: "Email is already registered",
					},
				]);
			}
		}

		await db.transaction(async (tx) => {
			await UserRepository().update(
				userId,
				{
					name: data.name,
					email: data.email,
				},
				tx,
			);
		});

		const userInformation = await UserRepository().UserInformation(userId);
		await Cache.set(UserInformationCacheKey(userId), userInformation, 3600);

		return userInformation;
	},

	changePassword: async (
		userId: string,
		data: { currentPassword: string; newPassword: string },
	): Promise<void> => {
		const user = await UserRepository().findById(userId);
		if (!user) {
			throw new NotFoundError(t("auth.userNotFound"));
		}

		const isCurrentPasswordValid = await Hash.compareHash(
			data.currentPassword,
			user.password,
		);
		if (!isCurrentPasswordValid) {
			throw new UnprocessableEntityError(t("auth.validationError"), [
				{
					field: "currentPassword",
					message: t("profile.currentPasswordIncorrect"),
				},
			]);
		}

		const hashedPassword = await Hash.generateHash(data.newPassword);
		await db.transaction(async (tx) => {
			await tx
				.update(users)
				.set({ password: hashedPassword })
				.where(eq(users.id, userId));
		});

		await Cache.delete(UserInformationCacheKey(userId));

		log.info({ userId }, "Password changed successfully");
	},
};
