import { sendEmailQueue } from "@bull";
import { AppConfig } from "@config";
import { db, DbTransaction, emailVerifications } from "@database";
import { resetPasswordLifetime, verificationTokenLifetime } from "@default";
import { getCurrentLocale, t } from "@i18n";
import { ForgotPasswordRepository, UserRepository } from "@repositories";
import { log, StrToolkit } from "@utils";
import { NotFoundError } from "elysia";

export class AuthMailService {
	async sendVerificationEmail(userId: string, tx?: DbTransaction) {
		const user = await UserRepository().getDetail(userId);
		if (!user) {
			throw new NotFoundError(t("user.notFound"));
		}

		const token = StrToolkit.random(100);
		const lang = getCurrentLocale();

		const dbInstance = tx ? tx : db;
		await dbInstance.insert(emailVerifications).values({
			token,
			user_id: user.id,
			expired_at: verificationTokenLifetime(),
		});

		// Queue email instead of blocking
		await sendEmailQueue.add("send-email", {
			subject: t("mail.subject.verification"),
			to: user.email,
			template: "auth/email-verification",
			lang,
			variables: {
				user_id: user.id,
				user_name: user.name,
				user_email: user.email,
				verification_url: `${AppConfig.CLIENT_URL}/auth/verify-email?token=${token}`,
			},
		});

		log.info(
			{ userId: user.id, email: user.email },
			"User registered successfully",
		);
	}

	async sendResetPasswordEmail(userId: string) {
		const user = await UserRepository().getDetail(userId);
		if (!user) {
			throw new NotFoundError(t("user.notFound"));
		}

		const token = StrToolkit.random(255);
		const lang = getCurrentLocale();

		await ForgotPasswordRepository().create({
			user_id: user.id,
			token,
			expired_at: resetPasswordLifetime(),
		});

		// Queue email instead of blocking
		await sendEmailQueue.add("send-email", {
			subject: t("mail.subject.resetPassword"),
			to: user.email,
			template: "auth/forgot-password",
			lang,
			variables: {
				user_id: user.id,
				user_name: user.name,
				user_email: user.email,
				reset_password_url: `${AppConfig.CLIENT_URL}/auth/reset-password?token=${token}`,
			},
		});

		log.info(
			{ userId: user.id, email: user.email },
			"Password reset email queued successfully",
		);
	}
}
