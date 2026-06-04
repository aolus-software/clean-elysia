/**
 * PM2 ecosystem — Bun + Elysia.
 *
 * Scaling model: SO_REUSEPORT. PM2 runs N independent *fork-mode* Bun
 * processes; each binds the same port with `reusePort: true` and the kernel
 * load-balances connections across them. We deliberately do NOT use PM2's
 * `cluster` exec_mode — it relies on Node's `cluster` module, which is only
 * partially supported under Bun.
 *
 * Because of this, leave APP_CLUSTER_MODE=false here: in-process node-cluster
 * forking (src/index.ts) would fight PM2 for the same socket. Pick ONE
 * scaling strategy. Here PM2 owns it.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 reload clean-elysia      # zero-downtime rolling restart
 *   pm2 logs clean-elysia
 *   pm2 delete clean-elysia
 *
 * Override worker count without editing this file:
 *   PM2_INSTANCES=2 pm2 start ecosystem.config.cjs --env production
 */
module.exports = {
	apps: [
		{
			name: "clean-elysia",
			// Run from source — Bun resolves tsconfig `paths` aliases directly.
			script: "src/index.ts",
			interpreter: "bun",
			interpreter_args: "run",

			// Fork mode + N instances => N independent Bun processes.
			exec_mode: "fork",
			instances: Number(process.env.PM2_INSTANCES) || "max",

			autorestart: true,
			max_restarts: 10,
			min_uptime: "10s",
			max_memory_restart: "512M",
			kill_timeout: 5000,

			env: {
				NODE_ENV: "development",
				APP_REUSE_PORT: "true",
				APP_CLUSTER_MODE: "false",
			},
			env_production: {
				NODE_ENV: "production",
				APP_REUSE_PORT: "true",
				APP_CLUSTER_MODE: "false",
			},
		},
	],
};
