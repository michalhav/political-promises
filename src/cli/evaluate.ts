/**
 * Vyhodnotí extraktor proti zlatému datasetu.
 *
 *   npm run corpus:evaluate -- corpus/nazev
 *   npm run corpus:evaluate -- corpus/nazev --extractor fixture --candidates cesta.json
 *
 * Před měřením ověří, že anotace na dokument vůbec sedí. Kdyby se rozešly,
 * všechna čísla níž by měřila něco jiného, než si myslíme — proto to je
 * zastavovací chyba, ne varování.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { HeuristicPromiseExtractor } from "@/modules/extraction/baseline";
import { evaluateExtractor, formatEvaluation } from "@/modules/extraction/evaluate";
import { FixturePromiseExtractor } from "@/modules/extraction/fixture";
import { parseGoldenDataset, validateGoldenDataset } from "@/modules/extraction/goldenDataset";
import type { ExtractionCandidate, PromiseExtractor } from "@/modules/extraction/types";
import type { CanonicalDocument } from "@/modules/ingestion/canonical";

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

async function buildExtractor(args: string[]): Promise<PromiseExtractor> {
  const kind = argValue(args, "--extractor") ?? "baseline";
  if (kind === "baseline") return new HeuristicPromiseExtractor();

  if (kind === "fixture") {
    const file = argValue(args, "--candidates");
    if (!file) throw new Error("U --extractor fixture je potřeba --candidates <soubor.json>.");
    const candidates = (await readJson(file)) as ExtractionCandidate[];
    return new FixturePromiseExtractor(candidates, `fixture:${path.basename(file)}`);
  }

  throw new Error(`Neznámý extraktor „${kind}". Použij baseline nebo fixture.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [directory] = args;
  if (!directory) {
    console.error("Použití: npm run corpus:evaluate -- <adresář> [--extractor baseline|fixture]");
    process.exitCode = 1;
    return;
  }

  const document = (await readJson(path.join(directory, "extracted.json"))) as CanonicalDocument;
  const dataset = parseGoldenDataset(await readJson(path.join(directory, "golden.json")));

  const issues = validateGoldenDataset(dataset, document);
  const errors = issues.filter((issue) => issue.severity === "ERROR");

  for (const issue of issues) {
    const prefix = issue.severity === "ERROR" ? "CHYBA" : "VAROVÁNÍ";
    console.error(`${prefix} ${issue.exampleId ?? "-"}: ${issue.message}`);
  }

  if (errors.length > 0) {
    console.error(`\nDataset nesedí na dokument (${errors.length} chyb). Neměřím.`);
    process.exitCode = 1;
    return;
  }

  const extractor = await buildExtractor(args);
  const result = await evaluateExtractor(extractor, dataset, document);

  console.log(`\n${formatEvaluation(result)}\n`);

  if (result.missed.length > 0) {
    console.log(`Nenalezené závazky (${result.missed.length}):`);
    for (const miss of result.missed) console.log(`  - ${miss.exampleId}: ${miss.quote}`);
  }

  if (result.spurious.length > 0) {
    console.log(`\nKandidáti bez anotace (${result.spurious.length}):`);
    for (const item of result.spurious) {
      console.log(`  - s. ${item.page}: ${item.quote}\n      ${item.reason}`);
    }
  }

  const out = argValue(args, "--out") ?? path.join(directory, "evaluation.json");
  await writeFile(out, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`\nPodrobný výsledek: ${out}`);
}

main().catch((error: unknown) => {
  console.error("Vyhodnocení selhalo:", error);
  process.exitCode = 1;
});
