import { RedisClient } from "@database";
import { Queue } from "bullmq";

const queueRedis = RedisClient.getQueueRedisClient();

export const sendEmailQueue = new Queue("send-email", {
	connection: queueRedis,
});
