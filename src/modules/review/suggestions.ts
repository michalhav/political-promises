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
import { desc, eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/types";
import { aiRuns, aiSuggestions } from "@/modules/ai/schema";
import { promiseExtractionOutputSchema } from "@/modules/ai/extraction";
import { promises } from "@/modules/promises/schema";
import { auditLogs } from "@/modules/review/schema";
import { createCandidatePromise, EditorialError, type Actor } from "@/modules/review/service";

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
    .where(eq(aiRuns.sourceDocumentId, sourceDocumentId))
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
    throw new EditorialError("Návrh nemá zdrojový dokument, ze kterého by slib vznikl.");
  }

  const parsed = storedSuggestionSchema.safeParse(row.payload);
  if (!parsed.success) {
    throw new EditorialError("Uložený návrh neodpovídá očekávané podobě a nedá se přijmout.");
  }

  return { ...row, sourceDocumentId: row.sourceDocumentId, candidate: parsed.data };
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

  const promiseId = await createCandidatePromise(db, actor, {
    electoralListId: input.electoralListId,
    slug: input.slug,
    title: input.title?.trim() || suggestion.candidate.suggestedTitle,
    originalText: suggestion.candidate.originalText,
    normalizedStatement: suggestion.candidate.normalizedStatement ?? undefined,
    topic: suggestion.candidate.topic,
    deadlineText: suggestion.candidate.deadlineText ?? undefined,
    sourceDocumentId: suggestion.sourceDocumentId,
    sourceExcerpt: suggestion.candidate.sourceExcerpt,
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
