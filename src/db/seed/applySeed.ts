/**
 * Zápis ukázkového datasetu do databáze.
 *
 * Oddělené od CLI schválně: stejnou funkci používá `npm run db:seed` i integrační
 * testy proti Postgresu v paměti. Kdyby seed žil jen ve skriptu, testovalo by se
 * něco jiného, než co se reálně spouští.
 */
import { getTableName, is, sql, Table } from "drizzle-orm";

import * as schema from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import { DEMO_DATASET } from "@/db/seed/demoDataset";
import { hashPassword } from "@/modules/accounts/password";

/**
 * Heslo demo účtů. Jen pro lokální vývoj — seed odmítne běžet proti nelokální
 * databázi, takže se do produkce nedostane. Přesto se nastavuje přes proměnnou,
 * ať jde v případě potřeby změnit bez zásahu do kódu.
 */
const DEMO_PASSWORD = process.env.SEED_EDITOR_PASSWORD ?? "demo-redakce";

/** Odvozeno ze schématu, ať na nově přidanou tabulku nejde zapomenout. */
function allTableNames(): string[] {
  const exported: unknown[] = Object.values(schema);
  const names: string[] = [];

  for (const value of exported) {
    if (is(value, Table)) {
      names.push(getTableName(value));
    }
  }

  return names.sort();
}

/**
 * TRUNCATE, ne DELETE: append-only triggery z migrace 0001 mazání řádků
 * zakazují a mají zakazovat. TRUNCATE je operace nad tabulkou, ne nad řádky,
 * takže integritní pravidla obchází vědomě a jen tady.
 */
export async function clearSeedData(db: AppDatabase): Promise<void> {
  const tables = allTableNames()
    .map((name) => `"${name}"`)
    .join(", ");

  await db.execute(sql.raw(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`));
}

export interface SeedResult {
  promises: number;
  publishedPromises: number;
  sourceDocuments: number;
  evidence: number;
}

export async function applySeed(db: AppDatabase): Promise<SeedResult> {
  const data = DEMO_DATASET;

  // Otisk hesla se počítá až tady: je pomalý schválně a v definici datasetu,
  // který se importuje i do testů, nemá co dělat.
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = data.appUsers.map((user) => ({ ...user, passwordHash }));

  await db.transaction(async (tx) => {
    await tx.insert(schema.appUsers).values(users);
    await tx.insert(schema.jurisdictions).values(data.jurisdictions);
    await tx.insert(schema.elections).values(data.elections);
    await tx.insert(schema.parties).values(data.parties);
    await tx.insert(schema.sourceDocuments).values(data.sourceDocuments);
    await tx.insert(schema.partyLineage).values(data.partyLineage);
    await tx.insert(schema.electoralLists).values(data.electoralLists);
    await tx.insert(schema.electoralListParties).values(data.electoralListParties);
    await tx.insert(schema.persons).values(data.persons);
    await tx.insert(schema.personRoles).values(data.personRoles);
    await tx.insert(schema.aiRuns).values(data.aiRuns);
    await tx.insert(schema.aiSuggestions).values(data.aiSuggestions);
    await tx.insert(schema.promises).values(data.promises);
    await tx.insert(schema.promiseSources).values(data.promiseSources);
    await tx.insert(schema.promiseMetrics).values(data.promiseMetrics);
    await tx.insert(schema.metricMeasurements).values(data.metricMeasurements);
    await tx.insert(schema.promiseEvents).values(data.promiseEvents);
    await tx.insert(schema.evidence).values(data.evidence);
    await tx.insert(schema.promiseEvidence).values(data.promiseEvidence);
    await tx.insert(schema.promiseEventEvidence).values(data.promiseEventEvidence);
    await tx.insert(schema.promiseAssessments).values(data.promiseAssessments);
    await tx.insert(schema.coalitionPromiseMappings).values(data.coalitionPromiseMappings);
    await tx.insert(schema.corrections).values(data.corrections);
    await tx.insert(schema.reviewDecisions).values(data.reviewDecisions);
    await tx.insert(schema.auditLogs).values(data.auditLogs);
  });

  return {
    promises: data.promises.length,
    publishedPromises: data.promises.filter((promise) => promise.published === true).length,
    sourceDocuments: data.sourceDocuments.length,
    evidence: data.evidence.length,
  };
}

/** Vyprázdní databázi a naplní ji znovu. Používá CLI i testy. */
export async function reseed(db: AppDatabase): Promise<SeedResult> {
  await clearSeedData(db);
  return applySeed(db);
}
