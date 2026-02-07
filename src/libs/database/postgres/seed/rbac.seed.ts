import { db, permissions, roles } from "@database";

export const RBACSeeder = () => {
	return db.transaction(async (tx) => {
		const roleNames = ["superuser", "admin"];
		await Promise.all(
			roleNames.map(async (role) => {
				await tx.insert(roles).values({
					name: role,
				});
			}),
		);

		const groupNames = ["user", "role", "permission"];
		const permissionNames = ["list", "create", "detail", "edit", "delete"];
		await Promise.all(
			groupNames.map(async (group) => {
				await Promise.all(
					permissionNames.map(async (permission) => {
						await tx.insert(permissions).values({
							name: `${group} ${permission}`,
							group: group,
						});
					}),
				);
			}),
		);
	});
};
