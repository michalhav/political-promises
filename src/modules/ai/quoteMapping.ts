/**
 * Most mezi textem, který čte model, a textem, který se ukládá jako citace.
 *
 * Model dostane **normalizovaný** text: bez dělení slov přes řádek, bez
 * neviditelných znaků, se sjednocenou interpunkcí. Bez toho vracel fragmenty
 * jako „Zvýšíme kapacitu Průmyslového polookruhu, kte-", protože v původním
 * textu slovo doopravdy takhle končí.
 *
 * Uloží se ale **kanonický** výřez, znak po znaku z toho, co je v databázi.
 * Kdyby se ukládala normalizovaná podoba, citace by přestala být citací:
 * odkazovala by na text, který v dokumentu nikde nestojí. Normalizace je
 * odvozená vrstva a tou zůstává — slouží ke čtení, ne k dokládání.
 */
import { normalizeText, type NormalizedText } from "@/modules/ingestion/normalize";

export interface CanonicalView {
  /** Text pro model. */
  normalized: NormalizedText;
  /** Text, ze kterého se krájí citace. */
  canonical: string;
}

export function buildView(canonical: string): CanonicalView {
  return { normalized: normalizeText(canonical), canonical };
}

/**
 * Najde v normalizovaném textu úryvek a vrátí odpovídající kanonický výřez.
 *
 * Vrací null, když úryvek v textu není — což je ta nejdůležitější odpověď
 * v celém modulu: znamená, že si ho model vymyslel.
 */
export function toCanonicalQuote(view: CanonicalView, quote: string): string | null {
  const trimmed = quote.trim();
  if (trimmed.length === 0) return null;

  const start = view.normalized.text.indexOf(trimmed);
  if (start < 0) return null;

  const end = start + trimmed.length;
  const canonicalStart = view.normalized.sourceOffsets[start];
  const lastIndex = view.normalized.sourceOffsets[end - 1];
  if (canonicalStart === undefined || lastIndex === undefined) return null;

  // Poslední znak může být v originále vícebajtový, proto se bere celý.
  const lastCodePoint = view.canonical.codePointAt(lastIndex) ?? 0;
  const lastCharLength = lastCodePoint > 0xffff ? 2 : 1;
  const canonicalEnd = Math.min(view.canonical.length, lastIndex + lastCharLength);

  const slice = view.canonical.slice(canonicalStart, canonicalEnd);
  return slice.length > 0 ? slice : null;
}
