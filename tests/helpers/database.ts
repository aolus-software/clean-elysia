import { Cache } from "@cache";
import { DatabaseConfig } from "@config";
import { db } from "@database";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { seedPermissions } from "../../src/libs/database/postgres/seed/permission.seed";
import { seedRoles } from "../../src/libs/database/postgres/seed/role.seed";
import { seedUsers } from "../../src/libs/database/postgres/seed/user.seed";

export const SEED_PASSWORD = "S3crEtP4ssw0rd!";

/**
 * Refuses any database whose name does not end in `_test`: the helpers
 * truncate every table, and `.env` is loaded into `bun test` too.
 */
export const assertTestDatabase = (url: string = DatabaseConfig.url): void => {
	const name = new URL(url).pathname.slice(1);
	if (!name.endsWith("_test")) {
		throw new Error(
			`Refusing to run integration tests against "${name}". Point TEST_DATABASE_URL at a database whose name ends in _test.`,
		);
	}
};

export const resetDatabase = async (): Promise<void> => {
	assertTestDatabase();
	await migrate(db, {
		migrationsFolder: "./src/libs/database/postgres/migrations",
	});
	await db.execute(
		sql`TRUNCATE TABLE users, roles, permissions, role_permissions, user_roles, email_verifications, password_reset_tokens RESTART IDENTITY CASCADE`,
	);
	await seedPermissions();
	await seedRoles();
	await seedUsers();
	await Cache.flush();
};
