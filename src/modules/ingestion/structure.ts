/**
 * Stránková výbava: běžící záhlaví, patičky a čísla stran.
 *
 * Tenhle modul **nikdy nesahá na kanonický text**. Jen označí rozsahy, které
 * do zpracování nepatří — vyloučí se z odvozené reprezentace, kanonický text
 * i posuny uvnitř stránky zůstávají beze změny. Citace se pořád vztahuje
 * k tomu, co v dokumentu doslova stojí.
 *
 * Doložený důvod (viz VISUAL-QA.md pro korpus praha-sobe-2022): na 78 z 92
 * stran je prvním řádkem běžící patička nebo holé číslo stránky. Do vět se
 * nevmísí, ale při rozpadu na úseky z nich vzniknou desítky falešných
 * kandidátů, které by musel anotátor pokaždé ručně odmítat.
 *
 * Detekce je **strukturální, ne slovníková**. Nikde tu není napsáno „PRAHA
 * SOBĚ“ — hledá se text, který se opakuje na dost stránkách na téže pozici.
 * Napevno zadaný řetězec by fungoval na jednom dokumentu a na dalším ne.
 */
import type { CanonicalDocument } from "@/modules/ingestion/canonical";

/** Zvyš při každé změně pravidel detekce. Je součástí verze zpracování. */
export const STRUCTURE_VERSION = "1.0.0";

export type FurnitureKind = "RUNNING_HEADER" | "PAGE_NUMBER";

export interface ExcludedRange {
  /** Posun v kanonickém textu stránky. Konec je exkluzivní. */
  start: number;
  end: number;
  kind: FurnitureKind;
  /** Vyloučený text. Uchováváme ho, aby šlo rozhodnutí zpětně zkontrolovat. */
  text: string;
}

export interface PageFurniture {
  pageNumber: number;
  excluded: ExcludedRange[];
}

export interface FurnitureOptions {
  /**
   * Na kolika procentech stránek se musí řádek opakovat, aby šlo o výbavu.
   * Nízká hodnota by zahodila text, který se náhodou opakuje na dvou stránkách.
   */
  minimumPageRatio?: number;
  /** Kratší opakující se řádky bývají čísla nebo interpunkce, ne záhlaví. */
  minimumHeaderLength?: number;
}

interface LineOccurrence {
  pageNumber: number;
  start: number;
  end: number;
  text: string;
  isFirst: boolean;
  isLast: boolean;
}

/** Řádky stránky i s posunem, na kterém v kanonickém textu začínají. */
function lineOccurrences(pageNumber: number, text: string): LineOccurrence[] {
  const lines: LineOccurrence[] = [];
  let cursor = 0;

  for (const raw of text.split("\n")) {
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();

    if (trimmed.length > 0) {
      lines.push({
        pageNumber,
        start: cursor + leading,
        end: cursor + leading + trimmed.length,
        text: trimmed,
        isFirst: false,
        isLast: false,
      });
    }
    cursor += raw.length + 1;
  }

  const first = lines[0];
  const last = lines.at(-1);
  if (first) first.isFirst = true;
  if (last) last.isLast = true;

  return lines;
}

/**
 * Otisk řádku bez čísel.
 *
 * Patička se na každé stránce liší jen číslem stránky, takže po jeho odebrání
 * musí být na všech stránkách totožná. Bez toho by se každý výskyt počítal
 * jako jedinečný a nic by se neopakovalo.
 */
function fingerprint(text: string): string {
  return text.replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

const BARE_NUMBER = /^\d{1,4}$/;

export function detectPageFurniture(
  document: CanonicalDocument,
  options: FurnitureOptions = {},
): PageFurniture[] {
  const minimumRatio = options.minimumPageRatio ?? 0.25;
  const minimumLength = options.minimumHeaderLength ?? 12;

  const perPage = document.pages.map((page) => lineOccurrences(page.pageNumber, page.text));
  const edgeLines = perPage.flatMap((lines) => lines.filter((line) => line.isFirst || line.isLast));

  // Kolik různých stránek nese tentýž otisk na kraji stránky.
  const pagesByFingerprint = new Map<string, Set<number>>();
  for (const line of edgeLines) {
    if (line.text.length < minimumLength) continue;
    const key = fingerprint(line.text);
    const pages = pagesByFingerprint.get(key) ?? new Set<number>();
    pages.add(line.pageNumber);
    pagesByFingerprint.set(key, pages);
  }

  const threshold = Math.max(3, Math.ceil(document.pageCount * minimumRatio));
  const repeated = new Set(
    [...pagesByFingerprint.entries()]
      .filter(([, pages]) => pages.size >= threshold)
      .map(([key]) => key),
  );

  return perPage.map((lines, index) => {
    const pageNumber = document.pages[index]?.pageNumber ?? index + 1;
    const excluded: ExcludedRange[] = [];

    for (const line of lines) {
      if (!line.isFirst && !line.isLast) continue;

      if (BARE_NUMBER.test(line.text)) {
        excluded.push({ start: line.start, end: line.end, kind: "PAGE_NUMBER", text: line.text });
        continue;
      }

      if (line.text.length >= minimumLength && repeated.has(fingerprint(line.text))) {
        excluded.push({
          start: line.start,
          end: line.end,
          kind: "RUNNING_HEADER",
          text: line.text,
        });
      }
    }

    return { pageNumber, excluded: excluded.sort((a, b) => a.start - b.start) };
  });
}

export function isExcluded(ranges: readonly ExcludedRange[], offset: number): boolean {
  return ranges.some((range) => offset >= range.start && offset < range.end);
}

export function furnitureForPage(
  furniture: readonly PageFurniture[],
  pageNumber: number,
): ExcludedRange[] {
  return furniture.find((page) => page.pageNumber === pageNumber)?.excluded ?? [];
}
