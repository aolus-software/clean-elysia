import { db, emailVerifications, passwordResetTokens, users } from "@database";
import { BadRequestError, UnprocessableEntityError } from "@errors";
import { t } from "@i18n";
import { AuthMailService } from "@mailer";
import { ForgotPasswordRepository, UserRepository } from "@repositories";
import { UserInformation } from "@types";
import { Hash, log } from "@utils";
import { and, eq, isNull } from "drizzle-orm";

const TIMING_EQUALISER_HASH =
	"$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const AuthService = {
	singIn: async (email: string, password: string): Promise<UserInformation> => {
		const user = await UserRepository().findByEmail(email);

		/* Verify the password before looking at account state, and answer an
		   unknown address and a wrong password with the same message, so an
		   unauthenticated caller cannot tell a registered address from an unknown
		   one. The dummy comparison keeps the unknown-address path as slow as a
		   real one. */
		const isPasswordValid = await Hash.compareHash(
			password,
			user?.password ?? TIMING_EQUALISER_HASH,
		);

		if (!user || !isPasswordValid) {
			throw new BadRequestError(t("auth.validationError"), [
				{
					field: "email",
					message: t("auth.invalidCredentials"),
				},
			]);
		}

		if (user.email_verified_at === null) {
			throw new BadRequestError(t("auth.validationError"), [
				{
					field: "email",
					message: t("auth.emailNotVerified"),
				},
			]);
		}

		if (user.status !== "active") {
			throw new BadRequestError(t("auth.validationError"), [
				{
					field: "email",
					message: t("auth.accountInactive"),
				},
			]);
		}

		// Log successful login
		log.info(
			{ userId: user.id, email: user.email },
			"User logged in successfully",
		);

		return await UserRepository().UserInformation(user.id);
	},

	register: async (data: {
		name: string;
		email: string;
		password: string;
	}): Promise<void> => {
		const existingUser = await UserRepository().findLiveByEmail(data.email);
		if (existingUser) {
			throw new UnprocessableEntityError(t("auth.validationError"), [
				{
					field: "email",
					message: t("auth.emailAlreadyRegistered"),
				},
			]);
		}

		const hashedPassword = await Hash.generateHash(data.password);

		const newUser = await db.transaction(async (tx) => {
			return await UserRepository().create(
				{
					name: data.name,
					email: data.email,
					password: hashedPassword,
				},
				tx,
			);
		});

		const authMailService = new AuthMailService();
		await authMailService.sendVerificationEmail(newUser.id);
	},

	async resentVerificationEmail(email: string): Promise<void> {
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
	},

	verifyEmail: async (token: string): Promise<void> => {
		const record =
			(
				await db
					.select()
					.from(emailVerifications)
					.where(eq(emailVerifications.token, token))
			)[0] ?? null;

		if (!record || record.expired_at < new Date() || record.used_at !== null) {
			throw new BadRequestError(t("auth.validationError"), [
				{
					field: "token",
					message: t("auth.invalidVerificationToken"),
				},
			]);
		}

		await db.transaction(async (trx) => {
			await trx
				.update(users)
				.set({ email_verified_at: new Date() })
				.where(eq(users.id, record.user_id));

			// Stamp rather than delete, so consumption is auditable. Every
			// outstanding token for this user is spent, matching the previous
			// delete-all-for-user behaviour.
			await trx
				.update(emailVerifications)
				.set({ used_at: new Date() })
				.where(
					and(
						eq(emailVerifications.user_id, record.user_id),
						isNull(emailVerifications.used_at),
					),
				);
		});

		log.info({ userId: record.user_id }, "Email verified successfully");
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
		const passwordReset = await ForgotPasswordRepository().findByToken(token);

		if (
			!passwordReset ||
			passwordReset.expired_at < new Date() ||
			passwordReset.used_at !== null
		) {
			throw new BadRequestError(t("auth.validationError"), [
				{
					field: "token",
					message: t("auth.invalidResetToken"),
				},
			]);
		}

		const hashedPassword = await Hash.generateHash(password);

		await db.transaction(async (trx) => {
			await trx
				.update(users)
				.set({ password: hashedPassword })
				.where(eq(users.id, passwordReset.user_id));

			// Stamp rather than delete, so consumption is auditable. Every
			// outstanding reset token for this user is spent — a password that has
			// just changed must invalidate the other links that could change it
			// again.
			await trx
				.update(passwordResetTokens)
				.set({ used_at: new Date() })
				.where(
					and(
						eq(passwordResetTokens.user_id, passwordReset.user_id),
						isNull(passwordResetTokens.used_at),
					),
				);
		});

		log.info({ userId: passwordReset.user_id }, "Password reset successfully");
	},
};
