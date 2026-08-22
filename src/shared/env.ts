/**
 * Validace prostředí na hranici systému. Pouze server — nikdy neimportovat
 * z klientské komponenty. Chybějící proměnná musí spadnout hned při startu,
 * ne až v půlce requestu.
 */
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL chybí. Zkopíruj .env.example do .env."),
  AI_PROVIDER: z.enum(["fixture", "local", "anthropic"]).default("fixture"),
  /**
   * Velikost poolu. Výchozí hodnota platí pro běžný Postgres; E2E běh proti
   * PGlite přes wire protokol zvládne jen jedno spojení, proto jde snížit.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Adresa lokálního modelu (Ollama). Výchozí hodnota odpovídá běžné instalaci. */
  AI_LOCAL_URL: z.string().url().default("http://localhost:11434"),
  /** Model, který se má použít. Musí být stažený (`ollama pull`). */
  AI_LOCAL_MODEL: z.string().min(1).default("qwen3:8b"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Neplatná konfigurace prostředí:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
