/**
 * Manifest zdrojů — deklarace toho, jaké dokumenty projekt potřebuje.
 *
 * Do teď byla akvizice **příkaz, který někdo jednou napsal do terminálu**.
 * Provenience vzniká až jako výsledek stažení, takže dokument, který se nikdy
 * nestáhl, nezanechá v repozitáři žádnou stopu — a nikdo se nedozví, že chybí.
 * Přesně tak zmizel `corpus/zakazky-mosty`: existoval na jednom stroji a
 * `npm run dev:pglite -- --praha` u kohokoli jiného tiše naplní nula dokladů.
 *
 * Manifest ten rozdíl ruší. Deklaruje, **co chceme**; souborový systém říká,
 * **co máme**; `corpus:sync` obojí porovná. Od té chvíle je „chybí nám doklad"
 * stav repozitáře, ne informace v něčí hlavě.
 *
 * Stav se schválně **neukládá**. Kdyby v JSONu stálo `"status": "FROZEN"`,
 * byla by to druhá pravda vedle adresáře a rozešly by se — stav se proto vždy
 * odvozuje z toho, co na disku opravdu leží.
 */
import { z } from "zod";

import { licenseModeEnum, sourceTypeEnum } from "@/db/enums";

/**
 * Článek řetězu, kvůli kterému dokument sbíráme.
 *
 * Není to jen štítek: dokument, který nepatří do žádného článku, nemá důvod
 * v korpusu být, a chybějící článek je vidět jako díra v pokrytí.
 */
export const chainLinkSchema = z.enum([
  /** Co strana slíbila, doslova. */
  "PROMISE",
  /** Kdo volby vyhrál a s jakou silou. */
  "MANDATE",
  /** Je slib převzatý do programu vlády města? */
  "COALITION",
  /** Rozhodla o tom rada nebo zastupitelstvo? */
  "DECISION",
  /** Dalo na to město peníze? */
  "BUDGET",
  /** Zadalo to město někomu? */
  "CONTRACT",
  /** Stalo se to doopravdy? */
  "OUTCOME",
]);

export type ChainLink = z.infer<typeof chainLinkSchema>;

const baseEntry = z.object({
  /** Adresář v korpusu. Zároveň identita záznamu — musí být unikátní. */
  dir: z.string().regex(/^corpus\/[a-z0-9-]+$/, "dir musí být tvaru corpus/nazev-dokumentu"),
  chainLink: chainLinkSchema,
  /** Proč ho potřebujeme. Bez odpovědi zdroj do manifestu nepatří. */
  why: z.string().min(10),
  url: z.url(),
  title: z.string().min(1),
  publisher: z.string().min(1),
  sourceType: z.enum(sourceTypeEnum.enumValues),
  license: z.enum(licenseModeEnum.enumValues).default("FULL_TEXT_STORED"),
  publishedAt: z.iso.date().optional(),
  /**
   * Proč zdroj ještě nejde stáhnout, i když ho potřebujeme.
   *
   * Chybějící nástroj je taky nález. Zapsat ho je poctivější než zdroj
   * z manifestu vynechat a tvářit se, že pokrytí je úplné.
   */
  blockedBy: z.string().min(10).optional(),
});

/** Dokument ke stažení tak, jak je (`corpus:add`). */
const documentEntry = baseEntry.extend({ kind: z.literal("DOCUMENT") });

/** Výřez tabulky (`corpus:table`) — jeden řádek tabulky na jeden řádek textu. */
const tableEntry = baseEntry.extend({
  kind: z.literal("TABLE"),
  /** Regulární výraz nad řádky. Výběr je redakční rozhodnutí, proto je v manifestu. */
  match: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  limit: z.number().int().min(1).max(50_000).optional(),
});

export const manifestEntrySchema = z.discriminatedUnion("kind", [documentEntry, tableEntry]);
export type ManifestEntry = z.infer<typeof manifestEntrySchema>;

export const manifestSchema = z.object({
  version: z.literal(1),
  sources: z
    .array(manifestEntrySchema)
    .min(1)
    .refine(
      (entries) => new Set(entries.map((entry) => entry.dir)).size === entries.length,
      "dva záznamy míří do stejného adresáře",
    ),
});

export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(value: unknown): Manifest {
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  sources.json → ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Manifest zdrojů je neplatný:\n${issues}`);
  }
  return parsed.data;
}

export interface ReconciliationReport {
  /** Deklarované a stažené. */
  frozen: ManifestEntry[];
  /** Deklarované, ale v korpusu nejsou. Tohle je ta díra v datech. */
  missing: ManifestEntry[];
  /** Deklarované a vědomě zablokované — chybí, ale víme proč. */
  blocked: ManifestEntry[];
  /** V korpusu leží, ale nikdo je nedeklaroval. Odkud se vzaly? */
  undeclared: string[];
}

/**
 * Porovná manifest se skutečností.
 *
 * Čistá funkce nad dvěma seznamy — souborový systém řeší volající. Díky tomu
 * jde smíření testovat bez korpusu na disku.
 *
 * `present` jsou adresáře, které mají `provenance.json`; adresář bez ní není
 * stažený dokument, ale rozdělaná práce.
 */
export function reconcile(manifest: Manifest, present: readonly string[]): ReconciliationReport {
  const presentSet = new Set(present);
  const declared = new Set(manifest.sources.map((entry) => entry.dir));

  const report: ReconciliationReport = { frozen: [], missing: [], blocked: [], undeclared: [] };

  for (const entry of manifest.sources) {
    if (presentSet.has(entry.dir)) report.frozen.push(entry);
    else if (entry.blockedBy) report.blocked.push(entry);
    else report.missing.push(entry);
  }

  report.undeclared = present.filter((dir) => !declared.has(dir)).sort();

  return report;
}

/**
 * Příkaz, kterým se chybějící zdroj pořídí.
 *
 * Sync ho vypíše místo toho, aby stahoval sám: stažení je nevratný zápis do
 * korpusu, u kterého se rozhoduje licence, a to má zůstat vědomý krok člověka.
 */
export function acquisitionCommand(entry: ManifestEntry): string {
  const parts = [
    entry.kind === "TABLE" ? "npm run corpus:table --" : "npm run corpus:add --",
    quote(entry.url),
    `--dir ${entry.dir}`,
    `--title ${quote(entry.title)}`,
    `--publisher ${quote(entry.publisher)}`,
    `--type ${entry.sourceType}`,
  ];

  if (entry.license !== "FULL_TEXT_STORED") parts.push(`--license ${entry.license}`);
  if (entry.publishedAt) parts.push(`--published-at ${entry.publishedAt}`);

  if (entry.kind === "TABLE") {
    parts.push(`--match ${quote(entry.match)}`, `--columns ${entry.columns.join(",")}`);
    if (entry.limit) parts.push(`--limit ${entry.limit}`);
  }

  return parts.join(" \\\n  ");
}

function quote(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}
