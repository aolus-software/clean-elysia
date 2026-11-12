import { env } from "./env.config";

interface IDatabaseConfig {
	url: string;
	poolMax: number;
	poolIdleTimeoutMs: number;
	poolConnectionTimeoutMs: number;
	logQueries: boolean;
}

export const DatabaseConfig: IDatabaseConfig = {
	url: env.DATABASE_URL,
	poolMax: env.DB_POOL_MAX,
	poolIdleTimeoutMs: env.DB_POOL_IDLE_TIMEOUT_MS,
	poolConnectionTimeoutMs: env.DB_POOL_CONNECTION_TIMEOUT_MS,
	logQueries: env.DB_LOG_QUERIES,
};
