/**
 * Model běžící na vlastním stroji (Ollama).
 *
 * Placené API u téhle úlohy není drahé, ale zbytečné: sestavit slovník výrazů
 * ke slibu je práce, na kterou osmimiliardový model stačí. Lokální běh navíc
 * dovolí zkoušet prompty a schémata bez ohlížení na útratu — a data z korpusu
 * přitom neopustí stroj, což je u cizích dokumentů příjemný vedlejší efekt.
 *
 * Mluví se **nativním** rozhraním Ollamy (`/api/chat`), ne vrstvou
 * kompatibilní s OpenAI. Důvod je jediný: `format` bere přímo JSON Schema,
 * takže se dá poslat to, co vygeneruje Zod, a odpověď se pak týmž schématem
 * ověří. Žádný převod mezi dvěma tvary schématu, žádná další závislost.
 *
 * Výstupu se ani tady nevěří: schéma se kontroluje stejně jako u placeného
 * dodavatele. Menší model chybuje víc, ne míň.
 */
import { z } from "zod";

import {
  AIProviderError,
  type AIProvider,
  type StructuredRequest,
  type StructuredResult,
} from "@/modules/ai/provider";

/**
 * Lokální model na spotřebním GPU odpovídá v desítkách sekund, ne v jednotkách.
 * Krátký timeout by ho utnul uprostřed odpovědi a vypadalo by to jako chyba.
 */
const REQUEST_TIMEOUT_MS = 180_000;

const responseSchema = z.object({
  message: z.object({ content: z.string() }),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
});

export class LocalProvider implements AIProvider {
  readonly name = "local";
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: { baseUrl: string; model: string }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model;
  }

  async generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const body = {
      model: this.model,
      messages: [
        { role: "system", content: request.system },
        {
          role: "user",
          content: [
            request.instruction,
            "",
            "<dokument>",
            request.documentText,
            "</dokument>",
          ].join("\n"),
        },
      ],
      // Odpověď se vynutí schématem, ne prosbou v promptu.
      format: z.toJSONSchema(request.schema),
      stream: false,
      /**
       * Uvažování vypnuté.
       *
       * Modely řady qwen3 přemýšlejí nahlas, než odpovědí. U vytěžování jmen
       * z jedné věty to nic nepřidá a měřitelně škodí: první běh nad slibem
       * o mostech trval 159 s a vrátil prázdné seznamy — model spotřeboval
       * budget na úvahy a na odpověď zbylo minimum. U modelu bez uvažování
       * je pole ignorované.
       */
      think: false,
      // Nulová teplota: u vytěžování a slovníku je rozmanitost na škodu.
      options: { temperature: 0, num_predict: request.maxTokens },
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AIProviderError(
        `Lokální model na ${this.baseUrl} neodpovídá. Běží Ollama (\`ollama serve\`)?`,
        { cause: error },
      );
    }

    if (response.status === 404) {
      throw new AIProviderError(
        `Ollama nezná model „${this.model}". Stáhni ho (\`ollama pull ${this.model}\`) nebo změň AI_LOCAL_MODEL.`,
      );
    }
    if (!response.ok) {
      throw new AIProviderError(`Lokální model vrátil chybu ${response.status}.`);
    }

    const parsedResponse = responseSchema.safeParse(await response.json());
    if (!parsedResponse.success) {
      throw new AIProviderError("Odpověď Ollamy nemá očekávaný tvar.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(parsedResponse.data.message.content);
    } catch (error) {
      // Menší modely občas schéma nedodrží a přilepí k JSONu vysvětlení.
      throw new AIProviderError("Model nevrátil platný JSON. Zkus jiný model nebo kratší vstup.", {
        cause: error,
      });
    }

    const data = request.schema.safeParse(payload);
    if (!data.success) {
      throw new AIProviderError(
        `Odpověď modelu neodpovídá schématu úlohy: ${data.error.issues[0]?.message ?? "neznámý rozpor"}.`,
      );
    }

    return {
      data: data.data,
      model: `${this.model} (local)`,
      inputTokens: parsedResponse.data.prompt_eval_count ?? null,
      outputTokens: parsedResponse.data.eval_count ?? null,
      // Vlastní hardware. Elektřinu si tenhle projekt neúčtuje.
      costUsd: "0.000000",
    };
  }
}
