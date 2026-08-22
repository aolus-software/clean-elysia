import { db, permissions, rolePermissions, roles } from "@database";
import { log } from "@utils";
import { eq, inArray } from "drizzle-orm";

import { permissionCatalogue } from "./permission.seed";

export const roleNames = ["superuser", "admin"];

/**
 * Seeds the two baseline roles and grants both of them the whole permission
 * catalogue.
 *
 * `superuser` short-circuits PermissionGuard, so its rows are redundant, but
 * `admin` is only usable because of them: a role holding no permissions is
 * refused by every guarded route, which reads as a broken API rather than as
 * missing seed data.
 *
 * The permission read is scoped to the seeded names so a permission an operator
 * added later is never silently granted. Every insert relies on a unique
 * constraint or a composite primary key, so the whole function is re-runnable.
 */
export async function seedRoles(): Promise<void> {
	const seededPermissionNames = permissionCatalogue.map(
		(permission) => permission.name,
	);

	for (const name of roleNames) {
		await db.insert(roles).values({ name }).onConflictDoNothing();

		// Re-read instead of using the insert's RETURNING: on a re-run the insert
		// conflicts away to zero rows, and the grants still need the existing id.
		const [role] = await db
			.select({ id: roles.id })
			.from(roles)
			.where(eq(roles.name, name))
			.limit(1);

		if (!role) {
			continue;
		}

		const grantablePermissions = await db
			.select({ id: permissions.id })
			.from(permissions)
			.where(inArray(permissions.name, seededPermissionNames));

		await db
			.insert(rolePermissions)
			.values(
				grantablePermissions.map((permission) => ({
					role_id: role.id,
					permission_id: permission.id,
				})),
			)
			.onConflictDoNothing();
	}

	log.info({ roles: roleNames.length }, "Role seeding completed");
}
