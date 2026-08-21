/**
 * A4 — hodnocení je append-only, ne přepisovaný řádek.
 *
 * Integritní pravidlo č. 5 ("každá změna statusu musí být zaznamenána") a sekce
 * CORRECTIONS ("aktualizováno DATE, důvod") jdou dohromady jen tak, že každá
 * změna vytvoří novou verzi. Starší verze zůstávají čitelné. UPDATE a DELETE
 * na téhle tabulce blokuje trigger z migrace 0001.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAt, pk } from "@/db/columns";
import {
  assessabilityEnum,
  assessmentWorkflowStateEnum,
  executionStatusEnum,
  outcomeStatusEnum,
} from "@/db/enums";
import { appUsers } from "@/modules/accounts/schema";
import { aiSuggestions } from "@/modules/ai/schema";
import { promises } from "@/modules/promises/schema";

export const promiseAssessments = pgTable(
  "promise_assessment",
  {
    id: pk(),
    promiseId: uuid("promise_id")
      .notNull()
      .references(() => promises.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    previousAssessmentId: uuid("previous_assessment_id"),

    specificityScore: integer("specificity_score").notNull(),
    measurabilityScore: integer("measurability_score").notNull(),
    deadlineScore: integer("deadline_score").notNull(),
    jurisdictionScore: integer("jurisdiction_score").notNull(),
    outcomeDefinitionScore: integer("outcome_definition_score").notNull(),

    /** Odvozeno deterministicky z pěti skóre — viz assessability.ts a /methodology. */
    assessability: assessabilityEnum("assessability").notNull(),
    /** A3 — verze algoritmu, která tohle hodnocení vyrobila. Bez ní nejde audit zpětně. */
    methodologyVersion: varchar("methodology_version", { length: 20 }).notNull(),

    /**
     * Redakční stav. Publikovaná verze je od téhle chvíle zmrazená — trigger
     * z migrace 0004 na ní nepustí žádnou změnu kromě zhasnutí `is_current`,
     * když ji nahradí novější verze.
     */
    workflowState: assessmentWorkflowStateEnum("workflow_state").notNull().default("DRAFT"),

    /**
     * Rozhodné datum: ke kterému dni jsme zdroje procházeli.
     *
     * Bez něj je stav plnění nedatovaný výrok. "Bez doloženého postupu" nedává
     * smysl bez odpovědi na otázku "k jakému datu" — zítra může vyjít usnesení
     * a tvrzení přestane platit, aniž by ho kdokoli změnil. Není to totéž co
     * `created_at`: hodnocení může vzniknout později, než kam sahá rešerše.
     */
    sourcesReviewedUpTo: date("sources_reviewed_up_to", { mode: "string" }).notNull(),

    executionStatus: executionStatusEnum("execution_status").notNull(),
    outcomeStatus: outcomeStatusEnum("outcome_status").notNull(),
    summary: text("summary"),

    /** Proč se tahle verze liší od předchozí. U verze 1 zůstává NULL. */
    changeReason: text("change_reason"),

    createdById: uuid("created_by_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    /** B3 — čtyři oči. Publikovat smí jen hodnocení schválené někým jiným než autorem. */
    reviewedById: uuid("reviewed_by_id").references(() => appUsers.id, { onDelete: "restrict" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    aiSuggestionId: uuid("ai_suggestion_id").references(() => aiSuggestions.id, {
      onDelete: "set null",
    }),

    isCurrent: boolean("is_current").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("promise_assessment_version_uq").on(t.promiseId, t.version),
    uniqueIndex("promise_assessment_current_uq")
      .on(t.promiseId)
      .where(sql`${t.isCurrent}`),
    index("promise_assessment_promise_idx").on(t.promiseId),
    index("promise_assessment_execution_idx").on(t.executionStatus),
    foreignKey({
      columns: [t.previousAssessmentId],
      foreignColumns: [t.id],
      name: "promise_assessment_previous_fk",
    }).onDelete("restrict"),
    check("promise_assessment_version_positive", sql`${t.version} >= 1`),
    check(
      "promise_assessment_scores_range",
      sql`${t.specificityScore} BETWEEN 0 AND 5
        AND ${t.measurabilityScore} BETWEEN 0 AND 5
        AND ${t.deadlineScore} BETWEEN 0 AND 5
        AND ${t.jurisdictionScore} BETWEEN 0 AND 5
        AND ${t.outcomeDefinitionScore} BETWEEN 0 AND 5`,
    ),
    check(
      "promise_assessment_four_eyes",
      sql`${t.reviewedById} IS NULL OR ${t.reviewedById} <> ${t.createdById}`,
    ),
    check(
      "promise_assessment_review_complete",
      sql`(${t.reviewedById} IS NULL) = (${t.reviewedAt} IS NULL)`,
    ),
    check(
      "promise_assessment_published_is_reviewed",
      sql`${t.workflowState} <> 'PUBLISHED' OR (${t.reviewedById} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL)`,
    ),
    check(
      "promise_assessment_current_is_published",
      sql`${t.isCurrent} = false OR ${t.workflowState} = 'PUBLISHED'`,
    ),
    check(
      "promise_assessment_change_reason_from_v2",
      sql`${t.version} = 1 OR ${t.changeReason} IS NOT NULL`,
    ),
  ],
);

export const promiseAssessmentRelations = relations(promiseAssessments, ({ one }) => ({
  promise: one(promises, {
    fields: [promiseAssessments.promiseId],
    references: [promises.id],
  }),
  createdBy: one(appUsers, {
    fields: [promiseAssessments.createdById],
    references: [appUsers.id],
  }),
  aiSuggestion: one(aiSuggestions, {
    fields: [promiseAssessments.aiSuggestionId],
    references: [aiSuggestions.id],
  }),
}));
