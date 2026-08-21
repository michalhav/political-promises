/**
 * Rozdělení stránky na věty s posuny do kanonického textu.
 *
 * Sdílí to heuristický extraktor i anotační pomůcka: obojí potřebuje „ukaž mi
 * kandidátské úseky téhle stránky i s tím, kde přesně jsou".
 *
 * Dělí se nad **kanonickým** textem, ne nad normalizovaným. Normalizace slepuje
 * řádky do jedné mezery, takže nadpis a první věta pod ním by splynuly v jeden
 * úsek — a citace by pak obsahovala nadpis.
 */
import type { CanonicalPage, PageSpan } from "@/modules/ingestion/canonical";
import { normalizeText, toCanonicalSpan } from "@/modules/ingestion/normalize";
import { isExcluded, type ExcludedRange } from "@/modules/ingestion/structure";

/** Zvyš při každé změně pravidel dělení na věty. Součást verze zpracování. */
export const SEGMENTATION_VERSION = "1.0.0";

export interface Segment {
  span: PageSpan;
  /** Doslovný text úseku z kanonického textu. */
  text: string;
  /** Tentýž úsek po normalizaci. Na porovnávání a hledání klíčových slov. */
  normalized: string;
}

const SENTENCE_END = /[.!?]/;

function isWhitespace(character: string): boolean {
  return /\s/.test(character);
}

/**
 * Hranice úseku: konec řádku, nebo tečka následovaná mezerou a velkým písmenem.
 *
 * Podmínka velkého písmena drží pohromadě zkratky a čísla („č. 2", „r. 2026",
 * „2 000 Kč."), kde tečka větu nekončí.
 */
function isBoundary(text: string, index: number): boolean {
  const character = text[index];
  if (character === undefined) return false;
  if (character === "\n") return true;
  if (!SENTENCE_END.test(character)) return false;

  let lookahead = index + 1;
  while (lookahead < text.length) {
    const next = text[lookahead];
    if (next === undefined) return true;
    if (!isWhitespace(next)) break;
    lookahead += 1;
  }

  const following = text[lookahead];
  if (following === undefined) return true;
  return following === following.toUpperCase() && /\p{L}/u.test(following);
}

/**
 * Volitelné vyloučení stránkové výbavy.
 *
 * Výchozí chování je beze změny — bez předaných rozsahů se úseky dělí přesně
 * jako dřív. Kdo výbavu vyloučit chce (anotace, budoucí vytěžování), předá ji;
 * heuristická laťka zůstává nedotčená.
 */
export function splitPageIntoSegments(
  page: CanonicalPage,
  excluded: readonly ExcludedRange[] = [],
): Segment[] {
  const text = page.text;
  const segments: Segment[] = [];

  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!isBoundary(text, index)) continue;

    // Konec řádku do úseku nepatří, tečka ano — je součástí věty.
    const end = text[index] === "\n" ? index : index + 1;
    pushSegment(segments, page.pageNumber, text, start, end, excluded);
    start = index + 1;
  }

  pushSegment(segments, page.pageNumber, text, start, text.length, excluded);
  return segments;
}

function pushSegment(
  segments: Segment[],
  pageNumber: number,
  text: string,
  rawStart: number,
  rawEnd: number,
  excluded: readonly ExcludedRange[],
): void {
  let start = rawStart;
  let end = rawEnd;

  // Úsek, který celý padne do stránkové výbavy, není kandidát na nic.
  if (excluded.length > 0 && isExcluded(excluded, start)) return;

  // Bílé znaky na okrajích do citace nepatří.
  while (start < end && isWhitespace(text[start] ?? "")) start += 1;
  while (end > start && isWhitespace(text[end - 1] ?? "")) end -= 1;
  if (end <= start) return;

  const slice = text.slice(start, end);
  segments.push({
    span: { page: pageNumber, start, end },
    text: slice,
    normalized: normalizeText(slice).text,
  });
}

/**
 * Dělení na **věty**, ne na typografické řádky.
 *
 * `splitPageIntoSegments` výše dělí kanonický text na hranicích řádků, protože
 * je nechce slepovat s nadpisy. U skutečného programu z PDF to ale nestačí:
 * v korpusu praha-sobe-2022 takhle vzniklo 3 302 úseků, z nichž jen 29 %
 * končilo tečkou a mnohé byly přeťaté uprostřed slova („do prá-“). Anotovat se
 * to nedá a vytěžovat taky ne.
 *
 * Řešení je dělit nad **zpracovací reprezentací**, kde jsou řádky slepené
 * a dělená slova spojená, a nález převést zpátky na rozsah v kanonickém textu.
 * Citace tak pořád odpovídá tomu, co v dokumentu doslova stojí — včetně
 * zalomení a spojovníků.
 *
 * Původní funkci to nechává být: heuristická laťka měří dál totéž co dřív.
 */
export function splitPageIntoSentences(
  page: CanonicalPage,
  excluded: readonly ExcludedRange[] = [],
): Segment[] {
  const processed = normalizeText(page.text, { excludedRanges: excluded });
  const text = processed.text;
  const segments: Segment[] = [];

  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!SENTENCE_END.test(text[index] ?? "")) continue;
    if (!endsSentence(text, index)) continue;

    pushSentence(segments, page, processed, start, index + 1);
    start = index + 1;
  }

  pushSentence(segments, page, processed, start, text.length);
  return segments;
}

/**
 * Tečka končí větu, jen když po ní následuje mezera a velké písmeno.
 *
 * Drží to pohromadě zkratky („č. 2“), pořadová čísla („1. etapa“) i desetinná
 * čísla, kterých je v rozpočtových pasážích programu plno.
 */
function endsSentence(text: string, index: number): boolean {
  let lookahead = index + 1;
  while (lookahead < text.length && isWhitespace(text[lookahead] ?? "")) lookahead += 1;

  const following = text[lookahead];
  if (following === undefined) return true;
  if (!/\p{L}/u.test(following)) return false;

  return following === following.toUpperCase();
}

function pushSentence(
  segments: Segment[],
  page: CanonicalPage,
  processed: ReturnType<typeof normalizeText>,
  rawStart: number,
  rawEnd: number,
): void {
  let start = rawStart;
  let end = rawEnd;

  while (start < end && isWhitespace(processed.text[start] ?? "")) start += 1;
  while (end > start && isWhitespace(processed.text[end - 1] ?? "")) end -= 1;
  if (end <= start) return;

  const span = toCanonicalSpan(processed, page.pageNumber, start, end, page.text.length);
  if (!span) return;

  segments.push({
    span,
    // Doslovné znění z originálu — se zalomením i spojovníky, jak tam stojí.
    text: page.text.slice(span.start, span.end),
    normalized: processed.text.slice(start, end),
  });
}
