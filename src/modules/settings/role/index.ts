import { PermissionGuard } from "@guards";
import { t as trans } from "@i18n";
import { AuthPlugin } from "@plugins";
import {
	commonPaginatedResponse,
	commonResponse,
	DatatableToolkit,
	ResponseToolkit,
} from "@utils";
import Elysia, { t } from "elysia";

import {
	CreateRoleSchema,
	RoleListSchema,
	RoleQuerySchema,
	UpdateRoleSchema,
} from "./schema";
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
		async ({ query, request }) => {
			const queryParam = DatatableToolkit.parseFilter(query, request.url);
			const result = await RoleService.findAll(queryParam);

			return ResponseToolkit.success(result, trans("role.listSuccess"), 200);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["role list"]);
			},
			query: RoleQuerySchema,
			detail: {
				summary: "List all roles",
				description:
					"Retrieve a paginated list of roles. Requires 'role list' permission. " +
					"`search` matches the role name. Sortable and filterable fields are " +
					"listed on the individual query parameters; an unsupported `sort` is " +
					"rejected with 422 and an unsupported `filter[<key>]` with 400.",
			},
			response: commonPaginatedResponse(RoleListSchema, {
				include: [200, 400, 401, 403, 422, 500],
			}),
		},
	)
	.post(
		"",
		async ({ body }) => {
			await RoleService.create(body);
			return ResponseToolkit.success(null, trans("role.createSuccess"), 201);
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
				include: [201, 400, 401, 403, 422, 500],
			}),
		},
	)
	.get(
		"/:id",
		async ({ params }) => {
			const result = await RoleService.findOne(params.id);
			return ResponseToolkit.success(result, trans("role.detailSuccess"), 200);
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
			return ResponseToolkit.success(null, trans("role.updateSuccess"), 200);
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
				include: [200, 400, 401, 403, 404, 422, 500],
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params }) => {
			await RoleService.delete(params.id);
			return ResponseToolkit.success(null, trans("role.deleteSuccess"), 200);
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
