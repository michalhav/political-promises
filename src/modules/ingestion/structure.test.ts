/**
 * Vyloučení stránkové výbavy.
 *
 * Vstupy nejsou vymyšlené — jsou to **doslovné řádky z korpusu
 * praha-sobe-2022**, tak jak z něj vypadly (viz VISUAL-QA.md). Kdyby se
 * detekce rozbila, spadne to na tom, co v tom dokumentu doopravdy stojí,
 * ne na konstrukci vyrobené pro test.
 */
import { describe, expect, it } from "vitest";

import { sliceSpan, type CanonicalDocument } from "@/modules/ingestion/canonical";
import { normalizeText, PROCESSING_VERSION } from "@/modules/ingestion/normalize";
import { detectPageFurniture, furnitureForPage } from "@/modules/ingestion/structure";
import { splitPageIntoSegments } from "@/modules/extraction/segments";

/** Běžící patička z korpusu. Na každé stránce se liší jen číslem na konci. */
const FOOTER = (page: number): string => `PRAHA SOBĚ I Naše vize a konkrétních 218 zlepšení${page}`;

const REAL_PAGE_26 = [
  FOOTER(26),
  "Proto jsme přišli s plánem prověřit vznik nové linky O: páté, okružní",
  "trasy pražského metra. Metro O by mělo v první fázi propojit místa",
  "nového developmentu a místa, mezi nimiž lidé dojíždějí do prá-",
  "ce. Jde o úsek Dejvice – Smíchov – Pankrác – Slatiny – Žižkov –",
  "Vysočany.",
].join("\n");

const REAL_PAGE_25 = ["25", "Zavedeme jednotné jízdné pro celou aglomeraci."].join("\n");

/** Různá slova, ne jen různá čísla — otisk řádku čísla ignoruje. */
const TOPICS = [
  "Doprava",
  "Bydlení",
  "Školství",
  "Zdravotnictví",
  "Veřejný prostor",
  "Sídliště",
  "Rozvoj",
  "Finance",
  "Životní prostředí",
  "Kultura",
];

function documentFrom(pages: { pageNumber: number; text: string }[]): CanonicalDocument {
  return {
    contentHash: "a".repeat(64),
    extractorVersion: "pdfjs-1.0.0",
    pageCount: pages.length,
    pages,
    sourceName: "plan-pro-prahu-2022.pdf",
    extractedAt: "2026-08-21T00:00:00.000Z",
  };
}

/** Dokument, kde se patička opakuje dost často na to, aby ji šlo poznat. */
function realisticDocument(): CanonicalDocument {
  const filler = Array.from({ length: 12 }, (_, index) => index + 30).map((pageNumber) => ({
    pageNumber,
    text: [
      FOOTER(pageNumber),
      `Věta na stránce ${pageNumber}, dost dlouhá na to, aby prošla.`,
    ].join("\n"),
  }));

  // Dvě stránky jsou doslova z korpusu; zbytek jen dodává patičce četnost.
  return documentFrom([
    { pageNumber: 25, text: REAL_PAGE_25 },
    { pageNumber: 26, text: REAL_PAGE_26 },
    ...filler,
  ]);
}

describe("rozpoznání stránkové výbavy", () => {
  it("najde běžící patičku, i když se na každé stránce liší číslem", () => {
    const document = realisticDocument();
    const furniture = detectPageFurniture(document);

    const page26 = furnitureForPage(furniture, 26);
    expect(page26).toHaveLength(1);
    expect(page26[0]?.kind).toBe("RUNNING_HEADER");
    expect(page26[0]?.text).toBe(FOOTER(26));
  });

  it("rozsah ukazuje přesně na patičku v kanonickém textu", () => {
    const document = realisticDocument();
    const range = furnitureForPage(detectPageFurniture(document), 26)[0];
    expect(range).toBeDefined();
    if (!range) return;

    // Nejdůležitější kontrola: posuny jsou pořád kanonické, ne přepočítané.
    expect(sliceSpan(document, { page: 26, start: range.start, end: range.end })).toBe(FOOTER(26));
  });

  it("pozná holé číslo stránky", () => {
    const furniture = detectPageFurniture(realisticDocument());
    const page25 = furnitureForPage(furniture, 25);

    expect(page25.map((range) => range.kind)).toEqual(["PAGE_NUMBER"]);
    expect(page25[0]?.text).toBe("25");
  });

  it("nezahodí text, který se jen náhodou opakuje na pár stránkách", () => {
    const document = documentFrom([
      { pageNumber: 1, text: "Opakovaná věta, která je dost dlouhá.\nJiný text." },
      { pageNumber: 2, text: "Opakovaná věta, která je dost dlouhá.\nJiný text." },
      ...Array.from({ length: 20 }, (_, index) => ({
        pageNumber: index + 3,
        text: `Unikátní úvodní věta stránky ${index + 3}.\nDalší text.`,
      })),
    ]);

    expect(furnitureForPage(detectPageFurniture(document), 1)).toEqual([]);
  });

  it("nesahá na řádky uprostřed stránky", () => {
    const document = documentFrom(
      Array.from({ length: 10 }, (_, index) => ({
        pageNumber: index + 1,
        // Okrajové řádky se musí lišit i po odebrání číslic — otisk je ignoruje,
        // aby poznal patičku, která se mění jen číslem stránky.
        text: [
          `${TOPICS[index] ?? "Ostatní"} je téma této kapitoly programu.`,
          FOOTER(index + 1),
          `Kapitolu o tématu ${TOPICS[index] ?? "ostatní"} tímto uzavíráme.`,
        ].join("\n"),
      })),
    );

    // Kdyby se výbava hledala i uprostřed, šlo by vyloučit libovolnou
    // opakující se větu z těla textu — třeba refrén programu.
    expect(furnitureForPage(detectPageFurniture(document), 5)).toEqual([]);
  });
});

describe("zpracovací reprezentace", () => {
  it("kanonický text zůstává beze změny", () => {
    const document = realisticDocument();
    const before = document.pages.find((page) => page.pageNumber === 26)?.text;

    detectPageFurniture(document);
    normalizeText(before ?? "", {
      excludedRanges: furnitureForPage(detectPageFurniture(document), 26),
    });

    expect(document.pages.find((page) => page.pageNumber === 26)?.text).toBe(before);
    expect(before).toContain(FOOTER(26));
  });

  it("z odvozeného textu patička zmizí, zbytek zůstane", () => {
    const document = realisticDocument();
    const page = document.pages.find((item) => item.pageNumber === 26);
    const excluded = furnitureForPage(detectPageFurniture(document), 26);

    const processed = normalizeText(page?.text ?? "", { excludedRanges: excluded });

    expect(processed.text).not.toContain("PRAHA SOBĚ");
    expect(processed.text).toContain("Proto jsme přišli s plánem");
    // Dělení slova na konci řádku funguje dál.
    expect(processed.text).toContain("do práce");
  });

  it("posuny v odvozeném textu pořád ukazují do kanonického originálu", () => {
    const document = realisticDocument();
    const page = document.pages.find((item) => item.pageNumber === 26);
    const excluded = furnitureForPage(detectPageFurniture(document), 26);

    const processed = normalizeText(page?.text ?? "", { excludedRanges: excluded });
    const needle = "Metro O by mělo";
    const start = processed.text.indexOf(needle);
    expect(start).toBeGreaterThanOrEqual(0);

    const canonicalStart = processed.sourceOffsets[start];
    expect(canonicalStart).toBeDefined();
    expect(page?.text.slice(canonicalStart, (canonicalStart ?? 0) + needle.length)).toBe(needle);
  });

  it("bez vyloučených rozsahů se chová přesně jako dřív", () => {
    const text = REAL_PAGE_26;

    expect(normalizeText(text, { excludedRanges: [] }).text).toBe(normalizeText(text).text);
    expect(normalizeText(text).text).toContain("PRAHA SOBĚ");
  });

  it("verze zpracování nese všechny tři části", () => {
    // Normalizace, rozpoznání výbavy a dělení na věty se verzují dohromady —
    // změna kterékoli z nich mění odvozený text, a tedy platnost anotací.
    expect(PROCESSING_VERSION).toBe("norm-1.0.0+struct-1.0.0+seg-1.0.0");
  });
});

describe("úseky k anotaci", () => {
  it("patička už není nabízena jako kandidát", () => {
    const document = realisticDocument();
    const page = document.pages.find((item) => item.pageNumber === 26);
    if (!page) throw new Error("Stránka chybí.");

    const withFurniture = splitPageIntoSegments(page);
    const withoutFurniture = splitPageIntoSegments(
      page,
      furnitureForPage(detectPageFurniture(document), 26),
    );

    expect(withFurniture.some((segment) => segment.text.includes("PRAHA SOBĚ"))).toBe(true);
    expect(withoutFurniture.some((segment) => segment.text.includes("PRAHA SOBĚ"))).toBe(false);
    // Obsahové úseky zůstávají a mají stejné rozsahy jako předtím.
    expect(withoutFurniture).toEqual(withFurniture.filter((s) => !s.text.includes("PRAHA SOBĚ")));
  });
});
