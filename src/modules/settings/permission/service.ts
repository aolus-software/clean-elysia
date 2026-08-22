import { db } from "@database";
import { UnprocessableEntityError } from "@errors";
import { t } from "@i18n";
import { PermissionRepository } from "@repositories";
import { DatatableType, PaginationResponse, PermissionList } from "@types";
import { NotFoundError } from "elysia";

export const PermissionService = {
	findAll: async (
		queryParam: DatatableType,
	): Promise<PaginationResponse<PermissionList>> => {
		return await PermissionRepository().findAll(queryParam);
	},

	create: async (data: { name: string[]; group: string }): Promise<void> => {
		/* Names are stored as "<group> <action>", so the uniqueness check has to
		   compose them the same way the insert does. */
		const permissionNames: string[] = data.name.map(
			(name) => `${data.group} ${name}`,
		);

		const existing =
			await PermissionRepository().findExistingByNames(permissionNames);
		if (existing.length > 0) {
			throw new UnprocessableEntityError(t("permission.someExists"), [
				{
					field: "name",
					message: t("permission.someExistsList", {
						names: existing.map((perm) => perm.name).join(", "),
					}),
				},
			]);
		}

		await db.transaction(async (tx) => {
			await PermissionRepository().create(data, tx);
		});
	},

	detail: async (id: string): Promise<PermissionList> => {
		const permission = await PermissionRepository().getDetail(id);
		if (!permission) {
			throw new NotFoundError(t("permission.notFound"));
		}

		return permission;
	},

	update: async (
		id: string,
		data: { name: string; group: string },
	): Promise<void> => {
		const permission = await PermissionRepository().findById(id);
		if (!permission) {
			throw new NotFoundError(t("permission.notFound"));
		}

		const existing = await PermissionRepository().findByName(data.name, id);
		if (existing) {
			throw new UnprocessableEntityError(t("permission.nameExists"), [
				{
					field: "name",
					message: t("permission.nameExists"),
				},
			]);
		}

		await db.transaction(async (tx) => {
			await PermissionRepository().update(id, data, tx);
		});
	},

	delete: async (id: string): Promise<void> => {
		const permission = await PermissionRepository().findById(id);
		if (!permission) {
			throw new NotFoundError(t("permission.notFound"));
		}

		await db.transaction(async (tx) => {
			await PermissionRepository().delete(id, tx);
		});
	},
};
