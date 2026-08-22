/**
 * Metriky a jejich měření proti skutečné databázi.
 *
 * Bez metriky je „splněno" jen názor redaktora (pravidlo A2). Aparát ale musí
 * hlavně bránit tomu, aby publikoval **věrohodně vypadající nesmysl** — proto
 * je tu důraz na dvojí započtení, na kterém by se to v rozpočtových datech
 * podlomilo jako první.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { getPublishedPromiseDetail } from "@/modules/promises/queries";
import { promises } from "@/modules/promises/schema";
import {
  computeFromRows,
  computeMeasurementsFromTable,
  defineMetric,
} from "@/modules/review/metrics";
import { createSourceDocument, EditorialError, type Actor } from "@/modules/review/service";

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };
const SLUG = "demo-a-2000-mestskych-najemnich-bytu";

let promiseId = "";
let sourceId = "";
let metricId = "";

/**
 * Výřez rozpočtu v naší uložené podobě.
 *
 * Poslední řádek každého roku je ten zrádný: přijatý transfer ve výši součtu
 * všech výdajových položek. Přesně takhle vypadají skutečná data města.
 */
const TABLE = [
  "Řádek 1 | rok: 2022 | nazev_oblast: Školství | nazev_uz: přímé náklady | cerpani: 100",
  "Řádek 2 | rok: 2022 | nazev_oblast: Školství | nazev_uz: přímé náklady | cerpani: 60",
  "Řádek 3 | rok: 2022 | nazev_oblast: Školství | nazev_uz: přímé náklady | cerpani: 40",
  "Řádek 4 | rok: 2022 | nazev_oblast: Přijaté transfery | nazev_uz: přímé náklady | cerpani: 200",
  "Řádek 5 | rok: 2023 | nazev_oblast: Školství | nazev_uz: přímé náklady | cerpani: 150",
  "Řádek 6 | rok: 2023 | nazev_oblast: Školství | nazev_uz: přímé náklady | cerpani: 60",
  "Řádek 7 | rok: 2023 | nazev_oblast: Školství | nazev_uz: přímé náklady | cerpani: 40",
].join("\n");

const SKOLSTVI = [
  { column: "nazev_oblast", contains: "Školství" },
  { column: "nazev_uz", contains: "přímé náklady" },
];

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);

  const [promise] = await handle.db
    .select({ id: promises.id })
    .from(promises)
    .where(eq(promises.slug, SLUG))
    .limit(1);
  if (!promise) throw new Error("Ukázková data neobsahují očekávaný slib.");
  promiseId = promise.id;

  sourceId = await createSourceDocument(handle.db, editor, {
    sourceType: "BUDGET",
    title: "Čerpání rozpočtu — testovací výřez",
    publisher: "Město",
    licenseMode: "FULL_TEXT_STORED",
    rawText: TABLE,
    isDemo: true,
  });

  metricId = await defineMetric(handle.db, editor, {
    promiseId,
    name: "Přímé náklady školství",
    unit: "tis. Kč",
    direction: "INCREASE",
    baselineValue: 200,
    baselineOn: "2022-12-31",
  });
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("výpočet z uložené tabulky", () => {
  it("sečte hodnoty po letech", () => {
    const result = computeFromRows(TABLE.split("\n"), {
      valueColumn: "cerpani",
      groupColumn: "rok",
      filters: SKOLSTVI,
    });

    expect(result).toEqual([
      { group: "2022", value: 200, rows: 3 },
      { group: "2023", value: 250, rows: 3 },
    ]);
  });

  it("řádky mimo filtr nezapočítá", () => {
    const [first] = computeFromRows(TABLE.split("\n"), {
      valueColumn: "cerpani",
      groupColumn: "rok",
      filters: [{ column: "nazev_oblast", contains: "Školství" }],
    });

    // Bez transferu: 100 + 60 + 40, ne 400.
    expect(first?.value).toBe(200);
  });
});

describe("měření uložená k metrice", () => {
  it("uloží hodnoty se zdrojem a postupem výpočtu", async () => {
    const result = await computeMeasurementsFromTable(handle.db, editor, {
      metricId,
      sourceDocumentId: sourceId,
      valueColumn: "cerpani",
      groupColumn: "rok",
      filters: SKOLSTVI,
    });

    expect(result.measurements).toHaveLength(2);
    // Správný filtr nesmí planě varovat — jinak se redakce naučí varování přehlížet.
    expect(result.warnings).toHaveLength(0);

    const detail = await getPublishedPromiseDetail(handle.db, SLUG);
    const metric = detail?.metrics.find((item) => item.name === "Přímé náklady školství");

    expect(metric?.measurements).toHaveLength(2);
    // Bez postupu by šlo číslo jen věřit, ne přepočítat.
    expect(metric?.measurements[0]?.note).toContain("Součet sloupce cerpani");
    expect(metric?.measurements[0]?.source.title).toContain("Čerpání rozpočtu");
  });

  it("dvojí započtení pozná a řekne, co s tím", async () => {
    // Bez filtru na oblast se přičte i transfer, který je součtem položek.
    const result = await computeMeasurementsFromTable(handle.db, editor, {
      metricId,
      sourceDocumentId: sourceId,
      valueColumn: "cerpani",
      groupColumn: "rok",
      filters: [{ column: "nazev_uz", contains: "přímé náklady" }],
    });

    expect(result.measurements[0]?.value).toBe(400);
    expect(result.warnings.join(" ")).toContain("souhrn s položkami");
  });

  it("přepočet tentýž rok přepíše, nezaloží druhý", async () => {
    await computeMeasurementsFromTable(handle.db, editor, {
      metricId,
      sourceDocumentId: sourceId,
      valueColumn: "cerpani",
      groupColumn: "rok",
      filters: SKOLSTVI,
    });

    const detail = await getPublishedPromiseDetail(handle.db, SLUG);
    const metric = detail?.metrics.find((item) => item.name === "Přímé náklady školství");

    expect(metric?.measurements).toHaveLength(2);
    expect(Number(metric?.measurements[0]?.value)).toBe(200);
  });

  it("filtr, kterému nic nevyhoví, skončí chybou místo prázdné metriky", async () => {
    await expect(
      computeMeasurementsFromTable(handle.db, editor, {
        metricId,
        sourceDocumentId: sourceId,
        valueColumn: "cerpani",
        groupColumn: "rok",
        filters: [{ column: "nazev_oblast", contains: "Kosmonautika" }],
      }),
    ).rejects.toBeInstanceOf(EditorialError);
  });
});
