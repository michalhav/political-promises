ALTER TABLE "correction" ADD COLUMN "submitter_ip_hash" char(64);--> statement-breakpoint
CREATE INDEX "correction_ip_idx" ON "correction" USING btree ("submitter_ip_hash","created_at");