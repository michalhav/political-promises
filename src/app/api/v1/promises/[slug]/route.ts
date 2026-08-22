/**
 * Jeden slib se vším, co je o něm doložené.
 *
 *   GET /api/v1/promises/praha-sobe-nove-mosty-pres-vltavu
 *
 * Čte se toutéž funkcí jako veřejná stránka, takže platí totéž omezení: co není
 * publikované a ověřené, se sem nedostane.
 */
import { db } from "@/db/client";
import { errorResponse, jsonResponse } from "@/app/api/v1/_shared";
import { API_VERSION, DATASET_LICENCE, toPublicDetail } from "@/modules/api/publicDataset";
import { getPublishedPromiseDetail } from "@/modules/promises/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;
  const detail = await getPublishedPromiseDetail(db, slug);

  if (!detail) return errorResponse("Takový zveřejněný slib neexistuje.", 404);

  return jsonResponse({
    version: API_VERSION,
    licence: DATASET_LICENCE,
    promise: toPublicDetail(detail),
  });
}
