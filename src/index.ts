import cluster from "node:cluster";
import os from "node:os";
import process from "node:process";

import { AppConfig } from "@config";

if (AppConfig.APP_CLUSTER_MODE && cluster.isPrimary) {
	const workerCount =
		AppConfig.APP_CLUSTER_WORKERS > 0
			? AppConfig.APP_CLUSTER_WORKERS
			: os.availableParallelism();

	// eslint-disable-next-line no-console
	console.log(
		`Cluster primary ${process.pid} spawning ${workerCount} worker(s) on port ${AppConfig.APP_PORT}`,
	);

	for (let i = 0; i < workerCount; i++) {
		cluster.fork();
	}

	cluster.on("exit", (worker, code, signal) => {
		// eslint-disable-next-line no-console
		console.log(
			`Worker ${worker.process.pid} exited (code=${code} signal=${signal}); restarting`,
		);
		cluster.fork();
	});

	const shutdown = (signal: NodeJS.Signals) => {
		// eslint-disable-next-line no-console
		console.log(`Cluster primary received ${signal}; terminating workers`);
		for (const worker of Object.values(cluster.workers ?? {})) {
			worker?.kill(signal);
		}
	};

	process.on("SIGINT", () => shutdown("SIGINT"));
	process.on("SIGTERM", () => shutdown("SIGTERM"));
} else {
	// PM2's Bun fork wrapper loads this file via require(), which cannot load
	// async modules — avoid top-level await here.
	void import("./server");
}
