import { PermissionGuard, RoleGuard } from "@guards";
import { AuthPlugin } from "@plugins";
import { DatatableQueryParams } from "@types";
import {
	CommonResponseSchemas,
	DatatableToolkit,
	PaginatedResponseSchema,
	ResponseToolkit,
	SuccessResponseSchema,
} from "@utils";
import Elysia from "elysia";

import {
	UserCreateSchema,
	UserDetailSchema,
	UserListSchema,
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
		async ({ query }) => {
			const queryParam = DatatableToolkit.parseFilter(query);
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
			query: DatatableQueryParams,
			detail: {
				summary: "List all users",
				description:
					"Retrieve a list of all users. Requires 'user list' permission.",
			},
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				500: CommonResponseSchemas[500],
				200: PaginatedResponseSchema(UserListSchema),
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				500: CommonResponseSchemas[500],
				201: CommonResponseSchemas[201],
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				404: CommonResponseSchemas[404],
				500: CommonResponseSchemas[500],
				200: SuccessResponseSchema(UserDetailSchema),
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				404: CommonResponseSchemas[404],
				500: CommonResponseSchemas[500],
				200: CommonResponseSchemas[200],
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				404: CommonResponseSchemas[404],
				500: CommonResponseSchemas[500],
				200: CommonResponseSchemas[200],
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				404: CommonResponseSchemas[404],
				500: CommonResponseSchemas[500],
				200: CommonResponseSchemas[200],
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				404: CommonResponseSchemas[404],
				500: CommonResponseSchemas[500],
				200: CommonResponseSchemas[200],
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				404: CommonResponseSchemas[404],
				500: CommonResponseSchemas[500],
				200: CommonResponseSchemas[200],
			},
		},
	);
