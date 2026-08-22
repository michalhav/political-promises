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
  /**
   * Tajný klíč pro otisky IP adres.
   *
   * Bez něj by otisk nebyl otisk: adres IPv4 je 4,3 miliardy, takže projít
   * všechny a porovnat je otázka minut na jednom jádru a sekund na grafické
   * kartě. Kdo by získal databázi, přečetl by z ní adresy všech, kdo nám psali.
   *
   * Povinný a bez výchozí hodnoty schválně. Výchozí hodnota by byla veřejná,
   * a tím pádem k ničemu — a nikdo by nepoznal, že ochrana nefunguje.
   * Vygeneruj: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   *
   * Změna klíče znehodnotí existující otisky. U počítadel to nevadí: obě okna
   * (15 minut u přihlášení, hodina u podnětů) jsou kratší než jakákoli rotace.
   */
  IP_HASH_SECRET: z
    .string()
    .min(32, "IP_HASH_SECRET musí mít aspoň 32 znaků. Vygeneruj náhodný, ne heslo."),
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

/**
 * Tajný klíč pro otisky IP — samostatně.
 *
 * Doménová vrstva ho potřebuje, ale nepotřebuje připojení k databázi. Kdyby si
 * ho brala přes `getEnv()`, vynutila by si ověření celého prostředí a otisk
 * adresy by nešlo spočítat bez `DATABASE_URL`, se kterým nemá nic společného.
 *
 * Validace zůstává tady, v hraničním modulu — dvě místa, kde se ověřuje táž
 * proměnná, by se dřív nebo později rozešla.
 */
let cachedIpHashSecret: string | null = null;

export function getIpHashSecret(): string {
  if (cachedIpHashSecret) return cachedIpHashSecret;

  const parsed = envSchema.shape.IP_HASH_SECRET.safeParse(process.env.IP_HASH_SECRET);
  if (!parsed.success) {
    throw new Error(
      `Neplatná konfigurace prostředí:
  IP_HASH_SECRET: ${parsed.error.issues[0]?.message ?? "chybí"}`,
    );
  }

  cachedIpHashSecret = parsed.data;
  return cachedIpHashSecret;
}
