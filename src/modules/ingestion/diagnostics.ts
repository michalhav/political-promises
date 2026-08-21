/**
 * Diagnostika vytěženého dokumentu.
 *
 * Čistá analýza nad hotovým kanonickým textem — **nic nemění a nic neopravuje**.
 * Smysl je najít místa, kde extrakce nejspíš selhala, dřív než se nad nimi
 * začne anotovat. Oprava extraktoru má přijít až po doloženém selhání, ne po
 * dojmu, že by se to dalo udělat líp.
 */
import type { CanonicalDocument } from "@/modules/ingestion/canonical";
import type { PageStats } from "@/modules/ingestion/pdf";

export interface ControlCharacterFinding {
  codePoint: string;
  name: string;
  count: number;
  pages: number[];
  sample: string;
}

export interface HyphenationFinding {
  page: number;
  /** Spojovník na konci řádku, za ním malé písmeno — skoro jistě dělení slova. */
  likely: number;
  /** Za spojovníkem velké písmeno nebo číslice — může jít o složeninu či rozsah. */
  ambiguous: number;
  samples: string[];
}

export interface FragmentationFinding {
  page: number;
  itemCount: number;
  characterCount: number;
  averageItemLength: number;
  /** Kolikrát je stránka roztříštěnější než medián dokumentu. */
  fragmentationFactor: number;
}

export interface QaPageRecommendation {
  page: number;
  reason: string;
}

export interface DiagnosticReport {
  sourceName: string;
  contentHash: string;
  extractorVersion: string;
  pageCount: number;
  characterCount: number;
  normalizedCharacterCount: number;
  emptyPages: number[];
  warnings: string[];
  controlCharacters: ControlCharacterFinding[];
  hyphenation: { totalLikely: number; totalAmbiguous: number; pages: HyphenationFinding[] };
  fragmentation: { medianAverageItemLength: number; suspiciousPages: FragmentationFinding[] };
  qaPages: QaPageRecommendation[];
}

/**
 * Znaky, které v čistém textu nemají co dělat.
 *
 * Nejsou to chyby samy o sobě — měkký spojovník je legitimní součást sazby.
 * Jsou to ale místa, kde se citace tiše rozejde s tím, co uživatel v dokumentu
 * vidí, takže o nich chceme vědět.
 */
const NAMED_CHARACTERS = new Map<number, string>([
  [0x0009, "tabulátor"],
  [0x000b, "svislý tabulátor"],
  [0x000c, "konec stránky (form feed)"],
  [0x000d, "návrat vozíku (CR)"],
  [0x00a0, "nezlomitelná mezera"],
  [0x00ad, "měkký spojovník"],
  [0x200b, "nulová mezera (ZWSP)"],
  [0x200c, "ZWNJ"],
  [0x200d, "ZWJ"],
  [0x200e, "značka směru zleva doprava"],
  [0x200f, "značka směru zprava doleva"],
  [0x2028, "oddělovač řádku"],
  [0x2029, "oddělovač odstavce"],
  [0x202f, "úzká nezlomitelná mezera"],
  [0x2060, "spojovač slov"],
  [0xfeff, "BOM / nezlomitelná nulová mezera"],
  [0xfffd, "náhradní znak — ztracený glyf"],
]);

function isSuspicious(codePoint: number): boolean {
  if (codePoint === 0x000a) return false; // konec řádku je v pořádku
  if (NAMED_CHARACTERS.has(codePoint)) return true;
  if (codePoint < 0x20) return true;
  if (codePoint === 0x7f) return true;
  return codePoint >= 0x80 && codePoint <= 0x9f;
}

function describe(codePoint: number): string {
  return NAMED_CHARACTERS.get(codePoint) ?? "řídicí znak";
}

function contextAround(text: string, index: number): string {
  const from = Math.max(0, index - 30);
  const to = Math.min(text.length, index + 30);
  return text.slice(from, to).replace(/\n/g, "\\n");
}

export function findControlCharacters(document: CanonicalDocument): ControlCharacterFinding[] {
  const byCodePoint = new Map<number, { count: number; pages: Set<number>; sample: string }>();

  for (const page of document.pages) {
    for (let index = 0; index < page.text.length; index += 1) {
      const codePoint = page.text.codePointAt(index);
      if (codePoint === undefined || !isSuspicious(codePoint)) continue;

      const entry = byCodePoint.get(codePoint) ?? {
        count: 0,
        pages: new Set<number>(),
        sample: contextAround(page.text, index),
      };
      entry.count += 1;
      entry.pages.add(page.pageNumber);
      byCodePoint.set(codePoint, entry);
    }
  }

  return [...byCodePoint.entries()]
    .map(([codePoint, entry]) => ({
      codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`,
      name: describe(codePoint),
      count: entry.count,
      pages: [...entry.pages].sort((a, b) => a - b),
      sample: entry.sample,
    }))
    .sort((a, b) => b.count - a.count);
}

const LIKELY_HYPHEN = /\p{L}-\n\p{Ll}/gu;
const AMBIGUOUS_HYPHEN = /\p{L}-\n[\p{Lu}\d]/gu;

export function findHyphenation(document: CanonicalDocument): DiagnosticReport["hyphenation"] {
  const pages: HyphenationFinding[] = [];
  let totalLikely = 0;
  let totalAmbiguous = 0;

  for (const page of document.pages) {
    const likely = [...page.text.matchAll(LIKELY_HYPHEN)];
    const ambiguous = [...page.text.matchAll(AMBIGUOUS_HYPHEN)];
    if (likely.length === 0 && ambiguous.length === 0) continue;

    totalLikely += likely.length;
    totalAmbiguous += ambiguous.length;

    pages.push({
      page: page.pageNumber,
      likely: likely.length,
      ambiguous: ambiguous.length,
      samples: likely
        .slice(0, 3)
        .map((match) => contextAround(page.text, match.index ?? 0))
        .concat(ambiguous.slice(0, 2).map((match) => contextAround(page.text, match.index ?? 0))),
    });
  }

  return { totalLikely, totalAmbiguous, pages };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/** Stránky, kde pdf.js vrací text v nezvykle malých kouscích. */
export function findFragmentation(
  stats: PageStats[],
  minimumCharacters = 200,
): DiagnosticReport["fragmentation"] {
  const meaningful = stats.filter((page) => page.characterCount >= minimumCharacters);
  const medianAverage = median(meaningful.map((page) => page.averageItemLength));

  const suspicious = meaningful
    .filter((page) => medianAverage > 0 && page.averageItemLength < medianAverage * 0.5)
    .map((page) => ({
      page: page.pageNumber,
      itemCount: page.itemCount,
      characterCount: page.characterCount,
      averageItemLength: page.averageItemLength,
      fragmentationFactor: Number(
        (medianAverage / Math.max(page.averageItemLength, 0.01)).toFixed(2),
      ),
    }))
    .sort((a, b) => b.fragmentationFactor - a.fragmentationFactor);

  return {
    medianAverageItemLength: Number(medianAverage.toFixed(2)),
    suspiciousPages: suspicious,
  };
}

/**
 * Deset stránek na ruční kontrolu.
 *
 * Nevybírají se náhodně. Cílem je pokrýt různé případy sazby — obálku, hustý
 * text, řídkou stránku, nejroztříštěnější, nejvíc dělených slov, stránku
 * s čísly (tabulky, rozpočty) a stránku s převahou verzálek (nadpisy, grafika).
 * Náhodný vzorek by u dvousetstránkové brožury s velkou pravděpodobností
 * ukázal desetkrát totéž.
 */
export function recommendQaPages(
  document: CanonicalDocument,
  stats: PageStats[],
  hyphenation: DiagnosticReport["hyphenation"],
  fragmentation: DiagnosticReport["fragmentation"],
  limit = 10,
): QaPageRecommendation[] {
  const recommendations: QaPageRecommendation[] = [];
  const seen = new Set<number>();

  const add = (page: number | undefined, reason: string): void => {
    if (page === undefined || seen.has(page)) return;
    seen.add(page);
    recommendations.push({ page, reason });
  };

  const nonEmpty = document.pages.filter((page) => page.text.trim().length > 0);
  const byLength = [...nonEmpty].sort((a, b) => b.text.length - a.text.length);

  const digitRatio = (text: string): number =>
    text.length === 0
      ? 0
      : [...text].filter((character) => /\d/.test(character)).length / text.length;

  const upperRatio = (text: string): number => {
    const letters = [...text].filter((character) => /\p{L}/u.test(character));
    if (letters.length === 0) return 0;
    return (
      letters.filter((character) => character === character.toUpperCase()).length / letters.length
    );
  };

  add(document.pages[0]?.pageNumber, "První stránka — obálka, jiná sazba než zbytek.");
  add(byLength[0]?.pageNumber, "Nejvíc textu — hustá sazba, největší šance na chybu v pořadí.");
  add(byLength.at(-1)?.pageNumber, "Nejméně textu (a přesto neprázdná) — grafika nebo popisky.");
  add(
    fragmentation.suspiciousPages[0]?.page,
    "Nejroztříštěnější text — kandidát na rozpadlou sazbu.",
  );
  add(
    [...hyphenation.pages].sort((a, b) => b.likely - a.likely)[0]?.page,
    "Nejvíc dělených slov na konci řádku.",
  );
  add(
    [...nonEmpty].sort((a, b) => digitRatio(b.text) - digitRatio(a.text))[0]?.pageNumber,
    "Nejvíc číslic — pravděpodobně tabulka nebo rozpočet.",
  );
  add(
    [...nonEmpty].sort((a, b) => upperRatio(b.text) - upperRatio(a.text))[0]?.pageNumber,
    "Převaha verzálek — nadpisová nebo grafická stránka.",
  );
  add(document.pages.at(-1)?.pageNumber, "Poslední stránka — tiráž a kontakty.");

  // Doplnění do limitu: rovnoměrně po dokumentu, ať nezůstane celá část neviděná.
  const step = Math.max(1, Math.floor(nonEmpty.length / (limit + 1)));
  for (let index = step; index < nonEmpty.length && recommendations.length < limit; index += step) {
    add(nonEmpty[index]?.pageNumber, "Rovnoměrný vzorek napříč dokumentem.");
  }

  return recommendations.slice(0, limit);
}
