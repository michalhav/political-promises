/**
 * Vložení vytěženého dokumentu z korpusu do aplikační databáze.
 *
 * Do teď korpus a aplikace nekomunikovaly: `corpus:extract` vyrobil
 * `extracted.json`, ale do systému se text dostal jedině tak, že ho někdo
 * vložil do formuláře. U programu o 220 tisících znacích to není redakční
 * práce, ale opisování.
 *
 * Import nezavádí druhou cestu do databáze — používá tutéž `createSourceDocument`
 * jako redakční konzole, takže platí stejné kontroly: otisk obsahu, zákaz
 * duplicit i pravidlo, že bez licence k plnému textu se text neukládá.
 *
 * Oddělené od CLI schválně: stejnou funkci volá `npm run corpus:import`
 * i vývojový server, který si korpus nahraje při startu.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { AppDatabase } from "@/db/types";
import { createSourceDocument, EditorialError, type Actor } from "@/modules/review/service";
import { licenseModeEnum, sourceTypeEnum } from "@/db/enums";

/**
 * Provenience dokumentu — kde se vzal, kdo ho vydal a jak s ním smíme nakládat.
 *
 * Bez tohohle souboru se dokument neimportuje. Uložit cizí text bez evidence
 * původu je přesně to, čemu má provenience bránit.
 */
const provenanceSchema = z.object({
  sourceType: z.enum(sourceTypeEnum.enumValues),
  title: z.string().trim().min(1).max(500),
  publisher: z.string().trim().min(1).max(200),
  url: z.string().url().max(2000).optional(),
  publishedAt: z.iso.date().optional(),
  licenseMode: z.enum(licenseModeEnum.enumValues),
  isDemo: z.boolean().default(false),
  /**
   * Zapisuje `corpus:add`, když rozpozná adresu webového archivu. Ručně se
   * nevyplňuje — archivní původ se pozná z adresy, ne z dobré vůle.
   */
  archive: z
    .object({
      service: z.string().trim().min(1).max(120),
      originalUrl: z.string().url().max(2000),
      snapshotAt: z.iso.datetime(),
    })
    .optional(),
});

export type CorpusProvenance = z.infer<typeof provenanceSchema>;

const extractedSchema = z.object({
  contentHash: z.string().trim().min(1),
  pageCount: z.number().int().min(1),
  pages: z.array(z.object({ pageNumber: z.number().int().min(1), text: z.string() })).min(1),
});

export interface CorpusImportResult {
  sourceDocumentId: string;
  title: string;
  pageCount: number;
  characters: number;
  licenseMode: CorpusProvenance["licenseMode"];
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch (error) {
    throw new EditorialError(
      `Soubor ${file} nejde přečíst nebo to není platný JSON: ${(error as Error).message}`,
    );
  }
}

/**
 * Text dokumentu tak, jak se uloží: stránky za sebou, oddělené prázdným řádkem.
 *
 * Pořadí se vynucuje podle čísla stránky, ne podle pořadí v souboru — na
 * pořadí stojí to, že citace ze strany 39 opravdu odpovídá straně 39.
 */
export function joinPages(pages: { pageNumber: number; text: string }[]): string {
  return [...pages]
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => page.text)
    .join("\n\n");
}

export async function importCorpusDocument(
  db: AppDatabase,
  actor: Actor,
  directory: string,
): Promise<CorpusImportResult> {
  const provenance = provenanceSchema.parse(
    await readJson(path.join(directory, "provenance.json")),
  );
  const extracted = extractedSchema.parse(await readJson(path.join(directory, "extracted.json")));

  const text = joinPages(extracted.pages);
  const storesText = provenance.licenseMode === "FULL_TEXT_STORED";

  const sourceDocumentId = await createSourceDocument(db, actor, {
    sourceType: provenance.sourceType,
    title: provenance.title,
    publisher: provenance.publisher,
    url: provenance.url,
    publishedAt: provenance.publishedAt,
    licenseMode: provenance.licenseMode,
    // U dokumentu bez licence k plnému textu se ukládá jen evidence o něm.
    rawText: storesText ? text : undefined,
    pageCount: extracted.pageCount,
    isDemo: provenance.isDemo,
    archive: provenance.archive
      ? {
          service: provenance.archive.service,
          originalUrl: provenance.archive.originalUrl,
          snapshotAt: new Date(provenance.archive.snapshotAt),
        }
      : undefined,
  });

  return {
    sourceDocumentId,
    title: provenance.title,
    pageCount: extracted.pageCount,
    characters: storesText ? text.length : 0,
    licenseMode: provenance.licenseMode,
  };
}
