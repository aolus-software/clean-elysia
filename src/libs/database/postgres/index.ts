import { DatabaseConfig } from "@config";
import { log } from "@utils";
import { ExtractTablesWithRelations, Logger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgTransaction } from "drizzle-orm/pg-core";
import { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { Pool } from "pg";

import { schema } from "./schema";

export * from "./schema/email-verification";
export * from "./schema/password-reset-token";
export * from "./schema/rbac";
export * from "./schema/user";

/**
 * Debug-level SQL log behind DB_LOG_QUERIES. Only the statement text and the
 * parameter count are written: parameters carry password hashes and tokens.
 */
class QueryLogger implements Logger {
	logQuery(query: string, params: unknown[]): void {
		log.debug({ query, paramCount: params.length }, "db query");
	}
}

const client = new Pool({
	connectionString: DatabaseConfig.url,
	max: DatabaseConfig.poolMax,
	idleTimeoutMillis: DatabaseConfig.poolIdleTimeoutMs,
	connectionTimeoutMillis: DatabaseConfig.poolConnectionTimeoutMs,
});

client.on("error", (error) => {
	log.error({ error }, "Idle PostgreSQL client error");
});

const db = drizzle(client, {
	schema,
	logger: DatabaseConfig.logQueries ? new QueryLogger() : false,
});

export { db, schema };

export type DbTransaction = PgTransaction<
	PostgresJsQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;
