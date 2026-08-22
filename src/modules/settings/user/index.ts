import { PermissionGuard, RoleGuard } from "@guards";
import { AuthPlugin } from "@plugins";
import {
	commonPaginatedResponse,
	commonResponse,
	DatatableToolkit,
	ResponseToolkit,
} from "@utils";
import Elysia, { t } from "elysia";

import {
	UserCreateSchema,
	UserDetailSchema,
	UserListSchema,
	UserQuerySchema,
	UserResetPasswordSchema,
	UserUpdateSchema,
} from "./schema";
import { UserService } from "./service";

export const UserModule = new Elysia({
	prefix: "/users",
	detail: {
		tags: ["Settings/Users"],
		description: "APIs for managing users",
	},
})
	.use(AuthPlugin)
	.get(
		"",
		async ({ query, request }) => {
			const queryParam = DatatableToolkit.parseFilter(query, request.url);
			const result = await UserService.findAll(queryParam);

			return ResponseToolkit.success(
				result,
				"User list retrieved successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["user list"]);
			},
			query: UserQuerySchema,
			detail: {
				summary: "List all users",
				description:
					"Retrieve a paginated list of users. Soft-deleted users are excluded. " +
					"Requires 'user list' permission. `search` matches name, email and " +
					"status. Sortable and filterable fields are listed on the individual " +
					"query parameters; `filter[roleId]` takes a role UUID and narrows to " +
					"users holding that role. An unsupported `sort` is rejected with 422 " +
					"and an unsupported `filter[<key>]` with 400.",
			},
			response: commonPaginatedResponse(UserListSchema, {
				include: [200, 400, 401, 403, 422, 500],
			}),
		},
	)
	.post(
		"",
		async ({ body }) => {
			await UserService.create(body);
			return ResponseToolkit.success(null, "User created successfully", 201);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["user create"]);
			},
			body: UserCreateSchema,
			detail: {
				summary: "Create a new user",
				description:
					"Create a new user with the provided details. Requires 'user create' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [201, 400, 401, 403, 500],
			}),
		},
	)
	.get(
		"/:id",
		async ({ params }) => {
			const user = await UserService.findOne(params.id);
			return ResponseToolkit.success(
				user,
				"User details retrieved successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["user detail"]);
			},
			detail: {
				summary: "Get user details",
				description:
					"Retrieve details of a specific user by ID. Requires 'user detail' permission.",
			},
			response: commonResponse(UserDetailSchema, {
				include: [200, 400, 401, 403, 404, 500],
			}),
		},
	)
	.patch(
		"/:id",
		async ({ params, body }) => {
			await UserService.update(params.id, body);
			return ResponseToolkit.success(null, "User updated successfully", 200);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["user edit"]);
			},
			body: UserUpdateSchema,
			detail: {
				summary: "Update user details",
				description:
					"Update the details of an existing user by ID. Requires 'user edit' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [200, 400, 401, 403, 404, 500],
			}),
		},
	)
	.post(
		"/:id/reset-password",
		async ({ params, body }) => {
			await UserService.resetPassword(params.id, body.newPassword);
			return ResponseToolkit.success(
				null,
				"User password reset successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				RoleGuard.canActivate(user, ["superuser"]);
			},
			body: UserResetPasswordSchema,
			detail: {
				summary: "Reset user password",
				description:
					"Reset the password of an existing user by ID. Requires 'superuser' role.",
			},
			response: commonResponse(t.Null(), {
				include: [200, 400, 401, 403, 404, 500],
			}),
		},
	)
	.post(
		"/:id/send-verification-email",
		async ({ params }) => {
			await UserService.sendEmailVerification(params.id);
			return ResponseToolkit.success(
				null,
				"Verification email sent successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["user create"]);
			},
			detail: {
				summary: "Send email verification",
				description:
					"Send an email verification to the user by ID. Requires 'user create' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [200, 400, 401, 403, 404, 500],
			}),
		},
	)
	.post(
		"/:id/send-reset-password-email",
		async ({ params }) => {
			await UserService.sendResetPasswordEmail(params.id);
			return ResponseToolkit.success(
				null,
				"Reset password email sent successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["user create"]);
			},
			detail: {
				summary: "Send reset password email",
				description:
					"Send a reset password email to the user by ID. Requires 'user create' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [200, 400, 401, 403, 404, 500],
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params }) => {
			await UserService.delete(params.id);
			return ResponseToolkit.success(null, "User deleted successfully", 200);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["user delete"]);
			},
			detail: {
				summary: "Delete a user",
				description:
					"Delete an existing user by ID. Requires 'user delete' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [200, 400, 401, 403, 404, 500],
			}),
		},
	);
