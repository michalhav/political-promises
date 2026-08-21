/**
 * Vyhodnocení extraktoru proti zlatému datasetu.
 *
 * Přesnost a úplnost samy o sobě nestačí. U produktu, který stojí na
 * doložitelnosti, je nejdůležitější metrika ta poslední: **kolik citací
 * v dokumentu vůbec není**. Extraktor s vysokou úplností, který si citace
 * upravuje, je horší než extraktor, který najde půlku — protože jeho výstup
 * nejde ověřit a redakce mu přestane věřit.
 *
 * Proto se sleduje odděleně:
 *  - `quoteFidelity` — citace přesně odpovídá svému rozsahu,
 *  - `unsupportedRate` — citace se na dané stránce nevyskytuje vůbec.
 *
 * Rozsahy se párují podle překryvu, ne na přesnou shodu. Anotátor a stroj se
 * skoro nikdy netrefí na tentýž znak a měřit shodu v interpunkci nemá smysl.
 */
import { sliceSpan, spanOverlapRatio, type CanonicalDocument } from "@/modules/ingestion/canonical";
import {
  notPromiseExamples,
  promiseExamples,
  type GoldenDataset,
  type GoldenExample,
} from "@/modules/extraction/goldenDataset";
import type { ExtractionCandidate, PromiseExtractor } from "@/modules/extraction/types";

/** Od jakého překryvu se predikce a anotace považují za tutéž větu. */
export const DEFAULT_OVERLAP_THRESHOLD = 0.5;

export interface MatchedPair {
  exampleId: string;
  overlap: number;
  quote: string;
}

export interface EvaluationResult {
  extractor: string;
  extractorVersion: string;
  overlapThreshold: number;

  goldPromiseCount: number;
  predictionCount: number;

  truePositives: number;
  falsePositives: number;
  falseNegatives: number;

  precision: number;
  recall: number;
  f1: number;

  /** Podíl predikcí, jejichž citace přesně odpovídá vlastnímu rozsahu. */
  quoteFidelity: number;
  /** Predikce, jejichž citace se na uvedené stránce vůbec nevyskytuje. */
  unsupportedCount: number;
  unsupportedRate: number;

  /** Predikce, které trefily větu anotovanou jako „tohle slib není". */
  knownNegativeHits: number;

  matched: MatchedPair[];
  missed: { exampleId: string; quote: string }[];
  spurious: { quote: string; page: number; reason: string }[];
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

interface QuoteCheck {
  exact: boolean;
  supported: boolean;
}

function checkQuote(document: CanonicalDocument, candidate: ExtractionCandidate): QuoteCheck {
  const atSpan = sliceSpan(document, candidate.span);
  if (atSpan === candidate.quote) return { exact: true, supported: true };

  const page = document.pages.find((item) => item.pageNumber === candidate.span.page);
  const supported = page ? page.text.includes(candidate.quote) : false;
  return { exact: false, supported };
}

/**
 * Nejlepší dosud nespárovaná anotace pro danou predikci.
 *
 * Párování je hladové podle míry překryvu. Optimální přiřazení by bylo
 * přesnější, ale u desítek vět na dokument je rozdíl zanedbatelný a hladový
 * postup jde vysvětlit anotátorovi.
 */
function bestMatch(
  candidate: ExtractionCandidate,
  examples: GoldenExample[],
  used: Set<string>,
  threshold: number,
): { example: GoldenExample; overlap: number } | null {
  let best: { example: GoldenExample; overlap: number } | null = null;

  for (const example of examples) {
    if (used.has(example.id)) continue;
    const overlap = spanOverlapRatio(candidate.span, { page: example.page, ...example.span });
    if (overlap < threshold) continue;
    if (!best || overlap > best.overlap) best = { example, overlap };
  }

  return best;
}

export interface EvaluateOptions {
  overlapThreshold?: number;
}

export function evaluateCandidates(
  extractorName: string,
  extractorVersion: string,
  candidates: ExtractionCandidate[],
  dataset: GoldenDataset,
  document: CanonicalDocument,
  options: EvaluateOptions = {},
): EvaluationResult {
  const threshold = options.overlapThreshold ?? DEFAULT_OVERLAP_THRESHOLD;
  const positives = promiseExamples(dataset);
  const negatives = notPromiseExamples(dataset);

  const usedExamples = new Set<string>();
  const matched: MatchedPair[] = [];
  const spurious: EvaluationResult["spurious"] = [];

  let exactQuotes = 0;
  let unsupported = 0;
  let knownNegativeHits = 0;

  // Nejjistější predikce si vybírají anotaci první.
  const ordered = [...candidates].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  for (const candidate of ordered) {
    const quoteCheck = checkQuote(document, candidate);
    if (quoteCheck.exact) exactQuotes += 1;
    if (!quoteCheck.supported) unsupported += 1;

    const match = bestMatch(candidate, positives, usedExamples, threshold);
    if (match) {
      usedExamples.add(match.example.id);
      matched.push({
        exampleId: match.example.id,
        overlap: Number(match.overlap.toFixed(3)),
        quote: candidate.quote,
      });
      continue;
    }

    const negative = bestMatch(candidate, negatives, new Set(), threshold);
    if (negative) knownNegativeHits += 1;

    spurious.push({
      quote: candidate.quote,
      page: candidate.span.page,
      reason: negative
        ? `Trefilo anotovaný protipříklad ${negative.example.id}.`
        : quoteCheck.supported
          ? "Bez odpovídající anotace."
          : "Citace se na uvedené stránce nevyskytuje.",
    });
  }

  const truePositives = matched.length;
  const falsePositives = candidates.length - truePositives;
  const falseNegatives = positives.length - truePositives;

  const precision = ratio(truePositives, truePositives + falsePositives);
  const recall = ratio(truePositives, positives.length);
  const f1 =
    precision + recall === 0
      ? 0
      : Number(((2 * precision * recall) / (precision + recall)).toFixed(4));

  return {
    extractor: extractorName,
    extractorVersion,
    overlapThreshold: threshold,
    goldPromiseCount: positives.length,
    predictionCount: candidates.length,
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1,
    quoteFidelity: ratio(exactQuotes, candidates.length),
    unsupportedCount: unsupported,
    unsupportedRate: ratio(unsupported, candidates.length),
    knownNegativeHits,
    matched,
    missed: positives
      .filter((example) => !usedExamples.has(example.id))
      .map((example) => ({ exampleId: example.id, quote: example.quote })),
    spurious,
  };
}

export async function evaluateExtractor(
  extractor: PromiseExtractor,
  dataset: GoldenDataset,
  document: CanonicalDocument,
  options: EvaluateOptions = {},
): Promise<EvaluationResult> {
  const candidates = await extractor.extract(document);
  return evaluateCandidates(
    extractor.name,
    extractor.version,
    candidates,
    dataset,
    document,
    options,
  );
}

/** Krátký přehled do konzole. Podrobnosti zůstávají v JSON výstupu. */
export function formatEvaluation(result: EvaluationResult): string {
  const percent = (value: number): string => `${(value * 100).toFixed(1)} %`;

  return [
    `Extraktor:            ${result.extractor} (${result.extractorVersion})`,
    `Anotovaných slibů:    ${result.goldPromiseCount}`,
    `Nalezeno kandidátů:   ${result.predictionCount}`,
    "",
    `Přesnost:             ${percent(result.precision)}  (${result.truePositives}/${result.truePositives + result.falsePositives})`,
    `Úplnost:              ${percent(result.recall)}  (${result.truePositives}/${result.goldPromiseCount})`,
    `F1:                   ${percent(result.f1)}`,
    "",
    `Věrnost citací:       ${percent(result.quoteFidelity)}`,
    `Citace bez opory:     ${result.unsupportedCount} (${percent(result.unsupportedRate)})`,
    `Trefené protipříklady:${String(result.knownNegativeHits).padStart(3)}`,
  ].join("\n");
}
