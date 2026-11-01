import { AppConfig } from "@config";
import { db } from "@database";
import { log } from "@utils";
import { sql } from "drizzle-orm";

/* Drops every table, type and the migration journal by recreating the `public`
   schema and dropping the `drizzle` schema. `drizzle-kit drop` only deletes
   migration files, never tables, which is why `make fresh` uses this instead.
   Refuses to run when NODE_ENV is production. */
const drop = async (): Promise<void> => {
	if (AppConfig.APP_ENV === "production") {
		throw new Error("Refusing to drop the database with NODE_ENV=production");
	}

	await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
	await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
	await db.execute(sql`CREATE SCHEMA public`);
};

drop()
	.then(async () => {
		log.info("Database dropped");
		await db.$client.end();
		process.exitCode = 0;
	})
	.catch(async (error: unknown) => {
		log.error({ error }, "Database drop failed");
		await db.$client.end().catch(() => undefined);
		process.exitCode = 1;
	});
