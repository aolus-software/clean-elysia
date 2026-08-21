import { relations } from "drizzle-orm";
import {
	index,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { users } from "./user";

export const passwordResetTokens = pgTable(
	"password_reset_tokens",
	{
		id: uuid().primaryKey().defaultRandom(),
		user_id: uuid()
			.notNull()
			.references(() => users.id),
		token: varchar({ length: 255 }).notNull(),
		expired_at: timestamp().notNull(),
		// Stamped when the token is consumed. Single use is enforced by this
		// column, not by deleting the row, so consumption stays auditable and a
		// failed write cannot leave a spent token live.
		used_at: timestamp(),
		created_at: timestamp().defaultNow(),
		updated_at: timestamp()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("password_reset_token_token_unique").on(table.token),
		index("password_reset_token_user_id_used_at_index").on(
			table.user_id,
			table.used_at,
		),
	],
);

export const passwordResetTokenRelations = relations(
	passwordResetTokens,
	({ one }) => ({
		user: one(users, {
			fields: [passwordResetTokens.user_id],
			references: [users.id],
		}),
	}),
);
