import { JWT_CONFIG } from "@config";
import { jwt } from "@elysiajs/jwt";
import { UserInformation } from "@types";
import {
	CommonResponseSchemas,
	ResponseToolkit,
	SuccessResponseSchema,
} from "@utils";
import Elysia, { t } from "elysia";

import { baseApp } from "../../base";
import {
	ForgotPasswordSchema,
	LoginResponseSchema,
	LoginSchema,
	RegisterSchema,
	ResendVerificationEmailSchema,
	ResetPasswordSchema,
	VerifyEmailSchema,
} from "./schema";
import { AuthService } from "./service";

export const AuthModule = new Elysia({
	prefix: "/auth",
	detail: {
		tags: ["Authentication"],
		security: [],
		description: "Authentication APIs",
	},
})
	.use(jwt(JWT_CONFIG))
	.use(baseApp)

	// ============================================
	// LOGIN
	// ============================================
	.post(
		"/login",
		// eslint-disable-next-line no-shadow
		async ({ body, jwt, set }) => {
			const user: UserInformation = await AuthService.singIn(
				body.email,
				body.password,
			);

			const token = await jwt.sign({ id: user.id });

			set.status = 200;
			return ResponseToolkit.success(
				{
					user,
					accessToken: token,
				},
				"Successfully logged in",
			);
		},
		{
			body: LoginSchema,
			response: {
				200: SuccessResponseSchema(LoginResponseSchema),
				400: CommonResponseSchemas[400],
				422: CommonResponseSchemas[422],
			},
			detail: {
				summary: "User login",
				description: "Authenticate user with email and password",
			},
		},
	)

	// ============================================
	// REGISTER
	// ============================================
	.post(
		"/register",
		async ({ set, body }) => {
			await AuthService.register({
				name: body.name,
				email: body.email,
				password: body.password,
			});

			set.status = 201;
			return ResponseToolkit.created(
				null,
				"Successfully registered. Please check your email to verify your account.",
			);
		},
		{
			body: RegisterSchema,
			response: {
				201: SuccessResponseSchema(t.Null()),
				400: CommonResponseSchemas[400],
				422: CommonResponseSchemas[422],
			},
			detail: {
				summary: "User registration",
				description: "Register a new user account",
			},
		},
	)

	// ============================================
	// RESEND VERIFICATION EMAIL
	// ============================================
	.post(
		"/resend-verification",
		async ({ body }) => {
			await AuthService.resentVerificationEmail(body.email);

			return ResponseToolkit.success(
				null,
				"If the email exists, a verification link has been sent. Please check your inbox.",
			);
		},
		{
			body: ResendVerificationEmailSchema,
			response: {
				200: SuccessResponseSchema(t.Null()),
				400: CommonResponseSchemas[400],
				422: CommonResponseSchemas[422],
			},
			detail: {
				summary: "Resend verification email",
				description: "Request a new email verification link",
			},
		},
	)

	// ============================================
	// VERIFY EMAIL
	// ============================================
	.post(
		"/verify-email",
		async ({ body }) => {
			await AuthService.verifyEmail(body.token);

			return ResponseToolkit.success(
				null,
				"Email verified successfully. You can now log in.",
			);
		},
		{
			body: VerifyEmailSchema,
			response: {
				200: SuccessResponseSchema(t.Null()),
				400: CommonResponseSchemas[400],
				422: CommonResponseSchemas[422],
			},
			detail: {
				summary: "Verify email address",
				description: "Verify user's email address with token",
			},
		},
	)

	// ============================================
	// FORGOT PASSWORD
	// ============================================
	.post(
		"/forgot-password",
		async ({ body }) => {
			await AuthService.forgotPassword(body.email);

			return ResponseToolkit.success(
				null,
				"If the email exists, a password reset link has been sent. Please check your inbox.",
			);
		},
		{
			body: ForgotPasswordSchema,
			response: {
				200: SuccessResponseSchema(t.Null()),
				400: CommonResponseSchemas[400],
				422: CommonResponseSchemas[422],
			},
			detail: {
				summary: "Request password reset",
				description: "Send password reset email to user",
			},
		},
	)

	// ============================================
	// RESET PASSWORD
	// ============================================
	.post(
		"/reset-password",
		async ({ body }) => {
			await AuthService.resetPassword(body.token, body.newPassword);

			return ResponseToolkit.success(
				null,
				"Password has been reset successfully. You can now log in with your new password.",
			);
		},
		{
			body: ResetPasswordSchema,
			response: {
				200: SuccessResponseSchema(t.Null()),
				400: CommonResponseSchemas[400],
				422: CommonResponseSchemas[422],
			},
			detail: {
				summary: "Reset password",
				description: "Reset user password with token",
			},
		},
	);
