/**
 * Dodavatel Anthropic.
 *
 * Dvě věci, na kterých tu stojí důvěryhodnost:
 *
 * 1. **Strukturovaný výstup.** Odpověď se validuje Zod schématem přímo v SDK
 *    (`messages.parse` + `zodOutputFormat`). Volný text se nikam nedostane.
 * 2. **Dokument je vstup, ne instrukce.** Text nahraného PDF je cizí obsah;
 *    prompt injection přes volební program je reálný vektor, ne teoretický.
 *    Systémový prompt to říká výslovně a text jde do samostatného bloku za
 *    značkou — model nemá důvod považovat větu uvnitř dokumentu za příkaz.
 *    Skutečnou pojistkou ale není prompt: je jí kontrola, že každá citace
 *    stojí doslova ve zdroji (viz `extractPromises`).
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  AIProviderError,
  type AIProvider,
  type StructuredRequest,
  type StructuredResult,
} from "@/modules/ai/provider";

/** Ceník v USD za milion tokenů. Drží se u modelu, ať je cena běhu dohledatelná. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const DEFAULT_MODEL = "claude-opus-5";

function estimateCost(model: string, input: number | null, output: number | null): string | null {
  const price = PRICING[model];
  if (!price || input === null || output === null) return null;

  const usd = (input / 1_000_000) * price.input + (output / 1_000_000) * price.output;
  return usd.toFixed(6);
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  request.instruction,
                  "",
                  "<dokument>",
                  request.documentText,
                  "</dokument>",
                ].join("\n"),
              },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(request.schema) },
      });

      if (response.stop_reason === "refusal") {
        throw new AIProviderError(
          "Model odpověď odmítl. U volebního programu to bývá tématem dokumentu; zpracuj ho ručně.",
        );
      }

      if (response.parsed_output === null || response.parsed_output === undefined) {
        throw new AIProviderError("Odpověď modelu neodpovídá očekávanému schématu.");
      }

      const inputTokens = response.usage.input_tokens ?? null;
      const outputTokens = response.usage.output_tokens ?? null;

      return {
        data: response.parsed_output,
        model: response.model,
        inputTokens,
        outputTokens,
        costUsd: estimateCost(response.model, inputTokens, outputTokens),
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;

      if (error instanceof Anthropic.RateLimitError) {
        throw new AIProviderError("Dodavatel hlásí překročený limit. Zkus to za chvíli.", {
          cause: error,
        });
      }
      if (error instanceof Anthropic.AuthenticationError) {
        throw new AIProviderError("ANTHROPIC_API_KEY není platný.", { cause: error });
      }
      if (error instanceof Anthropic.APIError) {
        throw new AIProviderError(`Dodavatel vrátil chybu ${error.status}.`, { cause: error });
      }

      throw new AIProviderError("Volání modelu selhalo.", { cause: error });
    }
  }
}
