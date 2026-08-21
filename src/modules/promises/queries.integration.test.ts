/**
 * Čtecí vrstva proti skutečným datům.
 *
 * Nejdůležitější test v tomhle souboru je ten poslední: nepotvrzený návrh AI
 * v databázi je, ale ven se dostat nesmí. Kdyby ta podmínka vypadla z dotazu,
 * aplikace by publikovala nezkontrolované tvrzení o jmenované kandidátce —
 * tedy přesně to, čemu má produkt bránit.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { promises } from "@/modules/promises/schema";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { getCoalitionComparison, listComparableElectoralLists } from "@/modules/coalition/queries";
import { promiseFiltersSchema, type PromiseFilters } from "@/modules/promises/filters";
import {
  getPublishedPromiseDetail,
  listElectoralListOptions,
  listPublishedPromises,
} from "@/modules/promises/queries";

let handle: TestDatabaseHandle;

const BYTY = "demo-a-2000-mestskych-najemnich-bytu";
const TRAMVAJ = "demo-a-tramvajova-trat-do-demo-ctvrti";
const NEPUBLIKOVANY = "demo-a-chranene-cyklotrasy-v-centru";

function filters(overrides: Partial<PromiseFilters> = {}): PromiseFilters {
  return promiseFiltersSchema.parse({ page: 1, ...overrides });
}

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("seznam slibů", () => {
  it("vrací jen publikované sliby", async () => {
    const result = await listPublishedPromises(handle.db, filters());

    expect(result.total).toBe(11);
    expect(result.items.map((item) => item.slug)).not.toContain(NEPUBLIKOVANY);
  });

  it("ke každému slibu doplní kandidátku, stav a počet důkazů", async () => {
    const result = await listPublishedPromises(handle.db, filters({ q: "2 000" }));
    const item = result.items.find((row) => row.slug === BYTY);

    expect(item).toBeDefined();
    expect(item?.electoralList.shortName).toBe("Demo A");
    expect(item?.electoralList.isDemo).toBe(true);
    expect(item?.executionStatus).toBe("PARTIALLY_COMPLETED");
    expect(item?.assessability).toBe("HIGH");
    expect(item?.evidenceCount).toBeGreaterThan(0);
    // Rozhodné datum je v seznamu ta nejdůležitější metadata: říká, jak starý
    // závěr čtenář vidí, ještě než slib otevře.
    expect(item?.sourcesReviewedUpTo).toBeTruthy();
  });

  it("filtruje podle tématu, kandidátky i stavu plnění", async () => {
    const byTopic = await listPublishedPromises(handle.db, filters({ topic: "HOUSING" }));
    expect(byTopic.items.every((item) => item.topic === "HOUSING")).toBe(true);
    expect(byTopic.total).toBeGreaterThan(0);

    const byList = await listPublishedPromises(handle.db, filters({ list: "demo-d-2022" }));
    expect(byList.items.every((item) => item.electoralList.slug === "demo-d-2022")).toBe(true);
    expect(byList.total).toBe(2);

    const byNoProgress = await listPublishedPromises(
      handle.db,
      filters({ execution: "NO_VERIFIED_PROGRESS" }),
    );
    expect(byNoProgress.total).toBe(2);

    const byExecution = await listPublishedPromises(handle.db, filters({ execution: "BLOCKED" }));
    expect(byExecution.items.map((item) => item.slug)).toEqual([
      "demo-bc-tri-parkovaci-domy-u-metra",
    ]);

    const byAssessability = await listPublishedPromises(
      handle.db,
      filters({ assessability: "NOT_ASSESSABLE" }),
    );
    expect(byAssessability.total).toBe(2);
  });

  it("hledá v názvu i v doslovném znění", async () => {
    const result = await listPublishedPromises(handle.db, filters({ q: "mateřských škol" }));

    expect(result.items.map((item) => item.slug)).toContain(
      "demo-a-1200-mist-v-materskych-skolach",
    );
  });

  it("nespadne na zástupných znacích v hledání", async () => {
    const result = await listPublishedPromises(handle.db, filters({ q: "%" }));

    expect(result.total).toBe(0);
  });

  it("stránkuje a nepustí za poslední stránku", async () => {
    const result = await listPublishedPromises(handle.db, filters({ page: 99 }));

    expect(result.page).toBe(result.pageCount);
    expect(result.items.length).toBeGreaterThan(0);
  });
});

describe("detail slibu", () => {
  it("nepublikovaný slib veřejně neexistuje", async () => {
    await expect(getPublishedPromiseDetail(handle.db, NEPUBLIKOVANY)).resolves.toBeNull();
  });

  it("složí celý řetězec od programu po naměřený výsledek", async () => {
    const detail = await getPublishedPromiseDetail(handle.db, BYTY);

    expect(detail).not.toBeNull();
    if (!detail) return;

    expect(detail.primarySource?.source.sourceType).toBe("ELECTION_PROGRAM");
    expect(detail.primarySource?.excerpt).toContain("2 000");

    expect(detail.timeline).toHaveLength(8);
    expect(detail.timeline[0]?.eventType).toBe("PROMISE_CREATED");
    expect(detail.timeline.at(-1)?.eventType).toBe("MILESTONE_REACHED");
    expect(detail.timeline.every((event) => event.citations.length > 0)).toBe(true);

    expect(detail.metrics).toHaveLength(1);
    expect(detail.metrics[0]?.targetValue).toContain("2000");
    expect(detail.metrics[0]?.measurements[0]?.value).toContain("910");

    expect(detail.coalition?.classification).toBe("RETAINED");
    expect(detail.coalition?.citation?.excerpt).toContain("2 000");
  });

  it("vysvětlí, proč vyšel právě takový stupeň hodnotitelnosti", async () => {
    const detail = await getPublishedPromiseDetail(handle.db, "demo-a-pece-o-mestskou-zelen");

    expect(detail?.assessment?.assessability).toBe("NOT_ASSESSABLE");
    expect(detail?.assessment?.derivation.appliedRules[0]?.code).toBe("GATE_PURE_DECLARATION");
  });

  it("ukáže starší verze hodnocení a opravu, ze které vzešly", async () => {
    const detail = await getPublishedPromiseDetail(handle.db, BYTY);

    expect(detail?.assessment?.version).toBe(2);
    expect(detail?.assessment?.changeReason).toContain("zpráva o stavu bytového fondu");
    expect(detail?.assessmentHistory.map((item) => item.version)).toEqual([1]);
    expect(detail?.corrections.map((item) => item.kind)).toContain("PUBLIC_CORRECTION");
  });

  it("nezveřejní rozpracovanou verzi hodnocení", async () => {
    // Založíme nad publikovaným slibem novou, dosud neschválenou verzi.
    const [promise] = await handle.db
      .select({ id: promises.id })
      .from(promises)
      .where(eq(promises.slug, BYTY));
    if (!promise) throw new Error("Slib ze seedu chybí.");

    await handle.client.query(
      `insert into promise_assessment
         (promise_id, version, specificity_score, measurability_score, deadline_score,
          jurisdiction_score, outcome_definition_score, assessability, methodology_version,
          workflow_state, sources_reviewed_up_to, execution_status, outcome_status,
          change_reason, created_by_id, is_current)
       values ($1, 90, 1, 1, 1, 1, 1, 'NOT_ASSESSABLE', '1.0.0', 'DRAFT', '2026-08-21',
               'ABANDONED', 'NOT_ACHIEVED', 'rozpracováno', $2, false)`,
      [promise.id, seedId("user:redaktor-1")],
    );

    const detail = await getPublishedPromiseDetail(handle.db, BYTY);

    expect(detail?.assessment?.version).toBe(2);
    expect(detail?.assessmentHistory.map((item) => item.version)).toEqual([1]);
    expect(
      [detail?.assessment, ...(detail?.assessmentHistory ?? [])].map(
        (item) => item?.executionStatus,
      ),
    ).not.toContain("ABANDONED");
  });

  it("nezveřejní nepotvrzený návrh AI", async () => {
    const detail = await getPublishedPromiseDetail(handle.db, TRAMVAJ);

    expect(detail).not.toBeNull();
    if (!detail) return;

    // V seedu je u tohohle slibu vazba SUPPORTS navržená AI a nepotvrzená
    // člověkem. Vedle ní je na týž dokument lidsky ověřená vazba PROGRESS.
    const relations = detail.evidence.map((item) => item.relationType);
    expect(relations).toContain("PROGRESS");
    expect(relations).not.toContain("SUPPORTS");
  });
});

describe("porovnání s koaliční smlouvou", () => {
  it("nabídne jen kandidátky, u kterých porovnání existuje", async () => {
    const lists = await listComparableElectoralLists(handle.db);
    const slugs = lists.map((list) => list.slug);

    expect(slugs).toContain("demo-a-2022");
    expect(slugs).toContain("demo-bc-2022");
    // Opoziční kandidátka koaliční smlouvu nepodepsala, porovnávat není s čím.
    expect(slugs).not.toContain("demo-d-2022");
  });

  it("u každé položky vrátí obě znění a důvod klasifikace", async () => {
    const comparison = await getCoalitionComparison(handle.db, "demo-a-2022");

    expect(comparison).not.toBeNull();
    if (!comparison) return;

    expect(comparison.agreement.sourceType).toBe("COALITION_AGREEMENT");
    expect(comparison.items).toHaveLength(5);
    expect(comparison.items.every((item) => item.reason.length > 0)).toBe(true);

    const notIncluded = comparison.items.find((item) => item.classification === "NOT_INCLUDED");
    expect(notIncluded?.coalitionExcerpt).toBeNull();

    const retained = comparison.items.find((item) => item.classification === "RETAINED");
    expect(retained?.coalitionExcerpt).not.toBeNull();
  });

  it("pro neznámou kandidátku vrací null", async () => {
    await expect(getCoalitionComparison(handle.db, "neexistuje")).resolves.toBeNull();
  });
});

describe("číselníky", () => {
  it("nabídne kandidátky, které mají publikované sliby", async () => {
    const lists = await listElectoralListOptions(handle.db);

    // Řazeno podle zobrazovaného názvu, ne podle slugu — v UI je vidět název.
    expect(lists.map((list) => list.name)).toEqual([
      "Demo koalice B+C",
      "Demo strana A",
      "Demo strana D",
    ]);
    expect(lists.find((list) => list.slug === "demo-bc-2022")?.parties).toHaveLength(2);
  });
});
