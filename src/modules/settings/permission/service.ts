import { db } from "@database";
import { PermissionRepository } from "@repositories";
import { DatatableType, PaginationResponse, PermissionList } from "@types";

export const PermissionService = {
	findAll: async (
		queryParam: DatatableType,
	): Promise<PaginationResponse<PermissionList>> => {
		return await PermissionRepository().findAll(queryParam);
	},

	create: async (data: { name: string[]; group: string }): Promise<void> => {
		await db.transaction(async (tx) => {
			await PermissionRepository().create(data, tx);
		});
	},

	detail: async (id: string): Promise<PermissionList> => {
		return await PermissionRepository().getDetail(id);
	},

	update: async (
		id: string,
		data: { name: string; group: string },
	): Promise<void> => {
		await db.transaction(async (tx) => {
			await PermissionRepository().update(id, data, tx);
		});
	},

	delete: async (id: string): Promise<void> => {
		await db.transaction(async (tx) => {
			await PermissionRepository().delete(id, tx);
		});
	},
};
