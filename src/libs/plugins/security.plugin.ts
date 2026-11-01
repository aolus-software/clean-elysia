import { CORSConfig } from "@config";
import cors from "@elysiajs/cors";
import { Elysia } from "elysia";
import { helmet } from "elysia-helmet";
import { rateLimit } from "elysia-rate-limit";

import { RateLimitError } from "../errors/to-many-request-error";

/* The rate limiter keys each client by the listening server's requestIP(), never a
   client header. It only sees this plugin instance, whose `server` is null, so the
   listening server is captured on start and injected; without it every client
   shares one bucket. */
let listeningServer: Elysia["server"] = null;

export const SecurityPlugin = new Elysia({ name: "security" })
	.onStart(({ server }) => {
		listeningServer = server;
	})
	.use(cors(CORSConfig))
	.use(
		rateLimit({
			max: 100,
			duration: 60 * 1000,
			headers: true,
			errorResponse: new RateLimitError(),
			injectServer: () => listeningServer,
		}),
	)
	.use(
		helmet({
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					scriptSrc: ["'self'"],
					styleSrc: ["'self'", "'unsafe-inline'"],
					imgSrc: ["'self'", "data:", "https:"],
					connectSrc: ["'self'"],
					fontSrc: ["'self'"],
					objectSrc: ["'none'"],
					frameSrc: ["'none'"],
				},
			},
			aot: true,
		}),
	);
