CREATE TABLE "login_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_key" varchar(320) NOT NULL,
	"ip_hash" char(64),
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_attempt_email_idx" ON "login_attempt" USING btree ("email_key","attempted_at");--> statement-breakpoint
CREATE INDEX "login_attempt_ip_idx" ON "login_attempt" USING btree ("ip_hash","attempted_at");