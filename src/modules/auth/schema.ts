import { StrongPassword } from "@default";
import { UserInformationTypeBox } from "@types";
import { t } from "elysia";

export const LoginSchema = t.Object({
	email: t.String({
		format: "email",
	}),
	password: t.String({
		minLength: 1,
	}),
});

export const LoginResponseSchema = t.Object({
	user: UserInformationTypeBox,
	accessToken: t.String(),
});

export const RegisterSchema = t.Object({
	email: t.String({
		format: "email",
	}),
	name: t.String({
		minLength: 1,
		maxLength: 255,
	}),
	password: t.String({
		pattern: StrongPassword.source,
		minLength: 8,
	}),
});

export const ResendVerificationEmailSchema = t.Object({
	email: t.String({
		format: "email",
		maxLength: 255,
	}),
});

export const VerifyEmailSchema = t.Object({
	token: t.String({
		minLength: 1,
	}),
});

export const ForgotPasswordSchema = t.Object({
	email: t.String({
		format: "email",
		maxLength: 255,
	}),
});

export const ResetPasswordSchema = t.Object({
	token: t.String({
		minLength: 1,
	}),
	newPassword: t.String({
		pattern: StrongPassword.source,
		minLength: 8,
	}),
});
