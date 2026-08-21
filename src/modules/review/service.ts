/**
 * Redakční operace — jediná zapisovací hranice adminu.
 *
 * Komponenty ani server actions nesmí sahat do databáze přímo. Všechno prochází
 * tudy, protože jen tady je pohromadě to, co musí platit současně: validace
 * vstupu, povolený přechod workflow, pravidlo čtyř očí, integritní kontroly
 * a zápis do auditu. Rozsypat to po stránkách znamená, že jedna z těch věcí
 * někde vypadne a nikdo si toho nevšimne.
 *
 * Databáze zůstává poslední pojistkou. Kontroly tady jsou proto, aby redaktor
 * dostal srozumitelnou hlášku místo chyby z constraintu — ne aby ho nahradily.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  executionStatusEnum,
  licenseModeEnum,
  outcomeStatusEnum,
  relationTypeEnum,
  sourceTypeEnum,
  topicEnum,
} from "@/db/enums";
import type { AppDatabase } from "@/db/types";
import { deriveAssessability } from "@/modules/assessments/assessability";
import { promiseAssessments } from "@/modules/assessments/schema";
import { validateReadyForPublication } from "@/modules/assessments/statusRules";
import { evidence, promiseEvidence } from "@/modules/evidence/schema";
import { promises, promiseSources } from "@/modules/promises/schema";
import { auditLogs, corrections, reviewDecisions } from "@/modules/review/schema";
import {
  checkTransition,
  isEditableState,
  nextState,
  type WorkflowAction,
} from "@/modules/review/workflow";
import { sourceDocuments } from "@/modules/sources/schema";
import { contentHash } from "@/db/seed/ids";

/** Chyba určená redaktorovi. Text je bezpečné zobrazit beze změny. */
export class EditorialError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "EditorialError";
    this.issues = issues.length > 0 ? issues : [message];
  }
}

export interface Actor {
  id: string;
  displayName: string;
}

type Tx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

async function recordAudit(
  tx: Tx,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  payload?: { before?: unknown; after?: unknown },
): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: actor.id,
    action,
    entityType,
    entityId,
    beforeJson: payload?.before ?? null,
    afterJson: payload?.after ?? null,
  });
}

// ---------------------------------------------------------------------------
// Zdrojové dokumenty
// ---------------------------------------------------------------------------

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const sourceDocumentInputSchema = z
  .object({
    sourceType: z.enum(sourceTypeEnum.enumValues),
    title: trimmed(500),
    publisher: trimmed(200),
    url: z.union([z.url().max(2000), z.literal("")]).optional(),
    publishedAt: z.iso.date().optional().or(z.literal("")),
    licenseMode: z.enum(licenseModeEnum.enumValues),
    rawText: z.string().max(2_000_000).optional(),
    isDemo: z.boolean().default(false),
  })
  .refine((value) => value.licenseMode === "FULL_TEXT_STORED" || !value.rawText?.trim(), {
    message:
      "U dokumentu bez licence k plnému textu se text neukládá. Pracuj jen s krátkým citátem v důkazech.",
    path: ["rawText"],
  });

export type SourceDocumentInput = z.input<typeof sourceDocumentInputSchema>;

export async function createSourceDocument(
  db: AppDatabase,
  actor: Actor,
  rawInput: SourceDocumentInput,
): Promise<string> {
  const input = parse(sourceDocumentInputSchema, rawInput);
  const storedText = input.licenseMode === "FULL_TEXT_STORED" ? (input.rawText?.trim() ?? "") : "";

  if (input.licenseMode === "FULL_TEXT_STORED" && storedText.length === 0) {
    throw new EditorialError("U dokumentu s plným textem musí být text vyplněný.");
  }

  // Otisk brání dvojímu nahrání téhož dokumentu. U dokumentů bez uloženého textu
  // se počítá z identity dokumentu, jinak by všechny měly stejný otisk.
  const hash = contentHash(
    storedText.length > 0 ? storedText : `${input.title}|${input.url ?? ""}`,
  );

  const [existing] = await db
    .select({ id: sourceDocuments.id, title: sourceDocuments.title })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.contentHash, hash))
    .limit(1);

  if (existing) {
    throw new EditorialError(
      `Tentýž dokument už v systému je pod názvem „${existing.title}". Zdroje se neduplikují.`,
    );
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(sourceDocuments)
      .values({
        sourceType: input.sourceType,
        title: input.title,
        publisher: input.publisher,
        url: input.url ? input.url : null,
        publishedAt: input.publishedAt ? input.publishedAt : null,
        retrievedAt: new Date(),
        contentHash: hash,
        licenseMode: input.licenseMode,
        rawText: storedText.length > 0 ? storedText : null,
        isDemo: input.isDemo,
        processingState: "REVIEW_REQUIRED",
      })
      .returning({ id: sourceDocuments.id });

    if (!created) throw new EditorialError("Dokument se nepodařilo uložit.");

    await recordAudit(tx, actor, "source.create", "source_document", created.id, {
      after: { title: input.title, sourceType: input.sourceType },
    });

    return created.id;
  });
}

// ---------------------------------------------------------------------------
// Kandidát na slib
// ---------------------------------------------------------------------------

export const candidatePromiseInputSchema = z.object({
  electoralListId: z.uuid(),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug smí obsahovat jen malá písmena bez diakritiky, číslice a pomlčky.",
    ),
  title: trimmed(300),
  originalText: trimmed(4000),
  normalizedStatement: z.string().trim().max(4000).optional(),
  topic: z.enum(topicEnum.enumValues),
  deadlineText: z.string().trim().max(200).optional(),
  deadlineOn: z.iso.date().optional().or(z.literal("")),
  sourceDocumentId: z.uuid(),
  sourceExcerpt: trimmed(4000),
  sourcePageNumber: z.coerce.number().int().min(1).max(100_000).optional(),
  sourceLocator: z.string().trim().max(200).optional(),
});

export type CandidatePromiseInput = z.input<typeof candidatePromiseInputSchema>;

export async function createCandidatePromise(
  db: AppDatabase,
  actor: Actor,
  rawInput: CandidatePromiseInput,
): Promise<string> {
  const input = parse(candidatePromiseInputSchema, rawInput);

  // Doslovné znění musí ve zdroji opravdu stát. U dokumentů s uloženým textem
  // to jde ověřit, ne jen předpokládat.
  await assertExcerptMatchesSource(db, input.sourceDocumentId, input.sourceExcerpt);

  if (!input.sourceExcerpt.includes(input.originalText)) {
    throw new EditorialError(
      "Doslovné znění slibu musí být obsaženo v citaci ze zdroje. Zkopíruj ho z ní přesně.",
    );
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(promises)
      .values({
        electoralListId: input.electoralListId,
        slug: input.slug,
        title: input.title,
        originalText: input.originalText,
        normalizedStatement: input.normalizedStatement?.trim() || null,
        topic: input.topic,
        deadlineText: input.deadlineText?.trim() || null,
        deadlineOn: input.deadlineOn ? input.deadlineOn : null,
        published: false,
      })
      .returning({ id: promises.id });

    if (!created) throw new EditorialError("Slib se nepodařilo uložit.");

    await tx.insert(promiseSources).values({
      promiseId: created.id,
      sourceDocumentId: input.sourceDocumentId,
      excerpt: input.sourceExcerpt,
      pageNumber: input.sourcePageNumber ?? null,
      locator: input.sourceLocator?.trim() || null,
      isPrimary: true,
    });

    await recordAudit(tx, actor, "promise.create", "promise", created.id, {
      after: { slug: input.slug, title: input.title },
    });

    return created.id;
  });
}

export const candidatePromiseEditSchema = candidatePromiseInputSchema
  .pick({
    title: true,
    normalizedStatement: true,
    topic: true,
    deadlineText: true,
    deadlineOn: true,
  })
  .extend({ promiseId: z.uuid() });

export async function updateCandidatePromise(
  db: AppDatabase,
  actor: Actor,
  rawInput: z.input<typeof candidatePromiseEditSchema>,
): Promise<void> {
  const input = parse(candidatePromiseEditSchema, rawInput);
  const promise = await loadPromise(db, input.promiseId);

  if (promise.published) {
    throw new EditorialError(
      "Publikovaný slib se takhle upravovat nedá. Změna hodnocení se dělá novou verzí, oprava textu přes korekci.",
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(promises)
      .set({
        title: input.title,
        normalizedStatement: input.normalizedStatement?.trim() || null,
        topic: input.topic,
        deadlineText: input.deadlineText?.trim() || null,
        deadlineOn: input.deadlineOn ? input.deadlineOn : null,
      })
      .where(eq(promises.id, input.promiseId));

    await recordAudit(tx, actor, "promise.edit", "promise", input.promiseId, {
      before: { title: promise.title, topic: promise.topic },
      after: { title: input.title, topic: input.topic },
    });
  });
}

// ---------------------------------------------------------------------------
// Důkazy
// ---------------------------------------------------------------------------

export const evidenceInputSchema = z.object({
  promiseId: z.uuid(),
  sourceDocumentId: z.uuid(),
  excerpt: trimmed(4000),
  pageNumber: z.coerce.number().int().min(1).max(100_000).optional(),
  locator: z.string().trim().max(200).optional(),
  relationType: z.enum(relationTypeEnum.enumValues),
  note: z.string().trim().max(2000).optional(),
});

export type EvidenceInput = z.input<typeof evidenceInputSchema>;

/**
 * Připojí důkaz ke slibu.
 *
 * Tři různé věci se tu vědomě nemíchají: dokument říká nějaký fakt, vazba říká,
 * proč je ten fakt pro slib podstatný, a hodnocení z toho teprve vyvozuje závěr.
 * Proto má vazba vlastní typ vztahu a vlastní poznámku, ne jedno textové pole.
 */
export async function attachEvidence(
  db: AppDatabase,
  actor: Actor,
  rawInput: EvidenceInput,
): Promise<string> {
  const input = parse(evidenceInputSchema, rawInput);
  await assertExcerptMatchesSource(db, input.sourceDocumentId, input.excerpt);

  return db.transaction(async (tx) => {
    const [createdEvidence] = await tx
      .insert(evidence)
      .values({
        sourceDocumentId: input.sourceDocumentId,
        excerpt: input.excerpt,
        pageNumber: input.pageNumber ?? null,
        locator: input.locator?.trim() || null,
      })
      .returning({ id: evidence.id });

    if (!createdEvidence) throw new EditorialError("Důkaz se nepodařilo uložit.");

    // Vazbu zakládá člověk, takže je rovnou ověřená a je zaznamenáno kým.
    // Nepotvrzené vazby vznikají až ve fázi 4 z návrhů modelu.
    const [link] = await tx
      .insert(promiseEvidence)
      .values({
        promiseId: input.promiseId,
        evidenceId: createdEvidence.id,
        relationType: input.relationType,
        humanVerified: true,
        verifiedById: actor.id,
        verifiedAt: new Date(),
        note: input.note?.trim() || null,
      })
      .returning({ id: promiseEvidence.id });

    if (!link) throw new EditorialError("Vazbu na důkaz se nepodařilo uložit.");

    await recordAudit(tx, actor, "evidence.attach", "promise_evidence", link.id, {
      after: { promiseId: input.promiseId, relationType: input.relationType },
    });

    return link.id;
  });
}

export async function detachEvidence(db: AppDatabase, actor: Actor, linkId: string): Promise<void> {
  const [link] = await db
    .select({
      id: promiseEvidence.id,
      promiseId: promiseEvidence.promiseId,
      relationType: promiseEvidence.relationType,
      published: promises.published,
    })
    .from(promiseEvidence)
    .innerJoin(promises, eq(promiseEvidence.promiseId, promises.id))
    .where(eq(promiseEvidence.id, linkId))
    .limit(1);

  if (!link) throw new EditorialError("Vazba na důkaz neexistuje.");
  if (link.published) {
    throw new EditorialError(
      "U publikovaného slibu důkaz odebrat nelze — publikované tvrzení by zůstalo bez opory. Použij korekci a novou verzi hodnocení.",
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(promiseEvidence).where(eq(promiseEvidence.id, linkId));
    await recordAudit(tx, actor, "evidence.detach", "promise_evidence", linkId, {
      before: { promiseId: link.promiseId, relationType: link.relationType },
    });
  });
}

// ---------------------------------------------------------------------------
// Hodnocení
// ---------------------------------------------------------------------------

const scoreField = z.coerce.number().int().min(0).max(5);

export const assessmentInputSchema = z.object({
  promiseId: z.uuid(),
  specificityScore: scoreField,
  measurabilityScore: scoreField,
  deadlineScore: scoreField,
  jurisdictionScore: scoreField,
  outcomeDefinitionScore: scoreField,
  executionStatus: z.enum(executionStatusEnum.enumValues),
  outcomeStatus: z.enum(outcomeStatusEnum.enumValues),
  summary: z.string().trim().max(4000).optional(),
  sourcesReviewedUpTo: z.iso.date(),
  changeReason: z.string().trim().max(2000).optional(),
});

export type AssessmentInput = z.input<typeof assessmentInputSchema>;

export async function createAssessmentDraft(
  db: AppDatabase,
  actor: Actor,
  rawInput: AssessmentInput,
): Promise<string> {
  const input = parse(assessmentInputSchema, rawInput);
  await loadPromise(db, input.promiseId);

  const [latest] = await db
    .select({ version: promiseAssessments.version, state: promiseAssessments.workflowState })
    .from(promiseAssessments)
    .where(eq(promiseAssessments.promiseId, input.promiseId))
    .orderBy(desc(promiseAssessments.version))
    .limit(1);

  if (latest && latest.state !== "PUBLISHED") {
    throw new EditorialError(
      "Nad tímto slibem už rozpracované hodnocení existuje. Dokonči ho, nebo ho nech vrátit k přepracování.",
    );
  }

  const version = (latest?.version ?? 0) + 1;
  if (version > 1 && !input.changeReason?.trim()) {
    throw new EditorialError(
      "Nová verze hodnocení musí uvádět důvod změny. Čtenář má vidět, proč se závěr posunul.",
    );
  }

  const derived = deriveAssessability(input);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(promiseAssessments)
      .values({
        promiseId: input.promiseId,
        version,
        previousAssessmentId: null,
        specificityScore: input.specificityScore,
        measurabilityScore: input.measurabilityScore,
        deadlineScore: input.deadlineScore,
        jurisdictionScore: input.jurisdictionScore,
        outcomeDefinitionScore: input.outcomeDefinitionScore,
        assessability: derived.level,
        methodologyVersion: derived.methodologyVersion,
        workflowState: "DRAFT",
        sourcesReviewedUpTo: input.sourcesReviewedUpTo,
        executionStatus: input.executionStatus,
        outcomeStatus: input.outcomeStatus,
        summary: input.summary?.trim() || null,
        changeReason: input.changeReason?.trim() || null,
        createdById: actor.id,
        isCurrent: false,
      })
      .returning({ id: promiseAssessments.id });

    if (!created) throw new EditorialError("Hodnocení se nepodařilo uložit.");

    if (version > 1) {
      const [previous] = await tx
        .select({ id: promiseAssessments.id })
        .from(promiseAssessments)
        .where(
          and(
            eq(promiseAssessments.promiseId, input.promiseId),
            eq(promiseAssessments.version, version - 1),
          ),
        )
        .limit(1);

      if (previous) {
        await tx
          .update(promiseAssessments)
          .set({ previousAssessmentId: previous.id })
          .where(eq(promiseAssessments.id, created.id));
      }
    }

    await recordAudit(tx, actor, "assessment.create", "promise_assessment", created.id, {
      after: { version, executionStatus: input.executionStatus },
    });

    return created.id;
  });
}

export const assessmentEditSchema = assessmentInputSchema
  .omit({ promiseId: true })
  .extend({ assessmentId: z.uuid() });

export async function updateAssessmentDraft(
  db: AppDatabase,
  actor: Actor,
  rawInput: z.input<typeof assessmentEditSchema>,
): Promise<void> {
  const input = parse(assessmentEditSchema, rawInput);
  const assessment = await loadAssessment(db, input.assessmentId);

  if (!isEditableState(assessment.workflowState)) {
    throw new EditorialError(
      "Hodnocení v tomto stavu se upravovat nedá. Recenzent ho musí nejdřív vrátit k přepracování.",
    );
  }

  if (assessment.createdById !== actor.id) {
    throw new EditorialError(
      "Upravovat hodnocení může jen jeho autor. Když je potřeba změna, vrať ho k přepracování s poznámkou.",
    );
  }

  if (assessment.version > 1 && !input.changeReason?.trim()) {
    throw new EditorialError("Nová verze hodnocení musí uvádět důvod změny.");
  }

  const derived = deriveAssessability(input);

  await db.transaction(async (tx) => {
    await tx
      .update(promiseAssessments)
      .set({
        specificityScore: input.specificityScore,
        measurabilityScore: input.measurabilityScore,
        deadlineScore: input.deadlineScore,
        jurisdictionScore: input.jurisdictionScore,
        outcomeDefinitionScore: input.outcomeDefinitionScore,
        assessability: derived.level,
        methodologyVersion: derived.methodologyVersion,
        sourcesReviewedUpTo: input.sourcesReviewedUpTo,
        executionStatus: input.executionStatus,
        outcomeStatus: input.outcomeStatus,
        summary: input.summary?.trim() || null,
        changeReason: input.changeReason?.trim() || null,
      })
      .where(eq(promiseAssessments.id, input.assessmentId));

    await recordAudit(tx, actor, "assessment.edit", "promise_assessment", input.assessmentId, {
      before: {
        executionStatus: assessment.executionStatus,
        outcomeStatus: assessment.outcomeStatus,
      },
      after: { executionStatus: input.executionStatus, outcomeStatus: input.outcomeStatus },
    });
  });
}

const REVIEW_DECISION_BY_ACTION = {
  SUBMIT: "EDIT",
  REQUEST_CHANGES: "REJECT",
  APPROVE: "ACCEPT",
  PUBLISH: "PUBLISH",
} as const satisfies Record<WorkflowAction, "EDIT" | "REJECT" | "ACCEPT" | "PUBLISH">;

export async function transitionAssessment(
  db: AppDatabase,
  actor: Actor,
  input: { assessmentId: string; action: Exclude<WorkflowAction, "PUBLISH">; note?: string },
): Promise<void> {
  const assessment = await loadAssessment(db, input.assessmentId);

  const problem = checkTransition(input.action, {
    currentState: assessment.workflowState,
    authorId: assessment.createdById,
    actorId: actor.id,
  });
  if (problem) throw new EditorialError(problem);

  const note = input.note?.trim();
  if (input.action === "REQUEST_CHANGES" && !note) {
    throw new EditorialError(
      "Vrácení k přepracování musí mít poznámku. Autor potřebuje vědět, co je špatně.",
    );
  }

  const target = nextState(input.action);

  await db.transaction(async (tx) => {
    await tx
      .update(promiseAssessments)
      .set(
        input.action === "APPROVE"
          ? { workflowState: target, reviewedById: actor.id, reviewedAt: new Date() }
          : { workflowState: target },
      )
      .where(eq(promiseAssessments.id, input.assessmentId));

    await tx.insert(reviewDecisions).values({
      reviewerId: actor.id,
      entityType: "promise_assessment",
      entityId: input.assessmentId,
      decision: REVIEW_DECISION_BY_ACTION[input.action],
      note: note ?? null,
    });

    await recordAudit(
      tx,
      actor,
      `assessment.${input.action.toLowerCase()}`,
      "promise_assessment",
      input.assessmentId,
      { before: { workflowState: assessment.workflowState }, after: { workflowState: target } },
    );
  });
}

export interface PublicationCheck {
  ready: boolean;
  issues: string[];
}

/** Tytéž kontroly, které publikaci provádí — jen bez zápisu, pro zobrazení v UI. */
export async function checkPublicationReadiness(
  db: AppDatabase,
  assessmentId: string,
): Promise<PublicationCheck> {
  const assessment = await loadAssessment(db, assessmentId);
  const facts = await loadPromiseFacts(db, assessment.promiseId);

  const issues = validateReadyForPublication({
    assessability: assessment.assessability,
    executionStatus: assessment.executionStatus,
    outcomeStatus: assessment.outcomeStatus,
    hasMeasuredMetric: facts.hasMeasuredMetric,
    hasVerifiedEvidence: facts.hasVerifiedEvidence,
    hasPrimarySource: facts.hasPrimarySource,
  });

  return { ready: issues.length === 0, issues };
}

export async function publishAssessment(
  db: AppDatabase,
  actor: Actor,
  assessmentId: string,
): Promise<void> {
  const assessment = await loadAssessment(db, assessmentId);

  const problem = checkTransition("PUBLISH", {
    currentState: assessment.workflowState,
    authorId: assessment.createdById,
    actorId: actor.id,
  });
  if (problem) throw new EditorialError(problem);

  const readiness = await checkPublicationReadiness(db, assessmentId);
  if (!readiness.ready) {
    throw new EditorialError("Hodnocení nesplňuje podmínky publikace.", readiness.issues);
  }

  await db.transaction(async (tx) => {
    // Předchozí publikovaná verze zůstává v datech, jen přestává být aktuální.
    await tx
      .update(promiseAssessments)
      .set({ isCurrent: false })
      .where(
        and(
          eq(promiseAssessments.promiseId, assessment.promiseId),
          eq(promiseAssessments.isCurrent, true),
        ),
      );

    await tx
      .update(promiseAssessments)
      .set({ workflowState: "PUBLISHED", isCurrent: true })
      .where(eq(promiseAssessments.id, assessmentId));

    await tx
      .update(promises)
      .set({ published: true, publishedAt: sql`COALESCE(${promises.publishedAt}, now())` })
      .where(eq(promises.id, assessment.promiseId));

    await tx.insert(reviewDecisions).values({
      reviewerId: actor.id,
      entityType: "promise_assessment",
      entityId: assessmentId,
      decision: "PUBLISH",
      note: null,
    });

    await recordAudit(tx, actor, "assessment.publish", "promise_assessment", assessmentId, {
      after: { version: assessment.version, promiseId: assessment.promiseId },
    });
  });
}

// ---------------------------------------------------------------------------
// Korekce
// ---------------------------------------------------------------------------

export const correctionInputSchema = z.object({
  promiseId: z.uuid(),
  kind: z.enum(["PUBLIC_CORRECTION", "PARTY_RESPONSE", "INTERNAL_REVISION"]),
  submitterName: z.string().trim().max(200).optional(),
  submitterOrganization: z.string().trim().max(200).optional(),
  body: trimmed(8000),
});

export async function createCorrection(
  db: AppDatabase,
  actor: Actor,
  rawInput: z.input<typeof correctionInputSchema>,
): Promise<string> {
  const input = parse(correctionInputSchema, rawInput);
  await loadPromise(db, input.promiseId);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(corrections)
      .values({
        promiseId: input.promiseId,
        kind: input.kind,
        status: "OPEN",
        submitterName: input.submitterName?.trim() || null,
        submitterOrganization: input.submitterOrganization?.trim() || null,
        body: input.body,
        handledById: actor.id,
      })
      .returning({ id: corrections.id });

    if (!created) throw new EditorialError("Podnět se nepodařilo uložit.");

    await recordAudit(tx, actor, "correction.create", "correction", created.id, {
      after: { promiseId: input.promiseId, kind: input.kind },
    });

    return created.id;
  });
}

export const correctionResolutionSchema = z.object({
  correctionId: z.uuid(),
  status: z.enum(["ACKNOWLEDGED", "APPLIED", "REJECTED"]),
  response: z.string().trim().max(8000).optional(),
  appliedAssessmentId: z.uuid().optional().or(z.literal("")),
});

export async function resolveCorrection(
  db: AppDatabase,
  actor: Actor,
  rawInput: z.input<typeof correctionResolutionSchema>,
): Promise<void> {
  const input = parse(correctionResolutionSchema, rawInput);

  const [existing] = await db
    .select()
    .from(corrections)
    .where(eq(corrections.id, input.correctionId))
    .limit(1);

  if (!existing) throw new EditorialError("Podnět neexistuje.");

  if (input.status === "APPLIED" && !input.appliedAssessmentId) {
    throw new EditorialError(
      "Promítnutí podnětu do hodnocení musí odkazovat na verzi, která z něj vzešla. Založ nejdřív novou verzi hodnocení.",
    );
  }

  const resolved = input.status !== "ACKNOWLEDGED";

  await db.transaction(async (tx) => {
    await tx
      .update(corrections)
      .set({
        status: input.status,
        response: input.response?.trim() || null,
        appliedAssessmentId: input.appliedAssessmentId ? input.appliedAssessmentId : null,
        handledById: actor.id,
        resolvedAt: resolved ? new Date() : null,
      })
      .where(eq(corrections.id, input.correctionId));

    await recordAudit(tx, actor, "correction.resolve", "correction", input.correctionId, {
      before: { status: existing.status },
      after: { status: input.status },
    });
  });
}

// ---------------------------------------------------------------------------
// Pomocné
// ---------------------------------------------------------------------------

function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new EditorialError(
      "Formulář obsahuje chyby.",
      result.error.issues.map((issue) =>
        issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
      ),
    );
  }
  return result.data;
}

async function loadPromise(db: AppDatabase, promiseId: string) {
  const [row] = await db.select().from(promises).where(eq(promises.id, promiseId)).limit(1);
  if (!row) throw new EditorialError("Slib neexistuje.");
  return row;
}

async function loadAssessment(db: AppDatabase, assessmentId: string) {
  const [row] = await db
    .select()
    .from(promiseAssessments)
    .where(eq(promiseAssessments.id, assessmentId))
    .limit(1);
  if (!row) throw new EditorialError("Hodnocení neexistuje.");
  return row;
}

interface PromiseFacts {
  hasPrimarySource: boolean;
  hasVerifiedEvidence: boolean;
  hasMeasuredMetric: boolean;
}

async function loadPromiseFacts(db: AppDatabase, promiseId: string): Promise<PromiseFacts> {
  const [row] = await db
    .select({
      primarySources: sql<number>`(
        select count(*) from promise_source
        where promise_source.promise_id = ${promiseId} and promise_source.is_primary
      )`,
      verifiedEvidence: sql<number>`(
        select count(*) from promise_evidence
        where promise_evidence.promise_id = ${promiseId} and promise_evidence.human_verified
      )`,
      measurements: sql<number>`(
        select count(*) from metric_measurement
        join promise_metric on promise_metric.id = metric_measurement.metric_id
        where promise_metric.promise_id = ${promiseId}
      )`,
    })
    .from(promises)
    .where(eq(promises.id, promiseId))
    .limit(1);

  if (!row) throw new EditorialError("Slib neexistuje.");

  return {
    hasPrimarySource: Number(row.primarySources) > 0,
    hasVerifiedEvidence: Number(row.verifiedEvidence) > 0,
    hasMeasuredMetric: Number(row.measurements) > 0,
  };
}

/**
 * Citát musí ve zdroji doslova stát.
 *
 * Zdrojový text je nedůvěryhodný obsah, se kterým se ale musí pracovat přesně:
 * kdyby se citace od originálu lišila, celý řetězec doložitelnosti přestane
 * platit. U dokumentů, kde plný text neukládáme (chráněná díla), ověřit nejde
 * a zůstává to na redaktorovi.
 */
async function assertExcerptMatchesSource(
  db: AppDatabase,
  sourceDocumentId: string,
  excerpt: string,
): Promise<void> {
  const [source] = await db
    .select({ rawText: sourceDocuments.rawText, title: sourceDocuments.title })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, sourceDocumentId))
    .limit(1);

  if (!source) throw new EditorialError("Zdrojový dokument neexistuje.");
  if (source.rawText === null) return;

  if (!source.rawText.includes(excerpt)) {
    throw new EditorialError(
      `Citace se v dokumentu „${source.title}" doslova nevyskytuje. Zkopíruj ji přesně, včetně interpunkce.`,
    );
  }
}
