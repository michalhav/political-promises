import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAt, pk, slug, updatedAt } from "@/db/columns";
import { eventTypeEnum, metricDirectionEnum, topicEnum } from "@/db/enums";
import { aiSuggestions } from "@/modules/ai/schema";
import { electoralLists } from "@/modules/parties/schema";
import { sourceDocuments } from "@/modules/sources/schema";

export const promises = pgTable(
  "promise",
  {
    id: pk(),
    /** A1 — slib patří kandidátce, ne straně. Strany se dohledají přes electoral_list_party. */
    electoralListId: uuid("electoral_list_id")
      .notNull()
      .references(() => electoralLists.id, { onDelete: "restrict" }),
    slug: slug(),
    title: varchar("title", { length: 300 }).notNull(),
    /** Doslovné znění ze zdroje. Po publikaci neměnné — vynuceno triggerem v migraci. */
    originalText: text("original_text").notNull(),
    /** Redakční přeformulování do ověřitelné věty. Nikdy nenahrazuje originalText. */
    normalizedStatement: text("normalized_statement"),
    topic: topicEnum("topic").notNull(),
    /** Termín tak, jak ho uvádí zdroj ("do konce volebního období"). */
    deadlineText: varchar("deadline_text", { length: 200 }),
    /** Termín převedený na datum, jen když to jde bez dohadů. */
    deadlineOn: date("deadline_on", { mode: "string" }),
    published: boolean("published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Sloučení duplicit v review konzoli. Sloučený slib zůstává, jen ukazuje na cíl. */
    mergedIntoPromiseId: uuid("merged_into_promise_id"),
    /**
     * Integritní pravidlo č. 7 — kandidát vytěžený AI musí zůstat odlišitelný
     * od slibu, který zapsal redaktor. Po publikaci hodnota zůstává: je to
     * provenience, ne pracovní příznak.
     */
    aiSuggestionId: uuid("ai_suggestion_id").references(() => aiSuggestions.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("promise_slug_uq").on(t.slug),
    index("promise_electoral_list_idx").on(t.electoralListId),
    index("promise_topic_idx").on(t.topic),
    index("promise_published_idx").on(t.published),
    check(
      "promise_published_has_timestamp",
      sql`${t.published} = false OR ${t.publishedAt} IS NOT NULL`,
    ),
    check("promise_not_merged_into_self", sql`${t.mergedIntoPromiseId} <> ${t.id}`),
    foreignKey({
      columns: [t.mergedIntoPromiseId],
      foreignColumns: [t.id],
      name: "promise_merged_into_fk",
    }).onDelete("set null"),
  ],
);

/** Kde přesně slib ve zdroji stojí. M:N — jeden slib může stát ve dvou dokumentech. */
export const promiseSources = pgTable(
  "promise_source",
  {
    id: pk(),
    promiseId: uuid("promise_id")
      .notNull()
      .references(() => promises.id, { onDelete: "cascade" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "restrict" }),
    excerpt: text("excerpt").notNull(),
    pageNumber: integer("page_number"),
    /** Např. kapitola nebo bod programu, když stránkování nedává smysl. */
    locator: varchar("locator", { length: 200 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("promise_source_promise_idx").on(t.promiseId),
    index("promise_source_document_idx").on(t.sourceDocumentId),
    uniqueIndex("promise_source_primary_uq")
      .on(t.promiseId)
      .where(sql`${t.isPrimary}`),
  ],
);

/**
 * A2 — bez metriky je "ACHIEVED" jen názor redaktora.
 * Metrika je závazek přepsaný do měřitelné podoby: co, odkud kam, do kdy.
 */
export const promiseMetrics = pgTable(
  "promise_metric",
  {
    id: pk(),
    promiseId: uuid("promise_id")
      .notNull()
      .references(() => promises.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    unit: varchar("unit", { length: 60 }).notNull(),
    direction: metricDirectionEnum("direction").notNull(),
    baselineValue: numeric("baseline_value", { precision: 20, scale: 4 }),
    baselineOn: date("baseline_on", { mode: "string" }),
    targetValue: numeric("target_value", { precision: 20, scale: 4 }),
    targetOn: date("target_on", { mode: "string" }),
    /** Jak se metrika počítá a proč zrovna takhle. Jde na /methodology. */
    definitionNote: text("definition_note"),
    /** Odkud pochází cílová hodnota. NULL = cíl je redakční interpretace, ne citace. */
    sourceDocumentId: uuid("source_document_id").references(() => sourceDocuments.id, {
      onDelete: "restrict",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("promise_metric_promise_idx").on(t.promiseId)],
);

/** Naměřená hodnota. Zdroj je povinný — jinak by šlo číslo vymyslet. */
export const metricMeasurements = pgTable(
  "metric_measurement",
  {
    id: pk(),
    metricId: uuid("metric_id")
      .notNull()
      .references(() => promiseMetrics.id, { onDelete: "cascade" }),
    value: numeric("value", { precision: 20, scale: 4 }).notNull(),
    measuredOn: date("measured_on", { mode: "string" }).notNull(),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "restrict" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("metric_measurement_metric_idx").on(t.metricId),
    uniqueIndex("metric_measurement_uq").on(t.metricId, t.measuredOn, t.sourceDocumentId),
  ],
);

/** Časová osa slibu. Důkazy visí přes promise_event_evidence (A5). */
export const promiseEvents = pgTable(
  "promise_event",
  {
    id: pk(),
    promiseId: uuid("promise_id")
      .notNull()
      .references(() => promises.id, { onDelete: "cascade" }),
    eventType: eventTypeEnum("event_type").notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("promise_event_promise_idx").on(t.promiseId),
    index("promise_event_date_idx").on(t.eventDate),
  ],
);

export const promiseRelations = relations(promises, ({ one, many }) => ({
  electoralList: one(electoralLists, {
    fields: [promises.electoralListId],
    references: [electoralLists.id],
  }),
  sources: many(promiseSources),
  metrics: many(promiseMetrics),
  events: many(promiseEvents),
}));

export const promiseSourceRelations = relations(promiseSources, ({ one }) => ({
  promise: one(promises, { fields: [promiseSources.promiseId], references: [promises.id] }),
  sourceDocument: one(sourceDocuments, {
    fields: [promiseSources.sourceDocumentId],
    references: [sourceDocuments.id],
  }),
}));

export const promiseMetricRelations = relations(promiseMetrics, ({ one, many }) => ({
  promise: one(promises, { fields: [promiseMetrics.promiseId], references: [promises.id] }),
  measurements: many(metricMeasurements),
}));

export const metricMeasurementRelations = relations(metricMeasurements, ({ one }) => ({
  metric: one(promiseMetrics, {
    fields: [metricMeasurements.metricId],
    references: [promiseMetrics.id],
  }),
  sourceDocument: one(sourceDocuments, {
    fields: [metricMeasurements.sourceDocumentId],
    references: [sourceDocuments.id],
  }),
}));

export const promiseEventRelations = relations(promiseEvents, ({ one }) => ({
  promise: one(promises, { fields: [promiseEvents.promiseId], references: [promises.id] }),
}));
