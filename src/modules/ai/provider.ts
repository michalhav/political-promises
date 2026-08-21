/**
 * Hranice mezi aplikací a jazykovým modelem.
 *
 * Aplikace nesmí být přišitá k jednomu dodavateli, a hlavně: **model nikdy
 * nevrací text, kterému by se věřilo.** Vrací JSON, který projde Zod schématem;
 * co schématem neprojde, jako by nepřišlo.
 *
 * Rozhraní je úmyslně jednorázové (jeden vstup → jedna strukturovaná odpověď).
 * Agentní smyčka ani nástroje tu nemají co dělat — vytěžování slibů je
 * klasifikační úloha nad textem, ne úkol, který by měl model sám rozhodovat,
 * jak splní.
 */
import type { z } from "zod";

export interface StructuredRequest<T> {
  /** Verze promptu z kódu, ne volný text — jinak nejde porovnat kvalita běhů. */
  promptVersion: string;
  system: string;
  /** Text dokumentu. Pro model jsou to **data**, nikdy instrukce. */
  documentText: string;
  instruction: string;
  schema: z.ZodType<T>;
  maxTokens: number;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  /** Numeric jako řetězec, ať se po cestě neztratí přesnost. */
  costUsd: string | null;
}

export interface AIProvider {
  readonly name: string;
  generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

/** Chyba dodavatele. Redaktorovi se ukazuje hláška, ne stack trace. */
export class AIProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AIProviderError";
  }
}
