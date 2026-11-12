import { forgetSelectOptions } from "@cache";
import { db } from "@database";
import { NotFoundError, UnprocessableEntityError } from "@errors";
import { t } from "@i18n";
import { RoleRepository } from "@repositories";
import { DatatableType, PaginationResponse, RoleList } from "@types";

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
		const result = await db.transaction(async (tx) => {
			return await RoleRepository().create(data, tx);
		});
		await forgetSelectOptions();
		return result;
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

		const result = await db.transaction(async (tx) => {
			return await RoleRepository().update(id, data, tx);
		});
		await forgetSelectOptions();
		return result;
	},

	delete: async (id: string) => {
		const role = await RoleRepository().findById(id);
		if (!role) {
			throw new NotFoundError(t("role.notFound"));
		}

		const result = await db.transaction(async (tx) => {
			return await RoleRepository().delete(id, tx);
		});
		await forgetSelectOptions();
		return result;
	},
};
