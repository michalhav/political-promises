/**
 * Převede PDF na kanonický text.
 *
 *   npm run corpus:extract -- corpus/nazev/program.pdf
 *
 * Výsledek je JSON se stránkami, otiskem souboru a verzí extraktoru. Na něj se
 * odkazují anotace i vyhodnocení, takže se po vytvoření nemění — když je
 * potřeba jiný text, vzniká nový soubor a anotace se ověřují znovu.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { normalizeText } from "@/modules/ingestion/normalize";
import { extractPdf } from "@/modules/ingestion/pdf";

async function main(): Promise<void> {
  const [input, ...rest] = process.argv.slice(2);
  if (!input) {
    console.error("Použití: npm run corpus:extract -- <soubor.pdf> [--out <adresář>]");
    process.exitCode = 1;
    return;
  }

  const outIndex = rest.indexOf("--out");
  const outDir =
    outIndex === -1 ? path.dirname(input) : (rest[outIndex + 1] ?? path.dirname(input));

  const bytes = await readFile(input);
  const { document, pagesWithoutText } = await extractPdf(bytes, path.basename(input));

  await mkdir(outDir, { recursive: true });
  const target = path.join(outDir, "extracted.json");
  await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  const characters = document.pages.reduce((sum, page) => sum + page.text.length, 0);
  const normalizedCharacters = document.pages.reduce(
    (sum, page) => sum + normalizeText(page.text).text.length,
    0,
  );

  console.log(
    [
      `Soubor:      ${input}`,
      `Otisk:       ${document.contentHash}`,
      `Extraktor:   ${document.extractorVersion}`,
      `Stránek:     ${document.pageCount}`,
      `Znaků:       ${characters} (po normalizaci ${normalizedCharacters})`,
      `Uloženo:     ${target}`,
    ].join("\n"),
  );

  if (pagesWithoutText.length > 0) {
    console.warn(
      [
        "",
        `VAROVÁNÍ: ${pagesWithoutText.length} stránek nemá textovou vrstvu: ${pagesWithoutText.join(", ")}.`,
        "Nejspíš jde o sken. OCR v projektu vědomě není — pokud je takových stránek",
        "hodně a jsou podstatné, je tohle ten doložený důvod ho přidat.",
      ].join("\n"),
    );
  }
}

main().catch((error: unknown) => {
  console.error("Extrakce selhala:", error);
  process.exitCode = 1;
});
