import { PermissionGuard } from "@guards";
import { AuthPlugin } from "@plugins";
import { DatatableQueryParams } from "@types";
import {
	commonPaginatedResponse,
	commonResponse,
	DatatableToolkit,
	ResponseToolkit,
} from "@utils";
import Elysia, { t } from "elysia";

import { CreateRoleSchema, RoleListSchema, UpdateRoleSchema } from "./schema";
import { RoleService } from "./service";

export const RoleModule = new Elysia({
	prefix: "/roles",
	detail: {
		tags: ["Settings/Roles"],
		description: "APIs for managing roles",
	},
})
	.use(AuthPlugin)
	.get(
		"",
		async ({ query }) => {
			const queryParam = DatatableToolkit.parseFilter(query);
			const result = await RoleService.findAll(queryParam);

			return ResponseToolkit.success(
				result,
				"Role list retrieved successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["role list"]);
			},
			query: DatatableQueryParams,
			detail: {
				summary: "List all roles",
				description:
					"Retrieve a list of all roles. Requires 'role list' permission.",
			},
			response: commonPaginatedResponse(RoleListSchema, {
				include: [200, 400, 401, 403, 500],
			}),
		},
	)
	.post(
		"",
		async ({ body }) => {
			await RoleService.create(body);
			return ResponseToolkit.success(null, "Role created successfully", 201);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["role create"]);
			},
			body: CreateRoleSchema,
			detail: {
				summary: "Create a new role",
				description:
					"Create a new role with the provided details. Requires 'role create' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [201, 400, 401, 403, 500],
			}),
		},
	)
	.get(
		"/:id",
		async ({ params }) => {
			const result = await RoleService.findOne(params.id);
			return ResponseToolkit.success(
				result,
				"Role detail retrieved successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["role detail"]);
			},
			detail: {
				summary: "Get role detail",
				description:
					"Retrieve detailed information about a specific role. Requires 'role detail' permission.",
			},
			response: commonResponse(RoleListSchema, {
				include: [200, 400, 401, 403, 404, 500],
			}),
		},
	)
	.patch(
		"/:id",
		async ({ params, body }) => {
			await RoleService.update(params.id, body);
			return ResponseToolkit.success(null, "Role updated successfully", 200);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["role edit"]);
			},
			body: UpdateRoleSchema,
			detail: {
				summary: "Update role",
				description:
					"Update the details of an existing role. Requires 'role edit' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [200, 400, 401, 403, 404, 500],
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params }) => {
			await RoleService.delete(params.id);
			return ResponseToolkit.success(null, "Role deleted successfully", 200);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["role delete"]);
			},
			detail: {
				summary: "Delete role",
				description:
					"Delete an existing role by its ID. Requires 'role delete' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [200, 400, 401, 403, 404, 500],
			}),
		},
	);
