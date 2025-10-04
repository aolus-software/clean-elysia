export interface IClickHouseConfig {
	host: string;
	user: string;
	password: string;
	database: string;
}

export const clickhouseConfig: IClickHouseConfig = {
	host: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
	user: process.env.CLICKHOUSE_USER || "default",
	password: process.env.CLICKHOUSE_PASSWORD || "",
	database: process.env.CLICKHOUSE_DATABASE || "default",
};
