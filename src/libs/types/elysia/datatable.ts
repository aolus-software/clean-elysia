import { paginationLength } from "@default";
import { SortDirection } from "@types";
import { t } from "elysia";

export type DatatableType = {
	page: number;
	perPage: number;
	search?: string;
	sort?: string;
	sortDirection: SortDirection;
	filter?: Record<string, boolean | string | Date>;
};

export const DatatableQueryParams = t.Object({
	page: t.Number({
		default: 1,
	}),
	perPage: t.Number({
		default: paginationLength,
	}),
	search: t.Optional(t.String()),
	sort: t.Optional(
		t.String({
			default: "created_at",
		}),
	),
	sortDirection: t.Union([t.Literal("asc"), t.Literal("desc")], {
		default: "asc",
	}),
	filter: t.Optional(
		t.Record(t.String(), t.Union([t.String(), t.Boolean(), t.String()])),
	),
});
