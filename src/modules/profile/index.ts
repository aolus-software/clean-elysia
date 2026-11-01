import { t as trans } from "@i18n";
import { AuthPlugin } from "@plugins";
import { UserInformationTypeBox } from "@types";
import { commonResponse, ResponseToolkit } from "@utils";
import Elysia, { t } from "elysia";

import { ProfileChangePasswordSchema } from "./schema";
import { ProfileService } from "./service";

export const ProfileModule = new Elysia({
	prefix: "/profile",
	detail: { tags: ["Profile"] },
})
	.use(AuthPlugin)
	// ============================================
	// GET PROFILE
	// ============================================
	.get(
		"",
		({ user }) => {
			return ResponseToolkit.success(user, trans("profile.retrieved"));
		},
		{
			response: commonResponse(UserInformationTypeBox, { include: [200, 401] }),
			detail: {
				summary: "Get current user profile",
				description: "Retrieve the authenticated user's profile information",
			},
		},
	)

	// ============================================
	// UPDATE PROFILE
	// ============================================
	.patch(
		"",
		async ({ user, body }) => {
			// user is guaranteed to exist here
			const updatedProfile = await ProfileService.updateProfile(user.id, {
				name: body.name,
				email: body.email,
			});

			return ResponseToolkit.success(updatedProfile, trans("profile.updated"));
		},
		{
			body: t.Object({
				name: t.String({
					minLength: 1,
					maxLength: 255,
				}),
				email: t.String({
					format: "email",
					maxLength: 255,
				}),
			}),
			response: commonResponse(UserInformationTypeBox, {
				include: [200, 401, 422],
			}),
			detail: {
				summary: "Update user profile",
				description: "Update the authenticated user's profile information",
			},
		},
	)

	// ============================================
	// CHANGE PASSWORD
	// ============================================
	.patch(
		"/password",
		async ({ user, body }) => {
			await ProfileService.changePassword(user.id, body);
			return ResponseToolkit.success(
				null,
				trans("profile.passwordChanged"),
				200,
			);
		},
		{
			body: ProfileChangePasswordSchema,
			response: commonResponse(t.Null(), {
				include: [200, 401, 404, 422],
			}),
			detail: {
				summary: "Change own password",
				description:
					"Change the authenticated user's password. Requires the current password; the new one must satisfy the strong-password rule. A wrong current password returns 422 on `currentPassword`. Clears the cached user information. No permission required.",
			},
		},
	);
