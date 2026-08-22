/**
 * Metriky a naměřené hodnoty.
 *
 * Pravidlo A2 z briefu říká, že bez metriky je „splněno" jen názor redaktora.
 * Tabulky `promise_metric` a `metric_measurement` jsou ve schématu od začátku,
 * ale nikdo do nich nezapisoval — slib „navýšíme platy o miliardu" tak zůstával
 * nedoložený, přestože odpověď leží v otevřených datech města.
 *
 * Zásadní je, **odkud hodnota pochází**. Měření bez zdroje by bylo číslo, které
 * si někdo vymyslel, proto je `sourceDocumentId` povinné už v databázi. Hodnota
 * spočítaná z tabulky navíc nese v poznámce přesný postup: filtr, sloupec
 * a počet sečtených řádků. Kdo si to chce přepočítat, má z čeho.
 *
 * Co se tu **nedělá**: závěr. Že rozpočtová položka vzrostla o miliardu,
 * neznamená, že město slib splnilo — u přímých nákladů školství jde z velké
 * části o státní transfer. Přisouzení je redakční úsudek a zůstává u člověka.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { metricDirectionEnum } from "@/db/enums";
import type { AppDatabase } from "@/db/types";
import { metricMeasurements, promiseMetrics } from "@/modules/promises/schema";
import { parseRenderedRow } from "@/modules/ingestion/tabular";
import { auditLogs } from "@/modules/review/schema";
import { EditorialError, parseEditorialInput, type Actor } from "@/modules/review/service";
import { sourceDocuments } from "@/modules/sources/schema";

const numericString = z
  .union([z.number(), z.string()])
  .transform((value) => String(value))
  .refine((value) => Number.isFinite(Number(value)), "Hodnota musí být číslo.");

export const metricInputSchema = z.object({
  promiseId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  /** Jednotka podle zdroje, ne podle toho, co se hezky čte. */
  unit: z.string().trim().min(1).max(60),
  direction: z.enum(metricDirectionEnum.enumValues),
  baselineValue: numericString.optional(),
  baselineOn: z.iso.date().optional(),
  targetValue: numericString.optional(),
  targetOn: z.iso.date().optional(),
  definitionNote: z.string().trim().max(4000).optional(),
});

export type MetricInput = z.input<typeof metricInputSchema>;

export async function defineMetric(
  db: AppDatabase,
  actor: Actor,
  rawInput: MetricInput,
): Promise<string> {
  const input = parseEditorialInput(metricInputSchema, rawInput);

  const [created] = await db
    .insert(promiseMetrics)
    .values({
      promiseId: input.promiseId,
      name: input.name,
      unit: input.unit,
      direction: input.direction,
      baselineValue: input.baselineValue ?? null,
      baselineOn: input.baselineOn ?? null,
      targetValue: input.targetValue ?? null,
      targetOn: input.targetOn ?? null,
      definitionNote: input.definitionNote?.trim() || null,
    })
    .returning({ id: promiseMetrics.id });

  if (!created) throw new EditorialError("Metriku se nepodařilo uložit.");

  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "metric.define",
    entityType: "promise_metric",
    entityId: created.id,
    afterJson: { promiseId: input.promiseId, name: input.name, unit: input.unit },
  });

  return created.id;
}

export interface ComputeFromTableInput {
  metricId: string;
  sourceDocumentId: string;
  /** Sloupec, jehož hodnoty se sčítají. */
  valueColumn: string;
  /** Sloupec, podle kterého se řádky seskupí — typicky rok. */
  groupColumn: string;
  /** Řádek se počítá, jen když tenhle sloupec obsahuje daný text. */
  filters: { column: string; contains: string }[];
}

export interface ComputedMeasurement {
  group: string;
  value: number;
  rows: number;
}

/**
 * Součet čísel z uložené tabulky, seskupený po skupinách (obvykle po letech).
 *
 * Počítá se z **uloženého** dokumentu, ne ze souboru na disku: to, co se
 * publikuje, se pak dá dohledat k otisku, který v databázi je.
 */
export function computeFromRows(
  lines: string[],
  input: Omit<ComputeFromTableInput, "metricId" | "sourceDocumentId">,
): ComputedMeasurement[] {
  const totals = new Map<string, { value: number; rows: number }>();

  for (const line of lines) {
    const row = parseRenderedRow(line);
    if (!row) continue;

    const matches = input.filters.every((filter) =>
      (row[filter.column] ?? "").toLowerCase().includes(filter.contains.toLowerCase()),
    );
    if (!matches) continue;

    const group = row[input.groupColumn];
    const raw = row[input.valueColumn];
    if (!group || !raw) continue;

    const value = Number(raw.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(value)) continue;

    const current = totals.get(group) ?? { value: 0, rows: 0 };
    totals.set(group, { value: current.value + value, rows: current.rows + 1 });
  }

  return [...totals.entries()]
    .map(([group, sum]) => ({ group, value: Number(sum.value.toFixed(4)), rows: sum.rows }))
    .sort((a, b) => a.group.localeCompare(b.group, "cs"));
}

export interface ComputeResult {
  measurements: ComputedMeasurement[];
  skippedGroups: string[];
  /** Nálezy, které vypadají na chybu ve filtru. Nezastavují, ale musí být vidět. */
  warnings: string[];
}

/**
 * Pojistka proti dvojímu započtení.
 *
 * Rozpočtová data drží souhrny i položky vedle sebe: tatáž miliarda je jednou
 * jako výdaj školství (20 řádků) a jednou jako jeden řádek přijatého transferu.
 * Filtr, který chytí obojí, dá dvojnásobek — a číslo přitom vypadá naprosto
 * věrohodně.
 *
 * Hledá se proto **přesný otisk** té chyby: jeden řádek, který se rovná součtu
 * všech ostatních. První pokus varoval, kdykoli jedna položka tvořila přes
 * 40 % součtu — jenže to u rozpočtu běžně nastane i bez chyby (základní školy
 * jsou prostě největší položka školství) a varování pak vyskočilo i nad
 * správným filtrem. Planý poplach je horší než žádný: naučí redakci varování
 * přehlížet.
 */
function detectDoubleCounting(lines: string[], input: ComputeInput, group: string): boolean {
  const values: number[] = [];

  for (const line of lines) {
    const row = parseRenderedRow(line);
    if (!row || row[input.groupColumn] !== group) continue;
    if (
      !input.filters.every((f) =>
        (row[f.column] ?? "").toLowerCase().includes(f.contains.toLowerCase()),
      )
    ) {
      continue;
    }
    const value = Number((row[input.valueColumn] ?? "").replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(value)) values.push(value);
  }

  /**
   * U tří položek je „jedna se rovná součtu zbylých dvou" běžná shoda okolností
   * (100 = 60 + 40). U desítek položek už ne. Práh je tu proto, aby varování
   * neztratilo váhu.
   */
  if (values.length < 4) return false;

  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return false;

  // Tolerance na zaokrouhlení: souhrnný řádek bývá zaokrouhlený jinak než
  // součet položek, ale rozdíl je v promilích, ne v procentech.
  return values.some((value) => Math.abs(value * 2 - total) / total < 0.01);
}

type ComputeInput = Omit<ComputeFromTableInput, "metricId" | "sourceDocumentId">;

/**
 * Postup výpočtu k naměřené hodnotě.
 *
 * Bez něj je to jen číslo, kterému se dá věřit nebo nevěřit. S ním se dá
 * přepočítat — a to je u tvrzení o politicích rozdíl mezi doloženým a tvrzeným.
 */
function describeMeasurement(
  item: ComputedMeasurement,
  input: ComputeInput,
  filters: string,
): string {
  return `Součet sloupce ${input.valueColumn} přes ${item.rows} řádků (${filters}).`;
}

export async function computeMeasurementsFromTable(
  db: AppDatabase,
  actor: Actor,
  input: ComputeFromTableInput,
): Promise<ComputeResult> {
  const [metric] = await db
    .select({ id: promiseMetrics.id })
    .from(promiseMetrics)
    .where(eq(promiseMetrics.id, input.metricId))
    .limit(1);
  if (!metric) throw new EditorialError("Metrika neexistuje.");

  const [source] = await db
    .select({ rawText: sourceDocuments.rawText })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, input.sourceDocumentId))
    .limit(1);
  if (!source?.rawText) {
    throw new EditorialError("Zdroj nemá uložený text, takže z něj nejde nic spočítat.");
  }

  const lines = source.rawText.split("\n");
  const computed = computeFromRows(lines, input);
  if (computed.length === 0) {
    throw new EditorialError(
      "Filtru nevyhověl žádný řádek. Zkontroluj názvy sloupců a hledaný text.",
    );
  }

  const describeFilters = input.filters
    .map((filter) => `${filter.column} obsahuje „${filter.contains}"`)
    .join(", ");

  const skippedGroups: string[] = [];
  const warnings: string[] = [];

  for (const item of computed) {
    if (detectDoubleCounting(lines, input, item.group)) {
      warnings.push(
        `${item.group}: jeden řádek se rovná součtu všech ostatních — nejspíš se sčítá souhrn s položkami. V rozpočtu města bývá tatáž částka i jako přijatý transfer; přidej filtr na oblast.`,
      );
    }
  }

  for (const item of computed) {
    // Skupina je typicky rok; datum měření je jeho konec, protože hodnota
    // popisuje celé období, ne jeden den.
    const measuredOn = /^\d{4}$/.test(item.group) ? `${item.group}-12-31` : null;
    if (!measuredOn) {
      skippedGroups.push(item.group);
      continue;
    }

    await db
      .insert(metricMeasurements)
      .values({
        metricId: input.metricId,
        value: String(item.value),
        measuredOn,
        sourceDocumentId: input.sourceDocumentId,
        note: describeMeasurement(item, input, describeFilters),
      })
      // Tentýž rok z téhož dokumentu se nezapisuje dvakrát; přepočet ale musí
      // jít spustit znovu, když se dataset opraví.
      .onConflictDoUpdate({
        target: [
          metricMeasurements.metricId,
          metricMeasurements.measuredOn,
          metricMeasurements.sourceDocumentId,
        ],
        set: {
          value: String(item.value),
          note: describeMeasurement(item, input, describeFilters),
        },
      });
  }

  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "metric.compute",
    entityType: "promise_metric",
    entityId: input.metricId,
    afterJson: {
      sourceDocumentId: input.sourceDocumentId,
      filters: input.filters,
      groups: computed.length,
    },
  });

  return { measurements: computed, skippedGroups, warnings };
}

/** Metriky slibu i s tím, kolik hodnot k nim je. Pro redakční přehled. */
export async function listMetrics(db: AppDatabase, promiseId: string) {
  return db
    .select({
      id: promiseMetrics.id,
      name: promiseMetrics.name,
      unit: promiseMetrics.unit,
      direction: promiseMetrics.direction,
      baselineValue: promiseMetrics.baselineValue,
      targetValue: promiseMetrics.targetValue,
    })
    .from(promiseMetrics)
    .where(and(eq(promiseMetrics.promiseId, promiseId)))
    .orderBy(promiseMetrics.name);
}
