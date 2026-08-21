/**
 * Výběr dodavatele podle prostředí.
 *
 * Výchozí je heuristika, ne model: běh, který stojí peníze, se musí zapnout
 * vědomě. Ve vývoji a v testech tak nejde omylem prostřílet rozpočet.
 */
import { AnthropicProvider } from "@/modules/ai/anthropicProvider";
import { HeuristicProvider } from "@/modules/ai/heuristicProvider";
import { AIProviderError, type AIProvider } from "@/modules/ai/provider";
import { getEnv } from "@/shared/env";

export function getAIProvider(): AIProvider {
  const env = getEnv();

  switch (env.AI_PROVIDER) {
    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) {
        throw new AIProviderError(
          "AI_PROVIDER=anthropic vyžaduje ANTHROPIC_API_KEY. Bez klíče nech AI_PROVIDER=fixture.",
        );
      }
      return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
    }
    case "local":
      throw new AIProviderError(
        "Lokální model zatím napojený není. Použij fixture (heuristika) nebo anthropic.",
      );
    case "fixture":
    default:
      return new HeuristicProvider();
  }
}
