/**
 * Redakční workflow proti skutečné databázi.
 *
 * Testy jdou po sobě jako jeden příběh: zdroj → kandidát → důkaz → hodnocení →
 * revize → publikace → nová verze → korekce. Je to schválně, protože právě
 * tenhle sled musí fungovat celý; izolované testy jednotlivých kroků by
 * neodhalily, že si někde nesedí stav.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { promiseAssessments } from "@/modules/assessments/schema";
import { promises } from "@/modules/promises/schema";
import {
  attachEvidence,
  createAssessmentDraft,
  createCandidatePromise,
  createCorrection,
  createSourceDocument,
  EditorialError,
  publishAssessment,
  resolveCorrection,
  transitionAssessment,
  updateAssessmentDraft,
  type Actor,
} from "@/modules/review/service";

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };
const reviewer: Actor = { id: seedId("user:redaktor-2"), displayName: "Demo redaktor 2" };
const LIST_ID = seedId("electoral-list:demo-a-2022");

const PROMISE_TEXT = "Zavedeme bezplatnou MHD pro seniory nad 70 let do konce roku 2025.";
const EVIDENCE_TEXT = "Rada schválila zavedení bezplatné MHD pro seniory nad 70 let.";

let sourceId = "";
let promiseId = "";
let slug = "";

async function currentAssessment(promiseIdentifier: string) {
  const [row] = await handle.db
    .select()
    .from(promiseAssessments)
    .where(eq(promiseAssessments.promiseId, promiseIdentifier))
    .orderBy(promiseAssessments.version);
  return row;
}

async function latestAssessment(promiseIdentifier: string) {
  const rows = await handle.db
    .select()
    .from(promiseAssessments)
    .where(eq(promiseAssessments.promiseId, promiseIdentifier))
    .orderBy(promiseAssessments.version);
  return rows.at(-1);
}

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("zdrojový dokument", () => {
  it("editor založí zdroj s plným textem", async () => {
    sourceId = await createSourceDocument(handle.db, editor, {
      sourceType: "ELECTION_PROGRAM",
      title: "Testovací volební program",
      publisher: "Demo strana A",
      url: "https://example.org/demo/test-program.pdf",
      publishedAt: "2022-08-15",
      licenseMode: "FULL_TEXT_STORED",
      rawText: ["PROGRAM", PROMISE_TEXT, EVIDENCE_TEXT].join("\n"),
      isDemo: true,
    });

    expect(sourceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("tentýž dokument nejde nahrát dvakrát", async () => {
    await expect(
      createSourceDocument(handle.db, editor, {
        sourceType: "ELECTION_PROGRAM",
        title: "Jiný název, stejný obsah",
        publisher: "Demo strana A",
        licenseMode: "FULL_TEXT_STORED",
        rawText: ["PROGRAM", PROMISE_TEXT, EVIDENCE_TEXT].join("\n"),
        isDemo: true,
      }),
    ).rejects.toThrow(EditorialError);
  });

  it("u dokumentu bez licence se plný text neuloží", async () => {
    await expect(
      createSourceDocument(handle.db, editor, {
        sourceType: "MEDIA_REPORT",
        title: "Chráněný článek",
        publisher: "Demo deník",
        licenseMode: "QUOTE_ONLY",
        rawText: "Celý text článku, který ukládat nesmíme.",
        isDemo: true,
      }),
    ).rejects.toThrow(EditorialError);
  });
});

describe("kandidát na slib", () => {
  it("editor založí kandidáta, který není veřejný", async () => {
    slug = "test-bezplatna-mhd-pro-seniory";
    promiseId = await createCandidatePromise(handle.db, editor, {
      electoralListId: LIST_ID,
      slug,
      title: "Bezplatná MHD pro seniory nad 70 let",
      originalText: PROMISE_TEXT,
      topic: "TRANSPORT",
      sourceDocumentId: sourceId,
      sourceExcerpt: PROMISE_TEXT,
      sourcePageNumber: 8,
    });

    const [row] = await handle.db.select().from(promises).where(eq(promises.id, promiseId));
    expect(row?.published).toBe(false);
    expect(row?.publishedAt).toBeNull();
  });

  it("citace, která ve zdroji nestojí, neprojde", async () => {
    await expect(
      createCandidatePromise(handle.db, editor, {
        electoralListId: LIST_ID,
        slug: "test-vymyslena-citace",
        title: "Vymyšlené",
        originalText: "Tohle v dokumentu není.",
        topic: "OTHER",
        sourceDocumentId: sourceId,
        sourceExcerpt: "Tohle v dokumentu není.",
      }),
    ).rejects.toThrow(/doslova nevyskytuje/);
  });
});

describe("hodnocení a revize", () => {
  let assessmentId = "";

  it("editor založí rozpracované hodnocení", async () => {
    assessmentId = await createAssessmentDraft(handle.db, editor, {
      promiseId,
      specificityScore: 5,
      measurabilityScore: 5,
      deadlineScore: 4,
      jurisdictionScore: 5,
      outcomeDefinitionScore: 4,
      // Rešerše proběhla, doklad o realizaci se nenašel. Netvrdíme, že nenastala.
      executionStatus: "NO_VERIFIED_PROGRESS",
      outcomeStatus: "NOT_MEASURABLE_YET",
      summary: "K rozhodnému datu jsme nenašli doklad o zavedení.",
      sourcesReviewedUpTo: "2026-08-01",
    });

    const assessment = await currentAssessment(promiseId);
    expect(assessment?.workflowState).toBe("DRAFT");
    expect(assessment?.isCurrent).toBe(false);
    expect(assessment?.assessability).toBe("HIGH");
    expect(assessment?.sourcesReviewedUpTo).toBe("2026-08-01");
  });

  it("rozpracované hodnocení nelze publikovat rovnou", async () => {
    await expect(publishAssessment(handle.db, reviewer, assessmentId)).rejects.toThrow(
      /nelze provést nad hodnocením ve stavu/,
    );
  });

  it("upravit hodnocení může jen jeho autor", async () => {
    await expect(
      updateAssessmentDraft(handle.db, reviewer, {
        assessmentId,
        specificityScore: 1,
        measurabilityScore: 1,
        deadlineScore: 1,
        jurisdictionScore: 1,
        outcomeDefinitionScore: 1,
        executionStatus: "NO_VERIFIED_PROGRESS",
        outcomeStatus: "NOT_MEASURABLE_YET",
        sourcesReviewedUpTo: "2026-08-01",
      }),
    ).rejects.toThrow(/jen jeho autor/);
  });

  it("editor předá hodnocení k revizi", async () => {
    await transitionAssessment(handle.db, editor, { assessmentId, action: "SUBMIT" });
    expect((await currentAssessment(promiseId))?.workflowState).toBe("IN_REVIEW");
  });

  it("autor nesmí schválit vlastní práci (pravidlo čtyř očí)", async () => {
    await expect(
      transitionAssessment(handle.db, editor, { assessmentId, action: "APPROVE" }),
    ).rejects.toThrow(/vlastní autor/);
  });

  it("recenzent vrátí hodnocení s poznámkou", async () => {
    await expect(
      transitionAssessment(handle.db, reviewer, { assessmentId, action: "REQUEST_CHANGES" }),
    ).rejects.toThrow(/musí mít poznámku/);

    await transitionAssessment(handle.db, reviewer, {
      assessmentId,
      action: "REQUEST_CHANGES",
      note: "Doplň prosím doklad o projednání v radě.",
    });

    expect((await currentAssessment(promiseId))?.workflowState).toBe("CHANGES_REQUESTED");
  });

  it("editor doplní důkaz a hodnocení znovu předá", async () => {
    await attachEvidence(handle.db, editor, {
      promiseId,
      sourceDocumentId: sourceId,
      excerpt: EVIDENCE_TEXT,
      relationType: "IMPLEMENTATION",
      note: "Doklad o rozhodnutí rady.",
    });

    await updateAssessmentDraft(handle.db, editor, {
      assessmentId,
      specificityScore: 5,
      measurabilityScore: 5,
      deadlineScore: 4,
      jurisdictionScore: 5,
      outcomeDefinitionScore: 4,
      executionStatus: "IN_PROGRESS",
      outcomeStatus: "NOT_MEASURABLE_YET",
      summary: "Rada zavedení schválila, realizace běží.",
      sourcesReviewedUpTo: "2026-08-10",
    });

    await transitionAssessment(handle.db, editor, { assessmentId, action: "SUBMIT" });
    expect((await currentAssessment(promiseId))?.workflowState).toBe("IN_REVIEW");
  });

  it("recenzent schválí a publikuje", async () => {
    await transitionAssessment(handle.db, reviewer, { assessmentId, action: "APPROVE" });

    const approved = await currentAssessment(promiseId);
    expect(approved?.workflowState).toBe("APPROVED");
    expect(approved?.reviewedById).toBe(reviewer.id);

    await publishAssessment(handle.db, reviewer, assessmentId);

    const publishedAssessment = await currentAssessment(promiseId);
    expect(publishedAssessment?.workflowState).toBe("PUBLISHED");
    expect(publishedAssessment?.isCurrent).toBe(true);

    const [promise] = await handle.db.select().from(promises).where(eq(promises.id, promiseId));
    expect(promise?.published).toBe(true);
    expect(promise?.publishedAt).not.toBeNull();
  });

  it("publikované hodnocení už nejde přepsat", async () => {
    await expect(
      updateAssessmentDraft(handle.db, editor, {
        assessmentId,
        specificityScore: 0,
        measurabilityScore: 0,
        deadlineScore: 0,
        jurisdictionScore: 0,
        outcomeDefinitionScore: 0,
        executionStatus: "COMPLETED",
        outcomeStatus: "ACHIEVED",
        sourcesReviewedUpTo: "2026-08-10",
      }),
    ).rejects.toThrow(/v tomto stavu se upravovat nedá/);

    // A ani obejitím servisní vrstvy.
    await expect(
      handle.client.query("update promise_assessment set summary = 'jinak' where id = $1", [
        assessmentId,
      ]),
    ).rejects.toThrow(/je neměnné/);
  });
});

describe("podmínky publikace", () => {
  let secondPromiseId = "";
  let draftId = "";

  beforeAll(async () => {
    secondPromiseId = await createCandidatePromise(handle.db, editor, {
      electoralListId: LIST_ID,
      slug: "test-druhy-slib",
      title: "Druhý testovací slib",
      originalText: EVIDENCE_TEXT,
      topic: "TRANSPORT",
      sourceDocumentId: sourceId,
      sourceExcerpt: EVIDENCE_TEXT,
    });
  });

  it("stav „nezjištěno“ se publikovat nedá — je to workflow, ne závěr", async () => {
    draftId = await createAssessmentDraft(handle.db, editor, {
      promiseId: secondPromiseId,
      specificityScore: 4,
      measurabilityScore: 4,
      deadlineScore: 3,
      jurisdictionScore: 5,
      outcomeDefinitionScore: 3,
      executionStatus: "UNKNOWN",
      outcomeStatus: "UNKNOWN",
      sourcesReviewedUpTo: "2026-08-10",
    });

    await transitionAssessment(handle.db, editor, { assessmentId: draftId, action: "SUBMIT" });
    await transitionAssessment(handle.db, reviewer, { assessmentId: draftId, action: "APPROVE" });

    // Konkrétní důvody jsou v `issues`, aby je šlo vypsat u formuláře.
    await expect(publishAssessment(handle.db, reviewer, draftId)).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.stringContaining("zatím nebyl prozkoumán")]),
    });
  });

  it("„nezahájeno“ bez doloženého zdroje neprojde, „bez doloženého postupu“ ano", async () => {
    const thirdId = await createCandidatePromise(handle.db, editor, {
      electoralListId: LIST_ID,
      slug: "test-treti-slib",
      title: "Třetí testovací slib",
      originalText: PROMISE_TEXT,
      topic: "TRANSPORT",
      sourceDocumentId: sourceId,
      sourceExcerpt: PROMISE_TEXT,
    });

    const notStartedId = await createAssessmentDraft(handle.db, editor, {
      promiseId: thirdId,
      specificityScore: 4,
      measurabilityScore: 4,
      deadlineScore: 3,
      jurisdictionScore: 5,
      outcomeDefinitionScore: 3,
      executionStatus: "NOT_STARTED",
      outcomeStatus: "NOT_MEASURABLE_YET",
      sourcesReviewedUpTo: "2026-08-10",
    });

    await transitionAssessment(handle.db, editor, {
      assessmentId: notStartedId,
      action: "SUBMIT",
    });
    await transitionAssessment(handle.db, reviewer, {
      assessmentId: notStartedId,
      action: "APPROVE",
    });

    await expect(publishAssessment(handle.db, reviewer, notStartedId)).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.stringContaining("ověřenou vazbu na zdrojový dokument"),
      ]),
    });

    // Tentýž slib, tentýž stav dokladů — jen poctivější formulace závěru.
    await handle.client.query(
      "update promise_assessment set execution_status = 'NO_VERIFIED_PROGRESS' where id = $1",
      [notStartedId],
    );

    await expect(publishAssessment(handle.db, reviewer, notStartedId)).resolves.toBeUndefined();
  });
});

describe("nová verze a korekce", () => {
  it("nová verze nepřepíše starou a vyžaduje důvod změny", async () => {
    await expect(
      createAssessmentDraft(handle.db, editor, {
        promiseId,
        specificityScore: 5,
        measurabilityScore: 5,
        deadlineScore: 4,
        jurisdictionScore: 5,
        outcomeDefinitionScore: 4,
        executionStatus: "COMPLETED",
        outcomeStatus: "NOT_MEASURABLE_YET",
        sourcesReviewedUpTo: "2026-08-20",
      }),
    ).rejects.toThrow(/důvod změny/);

    const v2 = await createAssessmentDraft(handle.db, editor, {
      promiseId,
      specificityScore: 5,
      measurabilityScore: 5,
      deadlineScore: 4,
      jurisdictionScore: 5,
      outcomeDefinitionScore: 4,
      executionStatus: "COMPLETED",
      outcomeStatus: "NOT_MEASURABLE_YET",
      summary: "Zavedení bylo dokončeno.",
      sourcesReviewedUpTo: "2026-08-20",
      changeReason: "Vyšla zpráva o zavedení bezplatné MHD.",
    });

    const rows = await handle.db
      .select()
      .from(promiseAssessments)
      .where(eq(promiseAssessments.promiseId, promiseId))
      .orderBy(promiseAssessments.version);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.version).toBe(1);
    expect(rows[0]?.workflowState).toBe("PUBLISHED");
    // Historie zůstává čitelná: první verze má pořád svůj původní závěr.
    expect(rows[0]?.executionStatus).toBe("IN_PROGRESS");
    expect(rows[1]?.id).toBe(v2);
    expect(rows[1]?.previousAssessmentId).toBe(rows[0]?.id);
  });

  it("publikace nové verze zhasne tu starou, ale nesmaže ji", async () => {
    const draft = await latestAssessment(promiseId);
    if (!draft) throw new Error("Chybí rozpracovaná verze.");

    await transitionAssessment(handle.db, editor, {
      assessmentId: draft.id,
      action: "SUBMIT",
    });
    await transitionAssessment(handle.db, reviewer, {
      assessmentId: draft.id,
      action: "APPROVE",
    });
    await publishAssessment(handle.db, reviewer, draft.id);

    const rows = await handle.db
      .select()
      .from(promiseAssessments)
      .where(eq(promiseAssessments.promiseId, promiseId))
      .orderBy(promiseAssessments.version);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.isCurrent).toBe(false);
    expect(rows[1]?.isCurrent).toBe(true);
  });

  it("korekce se váže na verzi, která z ní vzešla", async () => {
    const correctionId = await createCorrection(handle.db, reviewer, {
      promiseId,
      kind: "PARTY_RESPONSE",
      submitterOrganization: "Demo strana A",
      body: "Považujeme formulaci za nepřesnou.",
    });

    await expect(
      resolveCorrection(handle.db, reviewer, { correctionId, status: "APPLIED" }),
    ).rejects.toThrow(/odkazovat na verzi/);

    const latest = await latestAssessment(promiseId);
    await resolveCorrection(handle.db, reviewer, {
      correctionId,
      status: "APPLIED",
      response: "Doplnili jsme upřesnění.",
      appliedAssessmentId: latest?.id,
    });

    const rows = await handle.db
      .select()
      .from(promiseAssessments)
      .where(eq(promiseAssessments.promiseId, promiseId));
    expect(rows).toHaveLength(2);
  });
});

describe("audit", () => {
  it("zaznamenal celý průchod workflow", async () => {
    const rows = await handle.client.query<{ action: string }>(
      "select action from audit_log order by created_at",
    );
    const actions = rows.rows.map((row) => row.action);

    expect(actions).toEqual(
      expect.arrayContaining([
        "source.create",
        "promise.create",
        "evidence.attach",
        "assessment.create",
        "assessment.submit",
        "assessment.request_changes",
        "assessment.approve",
        "assessment.publish",
        "correction.create",
        "correction.resolve",
      ]),
    );
  });

  it("záznam auditu nejde změnit ani smazat", async () => {
    await expect(handle.client.query("update audit_log set action = 'podvrh'")).rejects.toThrow(
      /append-only/,
    );
    await expect(handle.client.query("delete from audit_log")).rejects.toThrow(/append-only/);
  });
});
