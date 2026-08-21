import { relations } from "drizzle-orm";
import { char, date, index, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { createdAt, pk, slug, updatedAt } from "@/db/columns";
import { jurisdictionTypeEnum } from "@/db/enums";

export const jurisdictions = pgTable(
  "jurisdiction",
  {
    id: pk(),
    slug: slug(),
    name: varchar("name", { length: 200 }).notNull(),
    type: jurisdictionTypeEnum("type").notNull(),
    countryCode: char("country_code", { length: 2 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("jurisdiction_slug_uq").on(t.slug)],
);

export const elections = pgTable(
  "election",
  {
    id: pk(),
    jurisdictionId: uuid("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "restrict" }),
    slug: slug(),
    name: varchar("name", { length: 200 }).notNull(),
    /** Komunální volby jsou dvoudenní; ukládáme první den. Datum bez času, ať nepodléhá TZ posunu. */
    electionDate: date("election_date", { mode: "string" }).notNull(),
    termStart: date("term_start", { mode: "string" }),
    termEnd: date("term_end", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("election_slug_uq").on(t.slug),
    index("election_jurisdiction_idx").on(t.jurisdictionId),
  ],
);

export const jurisdictionRelations = relations(jurisdictions, ({ many }) => ({
  elections: many(elections),
}));

export const electionRelations = relations(elections, ({ one }) => ({
  jurisdiction: one(jurisdictions, {
    fields: [elections.jurisdictionId],
    references: [jurisdictions.id],
  }),
}));
