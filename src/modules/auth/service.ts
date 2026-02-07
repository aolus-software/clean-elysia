import { db, emailVerifications, users } from "@database";
import { BadRequestError } from "@errors";
import { AuthMailService } from "@mailer";
import { ForgotPasswordRepository, UserRepository } from "@repositories";
import { UserInformation } from "@types";
import { Hash, log } from "@utils";
import { eq } from "drizzle-orm";

export const AuthService = {
	singIn: async (email: string, password: string): Promise<UserInformation> => {
		try {
			const user = await UserRepository().findByEmail(email);

			if (!user) {
				throw new BadRequestError("Validation error", [
					{
						field: "email",
						message: "Invalid email or password",
					},
				]);
			}

			if (user.email_verified_at === null) {
				throw new BadRequestError("Validation error", [
					{
						field: "email",
						message: "Email not verified. Please check your inbox.",
					},
				]);
			}

			if (user.status !== "active") {
				throw new BadRequestError("Validation error", [
					{
						field: "email",
						message: "Your account is inactive. Please contact support.",
					},
				]);
			}

			const isPasswordValid = await Hash.compareHash(password, user.password);

			if (!isPasswordValid) {
				throw new BadRequestError("Validation error", [
					{
						field: "email",
						message: "Invalid email or password",
					},
				]);
			}

			// Log successful login
			log.info(
				{ userId: user.id, email: user.email },
				"User logged in successfully",
			);

			return await UserRepository().UserInformation(user.id);
		} catch (error) {
			if (error instanceof BadRequestError) {
				throw error;
			}
			log.error({ error, email }, "Login error");
			throw new BadRequestError("Validation error", [
				{
					field: "email",
					message: "An error occurred during login",
				},
			]);
		}
	},

	register: async (data: {
		name: string;
		email: string;
		password: string;
	}): Promise<void> => {
		try {
			const existingUser = await UserRepository()
				.findByEmail(data.email)
				.catch(() => null);

			if (existingUser) {
				throw new BadRequestError("Validation error", [
					{
						field: "email",
						message: "Email is already registered",
					},
				]);
			}

			const hashedPassword = await Hash.generateHash(data.password);

			await db.transaction(async (tx) => {
				const newUser = await UserRepository().create(
					{
						name: data.name,
						email: data.email,
						password: hashedPassword,
					},
					tx,
				);

				const authMailService = new AuthMailService();
				await authMailService.sendVerificationEmail(newUser.id, tx);
			});
		} catch (error) {
			if (error instanceof BadRequestError) {
				throw error;
			}
			log.error({ error, email: data.email }, "Registration error");
			throw new BadRequestError("Validation error", [
				{
					field: "general",
					message: "An error occurred during registration",
				},
			]);
		}
	},

	async resentVerificationEmail(email: string): Promise<void> {
		try {
			const user = await UserRepository()
				.findByEmail(email)
				.catch(() => null);

			if (!user) {
				return;
			}

			if (user.email_verified_at) {
				log.info(
					{ userId: user.id, email },
					"Verification email requested for already verified user",
				);
				return;
			}

			const authMailService = new AuthMailService();
			await authMailService.sendVerificationEmail(user.id);
		} catch (error) {
			log.error({ error, email }, "Error resending verification email");
		}
	},

	verifyEmail: async (token: string): Promise<void> => {
		try {
			const record =
				(
					await db
						.select()
						.from(emailVerifications)
						.where(eq(emailVerifications.token, token))
				)[0] ?? null;

			if (!record || record.expired_at < new Date()) {
				throw new BadRequestError("Validation error", [
					{
						field: "token",
						message: "Invalid or expired verification token",
					},
				]);
			}

			await db.transaction(async (trx) => {
				await trx
					.update(users)
					.set({ email_verified_at: new Date() })
					.where(eq(users.id, record.user_id));

				await trx
					.delete(emailVerifications)
					.where(eq(emailVerifications.user_id, record.user_id));
			});

			log.info({ userId: record.user_id }, "Email verified successfully");
		} catch (error) {
			if (error instanceof BadRequestError) {
				throw error;
			}
			log.error({ error, token }, "Email verification error");
			throw new BadRequestError("Validation error", [
				{
					field: "token",
					message: "An error occurred during email verification",
				},
			]);
		}
	},

	forgotPassword: async (email: string): Promise<void> => {
		const user = await UserRepository()
			.findByEmail(email)
			.catch(() => null);

		if (!user) {
			return;
		}

		const authMailService = new AuthMailService();
		await authMailService.sendResetPasswordEmail(user.id);
	},

	resetPassword: async (token: string, password: string): Promise<void> => {
		try {
			const passwordReset = await ForgotPasswordRepository().findByToken(token);

			if (!passwordReset) {
				throw new BadRequestError("Validation error", [
					{
						field: "token",
						message: "Invalid or expired password reset token",
					},
				]);
			}

			const hashedPassword = await Hash.generateHash(password);

			await db.transaction(async (trx) => {
				await trx
					.update(users)
					.set({ password: hashedPassword })
					.where(eq(users.id, passwordReset.user_id));

				await trx
					.delete(ForgotPasswordRepository().getTable())
					.where(
						eq(ForgotPasswordRepository().getTable().id, passwordReset.id),
					);
			});

			log.info(
				{ userId: passwordReset.user_id },
				"Password reset successfully",
			);
		} catch (error) {
			if (error instanceof BadRequestError) {
				throw error;
			}
			log.error({ error, token }, "Password reset error");
			throw new BadRequestError("Validation error", [
				{
					field: "token",
					message: "An error occurred during password reset",
				},
			]);
		}
	},
};
