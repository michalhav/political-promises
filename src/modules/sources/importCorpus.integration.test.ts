/**
 * Import z korpusu proti skutečné databázi.
 *
 * Testuje se nad reálným adresářem `corpus/praha-sobe-2022`, ne nad fixturou:
 * smysl importu je právě to, že zvládne dokument, který nikdo nepsal pro nás.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { EditorialError, type Actor } from "@/modules/review/service";
import { importCorpusDocument, joinPages } from "@/modules/sources/importCorpus";
import { sourceDocuments } from "@/modules/sources/schema";

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };
const DIRECTORY = "corpus/praha-sobe-2022";

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("importCorpusDocument", () => {
  it("vloží skutečný program včetně provenience a počtu stran", async () => {
    const result = await importCorpusDocument(handle.db, editor, DIRECTORY);

    expect(result.pageCount).toBe(92);
    expect(result.characters).toBeGreaterThan(200_000);
    expect(result.licenseMode).toBe("FULL_TEXT_STORED");

    const [row] = await handle.db
      .select({
        title: sourceDocuments.title,
        publisher: sourceDocuments.publisher,
        url: sourceDocuments.url,
        publishedAt: sourceDocuments.publishedAt,
        pageCount: sourceDocuments.pageCount,
        isDemo: sourceDocuments.isDemo,
        processingState: sourceDocuments.processingState,
        rawText: sourceDocuments.rawText,
      })
      .from(sourceDocuments)
      .where(eq(sourceDocuments.id, result.sourceDocumentId));

    expect(row?.publisher).toBe("Praha Sobě");
    expect(row?.publishedAt).toBe("2022-04-13");
    expect(row?.url).toContain("prahasobe.cz");
    expect(row?.pageCount).toBe(92);
    expect(row?.isDemo).toBe(false);
    // Dokument čeká na redakci, ne aby se sám objevil venku.
    expect(row?.processingState).toBe("REVIEW_REQUIRED");
    // Citace ze strany 39 musí ve výsledném textu opravdu stát.
    expect(row?.rawText).toContain("Navýšíme platy učitelům o miliardu korun.");
  });

  it("tentýž dokument podruhé neprojde", async () => {
    await expect(importCorpusDocument(handle.db, editor, DIRECTORY)).rejects.toBeInstanceOf(
      EditorialError,
    );
  });

  it("adresář bez provenience se odmítne, ne aby se text uložil bez původu", async () => {
    await expect(
      importCorpusDocument(handle.db, editor, "corpus/demo-program"),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("stránky se skládají podle čísla, ne podle pořadí v souboru", () => {
    const text = joinPages([
      { pageNumber: 2, text: "druhá" },
      { pageNumber: 1, text: "první" },
    ]);

    expect(text).toBe("první\n\ndruhá");
  });
});
