/**
 * Průchod redakčním řetězcem se **skutečným** dokumentem.
 *
 * Ukázkový dataset je psaný tak, aby prošel — texty i citace vznikly společně
 * s pravidly. Tenhle test jde proti reálnému volebnímu programu z korpusu
 * (Praha Sobě, 2022, 92 stran, přes 200 tisíc znaků) a proti kandidátce, která
 * není označená jako smyšlená. Ověřuje se tím, co demo data ověřit nemůžou:
 * že validace citací obstojí nad textem s reálnými artefakty extrakce, že
 * projde dokument o dva řády větší než demo, a že se slib skutečné strany
 * dostane až na veřejnou stránku.
 */
import { readFileSync } from "node:fs";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { electoralListParties, electoralLists, parties } from "@/modules/parties/schema";
import { getPublishedPromiseDetail, listPublishedPromises } from "@/modules/promises/queries";
import {
  createAssessmentDraft,
  createCandidatePromise,
  createSourceDocument,
  EditorialError,
  publishAssessment,
  transitionAssessment,
  type Actor,
} from "@/modules/review/service";
import { sourceDocuments } from "@/modules/sources/schema";

interface ExtractedDocument {
  contentHash: string;
  pageCount: number;
  pages: { pageNumber: number; text: string }[];
}

const extracted = JSON.parse(
  readFileSync("corpus/praha-sobe-2022/extracted.json", "utf8"),
) as ExtractedDocument;

/** Text se skládá stejně, jako by ho redaktor vložil do formuláře: stránky za sebou. */
const documentText = extracted.pages.map((page) => page.text).join("\n\n");

const PROMISE_PAGE = 39;
const PROMISE_SENTENCE = "Navýšíme platy učitelům o miliardu korun.";
const EXCERPT_START = "Zajistíme více peněz pro dobré učitele";
const EXCERPT_END = "deme pokračovat.";

/** Doslovný odstavec ze strany 39 — včetně dělení slova přes řádek. */
function paragraphFromDocument(): string {
  const start = documentText.indexOf(EXCERPT_START);
  const end = documentText.indexOf(EXCERPT_END, start);
  if (start < 0 || end < 0) throw new Error("Kotva citace se v dokumentu nenašla.");
  return documentText.slice(start, end + EXCERPT_END.length);
}

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };
const reviewer: Actor = { id: seedId("user:redaktor-2"), displayName: "Demo redaktor 2" };

const ELECTION_ID = seedId("election:praha-2022");
const PARTY_ID = seedId("party:praha-sobe-real");
const LIST_ID = seedId("electoral-list:praha-sobe-2022-real");
const SLUG = "praha-sobe-navyseni-platu-ucitelu-o-miliardu";

let sourceId = "";
let promiseId = "";
let assessmentId = "";

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);

  // Kandidátku dnes nejde založit z aplikace — vzniká seedem nebo migrací.
  // Tady se proto vkládá přímo, jinak by reálný slib neměl kam patřit.
  await handle.db.insert(parties).values({
    id: PARTY_ID,
    slug: "praha-sobe",
    name: "Praha Sobě",
    shortName: "Praha Sobě",
    isDemo: false,
  });
  await handle.db.insert(electoralLists).values({
    id: LIST_ID,
    electionId: ELECTION_ID,
    slug: "praha-sobe-2022",
    name: "Praha Sobě",
    shortName: "Praha Sobě",
    ballotNumber: 4,
    seatsWon: 11,
  });
  await handle.db.insert(electoralListParties).values({
    electoralListId: LIST_ID,
    partyId: PARTY_ID,
    displayOrder: 0,
  });
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("skutečný volební program v redakčním řetězci", () => {
  it("dokument o 92 stranách projde uložením", async () => {
    sourceId = await createSourceDocument(handle.db, editor, {
      sourceType: "ELECTION_PROGRAM",
      title: "Plán pro Prahu — Naše vize a 218 konkrétních zlepšení",
      publisher: "Praha Sobě",
      url: "https://prahasobe.cz/wp-content/uploads/2022/04/Plan-pro-Prahu-2022-web.pdf",
      publishedAt: "2022-04-13",
      licenseMode: "FULL_TEXT_STORED",
      rawText: documentText,
      isDemo: false,
    });

    expect(sourceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(documentText.length).toBeGreaterThan(200_000);
  });

  it("kandidát vznikne z doslovné citace ze strany 39", async () => {
    promiseId = await createCandidatePromise(handle.db, editor, {
      electoralListId: LIST_ID,
      slug: SLUG,
      title: "Navýšení platů učitelů o miliardu korun",
      originalText: PROMISE_SENTENCE,
      topic: "EDUCATION",
      deadlineText: "do konce volebního období 2022–2026",
      sourceDocumentId: sourceId,
      sourceExcerpt: paragraphFromDocument(),
      sourcePageNumber: PROMISE_PAGE,
      sourceLocator: "kapitola Školství, věda, sport",
    });

    expect(promiseId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("citace, která v dokumentu nestojí, neprojde", async () => {
    await expect(
      createCandidatePromise(handle.db, editor, {
        electoralListId: LIST_ID,
        slug: "praha-sobe-vymysleny-slib",
        title: "Vymyšlený slib",
        originalText: "Postavíme na Letné lanovku na Měsíc.",
        topic: "TRANSPORT",
        sourceDocumentId: sourceId,
        sourceExcerpt: "Postavíme na Letné lanovku na Měsíc.",
      }),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("hodnocení projde revizí čtyř očí až k publikaci", async () => {
    assessmentId = await createAssessmentDraft(handle.db, editor, {
      promiseId,
      specificityScore: 3,
      measurabilityScore: 3,
      deadlineScore: 2,
      jurisdictionScore: 4,
      outcomeDefinitionScore: 2,
      // Rešerše k tomuhle slibu neproběhla, takže jediný poctivý stav je
      // „doklad jsme nenašli" — ne „nezačalo se".
      executionStatus: "NO_VERIFIED_PROGRESS",
      outcomeStatus: "NOT_MEASURABLE_YET",
      summary:
        "Slib uvádí konkrétní částku i adresáta. K rozhodnému datu jsme neprocházeli rozpočtové dokumenty města, takže o postupu netvrdíme nic.",
      sourcesReviewedUpTo: "2026-08-21",
    });

    await transitionAssessment(handle.db, editor, { assessmentId, action: "SUBMIT" });

    // Vlastní hodnocení si autor schválit nesmí.
    await expect(
      transitionAssessment(handle.db, editor, {
        assessmentId,
        action: "APPROVE",
        conflictFree: true,
      }),
    ).rejects.toBeInstanceOf(EditorialError);

    await transitionAssessment(handle.db, reviewer, {
      assessmentId,
      action: "APPROVE",
      conflictFree: true,
    });
    await publishAssessment(handle.db, reviewer, assessmentId);
  });

  it("slib se objeví na veřejném seznamu i detailu jako skutečná kandidátka", async () => {
    const list = await listPublishedPromises(handle.db, { list: "praha-sobe-2022", page: 1 });
    expect(list.items.map((item) => item.slug)).toContain(SLUG);

    const detail = await getPublishedPromiseDetail(handle.db, SLUG);
    expect(detail).not.toBeNull();
    expect(detail?.originalText).toBe(PROMISE_SENTENCE);
    expect(detail?.electoralList.name).toBe("Praha Sobě");
    expect(detail?.electoralList.isDemo).toBe(false);
    expect(detail?.assessment?.executionStatus).toBe("NO_VERIFIED_PROGRESS");

    // Provenience: veřejná stránka musí ukázat, odkud citace pochází.
    expect(detail?.primarySource?.pageNumber).toBe(PROMISE_PAGE);
    expect(detail?.primarySource?.excerpt).toContain(PROMISE_SENTENCE);
  });

  it("uložený text v databázi je znak po znaku ten z korpusu", async () => {
    const [row] = await handle.db
      .select({ rawText: sourceDocuments.rawText })
      .from(sourceDocuments)
      .where(eq(sourceDocuments.id, sourceId));

    expect(row?.rawText).toBe(documentText);
  });
});
