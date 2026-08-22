/**
 * Redakční vrstva: rozhodnutí, audit, opravy.
 *
 * audit_log je záměrně polymorfní (entityType + entityId bez FK) — jinak by
 * musela mít cizí klíč do každé tabulky v systému a při mazání entity by se
 * ztratil právě ten záznam, kvůli kterému audit existuje.
 */
import { relations, sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "@/db/columns";
import { correctionKindEnum, correctionStatusEnum, reviewDecisionTypeEnum } from "@/db/enums";
import { appUsers } from "@/modules/accounts/schema";
import { promiseAssessments } from "@/modules/assessments/schema";
import { promises } from "@/modules/promises/schema";

export const reviewDecisions = pgTable(
  "review_decision",
  {
    id: pk(),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    decision: reviewDecisionTypeEnum("decision").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("review_decision_entity_idx").on(t.entityType, t.entityId),
    index("review_decision_reviewer_idx").on(t.reviewerId),
  ],
);

export const auditLogs = pgTable(
  "audit_log",
  {
    id: pk(),
    actorId: uuid("actor_id").references(() => appUsers.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: uuid("entity_id"),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_created_idx").on(t.createdAt),
  ],
);

/**
 * A8 + B1 — opravný mechanismus a právo na odpověď.
 * U produktu, kde je důvěra hlavní feature, tohle nemůže čekat na fázi 6.
 */
export const corrections = pgTable(
  "correction",
  {
    id: pk(),
    promiseId: uuid("promise_id")
      .notNull()
      .references(() => promises.id, { onDelete: "cascade" }),
    kind: correctionKindEnum("kind").notNull(),
    status: correctionStatusEnum("status").notNull().default("OPEN"),
    /** Kdo opravu podal. U PARTY_RESPONSE typicky tiskové oddělení kandidátky. */
    submitterName: varchar("submitter_name", { length: 200 }),
    submitterEmail: varchar("submitter_email", { length: 320 }),
    submitterOrganization: varchar("submitter_organization", { length: 200 }),
    /**
     * Otisk adresy odesílatele u veřejného podání, nikdy adresa sama.
     *
     * Slouží k omezení počtu podání z jednoho místa a k dohledání zneužití.
     * Stejný postup jako u přihlašování: otisk stačí na obojí a neuchovává
     * osobní údaj, který k ničemu dalšímu nepotřebujeme.
     */
    submitterIpHash: char("submitter_ip_hash", { length: 64 }),
    body: text("body").notNull(),
    /** Veřejná redakční odpověď. Zobrazuje se u slibu spolu s podnětem. */
    response: text("response"),
    /** Verze hodnocení, která z opravy vzešla. Spojuje podnět s reálnou změnou. */
    appliedAssessmentId: uuid("applied_assessment_id").references(() => promiseAssessments.id, {
      onDelete: "set null",
    }),
    handledById: uuid("handled_by_id").references(() => appUsers.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("correction_promise_idx").on(t.promiseId),
    index("correction_ip_idx").on(t.submitterIpHash, t.createdAt),
    index("correction_status_idx").on(t.status),
    check(
      "correction_resolved_has_timestamp",
      sql`${t.status} IN ('OPEN', 'ACKNOWLEDGED') OR ${t.resolvedAt} IS NOT NULL`,
    ),
    check(
      "correction_applied_has_assessment",
      sql`${t.status} <> 'APPLIED' OR ${t.appliedAssessmentId} IS NOT NULL`,
    ),
  ],
);

export const correctionRelations = relations(corrections, ({ one }) => ({
  promise: one(promises, { fields: [corrections.promiseId], references: [promises.id] }),
  appliedAssessment: one(promiseAssessments, {
    fields: [corrections.appliedAssessmentId],
    references: [promiseAssessments.id],
  }),
  handledBy: one(appUsers, { fields: [corrections.handledById], references: [appUsers.id] }),
}));

export const reviewDecisionRelations = relations(reviewDecisions, ({ one }) => ({
  reviewer: one(appUsers, { fields: [reviewDecisions.reviewerId], references: [appUsers.id] }),
}));
