/**
 * Hledání důkazů proti skutečné databázi.
 *
 * Dvě věci, které tu musí platit bez ohledu na to, co model vrátí: důkaz se
 * nedá navěsit na slib, který nebyl v zadání, a citace musí stát ve zdroji.
 * Zbytek je redakční rozvaha.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { aiRuns } from "@/modules/ai/schema";
import {
  evidenceMatchingOutputSchema,
  listMatchablePromises,
  matchEvidence,
  type EvidenceMatch,
} from "@/modules/ai/evidenceMatching";
import { HeuristicProvider } from "@/modules/ai/heuristicProvider";
import type { AIProvider, StructuredRequest, StructuredResult } from "@/modules/ai/provider";
import { promiseEvidence } from "@/modules/evidence/schema";
import {
  acceptEvidenceSuggestion,
  listEvidenceSuggestions,
  rejectSuggestion,
} from "@/modules/review/suggestions";
import { createSourceDocument, EditorialError, type Actor } from "@/modules/review/service";

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };

const RESOLUTION_QUOTE =
  "Rada schválila zahájení stavby tramvajové trati do Demo čtvrti a vyčlenila na ni 300 milionů korun.";
const DOCUMENT_TEXT = [
  "USNESENÍ RADY MĚSTA",
  RESOLUTION_QUOTE,
  "Rada dále vzala na vědomí zprávu o čistotě ulic.",
].join("\n\n");

let sourceId = "";

/** Dodavatel s předem daným výstupem — simuluje model, který dokument přečetl. */
class ScriptedProvider implements AIProvider {
  readonly name: string;
  private readonly matches: EvidenceMatch[];

  constructor(matches: EvidenceMatch[], name: string) {
    this.matches = matches;
    this.name = name;
  }

  generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const inThisChunk = request.documentText.includes("USNESENÍ RADY MĚSTA");

    return Promise.resolve({
      data: request.schema.parse({ matches: inThisChunk ? this.matches : [] }),
      model: "scripted-1.0.0",
      inputTokens: 80,
      outputTokens: 40,
      costUsd: "0.000800",
    });
  }
}

function match(overrides: Partial<EvidenceMatch> = {}): EvidenceMatch {
  return {
    promiseNumber: 1,
    relationType: "PROGRESS",
    excerpt: RESOLUTION_QUOTE,
    explanation: "Usnesení dokládá, že stavba byla zahájena a má vyčleněné peníze.",
    limitationNote: "Ze schválení neplyne, že stavba byla dokončena.",
    ...overrides,
  };
}

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);

  sourceId = await createSourceDocument(handle.db, editor, {
    sourceType: "COUNCIL_RESOLUTION",
    title: "Usnesení rady k tramvajové trati",
    publisher: "Město",
    licenseMode: "FULL_TEXT_STORED",
    rawText: DOCUMENT_TEXT,
    isDemo: true,
  });
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("matchEvidence", () => {
  it("uloží návrh, který ukazuje na slib ze zadání", async () => {
    const result = await matchEvidence(
      handle.db,
      editor,
      new ScriptedProvider([match()], "scripted-ok"),
      sourceId,
    );

    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(0);

    const [first] = await listEvidenceSuggestions(handle.db, sourceId);
    const promises = await listMatchablePromises(handle.db);
    expect(first?.promiseId).toBe(promises[0]?.id);
    expect(first?.limitationNote).toContain("neplyne");
  });

  it("slib mimo zadaný seznam se zahodí", async () => {
    const result = await matchEvidence(
      handle.db,
      editor,
      new ScriptedProvider([match({ promiseNumber: 9_999 })], "scripted-mimo-seznam"),
      sourceId,
    );

    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(1);
    expect(result.rejectionReasons[0]).toContain("v seznamu není");
  });

  it("vymyšlenou citaci zahodí a nechá po ní stopu u běhu", async () => {
    const result = await matchEvidence(
      handle.db,
      editor,
      new ScriptedProvider(
        [match({ excerpt: "Rada rozhodla o okamžitém dokončení všech slibů." })],
        "scripted-halucinace",
      ),
      sourceId,
    );

    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(1);

    const [run] = await handle.db
      .select({ error: aiRuns.error })
      .from(aiRuns)
      .where(eq(aiRuns.id, result.aiRunId));
    expect(run?.error).toContain("doslova nestojí");
  });

  it("heuristika tuhle úlohu neumí a řekne to", async () => {
    await expect(
      matchEvidence(handle.db, editor, new HeuristicProvider(), sourceId),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("odmítne neznámý typ vztahu už na schématu", () => {
    const parsed = evidenceMatchingOutputSchema.safeParse({
      matches: [{ ...match(), relationType: "DOKLADA_NECO_JINEHO" }],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("revize návrhu důkazu", () => {
  it("přijetí založí vazbu ověřenou člověkem", async () => {
    const pending = (await listEvidenceSuggestions(handle.db, sourceId)).find(
      (row) => row.status === "PENDING",
    );
    if (!pending) throw new Error("Fronta návrhů důkazů je prázdná.");

    const linkId = await acceptEvidenceSuggestion(handle.db, editor, {
      suggestionId: pending.id,
      relationType: "IMPLEMENTATION",
    });

    const [link] = await handle.db
      .select({
        relationType: promiseEvidence.relationType,
        humanVerified: promiseEvidence.humanVerified,
        verifiedById: promiseEvidence.verifiedById,
        limitationNote: promiseEvidence.limitationNote,
      })
      .from(promiseEvidence)
      .where(eq(promiseEvidence.id, linkId));

    // Redaktor roli přepsal — jeho slovo platí nad návrhem modelu.
    expect(link?.relationType).toBe("IMPLEMENTATION");
    expect(link?.humanVerified).toBe(true);
    expect(link?.verifiedById).toBe(editor.id);
    expect(link?.limitationNote).toContain("neplyne");
  });

  it("o přijatém návrhu se podruhé nerozhoduje", async () => {
    const decided = (await listEvidenceSuggestions(handle.db, sourceId)).find(
      (row) => row.status === "ACCEPTED",
    );
    if (!decided) throw new Error("Žádný přijatý návrh.");

    await expect(
      rejectSuggestion(handle.db, editor, { suggestionId: decided.id, note: "Přece jen ne" }),
    ).rejects.toBeInstanceOf(EditorialError);
  });
});
