import { RedisConfig } from "@config";
import Redis from "ioredis";

export class RedisClient {
	private static redis: Redis | null = null;
	private static queueRedis: Redis | null = null;

	static getRedisClient(): Redis {
		if (!this.redis) {
			this.redis = new Redis({
				host: RedisConfig.REDIS_HOST,
				port: RedisConfig.REDIS_PORT,
				password: RedisConfig.REDIS_PASSWORD || undefined,
				db: RedisConfig.REDIS_DB,
			});
		}

		return this.redis;
	}

	static getQueueRedisClient(): Redis {
		if (!this.queueRedis) {
			this.queueRedis = new Redis({
				host: RedisConfig.REDIS_HOST,
				port: RedisConfig.REDIS_PORT,
				password: RedisConfig.REDIS_PASSWORD || undefined,
				maxRetriesPerRequest: null,
				db: RedisConfig.REDIS_DB,
			});
		}

		return this.queueRedis;
	}
}
