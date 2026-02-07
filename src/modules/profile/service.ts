import { Cache, UserInformationCacheKey } from "@cache";
import { db } from "@database";
import { UnprocessableEntityError } from "@errors";
import { UserRepository } from "@repositories";
import { UserInformation } from "@types";
import { NotFoundError } from "elysia";

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
};
