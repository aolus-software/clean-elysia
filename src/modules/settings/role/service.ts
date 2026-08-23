import { db } from "@database";
import { UnprocessableEntityError } from "@errors";
import { t } from "@i18n";
import { RoleRepository } from "@repositories";
import { DatatableType, PaginationResponse, RoleList } from "@types";
import { NotFoundError } from "elysia";

export const RoleService = {
	findAll: async (
		queryParam: DatatableType,
	): Promise<PaginationResponse<RoleList>> => {
		return await RoleRepository().findAll(queryParam);
	},

	create: async (data: { name: string; permissionIds: string[] }) => {
		const existing = await RoleRepository().findByName(data.name);
		if (existing) {
			throw new UnprocessableEntityError(t("role.nameExists"), [
				{
					field: "name",
					message: t("role.nameExistsFor", { name: data.name }),
				},
			]);
		}

		/* Two tables — roles and role_permissions — so the write is one
		   transaction owned here, not in the repository. */
		return await db.transaction(async (tx) => {
			return await RoleRepository().create(data, tx);
		});
	},

	findOne: async (id: string) => {
		const role = await RoleRepository().getDetail(id);
		if (!role) {
			throw new NotFoundError(t("role.notFound"));
		}

		return role;
	},

	update: async (
		id: string,
		data: { name: string; permissionIds: string[] },
	) => {
		const role = await RoleRepository().findById(id);
		if (!role) {
			throw new NotFoundError(t("role.notFound"));
		}

		const existing = await RoleRepository().findByName(data.name, id);
		if (existing) {
			throw new UnprocessableEntityError(t("role.nameExists"), [
				{
					field: "name",
					message: t("role.nameExistsFor", { name: data.name }),
				},
			]);
		}

		return await db.transaction(async (tx) => {
			return await RoleRepository().update(id, data, tx);
		});
	},

	delete: async (id: string) => {
		const role = await RoleRepository().findById(id);
		if (!role) {
			throw new NotFoundError(t("role.notFound"));
		}

		return await db.transaction(async (tx) => {
			return await RoleRepository().delete(id, tx);
		});
	},
};
