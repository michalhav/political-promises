/**
 * Prohlášení o střetu zájmů při schvalování (B3).
 *
 * Pravidlo čtyř očí hlídá jedinou věc: že neschvaluje autor. Že recenzent není
 * z téže kandidátky, o které slib je, nehlídá nic — a přesně tam by útok na
 * důvěryhodnost mířil. Prohlášení se proto vyžaduje výslovně a zůstává
 * u rozhodnutí, aby šlo doložit, kdo co tvrdil.
 */
import { desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { promises } from "@/modules/promises/schema";
import { reviewDecisions } from "@/modules/review/schema";
import {
  createAssessmentDraft,
  EditorialError,
  transitionAssessment,
  type Actor,
} from "@/modules/review/service";

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };
const reviewer: Actor = { id: seedId("user:redaktor-2"), displayName: "Demo redaktor 2" };

let assessmentId = "";

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);

  const [promise] = await handle.db
    .select({ id: promises.id })
    .from(promises)
    .where(eq(promises.slug, "demo-a-2000-mestskych-najemnich-bytu"))
    .limit(1);
  if (!promise) throw new Error("Ukázková data neobsahují očekávaný slib.");

  assessmentId = await createAssessmentDraft(handle.db, editor, {
    promiseId: promise.id,
    specificityScore: 4,
    measurabilityScore: 4,
    deadlineScore: 3,
    jurisdictionScore: 4,
    outcomeDefinitionScore: 3,
    executionStatus: "NO_VERIFIED_PROGRESS",
    outcomeStatus: "NOT_MEASURABLE_YET",
    sourcesReviewedUpTo: "2026-08-22",
    changeReason: "Kontrola prohlášení o střetu zájmů.",
  });
  await transitionAssessment(handle.db, editor, { assessmentId, action: "SUBMIT" });
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("schválení hodnocení", () => {
  it("bez prohlášení neprojde", async () => {
    await expect(
      transitionAssessment(handle.db, reviewer, { assessmentId, action: "APPROVE" }),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("prohlášení se nedá obejít prázdnou hodnotou", async () => {
    await expect(
      transitionAssessment(handle.db, reviewer, {
        assessmentId,
        action: "APPROVE",
        conflictFree: false,
      }),
    ).rejects.toThrow(/prohlášení/);
  });

  it("s prohlášením projde a zůstane u rozhodnutí", async () => {
    await transitionAssessment(handle.db, reviewer, {
      assessmentId,
      action: "APPROVE",
      conflictFree: true,
    });

    const [decision] = await handle.db
      .select({
        reviewerId: reviewDecisions.reviewerId,
        decision: reviewDecisions.decision,
        conflictDeclared: reviewDecisions.conflictDeclared,
      })
      .from(reviewDecisions)
      .where(eq(reviewDecisions.entityId, assessmentId))
      .orderBy(desc(reviewDecisions.createdAt))
      .limit(1);

    expect(decision?.reviewerId).toBe(reviewer.id);
    expect(decision?.conflictDeclared).toBe(true);
  });

  it("u vrácení k přepracování se prohlášení nevyžaduje ani nezapisuje", async () => {
    // Vrátit práci není schválení; nic se tím nepouští k publikaci.
    const [promise] = await handle.db
      .select({ id: promises.id })
      .from(promises)
      .where(eq(promises.slug, "demo-a-tramvajova-trat-do-demo-ctvrti"))
      .limit(1);
    if (!promise) throw new Error("Ukázková data neobsahují očekávaný slib.");

    const draftId = await createAssessmentDraft(handle.db, editor, {
      promiseId: promise.id,
      specificityScore: 3,
      measurabilityScore: 3,
      deadlineScore: 2,
      jurisdictionScore: 4,
      outcomeDefinitionScore: 2,
      executionStatus: "NO_VERIFIED_PROGRESS",
      outcomeStatus: "NOT_MEASURABLE_YET",
      sourcesReviewedUpTo: "2026-08-22",
      changeReason: "Kontrola vrácení.",
    });
    await transitionAssessment(handle.db, editor, { assessmentId: draftId, action: "SUBMIT" });
    await transitionAssessment(handle.db, reviewer, {
      assessmentId: draftId,
      action: "REQUEST_CHANGES",
      note: "Chybí doklad o zahájení stavby.",
    });

    const [decision] = await handle.db
      .select({ conflictDeclared: reviewDecisions.conflictDeclared })
      .from(reviewDecisions)
      .where(eq(reviewDecisions.entityId, draftId))
      .orderBy(desc(reviewDecisions.createdAt))
      .limit(1);

    expect(decision?.conflictDeclared).toBeNull();
  });
});
