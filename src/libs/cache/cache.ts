import { RedisClient } from "@database";
import { log } from "@utils";
import Redis from "ioredis";

class Cache {
	private static redis: Redis | null = null;

	private static getRedisClient(): Redis {
		if (!this.redis) {
			this.redis = RedisClient.getRedisClient();
		}

		return this.redis;
	}

	static async get<T>(key: string): Promise<T | null> {
		try {
			const client = this.getRedisClient();
			const value = await client.get(key);
			return value ? (JSON.parse(value) as T) : null;
		} catch (error) {
			log.error(error, `Error getting cache for key ${key}:`);
			return null;
		}
	}

	static async set<T>(
		key: string,
		value: T,
		ttl: number = 3600,
	): Promise<void> {
		try {
			const client = this.getRedisClient();
			await client.set(key, JSON.stringify(value), "EX", ttl);
		} catch (error) {
			log.error(error, `Error setting cache for key ${key}:`);
		}
	}

	static async delete(key: string): Promise<void> {
		try {
			const client = this.getRedisClient();
			await client.del(key);
		} catch (error) {
			log.error(error, `Error deleting cache for key ${key}:`);
		}
	}

	static async flush(): Promise<void> {
		try {
			const client = this.getRedisClient();
			await client.flushdb();
		} catch (error) {
			log.error(error, "Error flushing Redis cache:");
		}
	}

	static async exists(key: string): Promise<boolean> {
		try {
			const client = this.getRedisClient();
			const exists = await client.exists(key);
			return exists === 1;
		} catch (error) {
			log.error(error, `Error checking existence of key ${key}:`);
			return false;
		}
	}

	static async remember<T>(
		key: string,
		callback: () => Promise<T>,
		ttl: 3600,
	): Promise<T | null> {
		const cachedValue = await this.get<T>(key);
		if (cachedValue !== null) {
			return cachedValue;
		}

		const freshValue = await callback();
		await this.set(key, freshValue, ttl);
		return freshValue;
	}

	static generateKey(...args: string[]): string {
		return args.join(":");
	}

	static async getKeys(pattern: string): Promise<string[]> {
		try {
			const client = this.getRedisClient();
			const keys = await client.keys(pattern);
			return keys;
		} catch (error) {
			log.error(error, `Error getting keys with pattern ${pattern}:`);
			return [];
		}
	}

	static async disconnect(): Promise<void> {
		try {
			if (this.redis) {
				await this.redis.quit();
				this.redis = null;
			}
		} catch (error) {
			log.error(error, "Error disconnecting from Redis:");
		}
	}
}

export { Cache };
