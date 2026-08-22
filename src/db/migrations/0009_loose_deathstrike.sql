CREATE TABLE "promise_search_profile" (
	"promise_id" uuid PRIMARY KEY NOT NULL,
	"names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"synonyms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excluded" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_by" varchar(20) DEFAULT 'model' NOT NULL,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promise_search_profile" ADD CONSTRAINT "promise_search_profile_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_search_profile" ADD CONSTRAINT "promise_search_profile_updated_by_id_app_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;