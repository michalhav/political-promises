/**
 * Program → koaliční smlouva.
 *
 * A7 — vědomé rozhodnutí: stránka nikdy nezobrazí počty klasifikací ani dvě
 * kandidátky vedle sebe. Sloupec „NOT_INCLUDED: 7" je fakticky žebříček
 * důvěryhodnosti, což zakazuje integritní pravidlo č. 10. Ukazujeme proto vždy
 * jednu kandidátku, slib po slibu, s citací z koaliční smlouvy — čtenář si
 * srovnání udělá sám z textů, ne z čísla, které jsme mu předpočítali.
 */
import { and, asc, eq, isNull } from "drizzle-orm";

import type { AppDatabase } from "@/db/types";
import type { CoalitionClassification } from "@/modules/coalition/labels";
import { coalitionPromiseMappings } from "@/modules/coalition/schema";
import { evidence } from "@/modules/evidence/schema";
import { electoralLists } from "@/modules/parties/schema";
import type { Topic } from "@/modules/promises/labels";
import { promises, promiseSources } from "@/modules/promises/schema";
import type { ElectoralListRef, SourceRef } from "@/modules/promises/queries";
import { listElectoralListOptions } from "@/modules/promises/queries";
import { sourceDocuments } from "@/modules/sources/schema";

export interface ComparisonItem {
  promiseSlug: string;
  promiseTitle: string;
  topic: Topic;
  /** Doslovné znění z volebního programu. */
  originalText: string;
  classification: CoalitionClassification;
  reason: string;
  /** Doslovné znění z koaliční smlouvy. U nezahrnutých slibů chybí. */
  coalitionExcerpt: string | null;
  coalitionLocator: string | null;
  coalitionPageNumber: number | null;
}

export interface CoalitionComparison {
  electoralList: ElectoralListRef;
  agreement: SourceRef;
  items: ComparisonItem[];
}

export async function listComparableElectoralLists(db: AppDatabase): Promise<ElectoralListRef[]> {
  const withMappings = await db
    .selectDistinct({ slug: electoralLists.slug })
    .from(coalitionPromiseMappings)
    .innerJoin(promises, eq(coalitionPromiseMappings.promiseId, promises.id))
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .where(and(eq(promises.published, true), eq(coalitionPromiseMappings.humanVerified, true)));

  const comparable = new Set(withMappings.map((row) => row.slug));
  const all = await listElectoralListOptions(db);

  return all.filter((list) => comparable.has(list.slug));
}

export async function getCoalitionComparison(
  db: AppDatabase,
  listSlug: string,
): Promise<CoalitionComparison | null> {
  const rows = await db
    .select({
      promiseSlug: promises.slug,
      promiseTitle: promises.title,
      topic: promises.topic,
      originalText: promises.originalText,
      classification: coalitionPromiseMappings.classification,
      reason: coalitionPromiseMappings.reason,
      coalitionExcerpt: evidence.excerpt,
      coalitionLocator: evidence.locator,
      coalitionPageNumber: evidence.pageNumber,
      listSlug: electoralLists.slug,
      listName: electoralLists.name,
      listShortName: electoralLists.shortName,
      agreementTitle: sourceDocuments.title,
      agreementPublisher: sourceDocuments.publisher,
      agreementUrl: sourceDocuments.url,
      agreementPublishedAt: sourceDocuments.publishedAt,
      agreementRetrievedAt: sourceDocuments.retrievedAt,
      agreementType: sourceDocuments.sourceType,
      agreementIsDemo: sourceDocuments.isDemo,
    })
    .from(coalitionPromiseMappings)
    .innerJoin(promises, eq(coalitionPromiseMappings.promiseId, promises.id))
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .innerJoin(
      sourceDocuments,
      eq(coalitionPromiseMappings.coalitionSourceDocumentId, sourceDocuments.id),
    )
    .leftJoin(evidence, eq(coalitionPromiseMappings.coalitionEvidenceId, evidence.id))
    .where(
      and(
        eq(electoralLists.slug, listSlug),
        eq(promises.published, true),
        isNull(promises.mergedIntoPromiseId),
        eq(coalitionPromiseMappings.humanVerified, true),
      ),
    )
    .orderBy(asc(promises.title));

  const first = rows[0];
  if (!first) return null;

  const lists = await listElectoralListOptions(db);
  const electoralList = lists.find((list) => list.slug === listSlug);
  if (!electoralList) return null;

  return {
    electoralList,
    agreement: {
      title: first.agreementTitle,
      publisher: first.agreementPublisher,
      url: first.agreementUrl,
      publishedAt: first.agreementPublishedAt,
      retrievedAt: first.agreementRetrievedAt,
      sourceType: first.agreementType,
      isDemo: first.agreementIsDemo,
    },
    items: rows.map((row) => ({
      promiseSlug: row.promiseSlug,
      promiseTitle: row.promiseTitle,
      topic: row.topic,
      originalText: row.originalText,
      classification: row.classification,
      reason: row.reason,
      coalitionExcerpt: row.coalitionExcerpt,
      coalitionLocator: row.coalitionLocator,
      coalitionPageNumber: row.coalitionPageNumber,
    })),
  };
}

/** Kolik slibů kandidátky vůbec máme — kvůli rozlišení „nic nemáme" od „nic nenamapováno". */
export async function countPublishedPromisesForList(
  db: AppDatabase,
  listSlug: string,
): Promise<number> {
  const rows = await db
    .select({ id: promises.id })
    .from(promises)
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .leftJoin(promiseSources, eq(promiseSources.promiseId, promises.id))
    .where(
      and(
        eq(electoralLists.slug, listSlug),
        eq(promises.published, true),
        isNull(promises.mergedIntoPromiseId),
      ),
    );

  return new Set(rows.map((row) => row.id)).size;
}
