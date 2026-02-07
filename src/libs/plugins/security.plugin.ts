import { CORSConfig } from "@config";
import cors from "@elysiajs/cors";
import { Elysia } from "elysia";
import { helmet } from "elysia-helmet";
import { rateLimit } from "elysia-rate-limit";

import { RateLimitError } from "../errors/to-many-request-error";

export const SecurityPlugin = new Elysia({ name: "security" })
	.use(cors(CORSConfig))
	.use(
		rateLimit({
			max: 100,
			duration: 60 * 1000,
			headers: true,
			errorResponse: new RateLimitError(),
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
