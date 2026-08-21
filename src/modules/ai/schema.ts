/**
 * A6 + integritní pravidlo č. 6 — každý AI návrh musí nést provider, model,
 * verzi promptu a čas. Bez toho nejde po měsících zpětně říct, co systém navrhl a proč.
 *
 * ai_run  = jedno volání modelu (co šlo dovnitř, co stálo, jak dopadlo)
 * ai_suggestion = jeden konkrétní návrh z toho běhu, dokud ho člověk nepotvrdí
 */
import { relations } from "drizzle-orm";
import {
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAt, pk } from "@/db/columns";
import { aiRunStatusEnum, aiTaskTypeEnum, suggestionStatusEnum } from "@/db/enums";
import { appUsers } from "@/modules/accounts/schema";
import { sourceDocuments } from "@/modules/sources/schema";

export const aiRuns = pgTable(
  "ai_run",
  {
    id: pk(),
    taskType: aiTaskTypeEnum("task_type").notNull(),
    provider: varchar("provider", { length: 60 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    /** Verze promptu z kódu, ne volný text. Umožní porovnat kvalitu mezi verzemi. */
    promptVersion: varchar("prompt_version", { length: 60 }).notNull(),
    sourceDocumentId: uuid("source_document_id").references(() => sourceDocuments.id, {
      onDelete: "restrict",
    }),
    /** SHA-256 vstupu — stejný vstup se nemusí platit dvakrát. */
    inputHash: char("input_hash", { length: 64 }).notNull(),
    status: aiRunStatusEnum("status").notNull().default("PENDING"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_run_task_idx").on(t.taskType),
    index("ai_run_status_idx").on(t.status),
    index("ai_run_input_hash_idx").on(t.inputHash),
  ],
);

export const aiSuggestions = pgTable(
  "ai_suggestion",
  {
    id: pk(),
    aiRunId: uuid("ai_run_id")
      .notNull()
      .references(() => aiRuns.id, { onDelete: "cascade" }),
    /** Surový validovaný výstup modelu. Zůstává i po přijetí, kvůli dohledatelnosti. */
    payload: jsonb("payload").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    status: suggestionStatusEnum("status").notNull().default("PENDING"),
    reviewedById: uuid("reviewed_by_id").references(() => appUsers.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_suggestion_run_idx").on(t.aiRunId),
    index("ai_suggestion_status_idx").on(t.status),
  ],
);

export const aiRunRelations = relations(aiRuns, ({ one, many }) => ({
  sourceDocument: one(sourceDocuments, {
    fields: [aiRuns.sourceDocumentId],
    references: [sourceDocuments.id],
  }),
  suggestions: many(aiSuggestions),
}));

export const aiSuggestionRelations = relations(aiSuggestions, ({ one }) => ({
  run: one(aiRuns, { fields: [aiSuggestions.aiRunId], references: [aiRuns.id] }),
  reviewedBy: one(appUsers, { fields: [aiSuggestions.reviewedById], references: [appUsers.id] }),
}));
