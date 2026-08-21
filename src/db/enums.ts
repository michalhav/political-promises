/**
 * Sdílené Postgres enumy.
 *
 * Enum musí v Postgresu vzniknout právě jednou, proto žijí zde a ne v modulech —
 * jinak by je drizzle-kit generoval opakovaně a moduly by na sobě cyklicky visely.
 * Doménové hodnoty pochází z MASTER_IMPLEMENTATION_BRIEF.md.
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const jurisdictionTypeEnum = pgEnum("jurisdiction_type", [
  "MUNICIPALITY",
  "CITY_DISTRICT",
  "REGION",
  "COUNTRY",
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "ELECTION_PROGRAM",
  "COALITION_AGREEMENT",
  "COUNCIL_RESOLUTION",
  "COUNCIL_VOTE",
  "BUDGET",
  "CONTRACT",
  "PUBLIC_PROCUREMENT",
  "OFFICIAL_REPORT",
  "MEDIA_REPORT",
  "OTHER",
]);

/**
 * B2 — autorská práva. Politické dokumenty (program, koaliční smlouva, usnesení)
 * ukládáme celé; u chráněných děl (novinový článek) držíme jen odkaz a krátký citát.
 */
export const licenseModeEnum = pgEnum("license_mode", ["FULL_TEXT_STORED", "QUOTE_ONLY"]);

export const processingStateEnum = pgEnum("processing_state", [
  "PENDING",
  "PROCESSING",
  "REVIEW_REQUIRED",
  "FAILED",
  "PUBLISHED",
]);

export const topicEnum = pgEnum("topic", [
  "HOUSING",
  "TRANSPORT",
  "EDUCATION",
  "ENVIRONMENT",
  "DIGITALIZATION",
  "PUBLIC_FINANCE",
  "SECURITY",
  "SOCIAL_POLICY",
  "URBAN_DEVELOPMENT",
  "OTHER",
]);

export const executionStatusEnum = pgEnum("execution_status", [
  /**
   * Ke dni hodnocení jsme nenašli veřejný doklad o realizaci. Je to výrok
   * o našich zdrojích, ne o městě — proto se liší od NOT_STARTED, který tvrdí,
   * že realizace nezačala, a bez důkazu ho pravidla konzistence nepustí.
   */
  "NO_VERIFIED_PROGRESS",
  "NOT_STARTED",
  "PLANNED",
  "IN_PROGRESS",
  "PARTIALLY_COMPLETED",
  "COMPLETED",
  "ABANDONED",
  "BLOCKED",
  "NOT_ASSESSABLE",
  "UNKNOWN",
]);

export const outcomeStatusEnum = pgEnum("outcome_status", [
  "NOT_MEASURABLE_YET",
  "ACHIEVED",
  "PARTIALLY_ACHIEVED",
  "NOT_ACHIEVED",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);

export const assessabilityEnum = pgEnum("assessability", [
  "HIGH",
  "MEDIUM",
  "LOW",
  "NOT_ASSESSABLE",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "PROMISE_CREATED",
  "COALITION_INCLUDED",
  "COALITION_MODIFIED",
  "COUNCIL_DECISION",
  "BUDGET_ALLOCATED",
  "PROCUREMENT_STARTED",
  "CONTRACT_SIGNED",
  "IMPLEMENTATION_STARTED",
  "MILESTONE_REACHED",
  "COMPLETED",
  "BLOCKED",
  "ABANDONED",
]);

export const relationTypeEnum = pgEnum("relation_type", [
  "SUPPORTS",
  "CONTRADICTS",
  "PROGRESS",
  "IMPLEMENTATION",
  "FUNDING",
  "OUTCOME",
  "CONTEXT",
]);

export const coalitionMappingTypeEnum = pgEnum("coalition_mapping_type", [
  "RETAINED",
  "MODIFIED",
  "MERGED",
  "NOT_INCLUDED",
  "UNCLEAR",
]);

/** A2 — bez směru se z naměřené hodnoty nedá odvodit, jestli cíl byl splněn. */
export const metricDirectionEnum = pgEnum("metric_direction", ["INCREASE", "DECREASE", "MAINTAIN"]);

/** A1 — strany se přejmenovávají, slučují a štěpí; slib musí zůstat u původního subjektu. */
export const partyRelationTypeEnum = pgEnum("party_relation_type", [
  "RENAMED_TO",
  "MERGED_INTO",
  "SPLIT_FROM",
]);

export const personRoleTypeEnum = pgEnum("person_role_type", [
  "CANDIDATE",
  "COUNCILLOR",
  "MAYOR",
  "DEPUTY_MAYOR",
  "COMMITTEE_MEMBER",
  "PARTY_LEADER",
]);

export const aiTaskTypeEnum = pgEnum("ai_task_type", [
  "PROMISE_EXTRACTION",
  "EVIDENCE_MATCHING",
  "COALITION_MAPPING",
]);

export const aiRunStatusEnum = pgEnum("ai_run_status", [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
]);

export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
]);

export const reviewDecisionTypeEnum = pgEnum("review_decision_type", [
  "ACCEPT",
  "REJECT",
  "EDIT",
  "MERGE",
  "PUBLISH",
  "UNPUBLISH",
]);

/** A8 + B1 — oprava zvenčí, reakce dotčené strany, i vlastní redakční revize. */
export const correctionKindEnum = pgEnum("correction_kind", [
  "PUBLIC_CORRECTION",
  "PARTY_RESPONSE",
  "INTERNAL_REVISION",
]);

export const correctionStatusEnum = pgEnum("correction_status", [
  "OPEN",
  "ACKNOWLEDGED",
  "APPLIED",
  "REJECTED",
]);

/**
 * Redakční stav hodnocení. Workflow se nesmí odvozovat z prázdných sloupců —
 * "reviewed_by_id je NULL" neříká, jestli hodnocení čeká na revizi, nebo se
 * po vrácení znovu píše.
 */
export const assessmentWorkflowStateEnum = pgEnum("assessment_workflow_state", [
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
]);
