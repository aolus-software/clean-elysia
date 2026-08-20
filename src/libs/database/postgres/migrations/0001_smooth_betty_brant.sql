-- Any row already in this table was issued before expiry existed, so its age is
-- unknown and it is currently valid forever. Revoking them is the point of this
-- change; it also lets the NOT NULL column be added without a backfill default.
DELETE FROM "password_reset_tokens";--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD COLUMN "expired_at" timestamp NOT NULL;
