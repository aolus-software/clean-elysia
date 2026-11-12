import { parseAcceptLanguage, translate } from "@i18n";
import { describe, expect, test } from "bun:test";

describe("parseAcceptLanguage", () => {
	test("picks the highest-weighted supported locale", () => {
		expect(parseAcceptLanguage("fr;q=0.9, id-ID;q=0.8")).toBe("id");
		expect(parseAcceptLanguage("en-US,id;q=0.5")).toBe("en");
	});

	test("falls back to en", () => {
		expect(parseAcceptLanguage(undefined)).toBe("en");
		expect(parseAcceptLanguage("fr, de")).toBe("en");
	});
});

describe("translate", () => {
	test("resolves a key per locale", () => {
		const en = translate("auth.loginSuccess", undefined, "en");
		const id = translate("auth.loginSuccess", undefined, "id");
		expect(en).not.toBe("auth.loginSuccess");
		expect(id).not.toBe("auth.loginSuccess");
		expect(id).not.toBe(en);
	});

	test("interpolates variables and keeps a missing placeholder", () => {
		const message = translate(
			"datatable.sortNotAllowed",
			{ field: "password" },
			"en",
		);
		expect(message).toContain("password");
		expect(message).toContain("{{allowed}}");
	});
});
