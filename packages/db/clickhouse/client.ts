import { createClient, ClickHouseClient } from "@clickhouse/client";
import { clickhouseConfig } from "@packages_config/*";

let client: ClickHouseClient;

export const getClickHouseClient = (): ClickHouseClient => {
	if (!client) {
		client = createClient({
			host: clickhouseConfig.host,
			username: clickhouseConfig.user,
			password: clickhouseConfig.password,
			database: clickhouseConfig.database,
			clickhouse_settings: {
				async_insert: 1,
				wait_for_async_insert: 0,
			},
		});
	}
	return client;
};
