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

	// client
	CLIENT_URL: string;
}

export const AppConfig: IAppConfig = {
	APP_NAME: process.env.APP_NAME || "Elysia App",
	APP_PORT: Number(process.env.APP_PORT) || 3000,
	APP_URL: process.env.APP_URL || "http://localhost:3000",
	APP_ENV: (process.env.NODE_ENV || "development") as
		| "development"
		| "staging"
		| "production",
	APP_TIMEZONE: process.env.APP_TIMEZONE || "UTC",
	APP_KEY: process.env.APP_KEY || "your-app-key",
	APP_JWT_SECRET: process.env.APP_JWT_SECRET || "jwt-secret",

	LOG_LEVEL: (process.env.LOG_LEVEL || "info") as "info" | "warn" | "debug",

	CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
};
