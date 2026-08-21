-- Single-use token enforcement moves from "delete the row" to "stamp used_at".
--
-- No backfill is needed and none is wanted: under the old scheme a consumed
-- token was DELETEd, so every row that survives to this migration is genuinely
-- unconsumed and NULL is the correct value for it.
--
-- The two plain token indexes are replaced by UNIQUE indexes. This is the one
-- statement here that can fail: it aborts if the table already holds two rows
-- with the same token. Tokens are 100 and 255 characters from StrToolkit.random,
-- so a collision is not realistically reachable — but if it does fail, dedupe
-- before retrying rather than dropping back to a plain index.
DROP INDEX "email_verification_token_index";--> statement-breakpoint
DROP INDEX "password_reset_token_token_index";--> statement-breakpoint
ALTER TABLE "email_verifications" ADD COLUMN "used_at" timestamp;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD COLUMN "used_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_token_unique" ON "email_verifications" USING btree ("token");--> statement-breakpoint
CREATE INDEX "email_verification_user_id_used_at_index" ON "email_verifications" USING btree ("user_id","used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_token_token_unique" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "password_reset_token_user_id_used_at_index" ON "password_reset_tokens" USING btree ("user_id","used_at");
