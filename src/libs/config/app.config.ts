import { env } from "./env.config";

interface IAppConfig {
	APP_NAME: string;
	APP_PORT: number;
	APP_URL: string;
	APP_ENV: "development" | "staging" | "production";
	APP_TIMEZONE: string;
	APP_KEY: string;
	APP_JWT_SECRET: string;

	// log
	LOG_LEVEL: "info" | "warn" | "debug";

	// cluster
	APP_CLUSTER_MODE: boolean;
	APP_CLUSTER_WORKERS: number;

	// reuse-port
	APP_REUSE_PORT: boolean;

	// client
	CLIENT_URL: string;
}

export const AppConfig: IAppConfig = {
	APP_NAME: env.APP_NAME,
	APP_PORT: env.APP_PORT,
	APP_URL: env.APP_URL,
	APP_ENV: env.NODE_ENV,
	APP_TIMEZONE: env.APP_TIMEZONE,
	APP_KEY: env.APP_KEY,
	APP_JWT_SECRET: env.APP_JWT_SECRET,

	LOG_LEVEL: env.LOG_LEVEL,

	APP_CLUSTER_MODE: env.APP_CLUSTER_MODE,
	APP_CLUSTER_WORKERS: env.APP_CLUSTER_WORKERS,

	APP_REUSE_PORT: env.APP_REUSE_PORT,

	CLIENT_URL: env.CLIENT_URL,
};
