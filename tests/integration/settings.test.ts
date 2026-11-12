import { beforeAll, describe, expect, test } from "bun:test";

import { request } from "../helpers/app";
import { login, signAccessToken } from "../helpers/auth";
import { resetDatabase, SEED_PASSWORD } from "../helpers/database";

type Paginated<T> = {
	data: T[];
	meta: { page: number; limit: number; totalCount: number };
};
type Option = { id: string; name: string };

let superuserToken: string;
let adminToken: string;

beforeAll(async () => {
	await resetDatabase();
	superuserToken = await login("superuser@example.com");
	adminToken = await login("admin@example.com");
});

describe("GET /settings/users", () => {
	test("returns a paginated list", async () => {
		const response = await request<Paginated<{ email: string }>>(
			"GET",
			"/settings/users?page=1&perPage=1",
			{ token: adminToken },
		);
		expect(response.status).toBe(200);
		expect(response.body.data?.meta.totalCount).toBe(2);
		expect(response.body.data?.meta.page).toBe(1);
		expect(response.body.data?.data).toHaveLength(1);
	});

	test("applies an allowed filter", async () => {
		const response = await request<Paginated<{ email: string }>>(
			"GET",
			"/settings/users?filter[email]=superuser@example.com",
			{ token: adminToken },
		);
		expect(response.status).toBe(200);
		expect(response.body.data?.data.map((user) => user.email)).toEqual([
			"superuser@example.com",
		]);
	});

	test("answers 400 for an unknown filter key", async () => {
		const response = await request(
			"GET",
			"/settings/users?filter[password]=x",
			{ token: adminToken },
		);
		expect(response.status).toBe(400);
		expect(response.body.errors?.[0]?.field).toBe("filter[password]");
	});

	test("answers 422 for a sort field outside the allow-list", async () => {
		const response = await request("GET", "/settings/users?sort=password", {
			token: adminToken,
		});
		expect(response.status).toBe(422);
	});
});

describe("RBAC", () => {
	test("a user without roles gets 403 on a guarded route", async () => {
		const created = await request("POST", "/settings/users", {
			token: superuserToken,
			body: {
				name: "Plain",
				email: "plain@example.com",
				password: SEED_PASSWORD,
				status: "active",
				remark: null,
				roleIds: [],
			},
		});
		expect(created.status).toBe(201);

		const list = await request<Paginated<{ id: string }>>(
			"GET",
			"/settings/users?filter[email]=plain@example.com",
			{ token: superuserToken },
		);
		const plainId = list.body.data?.data[0]?.id ?? "";
		expect(plainId).not.toBe("");
		const plainToken = await signAccessToken(plainId);

		const forbidden = await request("GET", "/settings/users", {
			token: plainToken,
		});
		expect(forbidden.status).toBe(403);

		const profile = await request("GET", "/profile", { token: plainToken });
		expect(profile.status).toBe(200);
	});

	test("select-options are superuser only", async () => {
		const admin = await request("GET", "/settings/select-options/roles", {
			token: adminToken,
		});
		expect(admin.status).toBe(403);

		const superuser = await request<Option[]>(
			"GET",
			"/settings/select-options/roles",
			{ token: superuserToken },
		);
		expect(superuser.status).toBe(200);
		expect(superuser.body.data?.map((role) => role.name)).toEqual(["admin"]);

		const permissions = await request<Option[]>(
			"GET",
			"/settings/select-options/permissions",
			{ token: superuserToken },
		);
		expect(permissions.status).toBe(200);
	});
});
