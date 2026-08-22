import { db, permissions } from "@database";
import { log } from "@utils";

export const permissionGroups = ["user", "role", "permission"];
export const permissionActions = ["list", "create", "detail", "edit", "delete"];

/**
 * The catalogue every PermissionGuard string is checked against.
 *
 * Names are the space-separated `<group> <action>` form the guards use — see
 * .claude/rules/rbac.md. Changing the separator here silently 403s every
 * guarded route, because a guard naming an unseeded permission fails closed.
 */
export const permissionCatalogue = permissionGroups.flatMap((group) =>
	permissionActions.map((action) => ({
		name: `${group} ${action}`,
		group,
	})),
);

/**
 * Seeds the 15 `<group> <action>` permissions.
 *
 * `permissions.name` is unique, so onConflictDoNothing makes a re-run a no-op
 * rather than a constraint violation.
 */
export async function seedPermissions(): Promise<void> {
	await db
		.insert(permissions)
		.values(permissionCatalogue)
		.onConflictDoNothing();

	log.info(
		{ count: permissionCatalogue.length },
		"Permission seeding completed",
	);
}
