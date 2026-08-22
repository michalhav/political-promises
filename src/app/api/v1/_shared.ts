/**
 * Společné pro veřejné API.
 *
 * Data jsou veřejná a určená k dalšímu použití, takže hlavičky říkají tři věci:
 * kdokoli je smí načíst z prohlížeče (CORS), krátce se smí ukládat do mezipaměti
 * a pod jakou licencí platí.
 */
import { DATASET_LICENCE } from "@/modules/api/publicDataset";

/** Pět minut. Obsah se mění redakční prací, ne po sekundách. */
const CACHE_SECONDS = 300;

export function publicHeaders(contentType: string): HeadersInit {
  return {
    "content-type": contentType,
    "cache-control": `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=60`,
    // Veřejná data ke čtení. Bez tohohle je z prohlížeče nenačte nikdo.
    "access-control-allow-origin": "*",
    link: `<${DATASET_LICENCE.dataUrl}>; rel="license"`,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: publicHeaders("application/json; charset=utf-8"),
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}
