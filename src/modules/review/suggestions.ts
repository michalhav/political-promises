/**
 * Revize návrhů od modelu.
 *
 * Návrh není slib. Slibem se stane jedině tím, že ho redaktor přijme — a přijetí
 * jde přes tutéž `createCandidatePromise` jako ruční zápis, takže platí i tytéž
 * kontroly citace. Model si tedy nemůže „zkratkou" založit slib, který by ruční
 * cestou neprošel.
 *
 * Odmítnutý návrh se nemaže. Zůstává i s původním payloadem, protože bez něj by
 * nešlo doložit, co model navrhoval a proč to redakce nevzala.
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { AppDatabase } from "@/db/types";
import type { RelationTypeValue } from "@/modules/sources/labels";
import { aiRuns, aiSuggestions } from "@/modules/ai/schema";
import { promiseExtractionOutputSchema } from "@/modules/ai/extraction";
import { evidenceMatchingOutputSchema } from "@/modules/ai/evidenceMatching";
import { promises } from "@/modules/promises/schema";
import { auditLogs } from "@/modules/review/schema";
import {
  attachEvidence,
  createCandidatePromise,
  EditorialError,
  type Actor,
} from "@/modules/review/service";

/** Payload uloženého návrhu = jeden kandidát plus dokument, ze kterého pochází. */
const storedSuggestionSchema = promiseExtractionOutputSchema.shape.candidatePromises.element;

export interface SuggestionRow {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";
  suggestedTitle: string;
  originalText: string;
  sourceExcerpt: string;
  topic: string;
  reasoningSummary: string;
  reviewNote: string | null;
  createdAt: Date;
  model: string;
  provider: string;
}

export async function listSuggestions(
  db: AppDatabase,
  sourceDocumentId: string,
): Promise<SuggestionRow[]> {
  const rows = await db
    .select({
      id: aiSuggestions.id,
      status: aiSuggestions.status,
      payload: aiSuggestions.payload,
      reviewNote: aiSuggestions.reviewNote,
      createdAt: aiSuggestions.createdAt,
      model: aiRuns.model,
      provider: aiRuns.provider,
    })
    .from(aiSuggestions)
    .innerJoin(aiRuns, eq(aiSuggestions.aiRunId, aiRuns.id))
    .where(
      and(eq(aiRuns.sourceDocumentId, sourceDocumentId), eq(aiRuns.taskType, "PROMISE_EXTRACTION")),
    )
    .orderBy(desc(aiSuggestions.createdAt));

  return rows.flatMap((row) => {
    const parsed = storedSuggestionSchema.safeParse(row.payload);
    // Payload je uložený JSON. Kdyby se schéma časem změnilo, starý návrh se
    // radši přeskočí, než aby shodil celou stránku.
    if (!parsed.success) return [];

    return [
      {
        id: row.id,
        status: row.status,
        suggestedTitle: parsed.data.suggestedTitle,
        originalText: parsed.data.originalText,
        sourceExcerpt: parsed.data.sourceExcerpt,
        topic: parsed.data.topic,
        reasoningSummary: parsed.data.reasoningSummary,
        reviewNote: row.reviewNote,
        createdAt: row.createdAt,
        model: row.model,
        provider: row.provider,
      },
    ];
  });
}

async function loadPending(db: AppDatabase, suggestionId: string) {
  const [row] = await db
    .select({
      id: aiSuggestions.id,
      status: aiSuggestions.status,
      payload: aiSuggestions.payload,
      sourceDocumentId: aiRuns.sourceDocumentId,
    })
    .from(aiSuggestions)
    .innerJoin(aiRuns, eq(aiSuggestions.aiRunId, aiRuns.id))
    .where(eq(aiSuggestions.id, suggestionId))
    .limit(1);

  if (!row) throw new EditorialError("Návrh neexistuje.");
  if (row.status !== "PENDING") {
    throw new EditorialError("O tomhle návrhu už je rozhodnuto.");
  }
  if (!row.sourceDocumentId) {
    throw new EditorialError("Návrh nemá zdrojový dokument, ze kterého by záznam vznikl.");
  }

  // Payload se tu **nevaliduje**: kandidát a důkaz mají každý jiné schéma.
  // Ověřuje si ho ten, kdo návrh přijímá — tady se řeší jen to, jestli je
  // o čem rozhodovat.
  return { ...row, sourceDocumentId: row.sourceDocumentId };
}

export interface AcceptSuggestionInput {
  suggestionId: string;
  electoralListId: string;
  slug: string;
  /** Redaktor smí návrh před přijetím opravit — je to jeho podpis, ne modelův. */
  title?: string;
  note?: string;
}

export async function acceptSuggestion(
  db: AppDatabase,
  actor: Actor,
  input: AcceptSuggestionInput,
): Promise<string> {
  const suggestion = await loadPending(db, input.suggestionId);
  const parsed = storedSuggestionSchema.safeParse(suggestion.payload);
  if (!parsed.success) {
    throw new EditorialError("Uložený návrh kandidáta neodpovídá očekávané podobě.");
  }
  const candidate = parsed.data;

  const promiseId = await createCandidatePromise(db, actor, {
    electoralListId: input.electoralListId,
    slug: input.slug,
    title: input.title?.trim() || candidate.suggestedTitle,
    originalText: candidate.originalText,
    normalizedStatement: candidate.normalizedStatement ?? undefined,
    topic: candidate.topic,
    deadlineText: candidate.deadlineText ?? undefined,
    sourceDocumentId: suggestion.sourceDocumentId,
    sourceExcerpt: candidate.sourceExcerpt,
  });

  // Provenience podle pravidla 7: u slibu musí zůstat vidět, že ho našel stroj.
  await db
    .update(promises)
    .set({ aiSuggestionId: suggestion.id })
    .where(eq(promises.id, promiseId));

  await db
    .update(aiSuggestions)
    .set({
      status: "ACCEPTED",
      reviewedById: actor.id,
      reviewedAt: new Date(),
      reviewNote: input.note?.trim() || null,
    })
    .where(eq(aiSuggestions.id, suggestion.id));

  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "ai.suggestion.accept",
    entityType: "ai_suggestion",
    entityId: suggestion.id,
    afterJson: { promiseId, slug: input.slug },
  });

  return promiseId;
}

/**
 * Návrh důkazu tak, jak se uložil: shoda plus slib, ke kterému patří.
 *
 * Schéma je vlastní, ne odvozené z odpovědi modelu — v odpovědi je pořadové
 * číslo slibu, v uloženém návrhu už jeho identifikátor.
 */
const storedEvidenceSchema = evidenceMatchingOutputSchema.shape.matches.element
  .omit({ promiseNumber: true })
  .extend({
    promiseId: z.uuid(),
    promiseTitle: z.string(),
    sourceDocumentId: z.uuid(),
  });

export interface EvidenceSuggestionRow {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";
  promiseId: string;
  promiseTitle: string;
  relationType: RelationTypeValue;
  excerpt: string;
  explanation: string;
  limitationNote: string | null;
  reviewNote: string | null;
  model: string;
  provider: string;
}

export async function listEvidenceSuggestions(
  db: AppDatabase,
  sourceDocumentId: string,
): Promise<EvidenceSuggestionRow[]> {
  const rows = await db
    .select({
      id: aiSuggestions.id,
      status: aiSuggestions.status,
      payload: aiSuggestions.payload,
      reviewNote: aiSuggestions.reviewNote,
      model: aiRuns.model,
      provider: aiRuns.provider,
    })
    .from(aiSuggestions)
    .innerJoin(aiRuns, eq(aiSuggestions.aiRunId, aiRuns.id))
    .where(
      and(eq(aiRuns.sourceDocumentId, sourceDocumentId), eq(aiRuns.taskType, "EVIDENCE_MATCHING")),
    )
    .orderBy(desc(aiSuggestions.createdAt));

  return rows.flatMap((row) => {
    const parsed = storedEvidenceSchema.safeParse(row.payload);
    if (!parsed.success) return [];

    return [
      {
        id: row.id,
        status: row.status,
        promiseId: parsed.data.promiseId,
        promiseTitle: parsed.data.promiseTitle,
        relationType: parsed.data.relationType,
        excerpt: parsed.data.excerpt,
        explanation: parsed.data.explanation,
        limitationNote: parsed.data.limitationNote,
        reviewNote: row.reviewNote,
        model: row.model,
        provider: row.provider,
      },
    ];
  });
}

/**
 * Přijetí návrhu důkazu.
 *
 * Vazba vzniká přes tutéž `attachEvidence` jako ruční připojení, takže je
 * rovnou **ověřená člověkem** a je zaznamenáno kým. Nepotvrzené vazby v datech
 * nevznikají: buď to redaktor vzal a ručí za to, nebo návrh zůstal návrhem.
 */
export async function acceptEvidenceSuggestion(
  db: AppDatabase,
  actor: Actor,
  input: { suggestionId: string; relationType?: RelationTypeValue; note?: string },
): Promise<string> {
  const suggestion = await loadPending(db, input.suggestionId);
  const parsed = storedEvidenceSchema.safeParse(suggestion.payload);
  if (!parsed.success) {
    throw new EditorialError("Uložený návrh důkazu neodpovídá očekávané podobě.");
  }

  const linkId = await attachEvidence(db, actor, {
    promiseId: parsed.data.promiseId,
    sourceDocumentId: parsed.data.sourceDocumentId,
    excerpt: parsed.data.excerpt,
    relationType: input.relationType ?? parsed.data.relationType,
    note: parsed.data.explanation,
    limitationNote: parsed.data.limitationNote ?? undefined,
  });

  await db
    .update(aiSuggestions)
    .set({
      status: "ACCEPTED",
      reviewedById: actor.id,
      reviewedAt: new Date(),
      reviewNote: input.note?.trim() || null,
    })
    .where(eq(aiSuggestions.id, suggestion.id));

  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "ai.evidence.accept",
    entityType: "ai_suggestion",
    entityId: suggestion.id,
    afterJson: { linkId, promiseId: parsed.data.promiseId },
  });

  return linkId;
}

export async function rejectSuggestion(
  db: AppDatabase,
  actor: Actor,
  input: { suggestionId: string; note: string },
): Promise<void> {
  const suggestion = await loadPending(db, input.suggestionId);

  const note = input.note.trim();
  if (!note) {
    throw new EditorialError(
      "Odmítnutí musí mít důvod. Bez něj se nedá poznat, jestli model chyboval, nebo redakce.",
    );
  }

  await db
    .update(aiSuggestions)
    .set({
      status: "REJECTED",
      reviewedById: actor.id,
      reviewedAt: new Date(),
      reviewNote: note,
    })
    .where(eq(aiSuggestions.id, suggestion.id));

  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "ai.suggestion.reject",
    entityType: "ai_suggestion",
    entityId: suggestion.id,
    afterJson: { note },
  });
}
