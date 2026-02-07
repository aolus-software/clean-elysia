import { AuthPlugin } from "@plugins";
import { UserInformationTypeBox } from "@types";
import {
	CommonResponseSchemas,
	ResponseToolkit,
	SuccessResponseSchema,
} from "@utils";
import Elysia, { t } from "elysia";

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
			return ResponseToolkit.success(user, "Profile retrieved successfully");
		},
		{
			response: {
				200: SuccessResponseSchema(UserInformationTypeBox),
				401: CommonResponseSchemas[401],
			},
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

			return ResponseToolkit.success(
				updatedProfile,
				"Profile updated successfully",
			);
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
			response: {
				200: SuccessResponseSchema(UserInformationTypeBox),
				401: CommonResponseSchemas[401],
				422: CommonResponseSchemas[422],
			},
			detail: {
				summary: "Update user profile",
				description: "Update the authenticated user's profile information",
			},
		},
	);
