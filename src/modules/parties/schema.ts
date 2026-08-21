/**
 * A1 — subjekt, který dává slib, není strana, ale kandidátka.
 *
 * Praha 2022 jde přes koaliční kandidátky (SPOLU, PirSTAN), strany se v čase
 * přejmenovávají a slučují, a zastupitelé mezi kluby přebíhají. Model to musí
 * unést, jinak se slib nedá spolehlivě přiřadit k tomu, kdo ho vyslovil.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAt, pk, slug, updatedAt } from "@/db/columns";
import { partyRelationTypeEnum, personRoleTypeEnum } from "@/db/enums";
import { elections } from "@/modules/jurisdictions/schema";
import { sourceDocuments } from "@/modules/sources/schema";

export const parties = pgTable(
  "party",
  {
    id: pk(),
    slug: slug(),
    name: varchar("name", { length: 200 }).notNull(),
    shortName: varchar("short_name", { length: 60 }).notNull(),
    /** Rejstříkové ID politické strany u MV ČR, pokud je známé. Kotví identitu při přejmenování. */
    registrationId: varchar("registration_id", { length: 60 }),
    foundedOn: date("founded_on", { mode: "string" }),
    dissolvedOn: date("dissolved_on", { mode: "string" }),
    /**
     * Smyšlený subjekt z ukázkového datasetu. Není to příznak pro vývoj, ale
     * součást provenience: uživatel musí poznat, že jméno neoznačuje skutečnou
     * politickou stranu. UI to označuje u každého výskytu.
     */
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("party_slug_uq").on(t.slug)],
);

/** Přejmenování / fúze / štěpení. Každý přechod musí mít doložený zdroj. */
export const partyLineage = pgTable(
  "party_lineage",
  {
    id: pk(),
    fromPartyId: uuid("from_party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    toPartyId: uuid("to_party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    relationType: partyRelationTypeEnum("relation_type").notNull(),
    effectiveOn: date("effective_on", { mode: "string" }).notNull(),
    sourceDocumentId: uuid("source_document_id").references(() => sourceDocuments.id, {
      onDelete: "restrict",
    }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("party_lineage_uq").on(t.fromPartyId, t.toPartyId, t.relationType, t.effectiveOn),
    index("party_lineage_from_idx").on(t.fromPartyId),
    index("party_lineage_to_idx").on(t.toPartyId),
  ],
);

export const persons = pgTable(
  "person",
  {
    id: pk(),
    slug: slug(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    /**
     * B4 — u veřejných funkcionářů zpracováváme jen minimum nutné k odlišení osob.
     * Datum narození vědomě neukládáme, rok stačí na rozlišení jmenovců.
     */
    birthYear: integer("birth_year"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("person_slug_uq").on(t.slug)],
);

/** Kandidátka ve volbách — samostatná strana i koalice více stran. */
export const electoralLists = pgTable(
  "electoral_list",
  {
    id: pk(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "restrict" }),
    slug: slug(),
    name: varchar("name", { length: 200 }).notNull(),
    shortName: varchar("short_name", { length: 60 }).notNull(),
    /** Číslo kandidátky na hlasovacím lístku. */
    ballotNumber: integer("ballot_number"),
    seatsWon: integer("seats_won"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("electoral_list_slug_uq").on(t.slug),
    index("electoral_list_election_idx").on(t.electionId),
  ],
);

export const electoralListParties = pgTable(
  "electoral_list_party",
  {
    id: pk(),
    electoralListId: uuid("electoral_list_id")
      .notNull()
      .references(() => electoralLists.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    /** Pořadí pro zobrazení složení koalice, ne váha vlivu. */
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("electoral_list_party_uq").on(t.electoralListId, t.partyId),
    index("electoral_list_party_party_idx").on(t.partyId),
  ],
);

/**
 * Role osoby ve volebním období. Přeběh mezi kluby = ukončená role a nová role,
 * nikdy přepsaný řádek — jinak zmizí historie.
 */
export const personRoles = pgTable(
  "person_role",
  {
    id: pk(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    electionId: uuid("election_id").references(() => elections.id, { onDelete: "restrict" }),
    electoralListId: uuid("electoral_list_id").references(() => electoralLists.id, {
      onDelete: "restrict",
    }),
    /** Klub/strana, za kterou osobu v daném období vedeme. Po přeběhu jiná než kandidátka. */
    partyId: uuid("party_id").references(() => parties.id, { onDelete: "restrict" }),
    roleType: personRoleTypeEnum("role_type").notNull(),
    startedOn: date("started_on", { mode: "string" }),
    endedOn: date("ended_on", { mode: "string" }),
    sourceDocumentId: uuid("source_document_id").references(() => sourceDocuments.id, {
      onDelete: "restrict",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("person_role_person_idx").on(t.personId),
    index("person_role_election_idx").on(t.electionId),
    index("person_role_party_idx").on(t.partyId),
  ],
);

export const partyRelations = relations(parties, ({ many }) => ({
  electoralListParties: many(electoralListParties),
}));

export const electoralListRelations = relations(electoralLists, ({ one, many }) => ({
  election: one(elections, {
    fields: [electoralLists.electionId],
    references: [elections.id],
  }),
  parties: many(electoralListParties),
}));

export const electoralListPartyRelations = relations(electoralListParties, ({ one }) => ({
  electoralList: one(electoralLists, {
    fields: [electoralListParties.electoralListId],
    references: [electoralLists.id],
  }),
  party: one(parties, {
    fields: [electoralListParties.partyId],
    references: [parties.id],
  }),
}));

export const personRelations = relations(persons, ({ many }) => ({
  roles: many(personRoles),
}));

export const personRoleRelations = relations(personRoles, ({ one }) => ({
  person: one(persons, { fields: [personRoles.personId], references: [persons.id] }),
  party: one(parties, { fields: [personRoles.partyId], references: [parties.id] }),
  electoralList: one(electoralLists, {
    fields: [personRoles.electoralListId],
    references: [electoralLists.id],
  }),
}));
