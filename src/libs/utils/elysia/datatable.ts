import { defaultSort, paginationLength } from "@default";
import { DatatableType, SortDirection } from "@types";
import { PgColumn } from "drizzle-orm/pg-core";

// Define the query type that includes filter parameters
type QueryWithFilters = DatatableType & {
	[key: string]: unknown;
};

export class DatatableToolkit {
	static parseFilter(query: QueryWithFilters): DatatableType {
		const page: number = query.page ?? 1;
		const perPage: number = query.perPage ?? paginationLength;
		const search: string | undefined = query.search;
		const orderBy: string = query.sort ?? defaultSort;
		const orderDirection: SortDirection = query.sortDirection ?? "desc";

		// Parse filter parameters
		const filter: Record<string, boolean | string | Date> = {};

		for (const key in query) {
			if (key.startsWith("filter[")) {
				const filterKey = key.slice(7, -1);
				const value = query[key];

				// Type guard for the value
				if (typeof value === "string") {
					if (value === "true") {
						filter[filterKey] = true;
					} else if (value === "false") {
						filter[filterKey] = false;
					} else if (!isNaN(Date.parse(value))) {
						filter[filterKey] = new Date(value);
					} else {
						filter[filterKey] = value;
					}
				}
			}
		}

		return {
			page,
			perPage,
			search,
			sort: orderBy,
			sortDirection: orderDirection,
			filter: Object.keys(filter).length > 0 ? filter : undefined,
		};
	}

	static parseSort(
		validateOrderBy: Record<string, PgColumn>,
		orderBy: string,
	): PgColumn {
		type OrderableKey = keyof typeof validateOrderBy;

		const normalizedOrderBy: OrderableKey = Object.keys(
			validateOrderBy,
		).includes(orderBy)
			? orderBy
			: "id";

		const orderColumn = validateOrderBy[normalizedOrderBy];

		return orderColumn;
	}
}
