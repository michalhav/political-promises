/**
 * Extrakce textu z PDF.
 *
 * Testuje se proti skutečně vygenerovanému PDF, ne proti mocku pdf.js. Právě
 * v převodu kód glyfu → Unicode se extrakce nejčastěji rozbíjí a mock by
 * ověřil jen to, že umíme volat knihovnu.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { findExactSpans, sliceSpan } from "@/modules/ingestion/canonical";
import { EXTRACTOR_VERSION, extractPdf } from "@/modules/ingestion/pdf";
import { makePdf } from "@/modules/ingestion/testing/makePdf";

const PAGE_ONE = [
  "VOLEBNÍ PROGRAM",
  "Postavíme 2 000 nových bytů do roku 2026.",
  "Zavedeme jednotné přihlášení do sluzeb města.",
];

const PAGE_TWO = ["DOPRAVA", "Rozšíříme síť tramvajových tratí."];

async function extractFixture() {
  const bytes = makePdf([{ lines: PAGE_ONE }, { lines: PAGE_TWO }]);
  return { bytes, report: await extractPdf(bytes, "fixture.pdf") };
}

describe("extrakce PDF", () => {
  it("zachová hranice stran", async () => {
    const { report } = await extractFixture();

    expect(report.document.pageCount).toBe(2);
    expect(report.document.pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    expect(report.document.pages[0]?.text).toContain("VOLEBNÍ PROGRAM");
    expect(report.document.pages[1]?.text).toContain("DOPRAVA");
    // Text druhé stránky nesmí prosáknout do první.
    expect(report.document.pages[0]?.text).not.toContain("DOPRAVA");
  });

  it("přečte českou diakritiku", async () => {
    const { report } = await extractFixture();
    const text = report.document.pages[0]?.text ?? "";

    expect(text).toContain("Postavíme");
    expect(text).toContain("VOLEBNÍ");
    expect(report.document.pages[1]?.text).toContain("Rozšíříme síť");
  });

  it("otisk odpovídá bajtům souboru, ne textu", async () => {
    const { bytes, report } = await extractFixture();

    expect(report.document.contentHash).toBe(createHash("sha256").update(bytes).digest("hex"));
  });

  it("je deterministická — dvakrát stejný vstup, dvakrát stejný text", async () => {
    const first = await extractFixture();
    const second = await extractFixture();

    expect(first.report.document.contentHash).toBe(second.report.document.contentHash);
    expect(first.report.document.pages).toEqual(second.report.document.pages);
    expect(first.report.document.extractorVersion).toBe(EXTRACTOR_VERSION);
  });

  it("rozsahy ukazují na skutečný text stránky", async () => {
    const { report } = await extractFixture();
    const spans = findExactSpans(report.document, "Postavíme 2 000 nových bytů");

    expect(spans).toHaveLength(1);
    expect(spans[0]?.page).toBe(1);
    expect(sliceSpan(report.document, spans[0]!)).toBe("Postavíme 2 000 nových bytů");
  });

  it("pozná stránku bez textové vrstvy místo tichého mlčení", async () => {
    // Prázdná stránka se chová jako sken: text z ní nevypadne žádný.
    const bytes = makePdf([{ lines: PAGE_ONE }, { lines: [] }]);
    const report = await extractPdf(bytes, "sken.pdf");

    expect(report.pagesWithoutText).toEqual([2]);
    // Stránka v dokumentu zůstane, jen prázdná — číslování se nesmí posunout.
    expect(report.document.pageCount).toBe(2);
  });
});
