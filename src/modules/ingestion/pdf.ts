/**
 * Extrakce textu z PDF.
 *
 * Deterministická a bez modelu. Kdyby text z dokumentu vytahoval jazykový
 * model, přestala by být citace citací — nešlo by odlišit, co v dokumentu
 * stojí, od toho, co model doplnil. To je přesně ta hranice, na které celý
 * produkt stojí.
 *
 * OCR tu vědomě není. Přidávat ho na základě domněnky, že „některé programy
 * budou skeny", by znamenalo tahat do projektu velkou závislost naslepo.
 * Extrakce místo toho pozná stránku bez textové vrstvy a **řekne to**
 * (`pagesWithoutText`); teprve reálný dokument, který na tom selže, je důvod
 * OCR přidat.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { CanonicalDocument, CanonicalPage } from "@/modules/ingestion/canonical";

/** Zvyš, když se změní způsob skládání textu. Jiná verze může dát jiné posuny. */
export const EXTRACTOR_VERSION = "pdfjs-1.0.0";

/**
 * Statistika rozdělení textu na stránce.
 *
 * Slouží **jen k diagnostice**, do kanonického dokumentu nevstupuje a text
 * nijak neovlivňuje. Průměrná délka kusu prozradí roztříštěnou sazbu: když
 * pdf.js vrací stovky jednopísmenných kusů, je s tou stránkou něco v nepořádku.
 */
export interface PageStats {
  pageNumber: number;
  /** Kolik samostatných kusů textu pdf.js na stránce našel. */
  itemCount: number;
  characterCount: number;
  emptyItemCount: number;
  /** Znaků na kus. Nízká hodnota znamená roztříštěný text. */
  averageItemLength: number;
}

/**
 * Poloha jednoho kusu textu na stránce. Jen pro diagnostiku a ruční kontrolu —
 * kanonický text z ní nevzniká a nijak ji neovlivňuje.
 */
export interface GeometryItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL: boolean;
  fontName: string;
}

export interface PageGeometry {
  pageNumber: number;
  viewportWidth: number;
  viewportHeight: number;
  items: GeometryItem[];
}

export interface ExtractionReport {
  document: CanonicalDocument;
  /** Stránky, ze kterých nevypadl žádný text — typicky sken bez textové vrstvy. */
  pagesWithoutText: number[];
  pageStats: PageStats[];
  /** Vyplněné jen na vyžádání — u stostránkového dokumentu je to hodně dat. */
  pageGeometry?: PageGeometry[];
}

export interface ExtractOptions {
  /**
   * Upovídanost pdf.js. Výchozí 0 = jen chyby, protože při extrakci textu je
   * hlášení o chybějících písmech pro vykreslování šum. Diagnostika si ji
   * zvedá, aby varování viděla.
   */
  verbosity?: number;
  /** Sbírat polohy kusů textu. Pro ruční kontrolu sazby, ne pro extrakci. */
  collectGeometry?: boolean;
}

/** Cesta k písmům dodaným s pdf.js. Odvozuje se z instalace, ne z pevné cesty. */
function standardFontsUrl(): string {
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve("pdfjs-dist/package.json");
  return pathToFileURL(path.join(path.dirname(packageJson), "standard_fonts/")).href;
}

interface TextItemLike {
  str?: unknown;
  hasEOL?: unknown;
  transform?: unknown;
  width?: unknown;
  height?: unknown;
  fontName?: unknown;
}

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && "str" in item;
}

/**
 * Text jedné stránky.
 *
 * pdf.js vrací kusy textu v pořadí, v jakém je dokument kreslí, a u posledního
 * kusu na řádku nastaví `hasEOL`. Konce řádků zachováváme: jsou to jediná
 * informace o rozvržení, která v čistém textu zbyla, a normalizace si s nimi
 * poradí sama.
 */
function buildPageText(items: unknown[]): string {
  const parts: string[] = [];

  for (const item of items) {
    if (!isTextItem(item)) continue;
    const text = typeof item.str === "string" ? item.str : "";
    parts.push(text);
    if (item.hasEOL === true) parts.push("\n");
  }

  return parts.join("").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export async function extractPdf(
  bytes: Uint8Array,
  sourceName: string,
  options: ExtractOptions = {},
): Promise<ExtractionReport> {
  // Legacy build je určený pro Node; standardní build počítá s prohlížečem.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const task = pdfjs.getDocument({
    // pdf.js si buffer přivlastní; kopie chrání volajícího i výpočet otisku.
    data: new Uint8Array(bytes),
    // Písma nevykreslujeme, ale pdf.js je potřebuje ke správnému převodu kódů
    // glyfů na Unicode. Bez cesty k nim si stěžuje a diakritika může vypadnout.
    standardFontDataUrl: standardFontsUrl(),
    disableFontFace: true,
    // Jen chyby. pdf.js hlásí i chybějící písma pro vykreslování, což je při
    // extrakci textu šum — nevykreslujeme, jen čteme kódy znaků.
    verbosity: options.verbosity ?? 0,
  });

  const pdf = await task.promise;
  const pages: CanonicalPage[] = [];
  const pagesWithoutText: number[] = [];
  const pageStats: PageStats[] = [];
  const pageGeometry: PageGeometry[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = buildPageText(content.items);

      if (text.trim().length === 0) pagesWithoutText.push(pageNumber);
      pages.push({ pageNumber, text });
      pageStats.push(collectStats(pageNumber, content.items));

      if (options.collectGeometry === true) {
        const viewport = page.getViewport({ scale: 1 });
        pageGeometry.push({
          pageNumber,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          items: collectGeometry(content.items),
        });
      }

      page.cleanup();
    }
  } finally {
    // Uvolňuje se přes načítací úlohu; `pdf` samo destroy() nemá.
    await task.destroy();
  }

  const document: CanonicalDocument = {
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    extractorVersion: EXTRACTOR_VERSION,
    pageCount: pages.length,
    pages,
    sourceName,
    extractedAt: new Date().toISOString(),
  };

  return {
    document,
    pagesWithoutText,
    pageStats,
    ...(options.collectGeometry === true ? { pageGeometry } : {}),
  };
}

function numberAt(value: unknown, index: number): number {
  return Array.isArray(value) && typeof value[index] === "number" ? value[index] : 0;
}

function collectGeometry(items: unknown[]): GeometryItem[] {
  const geometry: GeometryItem[] = [];

  for (const item of items) {
    if (!isTextItem(item)) continue;
    // transform je matice [a, b, c, d, e, f]; e a f jsou posun, tedy poloha.
    geometry.push({
      str: typeof item.str === "string" ? item.str : "",
      x: Number(numberAt(item.transform, 4).toFixed(2)),
      y: Number(numberAt(item.transform, 5).toFixed(2)),
      width: typeof item.width === "number" ? Number(item.width.toFixed(2)) : 0,
      height: typeof item.height === "number" ? Number(item.height.toFixed(2)) : 0,
      hasEOL: item.hasEOL === true,
      fontName: typeof item.fontName === "string" ? item.fontName : "",
    });
  }

  return geometry;
}

function collectStats(pageNumber: number, items: unknown[]): PageStats {
  let itemCount = 0;
  let characterCount = 0;
  let emptyItemCount = 0;

  for (const item of items) {
    if (!isTextItem(item)) continue;
    const text = typeof item.str === "string" ? item.str : "";
    itemCount += 1;
    characterCount += text.length;
    if (text.trim().length === 0) emptyItemCount += 1;
  }

  return {
    pageNumber,
    itemCount,
    characterCount,
    emptyItemCount,
    averageItemLength: itemCount === 0 ? 0 : Number((characterCount / itemCount).toFixed(2)),
  };
}
