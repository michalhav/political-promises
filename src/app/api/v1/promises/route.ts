/**
 * Seznam publikovaných slibů.
 *
 *   GET /api/v1/promises?list=praha-sobe-2022&topic=TRANSPORT&page=2
 *
 * Filtry jsou tytéž jako ve veřejném přehledu — sdílí se `parsePromiseFilters`,
 * takže se API a stránka nemůžou rozejít v tom, co která považuje za platný
 * filtr.
 */
import { db } from "@/db/client";
import { jsonResponse } from "@/app/api/v1/_shared";
import { API_VERSION, DATASET_LICENCE, toPublicSummary } from "@/modules/api/publicDataset";
import { parsePromiseFilters } from "@/modules/promises/filters";
import { listPublishedPromises } from "@/modules/promises/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filters = parsePromiseFilters(params);
  const result = await listPublishedPromises(db, filters);

  return jsonResponse({
    version: API_VERSION,
    licence: DATASET_LICENCE,
    page: result.page,
    pageSize: result.pageSize,
    pageCount: result.pageCount,
    total: result.total,
    promises: result.items.map(toPublicSummary),
  });
}
