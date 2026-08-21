/**
 * Zakládání stran a kandidátek.
 *
 * Doteď vznikaly jedině seedem, takže reálný subjekt se do systému nedal
 * dostat bez zásahu do databáze — a bez kandidátky nejde založit slib.
 *
 * Strana a kandidátka zůstávají oddělené entity (pravidlo A1): slib patří
 * kandidátce, protože právě ta šla do voleb s programem. Koalice se skládá
 * z více stran, a kdyby se to slilo do jedné tabulky, historie stran po
 * rozpadu koalice by se rozpadla s ní. Formulář proto zakládá stranu a
 * kandidátku zvlášť a spojuje je výběrem.
 */
import { asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { AppDatabase } from "@/db/types";
import { elections } from "@/modules/jurisdictions/schema";
import { electoralListParties, electoralLists, parties } from "@/modules/parties/schema";
import { auditLogs } from "@/modules/review/schema";
import { EditorialError, parseEditorialInput as parse, type Actor } from "@/modules/review/service";

const slugField = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Adresa smí obsahovat jen malá písmena bez diakritiky, číslice a pomlčky.",
  );

export const partyInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  shortName: z.string().trim().min(1).max(60),
  slug: slugField,
  registrationId: z.string().trim().max(60).optional(),
  isDemo: z.boolean().default(false),
});

export type PartyInput = z.input<typeof partyInputSchema>;

export const electoralListInputSchema = z.object({
  electionId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  shortName: z.string().trim().min(1).max(60),
  slug: slugField,
  ballotNumber: z.coerce.number().int().min(1).max(1000).optional(),
  seatsWon: z.coerce.number().int().min(0).max(1000).optional(),
  /** Strany za kandidátkou. Jedna u samostatné strany, víc u koalice. */
  partyIds: z.array(z.uuid()).min(1, "Vyber aspoň jednu stranu za kandidátkou."),
});

export type ElectoralListInput = z.input<typeof electoralListInputSchema>;

export async function createParty(db: AppDatabase, actor: Actor, rawInput: PartyInput) {
  const input = parse(partyInputSchema, rawInput);

  const [existing] = await db
    .select({ name: parties.name })
    .from(parties)
    .where(eq(parties.slug, input.slug))
    .limit(1);

  if (existing) {
    throw new EditorialError(`Adresa „${input.slug}" už patří straně „${existing.name}".`);
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(parties)
      .values({
        name: input.name,
        shortName: input.shortName,
        slug: input.slug,
        registrationId: input.registrationId ?? null,
        isDemo: input.isDemo,
      })
      .returning({ id: parties.id });

    if (!created) throw new EditorialError("Stranu se nepodařilo uložit.");

    await tx.insert(auditLogs).values({
      actorId: actor.id,
      action: "party.create",
      entityType: "party",
      entityId: created.id,
      afterJson: { name: input.name, slug: input.slug, isDemo: input.isDemo },
    });

    return created.id;
  });
}

export async function createElectoralList(
  db: AppDatabase,
  actor: Actor,
  rawInput: ElectoralListInput,
) {
  const input = parse(electoralListInputSchema, rawInput);

  const [election] = await db
    .select({ id: elections.id })
    .from(elections)
    .where(eq(elections.id, input.electionId))
    .limit(1);

  if (!election) throw new EditorialError("Vybrané volby v systému nejsou.");

  const [existing] = await db
    .select({ name: electoralLists.name })
    .from(electoralLists)
    .where(eq(electoralLists.slug, input.slug))
    .limit(1);

  if (existing) {
    throw new EditorialError(`Adresa „${input.slug}" už patří kandidátce „${existing.name}".`);
  }

  // Duplicity ve výběru by porušily unique index na dvojici; smysl nedávají.
  const partyIds = [...new Set(input.partyIds)];

  const known = await db
    .select({ id: parties.id })
    .from(parties)
    .where(inArray(parties.id, partyIds));

  if (known.length !== partyIds.length) {
    throw new EditorialError("Některá z vybraných stran v systému není.");
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(electoralLists)
      .values({
        electionId: input.electionId,
        name: input.name,
        shortName: input.shortName,
        slug: input.slug,
        ballotNumber: input.ballotNumber ?? null,
        seatsWon: input.seatsWon ?? null,
      })
      .returning({ id: electoralLists.id });

    if (!created) throw new EditorialError("Kandidátku se nepodařilo uložit.");

    await tx.insert(electoralListParties).values(
      partyIds.map((partyId, index) => ({
        electoralListId: created.id,
        partyId,
        displayOrder: index,
      })),
    );

    await tx.insert(auditLogs).values({
      actorId: actor.id,
      action: "electoral_list.create",
      entityType: "electoral_list",
      entityId: created.id,
      afterJson: { name: input.name, slug: input.slug, partyIds },
    });

    return created.id;
  });
}

// ---------------------------------------------------------------------------
// Čtecí model pro stránku

export interface RegistryElection {
  id: string;
  name: string;
  electionDate: string;
}

export interface RegistryParty {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  isDemo: boolean;
}

export interface RegistryList {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  electionName: string;
  ballotNumber: number | null;
  seatsWon: number | null;
  partyNames: string;
  promiseCount: number;
}

export interface RegistryData {
  elections: RegistryElection[];
  parties: RegistryParty[];
  lists: RegistryList[];
}

export async function getRegistryData(db: AppDatabase): Promise<RegistryData> {
  const [electionRows, partyRows, listRows] = await Promise.all([
    db
      .select({ id: elections.id, name: elections.name, electionDate: elections.electionDate })
      .from(elections)
      .orderBy(asc(elections.electionDate)),
    db
      .select({
        id: parties.id,
        name: parties.name,
        shortName: parties.shortName,
        slug: parties.slug,
        isDemo: parties.isDemo,
      })
      .from(parties)
      .orderBy(asc(parties.name)),
    db
      .select({
        id: electoralLists.id,
        name: electoralLists.name,
        shortName: electoralLists.shortName,
        slug: electoralLists.slug,
        electionName: elections.name,
        ballotNumber: electoralLists.ballotNumber,
        seatsWon: electoralLists.seatsWon,
        partyNames: sql<string>`(
          select string_agg(party.short_name, ', ' order by electoral_list_party.display_order)
          from electoral_list_party
          join party on party.id = electoral_list_party.party_id
          where electoral_list_party.electoral_list_id = ${electoralLists.id}
        )`,
        promiseCount: sql<number>`(
          select count(*) from promise
          where promise.electoral_list_id = ${electoralLists.id}
        )`.mapWith(Number),
      })
      .from(electoralLists)
      .innerJoin(elections, eq(electoralLists.electionId, elections.id))
      .orderBy(asc(elections.electionDate), asc(electoralLists.name)),
  ]);

  return { elections: electionRows, parties: partyRows, lists: listRows };
}
