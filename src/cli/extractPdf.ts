/**
 * Převede dokument na kanonický text.
 *
 *   npm run corpus:extract -- corpus/nazev/program.pdf
 *   npm run corpus:extract -- corpus/nazev/dokument.html
 *
 * Výsledek je JSON se stránkami, otiskem souboru a verzí extraktoru. Na něj se
 * odkazují anotace i vyhodnocení, takže se po vytvoření nemění — když je
 * potřeba jiný text, vzniká nový soubor a anotace se ověřují znovu.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type { CanonicalDocument } from "@/modules/ingestion/canonical";
import { extractHtml } from "@/modules/ingestion/html";
import { normalizeText } from "@/modules/ingestion/normalize";
import { extractPdf } from "@/modules/ingestion/pdf";

/** `%PDF-` na začátku souboru. Otisk obsahu je spolehlivější než přípona. */
const PDF_MAGIC = "%PDF-";

interface ExtractionOutcome {
  document: CanonicalDocument;
  warnings: string[];
}

async function extractDocument(bytes: Buffer, sourceName: string): Promise<ExtractionOutcome> {
  if (bytes.subarray(0, PDF_MAGIC.length).toString("latin1") === PDF_MAGIC) {
    const { document, pagesWithoutText } = await extractPdf(bytes, sourceName);

    return {
      document,
      warnings:
        pagesWithoutText.length === 0
          ? []
          : [
              `${pagesWithoutText.length} stránek nemá textovou vrstvu: ${pagesWithoutText.join(", ")}.`,
              "Nejspíš jde o sken. OCR v projektu vědomě není — pokud je takových stránek",
              "hodně a jsou podstatné, je tohle ten doložený důvod ho přidat.",
            ],
    };
  }

  const extension = path.extname(sourceName).toLowerCase();
  if (extension !== ".html" && extension !== ".htm") {
    throw new Error(
      `${sourceName}: soubor není PDF ani HTML. Vytěžit jde jen to, u čeho víme, jak z něj vzniká text.`,
    );
  }

  const { document, declaredCharset, isEmpty } = extractHtml(bytes, sourceName);
  const warnings: string[] = [];

  if (declaredCharset) {
    warnings.push(
      `Stránka deklaruje kódování ${declaredCharset}, čteme ji ale jako UTF-8.`,
      "Text je nejspíš rozsypaný. Než se z něj bude citovat, je potřeba to vyřešit.",
    );
  }

  if (isEmpty) {
    warnings.push(
      "Ze stránky nevypadl žádný text — obsah se nejspíš dokresluje až v prohlížeči.",
      "Takový dokument nejde citovat; potřebuje jiný zdroj nebo jiný způsob stažení.",
    );
  }

  return { document, warnings };
}

async function main(): Promise<void> {
  const [input, ...rest] = process.argv.slice(2);
  if (!input) {
    console.error("Použití: npm run corpus:extract -- <soubor.pdf|soubor.html> [--out <adresář>]");
    process.exitCode = 1;
    return;
  }

  const outIndex = rest.indexOf("--out");
  const outDir =
    outIndex === -1 ? path.dirname(input) : (rest[outIndex + 1] ?? path.dirname(input));

  const bytes = await readFile(input);
  const { document, warnings } = await extractDocument(bytes, path.basename(input));

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

  if (warnings.length > 0) {
    console.warn(["", `VAROVÁNÍ: ${warnings.join("\n")}`].join("\n"));
  }
}

main().catch((error: unknown) => {
  console.error("Extrakce selhala:", error);
  process.exitCode = 1;
});
