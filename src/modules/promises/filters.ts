/**
 * Filtry Promise Exploreru.
 *
 * Query string je vstup od uživatele, tedy nedůvěryhodná data na hranici
 * systému. Neplatná hodnota ale nesmí shodit stránku — kdokoli může poslat
 * `?topic=cokoli`. Proto se každé pole validuje zvlášť a při nesmyslu tiše
 * vypadne, místo aby celý dotaz selhal.
 */
import { z } from "zod";

import { assessabilityEnum, executionStatusEnum, topicEnum } from "@/db/enums";

export const promiseFiltersSchema = z.object({
  list: z.string().trim().min(1).max(120).optional().catch(undefined),
  topic: z.enum(topicEnum.enumValues).optional().catch(undefined),
  execution: z.enum(executionStatusEnum.enumValues).optional().catch(undefined),
  assessability: z.enum(assessabilityEnum.enumValues).optional().catch(undefined),
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type PromiseFilters = z.infer<typeof promiseFiltersSchema>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Z opakovaného parametru bereme první hodnotu; víc filtrů téhož druhu nepodporujeme. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePromiseFilters(params: RawSearchParams): PromiseFilters {
  return promiseFiltersSchema.parse({
    list: firstValue(params.list),
    topic: firstValue(params.topic),
    execution: firstValue(params.execution),
    assessability: firstValue(params.assessability),
    q: firstValue(params.q),
    page: firstValue(params.page) ?? 1,
  });
}

/** Odkazy ve filtrech: současný stav plus jedna změna. */
export function buildFilterHref(filters: PromiseFilters, change: Partial<PromiseFilters>): string {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();

  if (next.list) params.set("list", next.list);
  if (next.topic) params.set("topic", next.topic);
  if (next.execution) params.set("execution", next.execution);
  if (next.assessability) params.set("assessability", next.assessability);
  if (next.q) params.set("q", next.q);
  // Změna filtru vždy vrací na první stránku; jiná by nemusela existovat.
  if (next.page > 1 && change.page !== undefined) params.set("page", String(next.page));

  const query = params.toString();
  return query ? `/promises?${query}` : "/promises";
}

export function hasActiveFilters(filters: PromiseFilters): boolean {
  return Boolean(
    filters.list ?? filters.topic ?? filters.execution ?? filters.assessability ?? filters.q,
  );
}
