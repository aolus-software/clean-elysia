import { relations } from "drizzle-orm";
import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

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
		created_at: timestamp().defaultNow(),
		updated_at: timestamp()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("password_reset_token_token_index").on(table.token)],
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
