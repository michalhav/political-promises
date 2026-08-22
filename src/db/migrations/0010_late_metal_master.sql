ALTER TABLE "source_document" ADD COLUMN "archive_service" varchar(120);--> statement-breakpoint
ALTER TABLE "source_document" ADD COLUMN "archive_original_url" text;--> statement-breakpoint
ALTER TABLE "source_document" ADD COLUMN "archive_snapshot_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_archive_origin_complete" CHECK (("source_document"."archive_service" IS NULL AND "source_document"."archive_original_url" IS NULL AND "source_document"."archive_snapshot_at" IS NULL)
          OR ("source_document"."archive_service" IS NOT NULL AND "source_document"."archive_original_url" IS NOT NULL AND "source_document"."archive_snapshot_at" IS NOT NULL));