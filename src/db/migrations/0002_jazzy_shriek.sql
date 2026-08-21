ALTER TABLE "party" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "promise" ADD COLUMN "ai_suggestion_id" uuid;--> statement-breakpoint
ALTER TABLE "source_document" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "promise" ADD CONSTRAINT "promise_ai_suggestion_id_ai_suggestion_id_fk" FOREIGN KEY ("ai_suggestion_id") REFERENCES "public"."ai_suggestion"("id") ON DELETE set null ON UPDATE no action;