/**
 * Dodavatel bez modelu — pro vývoj, testy a laťku.
 *
 * Není to atrapa, která vrací prázdno. Pouští **deterministickou heuristiku**
 * (`HeuristicPromiseExtractor`), tedy přesně toho protivníka, kterého má
 * jazykový model překonávat. Celý řetězec — běh, návrhy, revize, přijetí —
 * tak jde projet bez API klíče a bez placení, a přitom nad skutečnými větami
 * skutečného programu.
 *
 * Vrací výstup ve stejném schématu jako model, takže se za něj dá kdykoli
 * postavit ten druhý dodavatel a nic dalšího se měnit nemusí.
 */
import { BASELINE_VERSION, HeuristicPromiseExtractor } from "@/modules/extraction/baseline";
import { AIProviderError, type AIProvider, type StructuredRequest } from "@/modules/ai/provider";
import type { StructuredResult } from "@/modules/ai/provider";
import type { CanonicalDocument } from "@/modules/ingestion/canonical";

/** Skóre, které heuristika nemá jak určit. Redakce je stejně přepisuje. */
const UNKNOWN_SCORE = 0;

function asSinglePageDocument(text: string): CanonicalDocument {
  return {
    contentHash: "heuristic",
    extractorVersion: BASELINE_VERSION,
    pageCount: 1,
    pages: [{ pageNumber: 1, text }],
    sourceName: "in-memory",
    extractedAt: new Date().toISOString(),
  };
}

export class HeuristicProvider implements AIProvider {
  readonly name = "heuristic";
  private readonly extractor = new HeuristicPromiseExtractor();

  async generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const candidates = await this.extractor.extract(asSinglePageDocument(request.documentText));

    const payload = {
      candidatePromises: candidates.map((candidate) => ({
        originalText: candidate.quote,
        normalizedStatement: candidate.normalizedStatement ?? null,
        suggestedTitle: candidate.suggestedTitle ?? candidate.quote.slice(0, 120),
        topic: candidate.topic ?? "OTHER",
        deadlineText: null,
        specificityScore: UNKNOWN_SCORE,
        measurabilityScore: UNKNOWN_SCORE,
        deadlineScore: UNKNOWN_SCORE,
        jurisdictionScore: UNKNOWN_SCORE,
        outcomeDefinitionScore: UNKNOWN_SCORE,
        reasoningSummary: candidate.reasoning ?? "Heuristika: věta obsahuje sloveso závazku.",
        sourceExcerpt: candidate.quote,
      })),
    };

    // Projde tímtéž schématem jako odpověď modelu — jinak by se testovalo něco
    // jiného, než co poteče produkcí.
    const parsed = request.schema.safeParse(payload);
    if (!parsed.success) {
      throw new AIProviderError("Heuristický dodavatel nedodržel schéma úlohy.");
    }

    return {
      data: parsed.data,
      model: BASELINE_VERSION,
      inputTokens: null,
      outputTokens: null,
      costUsd: "0.000000",
    };
  }
}
