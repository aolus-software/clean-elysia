import { JWT_CONFIG } from "@config";
import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";

import { request } from "./app";
import { SEED_PASSWORD } from "./database";

type LoginData = { accessToken: string };

const signer = new Elysia().use(jwt(JWT_CONFIG)).decorator.jwt;

/** Signs an access token the way `POST /auth/login` does, for any user id. */
export const signAccessToken = (userId: string): Promise<string> =>
	signer.sign({ id: userId });

export const login = async (
	email: string,
	password: string = SEED_PASSWORD,
): Promise<string> => {
	const response = await request<LoginData>("POST", "/auth/login", {
		body: { email, password },
	});
	if (response.status !== 200 || !response.body.data) {
		throw new Error(`Login failed for ${email}: ${response.status}`);
	}
	return response.body.data.accessToken;
};
