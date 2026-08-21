"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { requireEditorialUser } from "@/modules/accounts/auth";
import { createElectoralList, createParty } from "@/modules/review/registry";
import {
  attachEvidence,
  createAssessmentDraft,
  createCandidatePromise,
  createCorrection,
  createSourceDocument,
  detachEvidence,
  EditorialError,
  publishAssessment,
  resolveCorrection,
  transitionAssessment,
  updateAssessmentDraft,
  updateCandidatePromise,
} from "@/modules/review/service";

/**
 * Zapisovací hranice adminu.
 *
 * Každá akce si sama ověří přihlášení. Guard v layoutu chrání jen vykreslení
 * stránky — server action se dá zavolat i bez toho, aby si prohlížeč tu stránku
 * kdy načetl, takže spoléhat na layout by byla díra.
 *
 * Identita aktéra pochází výhradně ze session. Z formuláře se nikdy nebere,
 * i kdyby v něm nějaké ID přišlo.
 *
 * CSRF řeší Next tím, že u server actions porovnává Origin s Host; cookie je
 * navíc SameSite=Lax.
 */
export interface ActionResult {
  ok: boolean;
  errors?: string[];
  message?: string;
}

type Action = (formData: FormData) => Promise<ActionResult>;

/** Chyba redaktora se vrací do formuláře, cokoli jiného spadne nahoru. */
async function run(action: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof EditorialError) {
      return { ok: false, errors: error.issues };
    }
    throw error;
  }
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalText(formData: FormData, key: string): string | undefined {
  const value = text(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

// ---------------------------------------------------------------------------

export const createSourceAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();

    const id = await createSourceDocument(db, actor, {
      sourceType: text(formData, "sourceType") as never,
      title: text(formData, "title"),
      publisher: text(formData, "publisher"),
      url: optionalText(formData, "url"),
      publishedAt: optionalText(formData, "publishedAt"),
      licenseMode: text(formData, "licenseMode") as never,
      rawText: optionalText(formData, "rawText"),
      isDemo: formData.get("isDemo") === "on",
    });

    revalidatePath("/admin");
    revalidatePath("/admin/sources");
    redirect(`/admin/sources/${id}`);
  });

export const createPartyAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();

    await createParty(db, actor, {
      name: text(formData, "name"),
      shortName: text(formData, "shortName"),
      slug: text(formData, "slug"),
      registrationId: optionalText(formData, "registrationId"),
      isDemo: formData.get("isDemo") === "on",
    });

    revalidatePath("/admin/lists");
    return { ok: true, message: "Strana založena." };
  });

export const createElectoralListAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();

    await createElectoralList(db, actor, {
      electionId: text(formData, "electionId"),
      name: text(formData, "name"),
      shortName: text(formData, "shortName"),
      slug: text(formData, "slug"),
      ballotNumber: optionalText(formData, "ballotNumber"),
      seatsWon: optionalText(formData, "seatsWon"),
      // Vícenásobný výběr chodí jako opakovaný klíč, ne jako jedna hodnota.
      partyIds: formData.getAll("partyIds").filter((value) => typeof value === "string"),
    });

    revalidatePath("/admin/lists");
    // Nová kandidátka se hned nabízí ve formuláři kandidáta na slib.
    revalidatePath("/admin/promises/new");
    return { ok: true, message: "Kandidátka založena." };
  });

export const createPromiseAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();
    const slug = text(formData, "slug");

    await createCandidatePromise(db, actor, {
      electoralListId: text(formData, "electoralListId"),
      slug,
      title: text(formData, "title"),
      originalText: text(formData, "originalText"),
      normalizedStatement: optionalText(formData, "normalizedStatement"),
      topic: text(formData, "topic") as never,
      deadlineText: optionalText(formData, "deadlineText"),
      deadlineOn: optionalText(formData, "deadlineOn"),
      sourceDocumentId: text(formData, "sourceDocumentId"),
      sourceExcerpt: text(formData, "sourceExcerpt"),
      sourcePageNumber: optionalText(formData, "sourcePageNumber"),
      sourceLocator: optionalText(formData, "sourceLocator"),
    });

    revalidatePath("/admin");
    redirect(`/admin/promises/${slug}`);
  });

export const updatePromiseAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();
    const slug = text(formData, "slug");

    await updateCandidatePromise(db, actor, {
      promiseId: text(formData, "promiseId"),
      title: text(formData, "title"),
      normalizedStatement: optionalText(formData, "normalizedStatement"),
      topic: text(formData, "topic") as never,
      deadlineText: optionalText(formData, "deadlineText"),
      deadlineOn: optionalText(formData, "deadlineOn"),
    });

    revalidatePath(`/admin/promises/${slug}`);
    return { ok: true, message: "Slib uložen." };
  });

export const attachEvidenceAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();
    const slug = text(formData, "slug");

    await attachEvidence(db, actor, {
      promiseId: text(formData, "promiseId"),
      sourceDocumentId: text(formData, "sourceDocumentId"),
      excerpt: text(formData, "excerpt"),
      pageNumber: optionalText(formData, "pageNumber"),
      locator: optionalText(formData, "locator"),
      relationType: text(formData, "relationType") as never,
      note: optionalText(formData, "note"),
      limitationNote: optionalText(formData, "limitationNote"),
    });

    revalidatePath(`/admin/promises/${slug}`);
    return { ok: true, message: "Důkaz připojen." };
  });

export const detachEvidenceAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();
    const slug = text(formData, "slug");

    await detachEvidence(db, actor, text(formData, "linkId"));

    revalidatePath(`/admin/promises/${slug}`);
    return { ok: true, message: "Vazba na důkaz odebrána." };
  });

function assessmentFields(formData: FormData) {
  return {
    specificityScore: text(formData, "specificityScore"),
    measurabilityScore: text(formData, "measurabilityScore"),
    deadlineScore: text(formData, "deadlineScore"),
    jurisdictionScore: text(formData, "jurisdictionScore"),
    outcomeDefinitionScore: text(formData, "outcomeDefinitionScore"),
    executionStatus: text(formData, "executionStatus") as never,
    outcomeStatus: text(formData, "outcomeStatus") as never,
    summary: optionalText(formData, "summary"),
    sourcesReviewedUpTo: text(formData, "sourcesReviewedUpTo"),
    changeReason: optionalText(formData, "changeReason"),
  };
}

export const createAssessmentAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();
    const slug = text(formData, "slug");

    await createAssessmentDraft(db, actor, {
      promiseId: text(formData, "promiseId"),
      ...assessmentFields(formData),
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/promises/${slug}`);
    return { ok: true, message: "Hodnocení založeno jako rozpracované." };
  });

export const updateAssessmentAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();
    const slug = text(formData, "slug");

    await updateAssessmentDraft(db, actor, {
      assessmentId: text(formData, "assessmentId"),
      ...assessmentFields(formData),
    });

    revalidatePath(`/admin/promises/${slug}`);
    return { ok: true, message: "Hodnocení uloženo." };
  });

export const transitionAssessmentAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();
    const slug = text(formData, "slug");
    const action = text(formData, "action");

    if (action !== "SUBMIT" && action !== "REQUEST_CHANGES" && action !== "APPROVE") {
      return { ok: false, errors: ["Neznámá akce."] };
    }

    await transitionAssessment(db, actor, {
      assessmentId: text(formData, "assessmentId"),
      action,
      note: optionalText(formData, "note"),
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/promises/${slug}`);
    return { ok: true, message: "Hotovo." };
  });

export const publishAssessmentAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();
    const slug = text(formData, "slug");

    await publishAssessment(db, actor, text(formData, "assessmentId"));

    revalidatePath("/admin");
    revalidatePath(`/admin/promises/${slug}`);
    revalidatePath("/promises");
    revalidatePath(`/promises/${slug}`);
    return { ok: true, message: "Publikováno." };
  });

export const createCorrectionAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();
    const slug = text(formData, "slug");

    await createCorrection(db, actor, {
      promiseId: text(formData, "promiseId"),
      kind: text(formData, "kind") as never,
      submitterName: optionalText(formData, "submitterName"),
      submitterOrganization: optionalText(formData, "submitterOrganization"),
      body: text(formData, "body"),
    });

    revalidatePath(`/admin/promises/${slug}`);
    return { ok: true, message: "Podnět zaznamenán." };
  });

export const resolveCorrectionAction: Action = async (formData) =>
  run(async () => {
    const actor = await requireEditorialUser();
    const slug = text(formData, "slug");

    await resolveCorrection(db, actor, {
      correctionId: text(formData, "correctionId"),
      status: text(formData, "status") as never,
      response: optionalText(formData, "response"),
      appliedAssessmentId: optionalText(formData, "appliedAssessmentId"),
    });

    revalidatePath(`/admin/promises/${slug}`);
    revalidatePath(`/promises/${slug}`);
    return { ok: true, message: "Podnět vyřízen." };
  });
