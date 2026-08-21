CREATE TYPE "public"."ai_run_status" AS ENUM('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."ai_task_type" AS ENUM('PROMISE_EXTRACTION', 'EVIDENCE_MATCHING', 'COALITION_MAPPING');--> statement-breakpoint
CREATE TYPE "public"."assessability" AS ENUM('HIGH', 'MEDIUM', 'LOW', 'NOT_ASSESSABLE');--> statement-breakpoint
CREATE TYPE "public"."coalition_mapping_type" AS ENUM('RETAINED', 'MODIFIED', 'MERGED', 'NOT_INCLUDED', 'UNCLEAR');--> statement-breakpoint
CREATE TYPE "public"."correction_kind" AS ENUM('PUBLIC_CORRECTION', 'PARTY_RESPONSE', 'INTERNAL_REVISION');--> statement-breakpoint
CREATE TYPE "public"."correction_status" AS ENUM('OPEN', 'ACKNOWLEDGED', 'APPLIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('PROMISE_CREATED', 'COALITION_INCLUDED', 'COALITION_MODIFIED', 'COUNCIL_DECISION', 'BUDGET_ALLOCATED', 'PROCUREMENT_STARTED', 'CONTRACT_SIGNED', 'IMPLEMENTATION_STARTED', 'MILESTONE_REACHED', 'COMPLETED', 'BLOCKED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."execution_status" AS ENUM('NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'ABANDONED', 'BLOCKED', 'NOT_ASSESSABLE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."jurisdiction_type" AS ENUM('MUNICIPALITY', 'CITY_DISTRICT', 'REGION', 'COUNTRY');--> statement-breakpoint
CREATE TYPE "public"."license_mode" AS ENUM('FULL_TEXT_STORED', 'QUOTE_ONLY');--> statement-breakpoint
CREATE TYPE "public"."metric_direction" AS ENUM('INCREASE', 'DECREASE', 'MAINTAIN');--> statement-breakpoint
CREATE TYPE "public"."outcome_status" AS ENUM('NOT_MEASURABLE_YET', 'ACHIEVED', 'PARTIALLY_ACHIEVED', 'NOT_ACHIEVED', 'UNKNOWN', 'NOT_APPLICABLE');--> statement-breakpoint
CREATE TYPE "public"."party_relation_type" AS ENUM('RENAMED_TO', 'MERGED_INTO', 'SPLIT_FROM');--> statement-breakpoint
CREATE TYPE "public"."person_role_type" AS ENUM('CANDIDATE', 'COUNCILLOR', 'MAYOR', 'DEPUTY_MAYOR', 'COMMITTEE_MEMBER', 'PARTY_LEADER');--> statement-breakpoint
CREATE TYPE "public"."processing_state" AS ENUM('PENDING', 'PROCESSING', 'REVIEW_REQUIRED', 'FAILED', 'PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('SUPPORTS', 'CONTRADICTS', 'PROGRESS', 'IMPLEMENTATION', 'FUNDING', 'OUTCOME', 'CONTEXT');--> statement-breakpoint
CREATE TYPE "public"."review_decision_type" AS ENUM('ACCEPT', 'REJECT', 'EDIT', 'MERGE', 'PUBLISH', 'UNPUBLISH');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('ELECTION_PROGRAM', 'COALITION_AGREEMENT', 'COUNCIL_RESOLUTION', 'COUNCIL_VOTE', 'BUDGET', 'CONTRACT', 'PUBLIC_PROCUREMENT', 'OFFICIAL_REPORT', 'MEDIA_REPORT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."topic" AS ENUM('HOUSING', 'TRANSPORT', 'EDUCATION', 'ENVIRONMENT', 'DIGITALIZATION', 'PUBLIC_FINANCE', 'SECURITY', 'SOCIAL_POLICY', 'URBAN_DEVELOPMENT', 'OTHER');--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_type" "ai_task_type" NOT NULL,
	"provider" varchar(60) NOT NULL,
	"model" varchar(120) NOT NULL,
	"prompt_version" varchar(60) NOT NULL,
	"source_document_id" uuid,
	"input_hash" char(64) NOT NULL,
	"status" "ai_run_status" DEFAULT 'PENDING' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(12, 6),
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_run_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"confidence" numeric(4, 3),
	"status" "suggestion_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promise_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"previous_assessment_id" uuid,
	"specificity_score" integer NOT NULL,
	"measurability_score" integer NOT NULL,
	"deadline_score" integer NOT NULL,
	"jurisdiction_score" integer NOT NULL,
	"outcome_definition_score" integer NOT NULL,
	"assessability" "assessability" NOT NULL,
	"methodology_version" varchar(20) NOT NULL,
	"execution_status" "execution_status" NOT NULL,
	"outcome_status" "outcome_status" NOT NULL,
	"summary" text,
	"change_reason" text,
	"created_by_id" uuid NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"ai_suggestion_id" uuid,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promise_assessment_version_positive" CHECK ("promise_assessment"."version" >= 1),
	CONSTRAINT "promise_assessment_scores_range" CHECK ("promise_assessment"."specificity_score" BETWEEN 0 AND 5
        AND "promise_assessment"."measurability_score" BETWEEN 0 AND 5
        AND "promise_assessment"."deadline_score" BETWEEN 0 AND 5
        AND "promise_assessment"."jurisdiction_score" BETWEEN 0 AND 5
        AND "promise_assessment"."outcome_definition_score" BETWEEN 0 AND 5),
	CONSTRAINT "promise_assessment_four_eyes" CHECK ("promise_assessment"."reviewed_by_id" IS NULL OR "promise_assessment"."reviewed_by_id" <> "promise_assessment"."created_by_id"),
	CONSTRAINT "promise_assessment_review_complete" CHECK (("promise_assessment"."reviewed_by_id" IS NULL) = ("promise_assessment"."reviewed_at" IS NULL)),
	CONSTRAINT "promise_assessment_change_reason_from_v2" CHECK ("promise_assessment"."version" = 1 OR "promise_assessment"."change_reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "coalition_promise_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_id" uuid NOT NULL,
	"coalition_source_document_id" uuid NOT NULL,
	"classification" "coalition_mapping_type" NOT NULL,
	"coalition_evidence_id" uuid,
	"reason" text NOT NULL,
	"human_verified" boolean DEFAULT false NOT NULL,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"ai_suggestion_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coalition_mapping_needs_evidence_unless_absent" CHECK ("coalition_promise_mapping"."classification" IN ('NOT_INCLUDED', 'UNCLEAR') OR "coalition_promise_mapping"."coalition_evidence_id" IS NOT NULL),
	CONSTRAINT "coalition_mapping_verified_has_reviewer" CHECK ("coalition_promise_mapping"."human_verified" = false OR ("coalition_promise_mapping"."verified_by_id" IS NOT NULL AND "coalition_promise_mapping"."verified_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_document_id" uuid NOT NULL,
	"excerpt" text NOT NULL,
	"page_number" integer,
	"locator" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promise_event_evidence" (
	"event_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promise_event_evidence_event_id_evidence_id_pk" PRIMARY KEY("event_id","evidence_id")
);
--> statement-breakpoint
CREATE TABLE "promise_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"relation_type" "relation_type" NOT NULL,
	"confidence" numeric(4, 3),
	"human_verified" boolean DEFAULT false NOT NULL,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"ai_suggestion_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promise_evidence_verified_has_reviewer" CHECK ("promise_evidence"."human_verified" = false OR ("promise_evidence"."verified_by_id" IS NOT NULL AND "promise_evidence"."verified_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "election" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"election_date" date NOT NULL,
	"term_start" date,
	"term_end" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jurisdiction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "jurisdiction_type" NOT NULL,
	"country_code" char(2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electoral_list_party" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"electoral_list_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electoral_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(60) NOT NULL,
	"ballot_number" integer,
	"seats_won" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(60) NOT NULL,
	"registration_id" varchar(60),
	"founded_on" date,
	"dissolved_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_lineage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_party_id" uuid NOT NULL,
	"to_party_id" uuid NOT NULL,
	"relation_type" "party_relation_type" NOT NULL,
	"effective_on" date NOT NULL,
	"source_document_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"election_id" uuid,
	"electoral_list_id" uuid,
	"party_id" uuid,
	"role_type" "person_role_type" NOT NULL,
	"started_on" date,
	"ended_on" date,
	"source_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"birth_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_measurement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_id" uuid NOT NULL,
	"value" numeric(20, 4) NOT NULL,
	"measured_on" date NOT NULL,
	"source_document_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promise_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_id" uuid NOT NULL,
	"event_type" "event_type" NOT NULL,
	"event_date" date NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promise_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"unit" varchar(60) NOT NULL,
	"direction" "metric_direction" NOT NULL,
	"baseline_value" numeric(20, 4),
	"baseline_on" date,
	"target_value" numeric(20, 4),
	"target_on" date,
	"definition_note" text,
	"source_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promise_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"excerpt" text NOT NULL,
	"page_number" integer,
	"locator" varchar(200),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"electoral_list_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"title" varchar(300) NOT NULL,
	"original_text" text NOT NULL,
	"normalized_statement" text,
	"topic" "topic" NOT NULL,
	"deadline_text" varchar(200),
	"deadline_on" date,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"merged_into_promise_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promise_published_has_timestamp" CHECK ("promise"."published" = false OR "promise"."published_at" IS NOT NULL),
	CONSTRAINT "promise_not_merged_into_self" CHECK ("promise"."merged_into_promise_id" <> "promise"."id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" uuid,
	"before_json" jsonb,
	"after_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_id" uuid NOT NULL,
	"kind" "correction_kind" NOT NULL,
	"status" "correction_status" DEFAULT 'OPEN' NOT NULL,
	"submitter_name" varchar(200),
	"submitter_email" varchar(320),
	"submitter_organization" varchar(200),
	"body" text NOT NULL,
	"response" text,
	"applied_assessment_id" uuid,
	"handled_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "correction_resolved_has_timestamp" CHECK ("correction"."status" IN ('OPEN', 'ACKNOWLEDGED') OR "correction"."resolved_at" IS NOT NULL),
	CONSTRAINT "correction_applied_has_assessment" CHECK ("correction"."status" <> 'APPLIED' OR "correction"."applied_assessment_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "review_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" uuid NOT NULL,
	"decision" "review_decision_type" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "source_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"publisher" varchar(200) NOT NULL,
	"url" text,
	"published_at" date,
	"retrieved_at" timestamp with time zone NOT NULL,
	"content_hash" char(64) NOT NULL,
	"license_mode" "license_mode" NOT NULL,
	"raw_text" text,
	"mime_type" varchar(120),
	"byte_size" bigint,
	"page_count" integer,
	"processing_state" "processing_state" DEFAULT 'PENDING' NOT NULL,
	"processing_error" text,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_document_quote_only_has_no_raw_text" CHECK ("source_document"."license_mode" = 'FULL_TEXT_STORED' OR "source_document"."raw_text" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_reviewed_by_id_app_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_assessment" ADD CONSTRAINT "promise_assessment_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_assessment" ADD CONSTRAINT "promise_assessment_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_assessment" ADD CONSTRAINT "promise_assessment_reviewed_by_id_app_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."app_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_assessment" ADD CONSTRAINT "promise_assessment_ai_suggestion_id_ai_suggestion_id_fk" FOREIGN KEY ("ai_suggestion_id") REFERENCES "public"."ai_suggestion"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_assessment" ADD CONSTRAINT "promise_assessment_previous_fk" FOREIGN KEY ("previous_assessment_id") REFERENCES "public"."promise_assessment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_promise_mapping" ADD CONSTRAINT "coalition_promise_mapping_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_promise_mapping" ADD CONSTRAINT "coalition_promise_mapping_coalition_source_document_id_source_document_id_fk" FOREIGN KEY ("coalition_source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_promise_mapping" ADD CONSTRAINT "coalition_promise_mapping_coalition_evidence_id_evidence_id_fk" FOREIGN KEY ("coalition_evidence_id") REFERENCES "public"."evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_promise_mapping" ADD CONSTRAINT "coalition_promise_mapping_verified_by_id_app_user_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_promise_mapping" ADD CONSTRAINT "coalition_promise_mapping_ai_suggestion_id_ai_suggestion_id_fk" FOREIGN KEY ("ai_suggestion_id") REFERENCES "public"."ai_suggestion"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_event_evidence" ADD CONSTRAINT "promise_event_evidence_event_id_promise_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."promise_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_event_evidence" ADD CONSTRAINT "promise_event_evidence_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_evidence" ADD CONSTRAINT "promise_evidence_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_evidence" ADD CONSTRAINT "promise_evidence_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_evidence" ADD CONSTRAINT "promise_evidence_verified_by_id_app_user_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_evidence" ADD CONSTRAINT "promise_evidence_ai_suggestion_id_ai_suggestion_id_fk" FOREIGN KEY ("ai_suggestion_id") REFERENCES "public"."ai_suggestion"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election" ADD CONSTRAINT "election_jurisdiction_id_jurisdiction_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdiction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral_list_party" ADD CONSTRAINT "electoral_list_party_electoral_list_id_electoral_list_id_fk" FOREIGN KEY ("electoral_list_id") REFERENCES "public"."electoral_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral_list_party" ADD CONSTRAINT "electoral_list_party_party_id_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral_list" ADD CONSTRAINT "electoral_list_election_id_election_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."election"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_lineage" ADD CONSTRAINT "party_lineage_from_party_id_party_id_fk" FOREIGN KEY ("from_party_id") REFERENCES "public"."party"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_lineage" ADD CONSTRAINT "party_lineage_to_party_id_party_id_fk" FOREIGN KEY ("to_party_id") REFERENCES "public"."party"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_lineage" ADD CONSTRAINT "party_lineage_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_role" ADD CONSTRAINT "person_role_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_role" ADD CONSTRAINT "person_role_election_id_election_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."election"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_role" ADD CONSTRAINT "person_role_electoral_list_id_electoral_list_id_fk" FOREIGN KEY ("electoral_list_id") REFERENCES "public"."electoral_list"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_role" ADD CONSTRAINT "person_role_party_id_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_role" ADD CONSTRAINT "person_role_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_measurement" ADD CONSTRAINT "metric_measurement_metric_id_promise_metric_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."promise_metric"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_measurement" ADD CONSTRAINT "metric_measurement_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_event" ADD CONSTRAINT "promise_event_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_metric" ADD CONSTRAINT "promise_metric_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_metric" ADD CONSTRAINT "promise_metric_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_source" ADD CONSTRAINT "promise_source_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_source" ADD CONSTRAINT "promise_source_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise" ADD CONSTRAINT "promise_electoral_list_id_electoral_list_id_fk" FOREIGN KEY ("electoral_list_id") REFERENCES "public"."electoral_list"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise" ADD CONSTRAINT "promise_merged_into_fk" FOREIGN KEY ("merged_into_promise_id") REFERENCES "public"."promise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction" ADD CONSTRAINT "correction_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction" ADD CONSTRAINT "correction_applied_assessment_id_promise_assessment_id_fk" FOREIGN KEY ("applied_assessment_id") REFERENCES "public"."promise_assessment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction" ADD CONSTRAINT "correction_handled_by_id_app_user_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_reviewer_id_app_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."app_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_email_uq" ON "app_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ai_run_task_idx" ON "ai_run" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "ai_run_status_idx" ON "ai_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_run_input_hash_idx" ON "ai_run" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "ai_suggestion_run_idx" ON "ai_suggestion" USING btree ("ai_run_id");--> statement-breakpoint
CREATE INDEX "ai_suggestion_status_idx" ON "ai_suggestion" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "promise_assessment_version_uq" ON "promise_assessment" USING btree ("promise_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "promise_assessment_current_uq" ON "promise_assessment" USING btree ("promise_id") WHERE "promise_assessment"."is_current";--> statement-breakpoint
CREATE INDEX "promise_assessment_promise_idx" ON "promise_assessment" USING btree ("promise_id");--> statement-breakpoint
CREATE INDEX "promise_assessment_execution_idx" ON "promise_assessment" USING btree ("execution_status");--> statement-breakpoint
CREATE UNIQUE INDEX "coalition_mapping_uq" ON "coalition_promise_mapping" USING btree ("promise_id","coalition_source_document_id");--> statement-breakpoint
CREATE INDEX "coalition_mapping_classification_idx" ON "coalition_promise_mapping" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "evidence_source_document_idx" ON "evidence" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "promise_event_evidence_evidence_idx" ON "promise_event_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promise_evidence_uq" ON "promise_evidence" USING btree ("promise_id","evidence_id","relation_type");--> statement-breakpoint
CREATE INDEX "promise_evidence_promise_idx" ON "promise_evidence" USING btree ("promise_id");--> statement-breakpoint
CREATE INDEX "promise_evidence_evidence_idx" ON "promise_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "election_slug_uq" ON "election" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "election_jurisdiction_idx" ON "election" USING btree ("jurisdiction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_slug_uq" ON "jurisdiction" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "electoral_list_party_uq" ON "electoral_list_party" USING btree ("electoral_list_id","party_id");--> statement-breakpoint
CREATE INDEX "electoral_list_party_party_idx" ON "electoral_list_party" USING btree ("party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "electoral_list_slug_uq" ON "electoral_list" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "electoral_list_election_idx" ON "electoral_list" USING btree ("election_id");--> statement-breakpoint
CREATE UNIQUE INDEX "party_slug_uq" ON "party" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "party_lineage_uq" ON "party_lineage" USING btree ("from_party_id","to_party_id","relation_type","effective_on");--> statement-breakpoint
CREATE INDEX "party_lineage_from_idx" ON "party_lineage" USING btree ("from_party_id");--> statement-breakpoint
CREATE INDEX "party_lineage_to_idx" ON "party_lineage" USING btree ("to_party_id");--> statement-breakpoint
CREATE INDEX "person_role_person_idx" ON "person_role" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_role_election_idx" ON "person_role" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX "person_role_party_idx" ON "person_role" USING btree ("party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_slug_uq" ON "person" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "metric_measurement_metric_idx" ON "metric_measurement" USING btree ("metric_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_measurement_uq" ON "metric_measurement" USING btree ("metric_id","measured_on","source_document_id");--> statement-breakpoint
CREATE INDEX "promise_event_promise_idx" ON "promise_event" USING btree ("promise_id");--> statement-breakpoint
CREATE INDEX "promise_event_date_idx" ON "promise_event" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "promise_metric_promise_idx" ON "promise_metric" USING btree ("promise_id");--> statement-breakpoint
CREATE INDEX "promise_source_promise_idx" ON "promise_source" USING btree ("promise_id");--> statement-breakpoint
CREATE INDEX "promise_source_document_idx" ON "promise_source" USING btree ("source_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promise_source_primary_uq" ON "promise_source" USING btree ("promise_id") WHERE "promise_source"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "promise_slug_uq" ON "promise" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "promise_electoral_list_idx" ON "promise" USING btree ("electoral_list_id");--> statement-breakpoint
CREATE INDEX "promise_topic_idx" ON "promise" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "promise_published_idx" ON "promise" USING btree ("published");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "correction_promise_idx" ON "correction" USING btree ("promise_id");--> statement-breakpoint
CREATE INDEX "correction_status_idx" ON "correction" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_decision_entity_idx" ON "review_decision" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "review_decision_reviewer_idx" ON "review_decision" USING btree ("reviewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_document_content_hash_uq" ON "source_document" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "source_document_type_idx" ON "source_document" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "source_document_state_idx" ON "source_document" USING btree ("processing_state");