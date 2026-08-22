/**
 * Celý dataset najednou.
 *
 *   GET /api/v1/export             JSON se všemi publikovanými sliby
 *   GET /api/v1/export?format=csv  plochá tabulka, slib na řádek
 *
 * Bez tohohle si analytik musí data složit ze stránkovaného seznamu, což je
 * první věc, která ho odradí. Stránkování se tu obchází projitím všech stránek
 * touž funkcí jako jinde — vlastní dotaz by znamenal druhé místo, kde se
 * rozhoduje, co je veřejné.
 */
import { db } from "@/db/client";
import { publicHeaders, jsonResponse } from "@/app/api/v1/_shared";
import {
  API_VERSION,
  DATASET_LICENCE,
  toCsv,
  toPublicSummary,
  type PublicPromiseSummary,
} from "@/modules/api/publicDataset";
import { parsePromiseFilters } from "@/modules/promises/filters";
import { listPublishedPromises } from "@/modules/promises/queries";

export const dynamic = "force-dynamic";

/** Pojistka proti nekonečnému cyklu, kdyby dotaz někdy začal vracet prázdno. */
const MAX_PAGES = 500;

async function loadAll(params: Record<string, string>): Promise<PublicPromiseSummary[]> {
  const items: PublicPromiseSummary[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await listPublishedPromises(
      db,
      parsePromiseFilters({ ...params, page: String(page) }),
    );
    items.push(...result.items.map(toPublicSummary));
    if (page >= result.pageCount) break;
  }

  return items;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const promises = await loadAll(params);

  if (url.searchParams.get("format") === "csv") {
    return new Response(toCsv(promises), {
      headers: {
        ...publicHeaders("text/csv; charset=utf-8"),
        "content-disposition": 'attachment; filename="slib-skutek-sliby.csv"',
      },
    });
  }

  return jsonResponse({
    version: API_VERSION,
    licence: DATASET_LICENCE,
    generatedAt: new Date().toISOString(),
    total: promises.length,
    promises,
  });
}
