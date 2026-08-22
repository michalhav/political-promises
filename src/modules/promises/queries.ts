/**
 * Čtecí vrstva pro veřejné stránky.
 *
 * Dvě pravidla, která tenhle soubor drží za celou aplikaci:
 *
 *  1. Ven jde jen to, co je publikované a lidsky ověřené. Nepotvrzený návrh AI
 *     v databázi existovat smí, na veřejné stránce nikoli (integritní pravidlo
 *     č. 2 a 5). Filtrovat se to musí tady, ne v komponentě — komponenta se dá
 *     omylem obejít, dotaz ne.
 *
 *  2. Žádné N+1. Seznam si natáhne stránku slibů jedním dotazem a doplňkové
 *     údaje pro tu stránku dalšími třemi, ne jedním dotazem na řádek.
 */
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import type { AppDatabase } from "@/db/types";
import {
  deriveAssessability,
  type AssessabilityResult,
  type AssessabilityScores,
} from "@/modules/assessments/assessability";
import type {
  AssessabilityLevel,
  ExecutionStatusValue,
  OutcomeStatusValue,
} from "@/modules/assessments/labels";
import { promiseAssessments } from "@/modules/assessments/schema";
import { coalitionPromiseMappings } from "@/modules/coalition/schema";
import type { CoalitionClassification } from "@/modules/coalition/labels";
import { evidence, promiseEvidence, promiseEventEvidence } from "@/modules/evidence/schema";
import { electoralListParties, electoralLists, parties } from "@/modules/parties/schema";
import type { EventTypeValue, Topic } from "@/modules/promises/labels";
import {
  metricMeasurements,
  promiseEvents,
  promiseMetrics,
  promises,
  promiseSources,
} from "@/modules/promises/schema";
import { corrections } from "@/modules/review/schema";
import type { RelationTypeValue, SourceTypeValue } from "@/modules/sources/labels";
import { sourceDocuments } from "@/modules/sources/schema";
import type { PromiseFilters } from "@/modules/promises/filters";

export const PAGE_SIZE = 12;

// ---------------------------------------------------------------------------
// Doménové tvary
// ---------------------------------------------------------------------------

export interface PartyRef {
  slug: string;
  name: string;
  shortName: string;
  isDemo: boolean;
}

export interface ElectoralListRef {
  slug: string;
  name: string;
  shortName: string;
  parties: PartyRef[];
  /** Kandidátka je smyšlená, pokud je smyšlená kterákoli ze stran za ní. */
  isDemo: boolean;
}

export interface SourceRef {
  title: string;
  publisher: string;
  url: string | null;
  publishedAt: string | null;
  retrievedAt: Date;
  sourceType: SourceTypeValue;
  isDemo: boolean;
  /**
   * Vyplněné jen u dokumentu z webového archivu.
   *
   * Čtenář musí vidět, že za shodu s originálem ručí třetí strana a že snímek
   * je z konkrétního dne — u programu, který z webu vydavatele zmizel, je to
   * podstatná část toho, jak silný ten doklad je.
   */
  archive: { service: string; originalUrl: string; snapshotAt: Date } | null;
}

export interface Citation {
  excerpt: string;
  pageNumber: number | null;
  locator: string | null;
  source: SourceRef;
}

export interface EvidenceView extends Citation {
  relationType: RelationTypeValue;
  /** Co zdroj dokládá — redakční výklad. */
  note: string | null;
  /** Co z něj naopak vyvodit nelze. Oddělené schválně, viz schéma. */
  limitationNote: string | null;
}

export interface TimelineEventView {
  eventType: EventTypeValue;
  eventDate: string;
  title: string;
  description: string | null;
  citations: Citation[];
}

export interface MeasurementView {
  value: string;
  measuredOn: string;
  note: string | null;
  source: SourceRef;
}

export interface MetricView {
  name: string;
  unit: string;
  direction: "INCREASE" | "DECREASE" | "MAINTAIN";
  baselineValue: string | null;
  baselineOn: string | null;
  targetValue: string | null;
  targetOn: string | null;
  definitionNote: string | null;
  measurements: MeasurementView[];
}

export interface AssessmentView {
  version: number;
  scores: AssessabilityScores;
  assessability: AssessabilityLevel;
  methodologyVersion: string;
  executionStatus: ExecutionStatusValue;
  outcomeStatus: OutcomeStatusValue;
  summary: string | null;
  changeReason: string | null;
  createdAt: Date;
  /** Ke kterému dni sahá rešerše zdrojů, o kterou se stav opírá. */
  sourcesReviewedUpTo: string;
  isCurrent: boolean;
  /** Proč vyšel právě tenhle stupeň. Odpověď na „proč to tak je" na jedno kliknutí. */
  derivation: AssessabilityResult;
}

export interface CoalitionMappingView {
  classification: CoalitionClassification;
  reason: string;
  citation: Citation | null;
  agreement: SourceRef;
}

export interface CorrectionView {
  kind: "PUBLIC_CORRECTION" | "PARTY_RESPONSE" | "INTERNAL_REVISION";
  status: "OPEN" | "ACKNOWLEDGED" | "APPLIED" | "REJECTED";
  submitterName: string | null;
  submitterOrganization: string | null;
  body: string;
  response: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface PromiseListItem {
  slug: string;
  title: string;
  originalText: string;
  topic: Topic;
  deadlineText: string | null;
  electoralList: ElectoralListRef;
  assessability: AssessabilityLevel | null;
  executionStatus: ExecutionStatusValue | null;
  outcomeStatus: OutcomeStatusValue | null;
  /** Datum, ke kterému byly zdroje procházeny. Null, dokud slib nemá hodnocení. */
  sourcesReviewedUpTo: string | null;
  evidenceCount: number;
}

export interface PromiseListResult {
  items: PromiseListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface PromiseDetail {
  slug: string;
  title: string;
  originalText: string;
  normalizedStatement: string | null;
  topic: Topic;
  deadlineText: string | null;
  deadlineOn: string | null;
  publishedAt: Date | null;
  electoralList: ElectoralListRef;
  electionName: string;
  primarySource: Citation | null;
  assessment: AssessmentView | null;
  assessmentHistory: AssessmentView[];
  timeline: TimelineEventView[];
  evidence: EvidenceView[];
  metrics: MetricView[];
  coalition: CoalitionMappingView | null;
  corrections: CorrectionView[];
}

// ---------------------------------------------------------------------------
// Pomocné
// ---------------------------------------------------------------------------

const publiclyVisible = () =>
  and(eq(promises.published, true), isNull(promises.mergedIntoPromiseId));

/** V LIKE vzoru mají %, _ a \ zvláštní význam; uživatelův text je nesmí nést. */
function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (character) => `\\${character}`);
}

async function loadElectoralLists(
  db: AppDatabase,
  listIds: string[],
): Promise<Map<string, ElectoralListRef>> {
  if (listIds.length === 0) return new Map();

  const rows = await db
    .select({
      listId: electoralLists.id,
      listSlug: electoralLists.slug,
      listName: electoralLists.name,
      listShortName: electoralLists.shortName,
      partySlug: parties.slug,
      partyName: parties.name,
      partyShortName: parties.shortName,
      partyIsDemo: parties.isDemo,
      displayOrder: electoralListParties.displayOrder,
    })
    .from(electoralLists)
    .leftJoin(electoralListParties, eq(electoralListParties.electoralListId, electoralLists.id))
    .leftJoin(parties, eq(electoralListParties.partyId, parties.id))
    .where(inArray(electoralLists.id, listIds))
    .orderBy(asc(electoralLists.name), asc(electoralListParties.displayOrder));

  const byId = new Map<string, ElectoralListRef>();

  for (const row of rows) {
    let entry = byId.get(row.listId);
    if (!entry) {
      entry = {
        slug: row.listSlug,
        name: row.listName,
        shortName: row.listShortName,
        parties: [],
        isDemo: false,
      };
      byId.set(row.listId, entry);
    }

    if (row.partySlug && row.partyName && row.partyShortName !== null) {
      entry.parties.push({
        slug: row.partySlug,
        name: row.partyName,
        shortName: row.partyShortName,
        isDemo: row.partyIsDemo ?? false,
      });
      entry.isDemo = entry.isDemo || (row.partyIsDemo ?? false);
    }
  }

  return byId;
}

interface SourceRow {
  title: string;
  publisher: string;
  url: string | null;
  publishedAt: string | null;
  retrievedAt: Date;
  sourceType: SourceTypeValue;
  isDemo: boolean;
  archiveService: string | null;
  archiveOriginalUrl: string | null;
  archiveSnapshotAt: Date | null;
}

function toSourceRef(row: SourceRow): SourceRef {
  return {
    title: row.title,
    publisher: row.publisher,
    url: row.url,
    publishedAt: row.publishedAt,
    retrievedAt: row.retrievedAt,
    sourceType: row.sourceType,
    isDemo: row.isDemo,
    // Databáze drží CHECK, že archivní původ je celý, nebo vůbec.
    archive:
      row.archiveService && row.archiveOriginalUrl && row.archiveSnapshotAt
        ? {
            service: row.archiveService,
            originalUrl: row.archiveOriginalUrl,
            snapshotAt: row.archiveSnapshotAt,
          }
        : null,
  };
}

const sourceColumns = {
  sourceTitle: sourceDocuments.title,
  sourcePublisher: sourceDocuments.publisher,
  sourceUrl: sourceDocuments.url,
  sourcePublishedAt: sourceDocuments.publishedAt,
  sourceRetrievedAt: sourceDocuments.retrievedAt,
  sourceType: sourceDocuments.sourceType,
  sourceIsDemo: sourceDocuments.isDemo,
  sourceArchiveService: sourceDocuments.archiveService,
  sourceArchiveOriginalUrl: sourceDocuments.archiveOriginalUrl,
  sourceArchiveSnapshotAt: sourceDocuments.archiveSnapshotAt,
} as const;

interface SourceColumnRow {
  sourceTitle: string;
  sourcePublisher: string;
  sourceUrl: string | null;
  sourcePublishedAt: string | null;
  sourceRetrievedAt: Date;
  sourceType: SourceTypeValue;
  sourceIsDemo: boolean;
  sourceArchiveService: string | null;
  sourceArchiveOriginalUrl: string | null;
  sourceArchiveSnapshotAt: Date | null;
}

function sourceRefFrom(row: SourceColumnRow): SourceRef {
  return toSourceRef({
    title: row.sourceTitle,
    publisher: row.sourcePublisher,
    url: row.sourceUrl,
    publishedAt: row.sourcePublishedAt,
    retrievedAt: row.sourceRetrievedAt,
    sourceType: row.sourceType,
    isDemo: row.sourceIsDemo,
    archiveService: row.sourceArchiveService,
    archiveOriginalUrl: row.sourceArchiveOriginalUrl,
    archiveSnapshotAt: row.sourceArchiveSnapshotAt,
  });
}

function toAssessmentView(row: typeof promiseAssessments.$inferSelect): AssessmentView {
  const scores: AssessabilityScores = {
    specificityScore: row.specificityScore,
    measurabilityScore: row.measurabilityScore,
    deadlineScore: row.deadlineScore,
    jurisdictionScore: row.jurisdictionScore,
    outcomeDefinitionScore: row.outcomeDefinitionScore,
  };

  return {
    version: row.version,
    scores,
    assessability: row.assessability,
    methodologyVersion: row.methodologyVersion,
    executionStatus: row.executionStatus,
    outcomeStatus: row.outcomeStatus,
    summary: row.summary,
    changeReason: row.changeReason,
    createdAt: row.createdAt,
    sourcesReviewedUpTo: row.sourcesReviewedUpTo,
    isCurrent: row.isCurrent,
    derivation: deriveAssessability(scores),
  };
}

// ---------------------------------------------------------------------------
// Seznam slibů
// ---------------------------------------------------------------------------

export async function listPublishedPromises(
  db: AppDatabase,
  filters: PromiseFilters,
): Promise<PromiseListResult> {
  const conditions: SQL[] = [];
  const base = publiclyVisible();
  if (base) conditions.push(base);

  if (filters.list) {
    conditions.push(eq(electoralLists.slug, filters.list));
  }
  if (filters.topic) {
    conditions.push(eq(promises.topic, filters.topic));
  }
  if (filters.execution) {
    conditions.push(eq(promiseAssessments.executionStatus, filters.execution));
  }
  if (filters.assessability) {
    conditions.push(eq(promiseAssessments.assessability, filters.assessability));
  }
  if (filters.q) {
    const pattern = `%${escapeLikePattern(filters.q)}%`;
    const search = or(
      ilike(promises.title, pattern),
      ilike(promises.originalText, pattern),
      ilike(promises.normalizedStatement, pattern),
    );
    if (search) conditions.push(search);
  }

  const where = and(...conditions);
  const currentAssessmentJoin = and(
    eq(promiseAssessments.promiseId, promises.id),
    eq(promiseAssessments.isCurrent, true),
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(promises)
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .leftJoin(promiseAssessments, currentAssessmentJoin)
    .where(where);

  const total = totalRow?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const rows = await db
    .select({
      id: promises.id,
      slug: promises.slug,
      title: promises.title,
      originalText: promises.originalText,
      topic: promises.topic,
      deadlineText: promises.deadlineText,
      electoralListId: promises.electoralListId,
      assessability: promiseAssessments.assessability,
      executionStatus: promiseAssessments.executionStatus,
      outcomeStatus: promiseAssessments.outcomeStatus,
      sourcesReviewedUpTo: promiseAssessments.sourcesReviewedUpTo,
    })
    .from(promises)
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .leftJoin(promiseAssessments, currentAssessmentJoin)
    .where(where)
    .orderBy(asc(promises.title), asc(promises.slug))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const promiseIds = rows.map((row) => row.id);
  const [lists, evidenceCounts] = await Promise.all([
    loadElectoralLists(db, [...new Set(rows.map((row) => row.electoralListId))]),
    loadEvidenceCounts(db, promiseIds),
  ]);

  const items: PromiseListItem[] = rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    originalText: row.originalText,
    topic: row.topic,
    deadlineText: row.deadlineText,
    electoralList: lists.get(row.electoralListId) ?? {
      slug: "",
      name: "Neznámá kandidátka",
      shortName: "—",
      parties: [],
      isDemo: false,
    },
    assessability: row.assessability,
    executionStatus: row.executionStatus,
    outcomeStatus: row.outcomeStatus,
    sourcesReviewedUpTo: row.sourcesReviewedUpTo,
    evidenceCount: evidenceCounts.get(row.id) ?? 0,
  }));

  return { items, total, page, pageSize: PAGE_SIZE, pageCount };
}

async function loadEvidenceCounts(
  db: AppDatabase,
  promiseIds: string[],
): Promise<Map<string, number>> {
  if (promiseIds.length === 0) return new Map();

  const rows = await db
    .select({ promiseId: promiseEvidence.promiseId, value: count() })
    .from(promiseEvidence)
    .where(
      and(inArray(promiseEvidence.promiseId, promiseIds), eq(promiseEvidence.humanVerified, true)),
    )
    .groupBy(promiseEvidence.promiseId);

  return new Map(rows.map((row) => [row.promiseId, row.value]));
}

// ---------------------------------------------------------------------------
// Detail slibu
// ---------------------------------------------------------------------------

export async function getPublishedPromiseDetail(
  db: AppDatabase,
  slug: string,
): Promise<PromiseDetail | null> {
  const [promiseRow] = await db
    .select({
      id: promises.id,
      slug: promises.slug,
      title: promises.title,
      originalText: promises.originalText,
      normalizedStatement: promises.normalizedStatement,
      topic: promises.topic,
      deadlineText: promises.deadlineText,
      deadlineOn: promises.deadlineOn,
      publishedAt: promises.publishedAt,
      electoralListId: promises.electoralListId,
      electionName: electoralLists.name,
    })
    .from(promises)
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .where(and(publiclyVisible(), eq(promises.slug, slug)))
    .limit(1);

  if (!promiseRow) return null;

  const promiseId = promiseRow.id;

  const [lists, primarySource, assessmentRows, timeline, evidenceList, metrics, coalition, corrs] =
    await Promise.all([
      loadElectoralLists(db, [promiseRow.electoralListId]),
      loadPrimarySource(db, promiseId),
      db
        .select()
        .from(promiseAssessments)
        // Rozpracovaná ani schválená verze se veřejně nezobrazuje. Publikované
        // je jen to, co prošlo revizí — historie verzí není výjimka.
        .where(
          and(
            eq(promiseAssessments.promiseId, promiseId),
            eq(promiseAssessments.workflowState, "PUBLISHED"),
          ),
        )
        .orderBy(desc(promiseAssessments.version)),
      loadTimeline(db, promiseId),
      loadEvidence(db, promiseId),
      loadMetrics(db, promiseId),
      loadCoalitionMapping(db, promiseId),
      loadCorrections(db, promiseId),
    ]);

  const assessments = assessmentRows.map(toAssessmentView);

  return {
    slug: promiseRow.slug,
    title: promiseRow.title,
    originalText: promiseRow.originalText,
    normalizedStatement: promiseRow.normalizedStatement,
    topic: promiseRow.topic,
    deadlineText: promiseRow.deadlineText,
    deadlineOn: promiseRow.deadlineOn,
    publishedAt: promiseRow.publishedAt,
    electoralList: lists.get(promiseRow.electoralListId) ?? {
      slug: "",
      name: "Neznámá kandidátka",
      shortName: "—",
      parties: [],
      isDemo: false,
    },
    electionName: promiseRow.electionName,
    primarySource,
    assessment: assessments.find((item) => item.isCurrent) ?? null,
    assessmentHistory: assessments.filter((item) => !item.isCurrent),
    timeline,
    evidence: evidenceList,
    metrics,
    coalition,
    corrections: corrs,
  };
}

async function loadPrimarySource(db: AppDatabase, promiseId: string): Promise<Citation | null> {
  const [row] = await db
    .select({
      excerpt: promiseSources.excerpt,
      pageNumber: promiseSources.pageNumber,
      locator: promiseSources.locator,
      ...sourceColumns,
    })
    .from(promiseSources)
    .innerJoin(sourceDocuments, eq(promiseSources.sourceDocumentId, sourceDocuments.id))
    .where(and(eq(promiseSources.promiseId, promiseId), eq(promiseSources.isPrimary, true)))
    .limit(1);

  if (!row) return null;

  return {
    excerpt: row.excerpt,
    pageNumber: row.pageNumber,
    locator: row.locator,
    source: sourceRefFrom(row),
  };
}

async function loadTimeline(db: AppDatabase, promiseId: string): Promise<TimelineEventView[]> {
  const rows = await db
    .select({
      eventId: promiseEvents.id,
      eventType: promiseEvents.eventType,
      eventDate: promiseEvents.eventDate,
      title: promiseEvents.title,
      description: promiseEvents.description,
      excerpt: evidence.excerpt,
      pageNumber: evidence.pageNumber,
      locator: evidence.locator,
      ...sourceColumns,
    })
    .from(promiseEvents)
    .leftJoin(promiseEventEvidence, eq(promiseEventEvidence.eventId, promiseEvents.id))
    .leftJoin(evidence, eq(promiseEventEvidence.evidenceId, evidence.id))
    .leftJoin(sourceDocuments, eq(evidence.sourceDocumentId, sourceDocuments.id))
    .where(eq(promiseEvents.promiseId, promiseId))
    .orderBy(asc(promiseEvents.eventDate), asc(promiseEvents.createdAt));

  const byEvent = new Map<string, TimelineEventView>();
  const order: string[] = [];

  for (const row of rows) {
    let entry = byEvent.get(row.eventId);
    if (!entry) {
      entry = {
        eventType: row.eventType,
        eventDate: row.eventDate,
        title: row.title,
        description: row.description,
        citations: [],
      };
      byEvent.set(row.eventId, entry);
      order.push(row.eventId);
    }

    if (row.excerpt !== null && row.sourceTitle !== null) {
      entry.citations.push({
        excerpt: row.excerpt,
        pageNumber: row.pageNumber,
        locator: row.locator,
        source: sourceRefFrom({
          sourceTitle: row.sourceTitle,
          sourcePublisher: row.sourcePublisher ?? "",
          sourceUrl: row.sourceUrl,
          sourcePublishedAt: row.sourcePublishedAt,
          sourceRetrievedAt: row.sourceRetrievedAt ?? new Date(0),
          sourceType: row.sourceType ?? "OTHER",
          sourceIsDemo: row.sourceIsDemo ?? false,
          sourceArchiveService: row.sourceArchiveService,
          sourceArchiveOriginalUrl: row.sourceArchiveOriginalUrl,
          sourceArchiveSnapshotAt: row.sourceArchiveSnapshotAt,
        }),
      });
    }
  }

  return order.flatMap((id) => {
    const entry = byEvent.get(id);
    return entry ? [entry] : [];
  });
}

async function loadEvidence(db: AppDatabase, promiseId: string): Promise<EvidenceView[]> {
  const rows = await db
    .select({
      relationType: promiseEvidence.relationType,
      note: promiseEvidence.note,
      limitationNote: promiseEvidence.limitationNote,
      excerpt: evidence.excerpt,
      pageNumber: evidence.pageNumber,
      locator: evidence.locator,
      ...sourceColumns,
    })
    .from(promiseEvidence)
    .innerJoin(evidence, eq(promiseEvidence.evidenceId, evidence.id))
    .innerJoin(sourceDocuments, eq(evidence.sourceDocumentId, sourceDocuments.id))
    // Nepotvrzený návrh AI se veřejně nezobrazuje.
    .where(and(eq(promiseEvidence.promiseId, promiseId), eq(promiseEvidence.humanVerified, true)))
    .orderBy(asc(sourceDocuments.publishedAt));

  return rows.map((row) => ({
    relationType: row.relationType,
    note: row.note,
    limitationNote: row.limitationNote,
    excerpt: row.excerpt,
    pageNumber: row.pageNumber,
    locator: row.locator,
    source: sourceRefFrom(row),
  }));
}

async function loadMetrics(db: AppDatabase, promiseId: string): Promise<MetricView[]> {
  const metricRows = await db
    .select()
    .from(promiseMetrics)
    .where(eq(promiseMetrics.promiseId, promiseId))
    .orderBy(asc(promiseMetrics.name));

  if (metricRows.length === 0) return [];

  const measurementRows = await db
    .select({
      metricId: metricMeasurements.metricId,
      value: metricMeasurements.value,
      measuredOn: metricMeasurements.measuredOn,
      note: metricMeasurements.note,
      ...sourceColumns,
    })
    .from(metricMeasurements)
    .innerJoin(sourceDocuments, eq(metricMeasurements.sourceDocumentId, sourceDocuments.id))
    .where(
      inArray(
        metricMeasurements.metricId,
        metricRows.map((row) => row.id),
      ),
    )
    .orderBy(asc(metricMeasurements.measuredOn));

  return metricRows.map((metric) => ({
    name: metric.name,
    unit: metric.unit,
    direction: metric.direction,
    baselineValue: metric.baselineValue,
    baselineOn: metric.baselineOn,
    targetValue: metric.targetValue,
    targetOn: metric.targetOn,
    definitionNote: metric.definitionNote,
    measurements: measurementRows
      .filter((row) => row.metricId === metric.id)
      .map((row) => ({
        value: row.value,
        measuredOn: row.measuredOn,
        note: row.note,
        source: sourceRefFrom(row),
      })),
  }));
}

async function loadCoalitionMapping(
  db: AppDatabase,
  promiseId: string,
): Promise<CoalitionMappingView | null> {
  const [row] = await db
    .select({
      classification: coalitionPromiseMappings.classification,
      reason: coalitionPromiseMappings.reason,
      excerpt: evidence.excerpt,
      pageNumber: evidence.pageNumber,
      locator: evidence.locator,
      agreementTitle: sourceDocuments.title,
      agreementPublisher: sourceDocuments.publisher,
      agreementUrl: sourceDocuments.url,
      agreementPublishedAt: sourceDocuments.publishedAt,
      agreementRetrievedAt: sourceDocuments.retrievedAt,
      agreementType: sourceDocuments.sourceType,
      agreementIsDemo: sourceDocuments.isDemo,
      agreementArchiveService: sourceDocuments.archiveService,
      agreementArchiveOriginalUrl: sourceDocuments.archiveOriginalUrl,
      agreementArchiveSnapshotAt: sourceDocuments.archiveSnapshotAt,
    })
    .from(coalitionPromiseMappings)
    .innerJoin(
      sourceDocuments,
      eq(coalitionPromiseMappings.coalitionSourceDocumentId, sourceDocuments.id),
    )
    .leftJoin(evidence, eq(coalitionPromiseMappings.coalitionEvidenceId, evidence.id))
    .where(
      and(
        eq(coalitionPromiseMappings.promiseId, promiseId),
        eq(coalitionPromiseMappings.humanVerified, true),
      ),
    )
    .limit(1);

  if (!row) return null;

  const agreement: SourceRef = {
    title: row.agreementTitle,
    publisher: row.agreementPublisher,
    url: row.agreementUrl,
    publishedAt: row.agreementPublishedAt,
    retrievedAt: row.agreementRetrievedAt,
    sourceType: row.agreementType,
    isDemo: row.agreementIsDemo,
    archive:
      row.agreementArchiveService &&
      row.agreementArchiveOriginalUrl &&
      row.agreementArchiveSnapshotAt
        ? {
            service: row.agreementArchiveService,
            originalUrl: row.agreementArchiveOriginalUrl,
            snapshotAt: row.agreementArchiveSnapshotAt,
          }
        : null,
  };

  return {
    classification: row.classification,
    reason: row.reason,
    agreement,
    citation:
      row.excerpt === null
        ? null
        : {
            excerpt: row.excerpt,
            pageNumber: row.pageNumber,
            locator: row.locator,
            source: agreement,
          },
  };
}

async function loadCorrections(db: AppDatabase, promiseId: string): Promise<CorrectionView[]> {
  const rows = await db
    .select()
    .from(corrections)
    .where(eq(corrections.promiseId, promiseId))
    .orderBy(desc(corrections.createdAt));

  /**
   * Ven jde jen to, co redakce viděla.
   *
   * `OPEN` znamená „přišlo a nikdo to zatím nečetl". Zveřejňovat takový text
   * u jmenovaného politika by z formuláře udělalo nástroj, jak mu na stránku
   * napsat cokoli. Podnět se zveřejní tím, že ho redakce vezme na vědomí —
   * i když ho odmítne, protože odmítnutý podnět je taky doklad o tom, že
   * se někdo ozval.
   *
   * Interní revize je pracovní poznámka redakce, ne veřejný podnět.
   */
  return rows
    .filter((row) => row.kind !== "INTERNAL_REVISION" && row.status !== "OPEN")
    .map((row) => ({
      kind: row.kind,
      status: row.status,
      submitterName: row.submitterName,
      submitterOrganization: row.submitterOrganization,
      body: row.body,
      response: row.response,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    }));
}

// ---------------------------------------------------------------------------
// Číselníky pro filtry
// ---------------------------------------------------------------------------

export async function listElectoralListOptions(db: AppDatabase): Promise<ElectoralListRef[]> {
  const rows = await db
    .selectDistinct({ id: promises.electoralListId })
    .from(promises)
    .where(publiclyVisible());

  const lists = await loadElectoralLists(
    db,
    rows.map((row) => row.id),
  );

  return [...lists.values()].sort((a, b) => a.name.localeCompare(b.name, "cs"));
}
