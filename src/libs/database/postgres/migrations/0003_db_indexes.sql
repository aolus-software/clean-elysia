CREATE INDEX "role_permissions_permission_id_index" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_index" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique_live" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_created_at_live_index" ON "users" USING btree ("created_at") WHERE "users"."deleted_at" IS NULL;