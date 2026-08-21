/**
 * Program → koaliční smlouva. Co se se slibem stalo po sestavení koalice.
 *
 * A7 — vědomě tu není žádné agregované skóre za stranu. Počty NOT_INCLUDED
 * na kandidátku by fakticky byly žebříček důvěryhodnosti, což zakazuje
 * integritní pravidlo č. 10. Agregace se nepočítá ani v DB, ani v UI.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "@/db/columns";
import { coalitionMappingTypeEnum } from "@/db/enums";
import { appUsers } from "@/modules/accounts/schema";
import { aiSuggestions } from "@/modules/ai/schema";
import { evidence } from "@/modules/evidence/schema";
import { promises } from "@/modules/promises/schema";
import { sourceDocuments } from "@/modules/sources/schema";

export const coalitionPromiseMappings = pgTable(
  "coalition_promise_mapping",
  {
    id: pk(),
    promiseId: uuid("promise_id")
      .notNull()
      .references(() => promises.id, { onDelete: "cascade" }),
    /** Koaliční smlouva, vůči které se slib porovnává. */
    coalitionSourceDocumentId: uuid("coalition_source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "restrict" }),
    classification: coalitionMappingTypeEnum("classification").notNull(),
    /** Místo v koaliční smlouvě. U NOT_INCLUDED chybí — proto je nullable. */
    coalitionEvidenceId: uuid("coalition_evidence_id").references(() => evidence.id, {
      onDelete: "restrict",
    }),
    /** Proč právě tahle klasifikace. Musí odkazovat na text, ne na dojem. */
    reason: text("reason").notNull(),
    humanVerified: boolean("human_verified").notNull().default(false),
    verifiedById: uuid("verified_by_id").references(() => appUsers.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    aiSuggestionId: uuid("ai_suggestion_id").references(() => aiSuggestions.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("coalition_mapping_uq").on(t.promiseId, t.coalitionSourceDocumentId),
    index("coalition_mapping_classification_idx").on(t.classification),
    check(
      "coalition_mapping_needs_evidence_unless_absent",
      sql`${t.classification} IN ('NOT_INCLUDED', 'UNCLEAR') OR ${t.coalitionEvidenceId} IS NOT NULL`,
    ),
    check(
      "coalition_mapping_verified_has_reviewer",
      sql`${t.humanVerified} = false OR (${t.verifiedById} IS NOT NULL AND ${t.verifiedAt} IS NOT NULL)`,
    ),
  ],
);

export const coalitionPromiseMappingRelations = relations(coalitionPromiseMappings, ({ one }) => ({
  promise: one(promises, {
    fields: [coalitionPromiseMappings.promiseId],
    references: [promises.id],
  }),
  coalitionSourceDocument: one(sourceDocuments, {
    fields: [coalitionPromiseMappings.coalitionSourceDocumentId],
    references: [sourceDocuments.id],
  }),
  coalitionEvidence: one(evidence, {
    fields: [coalitionPromiseMappings.coalitionEvidenceId],
    references: [evidence.id],
  }),
}));
