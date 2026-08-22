/**
 * Veřejný datový kontrakt proti skutečným datům.
 *
 * Nejdůležitější je tu první test: co není publikované, nesmí být ani ve
 * vývozu. Stránka i API čtou touž funkcí, takže by to platit mělo — ale
 * kontrakt je jediné místo, odkud data odcházejí do cizích rukou, a tam se
 * chyba už neopraví.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import {
  DATASET_LICENCE,
  toCsv,
  toPublicDetail,
  toPublicSummary,
  type PublicPromiseSummary,
} from "@/modules/api/publicDataset";
import { promiseFiltersSchema } from "@/modules/promises/filters";
import { getPublishedPromiseDetail, listPublishedPromises } from "@/modules/promises/queries";

let handle: TestDatabaseHandle;

const PUBLIKOVANY = "demo-a-2000-mestskych-najemnich-bytu";
const NEPUBLIKOVANY = "demo-a-chranene-cyklotrasy-v-centru";

async function vsechny(): Promise<PublicPromiseSummary[]> {
  const items: PublicPromiseSummary[] = [];

  for (let page = 1; page <= 50; page += 1) {
    const result = await listPublishedPromises(handle.db, promiseFiltersSchema.parse({ page }));
    items.push(...result.items.map(toPublicSummary));
    if (page >= result.pageCount) break;
  }

  return items;
}

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("vývoz datasetu", () => {
  it("neobsahuje nepublikovaný slib", async () => {
    const slugy = (await vsechny()).map((item) => item.slug);

    expect(slugy).toContain(PUBLIKOVANY);
    expect(slugy).not.toContain(NEPUBLIKOVANY);
  });

  it("projde všechny stránky, ne jen první", async () => {
    const prvni = await listPublishedPromises(handle.db, promiseFiltersSchema.parse({ page: 1 }));
    const vsechno = await vsechny();

    expect(vsechno).toHaveLength(prvni.total);
    expect(new Set(vsechno.map((item) => item.slug)).size).toBe(vsechno.length);
  });

  it("nese licenci, aby ji šlo poznat i z odpojeného souboru", () => {
    expect(DATASET_LICENCE.data).toBe("CC BY-SA 4.0");
    expect(DATASET_LICENCE.dataUrl).toMatch(/^https:\/\//);
  });
});

describe("detail slibu", () => {
  it("nese doklady i s tím, co z nich nevyplývá", async () => {
    const detail = await getPublishedPromiseDetail(handle.db, PUBLIKOVANY);
    const verejny = toPublicDetail(detail!);

    expect(verejny.slug).toBe(PUBLIKOVANY);
    expect(verejny.evidence.length).toBeGreaterThan(0);
    // `limitationNote` je pole samo o sobě. Kdyby se slilo s `note`, čtenář dat
    // by nepoznal, co zdroj dokládá a co ne.
    expect(verejny.evidence[0]).toHaveProperty("limitationNote");
    expect(verejny.evidence[0]?.source.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("datum posílá jako řetězec, ne jako objekt", async () => {
    const detail = await getPublishedPromiseDetail(handle.db, PUBLIKOVANY);
    const json = JSON.parse(JSON.stringify(toPublicDetail(detail!))) as Record<string, unknown>;

    expect(typeof json.publishedAt === "string" || json.publishedAt === null).toBe(true);
  });
});

describe("CSV", () => {
  it("má hlavičku a řádek na slib", async () => {
    const items = await vsechny();
    const radky = toCsv(items).trimEnd().split("\n");

    expect(radky[0]).toContain("slug,title");
    expect(radky).toHaveLength(items.length + 1);
  });

  it("uzavře text slibu, aby čárka nerozbila řádek", () => {
    const csv = toCsv([
      {
        slug: "test",
        title: 'Postavíme "mosty", školy a byty',
        originalText: "První věta.\nDruhá věta.",
        topic: "TRANSPORT",
        deadlineText: null,
        electoralList: { slug: "l", name: "Kandidátka, s čárkou", shortName: null },
        isDemo: false,
        assessability: null,
        executionStatus: null,
        outcomeStatus: null,
        sourcesReviewedUpTo: null,
        evidenceCount: 0,
      },
    ]);

    // Uvozovka uvnitř se zdvojuje (RFC 4180), konec řádku zůstává v buňce.
    expect(csv).toContain('"Postavíme ""mosty"", školy a byty"');
    expect(csv).toContain('"První věta.\nDruhá věta."');
  });

  it("rozlišuje ukázková data od skutečných", async () => {
    // Ukázkový dataset je smyšlený. V aplikaci to nese odznak; ve vývozu to
    // musí být taky, jinak si ho analytik stáhne jako skutečná data.
    const items = await vsechny();

    expect(items.every((item) => typeof item.isDemo === "boolean")).toBe(true);
    expect(items.some((item) => item.isDemo)).toBe(true);
    expect(toCsv(items)).toContain("is_demo");
  });

  it("začíná značkou BOM, jinak Excel rozsype diakritiku", () => {
    expect(toCsv([])).toMatch(/^﻿/);
  });
});
