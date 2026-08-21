/**
 * Diagnostika extrakce jednoho PDF.
 *
 *   npm run corpus:diagnose -- corpus/nazev/soubor.pdf
 *
 * Nic neopravuje. Vyrábí podklad pro rozhodnutí, jestli je extraktor potřeba
 * měnit — a když ano, tak kde konkrétně. Bez toho by úpravy vznikaly podle
 * dojmu a nedalo by se poznat, jestli pomohly.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  findControlCharacters,
  findFragmentation,
  findHyphenation,
  recommendQaPages,
  type DiagnosticReport,
} from "@/modules/ingestion/diagnostics";
import { normalizeText } from "@/modules/ingestion/normalize";
import { extractPdf } from "@/modules/ingestion/pdf";

/**
 * pdf.js hlásí problémy vlastním logem. Abychom je dostali do reportu,
 * konzole se na dobu extrakce odchytí — jinak by varování jen probleskla.
 */
async function extractCapturingWarnings(bytes: Uint8Array, name: string) {
  const warnings: string[] = [];
  const original = { warn: console.warn, log: console.log, error: console.error };

  const capture =
    (level: string) =>
    (...args: unknown[]): void => {
      warnings.push(`${level}: ${args.map((value) => String(value)).join(" ")}`);
    };

  console.warn = capture("warn");
  console.log = capture("log");
  console.error = capture("error");

  try {
    // Verbosity 1 = varování. Text extrakce to nijak nemění.
    const report = await extractPdf(bytes, name, { verbosity: 1 });
    return { report, warnings };
  } finally {
    console.warn = original.warn;
    console.log = original.log;
    console.error = original.error;
  }
}

function summarize(warnings: string[]): string[] {
  const counts = new Map<string, number>();

  for (const warning of warnings) {
    // Konkrétní názvy písem a čísla se liší; zajímá nás druh problému.
    const key = warning
      .replace(/[0-9a-f]{6,}/gi, "…")
      .replace(/\d+/g, "N")
      .slice(0, 160);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([message, count]) => (count === 1 ? message : `${message}  (${count}×)`));
}

async function main(): Promise<void> {
  const [input, ...rest] = process.argv.slice(2);
  if (!input) {
    console.error("Použití: npm run corpus:diagnose -- <soubor.pdf> [--out <soubor.json>]");
    process.exitCode = 1;
    return;
  }

  const outIndex = rest.indexOf("--out");
  const outFile =
    outIndex === -1
      ? path.join(path.dirname(input), "diagnostics.json")
      : (rest[outIndex + 1] ?? path.join(path.dirname(input), "diagnostics.json"));

  const bytes = await readFile(input);
  const { report, warnings } = await extractCapturingWarnings(bytes, path.basename(input));
  const { document, pagesWithoutText, pageStats } = report;

  const characterCount = document.pages.reduce((sum, page) => sum + page.text.length, 0);
  const normalizedCharacterCount = document.pages.reduce(
    (sum, page) => sum + normalizeText(page.text).text.length,
    0,
  );

  const hyphenation = findHyphenation(document);
  const fragmentation = findFragmentation(pageStats);

  const diagnostics: DiagnosticReport = {
    sourceName: document.sourceName,
    contentHash: document.contentHash,
    extractorVersion: document.extractorVersion,
    pageCount: document.pageCount,
    characterCount,
    normalizedCharacterCount,
    emptyPages: pagesWithoutText,
    warnings: summarize(warnings),
    controlCharacters: findControlCharacters(document),
    hyphenation,
    fragmentation,
    qaPages: recommendQaPages(document, pageStats, hyphenation, fragmentation),
  };

  await writeFile(outFile, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");

  const extractedPath = path.join(path.dirname(input), "extracted.json");
  await writeFile(extractedPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  console.log(
    [
      `Soubor:                 ${input}`,
      `SHA-256:                ${diagnostics.contentHash}`,
      `Extraktor:              ${diagnostics.extractorVersion}`,
      `Stránek:                ${diagnostics.pageCount}`,
      `Znaků (kanonicky):      ${diagnostics.characterCount}`,
      `Znaků (normalizovaně):  ${diagnostics.normalizedCharacterCount}`,
      `Stránek bez textu:      ${diagnostics.emptyPages.length}${
        diagnostics.emptyPages.length > 0 ? ` (${diagnostics.emptyPages.join(", ")})` : ""
      }`,
      `Varování pdf.js:        ${diagnostics.warnings.length} druhů`,
      `Podezřelé znaky:        ${diagnostics.controlCharacters.length} druhů`,
      `Dělení slov:            ${hyphenation.totalLikely} jistých, ${hyphenation.totalAmbiguous} nejednoznačných`,
      `Roztříštěné stránky:    ${fragmentation.suspiciousPages.length}`,
      "",
      `Report:                 ${outFile}`,
      `Kanonický text:         ${extractedPath}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error("Diagnostika selhala:", error);
  process.exitCode = 1;
});
