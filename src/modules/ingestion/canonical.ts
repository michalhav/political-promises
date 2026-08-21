/**
 * Kanonická podoba dokumentu.
 *
 * Celý řetězec doložitelnosti stojí na tom, že citace ukazuje na konkrétní
 * místo v konkrétním dokumentu. Aby to platilo i za dva roky, musí být text,
 * na který se odkazuje, **neměnný a adresovatelný**:
 *
 *  - `contentHash` říká, o který soubor jde,
 *  - `pages` zachovává hranice stran, takže „s. 12" znamená pořád totéž,
 *  - `start`/`end` jsou znakové posuny **uvnitř stránky**, ne v celém dokumentu.
 *
 * Posuny jsou lokální schválně. Kdyby byly globální, přidání stránky na začátek
 * (jiná verze PDF, jiný extraktor) by posunulo všechny citace v dokumentu.
 *
 * Kanonický text se po uložení nikdy nemění. Všechno ostatní — čištění,
 * normalizace, tokenizace — se z něj odvozuje a nese vlastní verzi.
 */
export interface CanonicalPage {
  pageNumber: number;
  /** Text stránky tak, jak vyšel z extraktoru. Neupravuje se. */
  text: string;
}

export interface CanonicalDocument {
  /** SHA-256 bajtů souboru, hex. Identita dokumentu, ne jeho textu. */
  contentHash: string;
  /** Verze extrakčního postupu. Jiná verze může dát jiný text. */
  extractorVersion: string;
  pageCount: number;
  pages: CanonicalPage[];
  /** Odkud soubor pochází. Vyplňuje ho ten, kdo dokument dodal. */
  sourceName: string;
  extractedAt: string;
}

/** Rozsah uvnitř jedné stránky. `end` je exkluzivní, jako u `String.slice`. */
export interface PageSpan {
  page: number;
  start: number;
  end: number;
}

export function getPage(document: CanonicalDocument, pageNumber: number): CanonicalPage | null {
  return document.pages.find((page) => page.pageNumber === pageNumber) ?? null;
}

/** Text, na který rozsah ukazuje. `null`, když rozsah do dokumentu nesedí. */
export function sliceSpan(document: CanonicalDocument, span: PageSpan): string | null {
  const page = getPage(document, span.page);
  if (!page) return null;
  if (span.start < 0 || span.end > page.text.length || span.start >= span.end) return null;

  return page.text.slice(span.start, span.end);
}

/**
 * Najde všechny doslovné výskyty citace v dokumentu.
 *
 * Používá se k ověření, že tvrzení má oporu ve zdroji. Vrací všechny výskyty,
 * ne první — když je citace v dokumentu dvakrát, je to informace, ne detail.
 */
export function findExactSpans(document: CanonicalDocument, quote: string): PageSpan[] {
  if (quote.length === 0) return [];

  const spans: PageSpan[] = [];
  for (const page of document.pages) {
    let index = page.text.indexOf(quote);
    while (index !== -1) {
      spans.push({ page: page.pageNumber, start: index, end: index + quote.length });
      index = page.text.indexOf(quote, index + 1);
    }
  }
  return spans;
}

export function spansOverlap(a: PageSpan, b: PageSpan): boolean {
  return a.page === b.page && a.start < b.end && b.start < a.end;
}

/**
 * Míra překryvu dvou rozsahů (0–1), počítaná jako průnik ku sjednocení.
 *
 * Anotace a strojový výstup se skoro nikdy netrefí na stejný znak — jeden vezme
 * větu i s tečkou, druhý bez ní. Porovnávat rozsahy na přesnou shodu by proto
 * měřilo hlavně shodu v interpunkci.
 */
export function spanOverlapRatio(a: PageSpan, b: PageSpan): number {
  if (a.page !== b.page) return 0;

  const intersection = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  if (intersection <= 0) return 0;

  const union = Math.max(a.end, b.end) - Math.min(a.start, b.start);
  return union === 0 ? 0 : intersection / union;
}
