/**
 * Připraví kostru zlatého datasetu k ruční anotaci.
 *
 *   npm run corpus:scaffold -- corpus/nazev/extracted.json --annotator "Jméno"
 *
 * Vypíše **všechny** dostatečně dlouhé úseky dokumentu v pořadí, jak jdou za
 * sebou, každý s přesným rozsahem a doslovnou citací. Anotátor pak jen mění
 * `label` a maže, co ho nezajímá.
 *
 * Vědomě se nepředvyplňuje nic podle heuristiky — ani skóre, ani návrh štítku.
 * Kdyby kostra napovídala, co si myslí extraktor, anotace by se mu přizpůsobila
 * a evaluace by pak měřila shodu s vlastním odhadem, ne s realitou.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { GOLDEN_DATASET_VERSION } from "@/modules/extraction/goldenDataset";
import { splitPageIntoSentences } from "@/modules/extraction/segments";
import type { CanonicalDocument } from "@/modules/ingestion/canonical";
import { PROCESSING_VERSION } from "@/modules/ingestion/normalize";
import { detectPageFurniture, furnitureForPage } from "@/modules/ingestion/structure";

/** Kratší úseky jsou v programech nadpisy, popisky a čísla stránek. */
const MIN_SEGMENT_LENGTH = 25;

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [input] = args;
  if (!input) {
    console.error(
      "Použití: npm run corpus:scaffold -- <extracted.json> [--annotator <jméno>] [--from N] [--to N] [--out <soubor>]",
    );
    process.exitCode = 1;
    return;
  }

  const annotator = argValue(args, "--annotator") ?? "doplň jméno";
  const out = argValue(args, "--out") ?? path.join(path.dirname(input), "golden.draft.json");

  const parsed: unknown = JSON.parse(await readFile(input, "utf8"));
  const document = parsed as CanonicalDocument;

  const today = new Date().toISOString().slice(0, 10);
  let counter = 0;

  // Běžící záhlaví, patičky a čísla stran se z nabídky vynechají. Kanonický
  // text tím nijak netrpí — vylučuje se jen ze zpracovací reprezentace.
  const furniture = detectPageFurniture(document);
  const excludedCount = furniture.reduce((sum, page) => sum + page.excluded.length, 0);

  const fromPage = Number(argValue(args, "--from") ?? 1);
  const toPage = Number(argValue(args, "--to") ?? document.pageCount);

  const examples = document.pages
    .filter((page) => page.pageNumber >= fromPage && page.pageNumber <= toPage)
    .flatMap((page) =>
      splitPageIntoSentences(page, furnitureForPage(furniture, page.pageNumber))
        .filter((segment) => segment.text.length >= MIN_SEGMENT_LENGTH)
        .map((segment) => {
          counter += 1;
          return {
            id: `p${page.pageNumber}-${String(counter).padStart(3, "0")}`,
            // Výchozí štítek je „není slib". Anotátor přepíná to, co slib je —
            // opačné pořadí by svádělo k tomu nechat vše a jen mazat.
            label: "NOT_PROMISE",
            page: page.pageNumber,
            span: { start: segment.span.start, end: segment.span.end },
            quote: segment.text,
            notes: "",
            annotator,
            annotatedOn: today,
          };
        }),
    );

  const draft = {
    datasetVersion: GOLDEN_DATASET_VERSION,
    guidelinesVersion: "1.0.0",
    document: {
      sourceName: document.sourceName,
      contentHash: document.contentHash,
      extractorVersion: document.extractorVersion,
    },
    processingVersion: PROCESSING_VERSION,
    examples,
  };

  await writeFile(out, `${JSON.stringify(draft, null, 2)}\n`, "utf8");

  console.log(
    [
      `Kostra:      ${out}`,
      `Stránky:     ${fromPage}–${toPage} z ${document.pageCount}`,
      `Úseků:       ${examples.length}`,
      `Vyloučeno:   ${excludedCount} kusů stránkové výbavy (záhlaví, čísla stran)`,
      `Zpracování:  ${PROCESSING_VERSION}`,
      "",
      "Dál ručně:",
      "  1. Projdi úseky a u skutečných závazků přepiš label na PROMISE.",
      "  2. Nech mezi nimi i poučné protipříklady (NOT_PROMISE) a napiš k nim proč.",
      "  3. Zbytek smaž, ať se dataset dá udržet.",
      "  4. Přejmenuj na golden.json a spusť npm run corpus:evaluate.",
      "",
      "Pravidla, co se počítá jako slib: docs/promise-annotation-guidelines.md",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error("Příprava kostry selhala:", error);
  process.exitCode = 1;
});
