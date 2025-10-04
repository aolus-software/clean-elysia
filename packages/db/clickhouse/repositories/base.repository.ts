import { ClickHouseClient } from "@clickhouse/client";
import { getClickHouseClient } from "../client";

export class BaseRepository {
	private client: ClickHouseClient | null = null;

	constructor() {
		if (!this.client) {
			this.client = getClickHouseClient();
		}
	}

	protected getClient(): ClickHouseClient {
		if (!this.client) {
			this.client = getClickHouseClient();
		}
		return this.client;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static async query<T = any>(
		sql: string,
		params?: Record<string, unknown>,
	): Promise<T[]> {
		const ch = getClickHouseClient();
		const resultSet = await ch.query({
			query: sql,
			query_params: params,
			format: "JSONEachRow",
		});
		return await resultSet.json<T>();
	}

	static async exec(
		sql: string,
		params?: Record<string, unknown>,
	): Promise<void> {
		const ch = getClickHouseClient();
		await ch.exec({ query: sql, query_params: params });
	}
}
