import { users } from "@database";
import { BadRequestError } from "@errors";
import type { FilterField } from "@types";
import { DatatableToolkit } from "@utils";
import { describe, expect, test } from "bun:test";

const fields: FilterField[] = [
	"name",
	{ field: "status", enum: ["active", "inactive"] },
	{ field: "createdAt", kind: "date" },
];

describe("DatatableToolkit.parseFilter", () => {
	test("applies defaults and reads filters off the raw URL", () => {
		const parsed = DatatableToolkit.parseFilter(
			{},
			"http://localhost/x?filter[name]=jane&filter[active]=true&filter[]=x",
		);
		expect(parsed.page).toBe(1);
		expect(parsed.sortDirection).toBe("desc");
		expect(parsed.filter).toEqual({ name: "jane", active: true });
	});

	test("leaves filter undefined when none are sent", () => {
		const parsed = DatatableToolkit.parseFilter(
			{ page: 2, perPage: 5, sort: "name", sortDirection: "asc" },
			"http://localhost/x?page=2",
		);
		expect(parsed).toMatchObject({
			page: 2,
			perPage: 5,
			sort: "name",
			sortDirection: "asc",
		});
		expect(parsed.filter).toBeUndefined();
	});
});

describe("DatatableToolkit allow-lists", () => {
	test("parseSort rejects a field outside the allow-list", () => {
		const columns = { name: users.name };
		expect(DatatableToolkit.parseSort(columns, "name")).toBe(users.name);
		expect(() => DatatableToolkit.parseSort(columns, "password")).toThrow(
			BadRequestError,
		);
	});

	test("assertFilterKeys rejects an unknown key", () => {
		expect(() =>
			DatatableToolkit.assertFilterKeys({ name: "a" }, ["name"]),
		).not.toThrow();
		expect(() =>
			DatatableToolkit.assertFilterKeys(undefined, []),
		).not.toThrow();
		expect(() =>
			DatatableToolkit.assertFilterKeys({ password: "a" }, ["name"]),
		).toThrow(BadRequestError);
	});

	test("assertFilterEnums rejects a value outside the enum", () => {
		expect(() =>
			DatatableToolkit.assertFilterEnums({ status: "active,inactive" }, fields),
		).not.toThrow();
		expect(() =>
			DatatableToolkit.assertFilterEnums({ status: "deleted" }, fields),
		).toThrow(BadRequestError);
	});

	test("filterValues splits and trims a comma list", () => {
		expect(DatatableToolkit.filterValues(" a, b ,,c ")).toEqual([
			"a",
			"b",
			"c",
		]);
	});

	test("filterDateRange spans whole days and rejects bad input", () => {
		const { from, to } = DatatableToolkit.filterDateRange(
			"2024-01-01,2024-01-31",
			"createdAt",
		);
		expect(from < to).toBe(true);
		expect(() =>
			DatatableToolkit.filterDateRange("2024-02-01,2024-01-01", "createdAt"),
		).toThrow(BadRequestError);
		expect(() =>
			DatatableToolkit.filterDateRange("yesterday", "createdAt"),
		).toThrow(BadRequestError);
		expect(() =>
			DatatableToolkit.filterDateRange("a,b,c", "createdAt"),
		).toThrow(BadRequestError);
	});
});
