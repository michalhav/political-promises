/**
 * Čtecí modely pro redakční konzoli.
 *
 * Oddělené od veřejných dotazů schválně: veřejná vrstva smí vidět jen
 * publikované a ověřené záznamy, admin naopak musí vidět i rozpracované,
 * nepotvrzené a vrácené. Kdyby to sdílelo jeden dotaz s parametrem
 * „includeUnpublished", stačilo by tenhle parametr někde omylem prohodit
 * a veřejná stránka by ukázala nezkontrolovaný obsah.
 */
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { AppDatabase } from "@/db/types";
import { appUsers } from "@/modules/accounts/schema";
import type {
  AssessabilityLevel,
  ExecutionStatusValue,
  OutcomeStatusValue,
} from "@/modules/assessments/labels";
import { promiseAssessments } from "@/modules/assessments/schema";
import { evidence, promiseEvidence } from "@/modules/evidence/schema";
import { electoralLists } from "@/modules/parties/schema";
import type { Topic } from "@/modules/promises/labels";
import { promises, promiseSources } from "@/modules/promises/schema";
import { auditLogs, corrections, reviewDecisions } from "@/modules/review/schema";
import type { AssessmentWorkflowState } from "@/modules/review/workflow";
import type { RelationTypeValue, SourceTypeValue } from "@/modules/sources/labels";
import { sourceDocuments } from "@/modules/sources/schema";

export interface QueueItem {
  promiseSlug: string;
  promiseTitle: string;
  listShortName: string;
  workflowState: AssessmentWorkflowState;
  version: number;
  authorName: string;
  updatedAt: Date;
}

export interface DashboardData {
  counts: {
    sourcesAwaiting: number;
    candidatePromises: number;
    inReview: number;
    changesRequested: number;
    readyToPublish: number;
    openCorrections: number;
  };
  inReview: QueueItem[];
  changesRequested: QueueItem[];
  readyToPublish: QueueItem[];
  recentlyPublished: QueueItem[];
  candidatePromises: { slug: string; title: string; listShortName: string; createdAt: Date }[];
  sourcesAwaiting: { id: string; title: string; sourceType: SourceTypeValue; createdAt: Date }[];
}

async function queueByState(
  db: AppDatabase,
  states: AssessmentWorkflowState[],
  limit = 8,
  /** Jen aktuálně zveřejněné verze — jinak by se slib s v1 i v2 objevil dvakrát. */
  onlyCurrent = false,
): Promise<QueueItem[]> {
  const rows = await db
    .select({
      promiseSlug: promises.slug,
      promiseTitle: promises.title,
      listShortName: electoralLists.shortName,
      workflowState: promiseAssessments.workflowState,
      version: promiseAssessments.version,
      authorName: appUsers.displayName,
      updatedAt: promiseAssessments.createdAt,
    })
    .from(promiseAssessments)
    .innerJoin(promises, eq(promiseAssessments.promiseId, promises.id))
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .innerJoin(appUsers, eq(promiseAssessments.createdById, appUsers.id))
    .where(
      onlyCurrent
        ? and(
            inArray(promiseAssessments.workflowState, states),
            eq(promiseAssessments.isCurrent, true),
          )
        : inArray(promiseAssessments.workflowState, states),
    )
    .orderBy(desc(promiseAssessments.createdAt))
    .limit(limit);

  return rows;
}

async function countByState(db: AppDatabase, states: AssessmentWorkflowState[]): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(promiseAssessments)
    .where(inArray(promiseAssessments.workflowState, states));
  return row?.value ?? 0;
}

export async function getDashboardData(db: AppDatabase): Promise<DashboardData> {
  const [
    inReview,
    changesRequested,
    readyToPublish,
    recentlyPublished,
    candidateRows,
    sourceRows,
    inReviewCount,
    changesCount,
    readyCount,
    candidateCount,
    sourcesCount,
    correctionCount,
  ] = await Promise.all([
    queueByState(db, ["IN_REVIEW"]),
    queueByState(db, ["CHANGES_REQUESTED"]),
    queueByState(db, ["APPROVED"]),
    queueByState(db, ["PUBLISHED"], 5, true),
    db
      .select({
        slug: promises.slug,
        title: promises.title,
        listShortName: electoralLists.shortName,
        createdAt: promises.createdAt,
      })
      .from(promises)
      .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
      .where(and(eq(promises.published, false), isNull(promises.mergedIntoPromiseId)))
      .orderBy(desc(promises.createdAt))
      .limit(8),
    db
      .select({
        id: sourceDocuments.id,
        title: sourceDocuments.title,
        sourceType: sourceDocuments.sourceType,
        createdAt: sourceDocuments.createdAt,
      })
      .from(sourceDocuments)
      .where(inArray(sourceDocuments.processingState, ["PENDING", "REVIEW_REQUIRED", "FAILED"]))
      .orderBy(desc(sourceDocuments.createdAt))
      .limit(8),
    countByState(db, ["IN_REVIEW"]),
    countByState(db, ["CHANGES_REQUESTED"]),
    countByState(db, ["APPROVED"]),
    db
      .select({ value: count() })
      .from(promises)
      .where(and(eq(promises.published, false), isNull(promises.mergedIntoPromiseId))),
    db
      .select({ value: count() })
      .from(sourceDocuments)
      .where(inArray(sourceDocuments.processingState, ["PENDING", "REVIEW_REQUIRED", "FAILED"])),
    db.select({ value: count() }).from(corrections).where(eq(corrections.status, "OPEN")),
  ]);

  return {
    counts: {
      sourcesAwaiting: sourcesCount[0]?.value ?? 0,
      candidatePromises: candidateCount[0]?.value ?? 0,
      inReview: inReviewCount,
      changesRequested: changesCount,
      readyToPublish: readyCount,
      openCorrections: correctionCount[0]?.value ?? 0,
    },
    inReview,
    changesRequested,
    readyToPublish,
    recentlyPublished,
    candidatePromises: candidateRows,
    sourcesAwaiting: sourceRows,
  };
}

// ---------------------------------------------------------------------------

export interface AdminSourceRow {
  id: string;
  title: string;
  publisher: string;
  sourceType: SourceTypeValue;
  publishedAt: string | null;
  processingState: "PENDING" | "PROCESSING" | "REVIEW_REQUIRED" | "FAILED" | "PUBLISHED";
  isDemo: boolean;
  usageCount: number;
}

export async function listAdminSources(db: AppDatabase): Promise<AdminSourceRow[]> {
  return db
    .select({
      id: sourceDocuments.id,
      title: sourceDocuments.title,
      publisher: sourceDocuments.publisher,
      sourceType: sourceDocuments.sourceType,
      publishedAt: sourceDocuments.publishedAt,
      processingState: sourceDocuments.processingState,
      isDemo: sourceDocuments.isDemo,
      usageCount: sql<number>`(
        select count(*) from evidence where evidence.source_document_id = ${sourceDocuments.id}
      ) + (
        select count(*) from promise_source
        where promise_source.source_document_id = ${sourceDocuments.id}
      )`,
    })
    .from(sourceDocuments)
    .orderBy(desc(sourceDocuments.createdAt));
}

export interface AdminSourceDetail extends AdminSourceRow {
  url: string | null;
  retrievedAt: Date;
  contentHash: string;
  licenseMode: "FULL_TEXT_STORED" | "QUOTE_ONLY";
  rawText: string | null;
  pageCount: number | null;
  processingError: string | null;
}

export async function getAdminSource(
  db: AppDatabase,
  id: string,
): Promise<AdminSourceDetail | null> {
  const [row] = await db
    .select({
      id: sourceDocuments.id,
      title: sourceDocuments.title,
      publisher: sourceDocuments.publisher,
      sourceType: sourceDocuments.sourceType,
      publishedAt: sourceDocuments.publishedAt,
      processingState: sourceDocuments.processingState,
      isDemo: sourceDocuments.isDemo,
      url: sourceDocuments.url,
      retrievedAt: sourceDocuments.retrievedAt,
      contentHash: sourceDocuments.contentHash,
      licenseMode: sourceDocuments.licenseMode,
      rawText: sourceDocuments.rawText,
      pageCount: sourceDocuments.pageCount,
      processingError: sourceDocuments.processingError,
      usageCount: sql<number>`(
        select count(*) from evidence where evidence.source_document_id = ${sourceDocuments.id}
      ) + (
        select count(*) from promise_source
        where promise_source.source_document_id = ${sourceDocuments.id}
      )`,
    })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, id))
    .limit(1);

  return row ?? null;
}

// ---------------------------------------------------------------------------

export interface AdminPromiseRow {
  slug: string;
  title: string;
  listShortName: string;
  topic: Topic;
  published: boolean;
  latestState: AssessmentWorkflowState | null;
  latestVersion: number | null;
}

export async function listAdminPromises(db: AppDatabase): Promise<AdminPromiseRow[]> {
  const rows = await db
    .select({
      slug: promises.slug,
      title: promises.title,
      listShortName: electoralLists.shortName,
      topic: promises.topic,
      published: promises.published,
      createdAt: promises.createdAt,
      latestState: sql<AssessmentWorkflowState | null>`(
        select workflow_state from promise_assessment
        where promise_assessment.promise_id = ${promises.id}
        order by version desc limit 1
      )`,
      latestVersion: sql<number | null>`(
        select version from promise_assessment
        where promise_assessment.promise_id = ${promises.id}
        order by version desc limit 1
      )`,
    })
    .from(promises)
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .orderBy(desc(promises.createdAt));

  return rows;
}

export interface AdminEvidenceRow {
  linkId: string;
  excerpt: string;
  pageNumber: number | null;
  locator: string | null;
  relationType: RelationTypeValue;
  humanVerified: boolean;
  note: string | null;
  limitationNote: string | null;
  sourceTitle: string;
  sourceId: string;
}

export interface AdminAssessmentRow {
  id: string;
  version: number;
  workflowState: AssessmentWorkflowState;
  isCurrent: boolean;
  specificityScore: number;
  measurabilityScore: number;
  deadlineScore: number;
  jurisdictionScore: number;
  outcomeDefinitionScore: number;
  assessability: AssessabilityLevel;
  executionStatus: ExecutionStatusValue;
  outcomeStatus: OutcomeStatusValue;
  summary: string | null;
  changeReason: string | null;
  sourcesReviewedUpTo: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  reviewerName: string | null;
  reviewedAt: Date | null;
}

export interface AdminPromiseDetail {
  id: string;
  slug: string;
  title: string;
  originalText: string;
  normalizedStatement: string | null;
  topic: Topic;
  deadlineText: string | null;
  deadlineOn: string | null;
  published: boolean;
  publishedAt: Date | null;
  listName: string;
  listShortName: string;
  primarySource: {
    excerpt: string;
    pageNumber: number | null;
    locator: string | null;
    sourceId: string;
    sourceTitle: string;
  } | null;
  evidence: AdminEvidenceRow[];
  assessments: AdminAssessmentRow[];
  corrections: {
    id: string;
    kind: string;
    status: string;
    body: string;
    response: string | null;
    submitterName: string | null;
    submitterOrganization: string | null;
    createdAt: Date;
  }[];
  reviewNotes: { decision: string; note: string | null; reviewer: string; createdAt: Date }[];
  audit: { action: string; actor: string | null; createdAt: Date }[];
}

export async function getAdminPromiseDetail(
  db: AppDatabase,
  slug: string,
): Promise<AdminPromiseDetail | null> {
  const [promise] = await db
    .select({
      id: promises.id,
      slug: promises.slug,
      title: promises.title,
      originalText: promises.originalText,
      normalizedStatement: promises.normalizedStatement,
      topic: promises.topic,
      deadlineText: promises.deadlineText,
      deadlineOn: promises.deadlineOn,
      published: promises.published,
      publishedAt: promises.publishedAt,
      listName: electoralLists.name,
      listShortName: electoralLists.shortName,
    })
    .from(promises)
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .where(eq(promises.slug, slug))
    .limit(1);

  if (!promise) return null;

  const [primary, evidenceRows, assessmentRows, correctionRows, decisions, auditRows] =
    await Promise.all([
      db
        .select({
          excerpt: promiseSources.excerpt,
          pageNumber: promiseSources.pageNumber,
          locator: promiseSources.locator,
          sourceId: sourceDocuments.id,
          sourceTitle: sourceDocuments.title,
        })
        .from(promiseSources)
        .innerJoin(sourceDocuments, eq(promiseSources.sourceDocumentId, sourceDocuments.id))
        .where(and(eq(promiseSources.promiseId, promise.id), eq(promiseSources.isPrimary, true)))
        .limit(1),
      db
        .select({
          linkId: promiseEvidence.id,
          excerpt: evidence.excerpt,
          pageNumber: evidence.pageNumber,
          locator: evidence.locator,
          relationType: promiseEvidence.relationType,
          humanVerified: promiseEvidence.humanVerified,
          note: promiseEvidence.note,
          limitationNote: promiseEvidence.limitationNote,
          sourceTitle: sourceDocuments.title,
          sourceId: sourceDocuments.id,
        })
        .from(promiseEvidence)
        .innerJoin(evidence, eq(promiseEvidence.evidenceId, evidence.id))
        .innerJoin(sourceDocuments, eq(evidence.sourceDocumentId, sourceDocuments.id))
        .where(eq(promiseEvidence.promiseId, promise.id)),
      db
        .select({
          id: promiseAssessments.id,
          version: promiseAssessments.version,
          workflowState: promiseAssessments.workflowState,
          isCurrent: promiseAssessments.isCurrent,
          specificityScore: promiseAssessments.specificityScore,
          measurabilityScore: promiseAssessments.measurabilityScore,
          deadlineScore: promiseAssessments.deadlineScore,
          jurisdictionScore: promiseAssessments.jurisdictionScore,
          outcomeDefinitionScore: promiseAssessments.outcomeDefinitionScore,
          assessability: promiseAssessments.assessability,
          executionStatus: promiseAssessments.executionStatus,
          outcomeStatus: promiseAssessments.outcomeStatus,
          summary: promiseAssessments.summary,
          changeReason: promiseAssessments.changeReason,
          sourcesReviewedUpTo: promiseAssessments.sourcesReviewedUpTo,
          createdAt: promiseAssessments.createdAt,
          authorId: promiseAssessments.createdById,
          authorName: appUsers.displayName,
          reviewedAt: promiseAssessments.reviewedAt,
          reviewerName: sql<string | null>`(
            select display_name from app_user
            where app_user.id = ${promiseAssessments.reviewedById}
          )`,
        })
        .from(promiseAssessments)
        .innerJoin(appUsers, eq(promiseAssessments.createdById, appUsers.id))
        .where(eq(promiseAssessments.promiseId, promise.id))
        .orderBy(desc(promiseAssessments.version)),
      db
        .select()
        .from(corrections)
        .where(eq(corrections.promiseId, promise.id))
        .orderBy(desc(corrections.createdAt)),
      db
        .select({
          decision: reviewDecisions.decision,
          note: reviewDecisions.note,
          reviewer: appUsers.displayName,
          createdAt: reviewDecisions.createdAt,
          entityId: reviewDecisions.entityId,
        })
        .from(reviewDecisions)
        .innerJoin(appUsers, eq(reviewDecisions.reviewerId, appUsers.id))
        .orderBy(desc(reviewDecisions.createdAt)),
      db
        .select({
          action: auditLogs.action,
          actor: appUsers.displayName,
          createdAt: auditLogs.createdAt,
          entityId: auditLogs.entityId,
        })
        .from(auditLogs)
        .leftJoin(appUsers, eq(auditLogs.actorId, appUsers.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(200),
    ]);

  const assessmentIds = new Set(assessmentRows.map((row) => row.id));
  const relatedIds = new Set<string>([promise.id, ...assessmentIds]);

  return {
    ...promise,
    primarySource: primary[0] ?? null,
    evidence: evidenceRows,
    assessments: assessmentRows,
    corrections: correctionRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      body: row.body,
      response: row.response,
      submitterName: row.submitterName,
      submitterOrganization: row.submitterOrganization,
      createdAt: row.createdAt,
    })),
    reviewNotes: decisions
      .filter((row) => assessmentIds.has(row.entityId))
      .map(({ decision, note, reviewer, createdAt }) => ({ decision, note, reviewer, createdAt })),
    audit: auditRows
      .filter((row) => row.entityId !== null && relatedIds.has(row.entityId))
      .map(({ action, actor, createdAt }) => ({ action, actor, createdAt })),
  };
}

// ---------------------------------------------------------------------------

export async function listElectoralListChoices(db: AppDatabase) {
  return db
    .select({ id: electoralLists.id, name: electoralLists.name })
    .from(electoralLists)
    .orderBy(electoralLists.name);
}

export async function listSourceChoices(db: AppDatabase) {
  return db
    .select({
      id: sourceDocuments.id,
      title: sourceDocuments.title,
      sourceType: sourceDocuments.sourceType,
    })
    .from(sourceDocuments)
    .orderBy(desc(sourceDocuments.createdAt));
}
