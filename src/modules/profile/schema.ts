import { StrongPassword } from "@default";
import { t } from "elysia";

export const ProfileChangePasswordSchema = t.Object({
	currentPassword: t.String({
		minLength: 1,
		description: "The authenticated user's current password",
		examples: ["MySecure123!"],
	}),
	newPassword: t.String({
		pattern: StrongPassword.source,
		minLength: 8,
		description:
			"New strong password with uppercase, lowercase, number, and special character",
		examples: ["NewSecure123!"],
	}),
});
