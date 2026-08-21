/**
 * Evaluační aparát nad skutečně vytěženým PDF.
 *
 * Celý řetězec: PDF → kanonický text → zlatý dataset → extraktor → metriky.
 * Testuje se přes skutečný soubor, protože posuny a citace jsou přesně to,
 * co se mezi vrstvami rozbíjí.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { HeuristicPromiseExtractor } from "@/modules/extraction/baseline";
import { evaluateExtractor } from "@/modules/extraction/evaluate";
import { FixturePromiseExtractor } from "@/modules/extraction/fixture";
import {
  parseGoldenDataset,
  validateGoldenDataset,
  type GoldenDataset,
} from "@/modules/extraction/goldenDataset";
import { findExactSpans, type CanonicalDocument } from "@/modules/ingestion/canonical";
import { extractPdf } from "@/modules/ingestion/pdf";
import { makePdf } from "@/modules/ingestion/testing/makePdf";

const PAGE_ONE = [
  "VOLEBNÍ PROGRAM DEMO STRANY",
  "BYDLENÍ",
  "Postavíme 2 000 nových městských bytů do roku 2026.",
  "Bydlení je v našem městě dlouhodobě drahé.",
  "Zavedeme jednotné přihlášení do digitálních služeb.",
];

const PAGE_TWO = [
  "DOPRAVA",
  "Rozšíříme síť tramvajových tratí do rozvojových oblastí.",
  "Chceme, aby doprava byla plynulejší.",
  "Snížíme počet nehod na křižovatkách o 20 procent.",
];

const PROMISES = [
  "Postavíme 2 000 nových městských bytů do roku 2026.",
  "Zavedeme jednotné přihlášení do digitálních služeb.",
  "Rozšíříme síť tramvajových tratí do rozvojových oblastí.",
  "Snížíme počet nehod na křižovatkách o 20 procent.",
];

const NOT_PROMISES = [
  "Bydlení je v našem městě dlouhodobě drahé.",
  "Chceme, aby doprava byla plynulejší.",
];

let document: CanonicalDocument;
let dataset: GoldenDataset;

/** Anotace pro test skládáme z textu dokumentu, ať posuny sedí. */
function buildDataset(): GoldenDataset {
  const examples = [
    ...PROMISES.map((quote, index) => ({ quote, index, label: "PROMISE" as const })),
    ...NOT_PROMISES.map((quote, index) => ({
      quote,
      index: index + PROMISES.length,
      label: "NOT_PROMISE" as const,
    })),
  ].map(({ quote, index, label }) => {
    const [span] = findExactSpans(document, quote);
    if (!span) throw new Error(`Citace „${quote}" v dokumentu není.`);

    return {
      id: `example-${index + 1}`,
      label,
      page: span.page,
      span: { start: span.start, end: span.end },
      quote,
      annotator: "test",
      annotatedOn: "2026-08-21",
    };
  });

  return parseGoldenDataset({
    datasetVersion: "1",
    guidelinesVersion: "1.0.0",
    document: {
      sourceName: document.sourceName,
      contentHash: document.contentHash,
      extractorVersion: document.extractorVersion,
    },
    examples,
  });
}

beforeAll(async () => {
  const report = await extractPdf(makePdf([{ lines: PAGE_ONE }, { lines: PAGE_TWO }]), "demo.pdf");
  document = report.document;
  dataset = buildDataset();
});

describe("zlatý dataset", () => {
  it("sedí na dokument, ze kterého vznikl", () => {
    expect(validateGoldenDataset(dataset, document)).toEqual([]);
  });

  it("odhalí citaci, která na svém místě nestojí", () => {
    const tampered: GoldenDataset = {
      ...dataset,
      examples: dataset.examples.map((example, index) =>
        index === 0 ? { ...example, quote: "Postavíme 5 000 bytů." } : example,
      ),
    };

    const issues = validateGoldenDataset(tampered, document);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("Citace neodpovídá textu");
  });

  it("odhalí, že anotace patří k jinému souboru", () => {
    const issues = validateGoldenDataset(
      { ...dataset, document: { ...dataset.document, contentHash: "a".repeat(64) } },
      document,
    );

    expect(issues.some((issue) => issue.message.includes("jinému souboru"))).toBe(true);
  });

  it("odhalí rozsah mimo stránku", () => {
    const broken: GoldenDataset = {
      ...dataset,
      examples: [{ ...dataset.examples[0]!, span: { start: 10_000, end: 10_050 } }],
    };

    expect(validateGoldenDataset(broken, document)[0]?.message).toContain("mimo text stránky");
  });
});

describe("heuristická laťka", () => {
  it("najde závazky a vynechá nadpisy i konstatování", async () => {
    const result = await evaluateExtractor(new HeuristicPromiseExtractor(), dataset, document);

    expect(result.goldPromiseCount).toBe(4);
    expect(result.recall).toBe(1);
    expect(result.precision).toBe(1);
    expect(result.f1).toBe(1);
    // Věta „Chceme, aby…" je přání, ne závazek — a heuristika ji nesmí vzít.
    expect(result.knownNegativeHits).toBe(0);
  });

  it("cituje doslova, takže se výstup dá ověřit ve zdroji", async () => {
    const result = await evaluateExtractor(new HeuristicPromiseExtractor(), dataset, document);

    expect(result.quoteFidelity).toBe(1);
    expect(result.unsupportedCount).toBe(0);
  });
});

describe("metriky", () => {
  it("odhalí vymyšlenou citaci, i když rozsah sedí na anotaci", async () => {
    const [real] = findExactSpans(document, PROMISES[0]!);
    const extractor = new FixturePromiseExtractor([
      {
        // Rozsah je správný, ale text se od dokumentu liší — přesně ten případ,
        // kdy model „vylepší" citaci a tvrzení tím ztratí oporu.
        quote: "Postavíme 5 000 nových městských bytů do roku 2026.",
        span: real!,
      },
    ]);

    const result = await evaluateExtractor(extractor, dataset, document);

    expect(result.truePositives).toBe(1);
    expect(result.quoteFidelity).toBe(0);
    expect(result.unsupportedCount).toBe(1);
    expect(result.unsupportedRate).toBe(1);
  });

  it("započítá trefu do anotovaného protipříkladu", async () => {
    const [negative] = findExactSpans(document, NOT_PROMISES[0]!);
    const extractor = new FixturePromiseExtractor([{ quote: NOT_PROMISES[0]!, span: negative! }]);

    const result = await evaluateExtractor(extractor, dataset, document);

    expect(result.knownNegativeHits).toBe(1);
    expect(result.truePositives).toBe(0);
    expect(result.precision).toBe(0);
    expect(result.spurious[0]?.reason).toContain("protipříklad");
  });

  it("nespáruje jednu anotaci s víc predikcemi", async () => {
    const [span] = findExactSpans(document, PROMISES[0]!);
    const extractor = new FixturePromiseExtractor([
      { quote: PROMISES[0]!, span: span!, confidence: 0.9 },
      { quote: PROMISES[0]!, span: span!, confidence: 0.4 },
    ]);

    const result = await evaluateExtractor(extractor, dataset, document);

    expect(result.truePositives).toBe(1);
    expect(result.falsePositives).toBe(1);
    expect(result.precision).toBe(0.5);
  });

  it("hodnotí jen stránky, které anotace pokrývá", async () => {
    // Anotace jen ze strany 1 — přesně situace, kdy anotátor zvládl výsek.
    const partial = parseGoldenDataset({
      datasetVersion: "1",
      guidelinesVersion: "1.0.0",
      document: {
        sourceName: document.sourceName,
        contentHash: document.contentHash,
        extractorVersion: document.extractorVersion,
      },
      examples: dataset.examples.filter((example) => example.page === 1),
    });

    const result = await evaluateExtractor(new HeuristicPromiseExtractor(), partial, document);

    expect(result.annotatedPages).toEqual([1]);
    // Závazky ze strany 2 nesmí spadnout do falešných poplachů — anotátor
    // tu stránku neprošel, takže o ní nic nevíme.
    expect(result.outOfScopeCount).toBeGreaterThan(0);
    expect(result.precision).toBe(1);
    expect(result.recall).toBe(1);
  });

  it("stránka bez jediného slibu se pořád počítá za prošlou", async () => {
    // Samé protipříklady: anotátor stránku prošel a rozhodl, že tam slib není.
    const negativesOnly = parseGoldenDataset({
      datasetVersion: "1",
      guidelinesVersion: "1.0.0",
      document: {
        sourceName: document.sourceName,
        contentHash: document.contentHash,
        extractorVersion: document.extractorVersion,
      },
      examples: dataset.examples.filter(
        (example) => example.page === 1 && example.label === "NOT_PROMISE",
      ),
    });

    const result = await evaluateExtractor(
      new HeuristicPromiseExtractor(),
      negativesOnly,
      document,
    );

    expect(result.annotatedPages).toEqual([1]);
    // Právě tady mají falešné poplachy smysl a musí se počítat.
    expect(result.falsePositives).toBeGreaterThan(0);
    expect(result.precision).toBe(0);
  });

  it("prázdný výstup dá nulové metriky místo dělení nulou", async () => {
    const result = await evaluateExtractor(new FixturePromiseExtractor([]), dataset, document);

    expect(result.precision).toBe(0);
    expect(result.recall).toBe(0);
    expect(result.f1).toBe(0);
    expect(result.quoteFidelity).toBe(0);
    expect(result.missed).toHaveLength(4);
  });
});
