// import { sendEmailQueue } from "@app/worker/queue/send-email.queue";
// import { AppConfig } from "@config";
// import { verificationTokenLifetime } from "@default/token-lifetime";
// import { log } from "@packages";
// import { db } from "@postgres/index";
// import {
// 	DbTransaction,
// 	ForgotPasswordRepository,
// 	UserRepository,
// } from "@postgres/repositories";
// import { emailVerifications } from "@postgres/schema";
// import { StrToolkit } from "@toolkit/string";

import { sendEmailQueue } from "@bull";
import { AppConfig } from "@config";
import { db, DbTransaction, emailVerifications } from "@database";
import { verificationTokenLifetime } from "@default";
import { ForgotPasswordRepository, UserRepository } from "@repositories";
import { log, StrToolkit } from "@utils";

export class AuthMailService {
	async sendVerificationEmail(userId: string, tx?: DbTransaction) {
		const user = await UserRepository().getDetail(userId);
		const token = StrToolkit.random(100);

		const dbInstance = tx ? tx : db;
		await dbInstance.insert(emailVerifications).values({
			token,
			user_id: user.id,
			expired_at: verificationTokenLifetime,
		});

		// Queue email instead of blocking
		await sendEmailQueue.add("send-email", {
			subject: "Email verification",
			to: user.email,
			template: "/auth/email-verification",
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
		const token = StrToolkit.random(255);
		await ForgotPasswordRepository().create({
			user_id: user.id,
			token,
		});

		// Queue email instead of blocking
		await sendEmailQueue.add("send-email", {
			subject: "Reset Password",
			to: user.email,
			template: "/auth/forgot-password",
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
