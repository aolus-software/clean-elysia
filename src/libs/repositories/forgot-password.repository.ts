import { eq } from "drizzle-orm";

import { db, DbTransaction, passwordResetTokens } from "..";

export const ForgotPasswordRepository = () => {
	const dbInstance = db;

	return {
		db: dbInstance,
		getDb: (tx?: DbTransaction) => tx || dbInstance.$cache,
		getTable: () => passwordResetTokens,

		create: async (
			data: { user_id: string; token: string; expired_at: Date },
			tx?: DbTransaction,
		) => {
			const database = tx || dbInstance;
			await database.insert(passwordResetTokens).values({
				token: data.token,
				user_id: data.user_id,
				expired_at: data.expired_at,
			});
		},

		findByToken: async (token: string, tx?: DbTransaction) => {
			const database = tx || dbInstance;
			return await database.query.passwordResetTokens.findFirst({
				where: eq(passwordResetTokens.token, token),
			});
		},
	};
};
