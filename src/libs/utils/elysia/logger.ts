import { LoggerOptions } from "@bogeychan/elysia-logger/dist/types";
import { AppConfig } from "@config";
import { destination, Logger, pino } from "pino";

const isProd = AppConfig.APP_ENV !== "development";
const logFile = destination({
	append: true,
	write: true,
	writable: true,
	dest: isProd ? "storage/logs/app.log" : "storage/logs/app-dev.log",
});

const transport = {
	target: "pino-pretty",
	options: {
		singleLine: false,
		translateTime: "SYS:standard",
		include: "time",
	},
};

const options: LoggerOptions = {
	level: AppConfig.LOG_LEVEL,
	base: null,
	timestamp: () =>
		`<${new Date().toLocaleString("en-US", {
			weekday: "long",
			day: "numeric",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			timeZone: AppConfig.APP_TIMEZONE,
		})}>`,
	transport: isProd ? undefined : transport,
	formatters: {
		level(label) {
			return { level: label };
		},
		log(obj) {
			// Create a copy to avoid mutating the original object
			const sanitized = { ...obj };

			// Helper to recursively remove sensitive fields
			const sensitivePattern =
				/password|token|auth|bearer|secret|key|credential/i;

			// eslint-disable-next-line
			function deepSanitize(objectSanitize: Record<string, any>) {
				for (const key of Object.keys(objectSanitize)) {
					if (sensitivePattern.test(key)) {
						delete objectSanitize[key];
					} else if (
						objectSanitize[key] &&
						typeof objectSanitize[key] === "object" &&
						!Array.isArray(objectSanitize[key])
					) {
						// eslint-disable-next-line
						deepSanitize(objectSanitize[key]);
					}
				}
			}

			deepSanitize(sanitized);

			return sanitized;
		},
	},

	file: logFile,
};

// SINGLE logger instance for the whole app
export const log: Logger = pino(options, logFile);

/**
 * Create a child logger with bindings for a module or domain.
 * Example: const userLog = child({ module: "user" })
 */
export function child(bindings: Record<string, unknown>) {
	return log.child(bindings);
}
