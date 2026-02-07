import { RedisClient } from "@database";
import { EmailService } from "@mailer";
import { EmailOptions } from "@types";
import { log } from "@utils";
import { Worker } from "bullmq";

const queueRedis = RedisClient.getQueueRedisClient();

const worker = new Worker<EmailOptions>(
	"send-email",
	async (job) => {
		try {
			await EmailService.sendEmail(job.data);
			log.info({}, `Email job processed for ${job.data.to}`);
		} catch (error) {
			log.error(error, `Failed to process email job for ${job.data.to}`);
			throw error;
		}
	},
	{
		connection: queueRedis,
	},
);

worker.on("failed", (job, err) => {
	log.error(err, `Job ${job ? job.id : "unknown"} failed`);
});

export { worker };
