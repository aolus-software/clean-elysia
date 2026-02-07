import { RoleRepository } from "@repositories";
import { DatatableType, PaginationResponse, RoleList } from "@types";

export const RoleService = {
	findAll: async (
		queryParam: DatatableType,
	): Promise<PaginationResponse<RoleList>> => {
		return await RoleRepository().findAll(queryParam);
	},

	create: async (data: { name: string; permission_ids: string[] }) => {
		return await RoleRepository().create(data);
	},

	findOne: async (id: string) => {
		return await RoleRepository().getDetail(id);
	},

	update: async (
		id: string,
		data: { name: string; permission_ids: string[] },
	) => {
		return await RoleRepository().update(id, data);
	},

	delete: async (id: string) => {
		return await RoleRepository().delete(id);
	},
};
