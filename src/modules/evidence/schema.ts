/**
 * A5 — vazba důkaz ↔ slib je M:N, ne 1:1.
 * Jedna rozpočtová položka financuje pět slibů, jedna událost stojí na třech zdrojích.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "@/db/columns";
import { relationTypeEnum } from "@/db/enums";
import { appUsers } from "@/modules/accounts/schema";
import { aiSuggestions } from "@/modules/ai/schema";
import { promiseEvents, promises } from "@/modules/promises/schema";
import { sourceDocuments } from "@/modules/sources/schema";

/** Konkrétní místo ve zdroji, o které se opírá tvrzení. Bez zdroje nemůže vzniknout. */
export const evidence = pgTable(
  "evidence",
  {
    id: pk(),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "restrict" }),
    excerpt: text("excerpt").notNull(),
    pageNumber: integer("page_number"),
    locator: varchar("locator", { length: 200 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("evidence_source_document_idx").on(t.sourceDocumentId)],
);

export const promiseEvidence = pgTable(
  "promise_evidence",
  {
    id: pk(),
    promiseId: uuid("promise_id")
      .notNull()
      .references(() => promises.id, { onDelete: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id, { onDelete: "cascade" }),
    relationType: relationTypeEnum("relation_type").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    /** Dokud je false, vazba se veřejně nezobrazuje (integritní pravidlo č. 2). */
    humanVerified: boolean("human_verified").notNull().default(false),
    verifiedById: uuid("verified_by_id").references(() => appUsers.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    /** Nenulové = vazbu navrhla AI. UI to musí odlišit od lidsky ověřené vazby. */
    aiSuggestionId: uuid("ai_suggestion_id").references(() => aiSuggestions.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("promise_evidence_uq").on(t.promiseId, t.evidenceId, t.relationType),
    index("promise_evidence_promise_idx").on(t.promiseId),
    index("promise_evidence_evidence_idx").on(t.evidenceId),
    check(
      "promise_evidence_verified_has_reviewer",
      sql`${t.humanVerified} = false OR (${t.verifiedById} IS NOT NULL AND ${t.verifiedAt} IS NOT NULL)`,
    ),
  ],
);

export const promiseEventEvidence = pgTable(
  "promise_event_evidence",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => promiseEvents.id, { onDelete: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.evidenceId] }),
    index("promise_event_evidence_evidence_idx").on(t.evidenceId),
  ],
);

export const evidenceRelations = relations(evidence, ({ one, many }) => ({
  sourceDocument: one(sourceDocuments, {
    fields: [evidence.sourceDocumentId],
    references: [sourceDocuments.id],
  }),
  promiseLinks: many(promiseEvidence),
  eventLinks: many(promiseEventEvidence),
}));

export const promiseEvidenceRelations = relations(promiseEvidence, ({ one }) => ({
  promise: one(promises, { fields: [promiseEvidence.promiseId], references: [promises.id] }),
  evidence: one(evidence, { fields: [promiseEvidence.evidenceId], references: [evidence.id] }),
  aiSuggestion: one(aiSuggestions, {
    fields: [promiseEvidence.aiSuggestionId],
    references: [aiSuggestions.id],
  }),
}));

export const promiseEventEvidenceRelations = relations(promiseEventEvidence, ({ one }) => ({
  event: one(promiseEvents, {
    fields: [promiseEventEvidence.eventId],
    references: [promiseEvents.id],
  }),
  evidence: one(evidence, {
    fields: [promiseEventEvidence.evidenceId],
    references: [evidence.id],
  }),
}));
