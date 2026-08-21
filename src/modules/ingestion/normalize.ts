/**
 * Normalizovaná podoba textu pro strojové zpracování.
 *
 * Je to **odvozená** reprezentace, ne náhrada kanonického textu. Slouží
 * k hledání a k porovnávání; citovat se vždycky cituje z kanonického textu.
 *
 * Klíčová vlastnost: každý znak normalizovaného textu si pamatuje, ze kterého
 * znaku kanonického textu vznikl. Díky tomu jde nález v normalizovaném textu
 * převést zpátky na rozsah v originálu — bez toho by normalizace řetězec
 * doložitelnosti přetrhla.
 *
 * Proto všechny operace jsou jen **náhrada 1:1 nebo smazání**, nikdy vkládání.
 * Kdyby normalizace znaky přidávala, mapování zpět by přestalo být jednoznačné.
 */
import type { PageSpan } from "@/modules/ingestion/canonical";
import { isExcluded, STRUCTURE_VERSION, type ExcludedRange } from "@/modules/ingestion/structure";

/** Zvyš při každé změně pravidel níž. Ukládá se k odvozeným datům. */
export const NORMALIZATION_VERSION = "1.0.0";

/**
 * Verze celé zpracovací reprezentace.
 *
 * Skládá se ze dvou nezávislých částí: normalizačních pravidel a pravidel pro
 * rozpoznání stránkové výbavy. Změna kterékoli z nich mění odvozený text,
 * a tedy i platnost všeho, co nad ním vzniklo — proto se verzují dohromady.
 */
export const PROCESSING_VERSION = `norm-${NORMALIZATION_VERSION}+struct-${STRUCTURE_VERSION}+seg-1.0.0`;

export interface NormalizeOptions {
  /**
   * Rozsahy kanonického textu, které se do odvozené reprezentace nedostanou.
   * Kanonický text se tím **nemění** — jen se z něj přeskočí.
   */
  excludedRanges?: readonly ExcludedRange[];
}

export interface NormalizedText {
  text: string;
  /** `sourceOffsets[i]` je index znaku v kanonickém textu, ze kterého vznikl `text[i]`. */
  sourceOffsets: number[];
  normalizationVersion: string;
}

/** Mezery všeho druhu, které PDF rád produkuje místo obyčejné mezery. */
const SPACE_LIKE = new Set([
  "\u0009",
  "\u000b",
  "\u000c",
  "\u00a0",
  "\u1680",
  "\u2000",
  "\u2001",
  "\u2002",
  "\u2003",
  "\u2004",
  "\u2005",
  "\u2006",
  "\u2007",
  "\u2008",
  "\u2009",
  "\u200a",
  "\u202f",
  "\u205f",
  "\u3000",
]);

/** Znaky, které se v PDF objevují místo běžné interpunkce. */
const CHARACTER_MAP = new Map<string, string>([
  ["‘", "'"],
  ["’", "'"],
  ["‚", "'"],
  ["‛", "'"],
  ["“", '"'],
  ["”", '"'],
  ["„", '"'],
  ["‟", '"'],
  ["«", '"'],
  ["»", '"'],
  ["‐", "-"],
  ["‑", "-"],
  ["‒", "-"],
  ["–", "-"],
  ["—", "-"],
  ["−", "-"],
  ["…", "…"],
]);

/** Znaky, které mizí beze stopy: měkký spojovník, ZWSP, ZWNJ, ZWJ, BOM. */
const DROPPED = new Set(["\u00ad", "\u200b", "\u200c", "\u200d", "\ufeff"]);

function isCombiningMark(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x20d0 && code <= 0x20f0)
  );
}

function isWhitespace(character: string): boolean {
  return character === " " || character === "\n" || character === "\r" || SPACE_LIKE.has(character);
}

/**
 * Pravidla verze 1.0.0:
 *
 *  1. Rozložená diakritika se složí do jednoho znaku (`e` + háček → `ě`).
 *     PDF ji tak občas vysype a bez složení by hledání „zavedeme" minulo.
 *  2. Neviditelné znaky (měkký spojovník, ZWSP, BOM) se zahodí.
 *  3. Typografické uvozovky a pomlčky se sjednotí.
 *  4. Dělení slova na konci řádku (`-\n`) se spojí zpátky do jednoho slova.
 *  5. Libovolná posloupnost bílých znaků se scvrkne na jednu mezeru.
 *  6. Text se ořízne zleva i zprava.
 */
export function normalizeText(canonical: string, options: NormalizeOptions = {}): NormalizedText {
  const excluded = options.excludedRanges ?? [];
  const characters = [...canonical];
  // Znaky mimo BMP zabírají dva indexy; potřebujeme mapu zpět na ně.
  const canonicalIndexes: number[] = [];
  let cursor = 0;
  for (const character of characters) {
    canonicalIndexes.push(cursor);
    cursor += character.length;
  }

  const out: string[] = [];
  const offsets: number[] = [];
  let pendingWhitespace = false;
  // Kde bílá posloupnost začala. Normalizovaná mezera ukazuje na její začátek,
  // aby posuny zůstaly ostře rostoucí a rozsah nikdy nešel pozpátku.
  let pendingWhitespaceIndex = 0;

  for (let i = 0; i < characters.length; i += 1) {
    const character = characters[i];
    if (character === undefined) continue;
    const sourceIndex = canonicalIndexes[i] ?? 0;

    if (DROPPED.has(character)) continue;

    // Stránková výbava se přeskočí, ale posuny zbytku zůstávají kanonické.
    if (excluded.length > 0 && isExcluded(excluded, sourceIndex)) {
      // Za vyloučeným úsekem chceme mezeru, ne slepenec se sousedním textem.
      if (out.length > 0 && !pendingWhitespace) {
        pendingWhitespace = true;
        pendingWhitespaceIndex = sourceIndex;
      }
      continue;
    }

    // Dělení slova na konci řádku: spojovník, bílé znaky, další písmeno.
    if (character === "-") {
      let lookahead = i + 1;
      let sawNewline = false;
      while (lookahead < characters.length) {
        const next = characters[lookahead];
        if (next === undefined) break;
        if (next === "\n" || next === "\r") {
          sawNewline = true;
          lookahead += 1;
          continue;
        }
        if (isWhitespace(next)) {
          lookahead += 1;
          continue;
        }
        break;
      }
      const following = characters[lookahead];
      if (sawNewline && following !== undefined && /\p{L}/u.test(following)) {
        i = lookahead - 1;
        pendingWhitespace = false;
        continue;
      }
    }

    if (isWhitespace(character)) {
      // Mezera se zapíše až s dalším viditelným znakem, aby na konci nezůstala.
      if (out.length > 0 && !pendingWhitespace) {
        pendingWhitespace = true;
        pendingWhitespaceIndex = sourceIndex;
      }
      continue;
    }

    if (pendingWhitespace) {
      out.push(" ");
      offsets.push(pendingWhitespaceIndex);
      pendingWhitespace = false;
    }

    // Skládání diakritiky: základ plus následující spojovací znaménka.
    let composed = character;
    let consumed = i;
    while (consumed + 1 < characters.length) {
      const next = characters[consumed + 1];
      if (next === undefined || !isCombiningMark(next)) break;
      const candidate = (composed + next).normalize("NFC");
      if ([...candidate].length !== 1) break;
      composed = candidate;
      consumed += 1;
    }
    i = consumed;

    out.push(CHARACTER_MAP.get(composed) ?? composed);
    offsets.push(sourceIndex);
  }

  return {
    text: out.join(""),
    sourceOffsets: offsets,
    normalizationVersion: NORMALIZATION_VERSION,
  };
}

/**
 * Převede rozsah v normalizovaném textu zpátky na rozsah v kanonickém.
 *
 * Konec se počítá z posledního znaku rozsahu, ne z prvního za ním — ten už může
 * patřit jinam nebo neexistovat.
 */
/**
 * Citace pro čtenáře.
 *
 * V databázi zůstává doslovné znění včetně toho, jak ho rozsekalo PDF:
 * „cyklo-
stezek", dvojité mezery po zalomení, měkké spojovníky. Bez toho by
 * citace přestala být citací — nešlo by ji porovnat s dokumentem.
 *
 * Čtenáři se ale ta samá věta ukazuje spojená. Dělení slova na konci řádku
 * není nic, co by politik řekl; je to artefakt sazby. Zobrazit ho jako součást
 * výroku by bylo méně věrné, ne víc.
 *
 * Rozdíl je vědomý a jednosměrný: mění se **jen zobrazení**, nikdy uložený
 * text. V redakční konzoli se proto citace ukazují syrové — tam se porovnávají
 * s dokumentem a každý rozdíl by překážel.
 */
export function toReadableQuote(canonical: string): string {
  return normalizeText(canonical).text;
}

export function toCanonicalSpan(
  normalized: NormalizedText,
  page: number,
  start: number,
  end: number,
  canonicalLength: number,
): PageSpan | null {
  if (start < 0 || end > normalized.text.length || start >= end) return null;

  const canonicalStart = normalized.sourceOffsets[start];
  const lastIndex = normalized.sourceOffsets[end - 1];
  if (canonicalStart === undefined || lastIndex === undefined) return null;

  // Poslední znak může být v originále vícebajtový; vezmeme ho celý.
  const canonicalEnd = Math.min(canonicalLength, lastIndex + 1);
  return { page, start: canonicalStart, end: Math.max(canonicalEnd, canonicalStart + 1) };
}
