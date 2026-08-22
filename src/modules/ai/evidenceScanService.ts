/**
 * Průchod jedním zdrojem proti **všem** slibům.
 *
 * Analytik doteď u každého slibu vymýšlel, co v datech hledat, a hledal ručně.
 * Tohle to obrátí: zdroj se nahraje jednou a nástroj sám nabídne, co ke kterému
 * slibu sedí — u 24 tisíc řádků zakázek je to rozdíl mezi hodinami a vteřinami.
 *
 * Návrh **není důkaz**. Vzniká jako PENDING ve stejné frontě jako návrhy od
 * modelu a připojí ho až člověk. Nástroj šetří hledání, ne rozhodování.
 *
 * Neplatí se za to nic: běh je čistě lexikální, takže ho jde pouštět na každý
 * nový dokument bez rozmýšlení nad cenou.
 */
import { and, eq, isNull } from "drizzle-orm";

import { contentHash } from "@/db/seed/ids";
import type { AppDatabase } from "@/db/types";
import {
  extractSearchTerms,
  isExcluded,
  scanLines,
  termsFromProfile,
} from "@/modules/ai/evidenceScan";
import { loadSearchProfile } from "@/modules/ai/searchProfile";
import { aiRuns, aiSuggestions } from "@/modules/ai/schema";
import { electoralLists } from "@/modules/parties/schema";
import { promiseSources, promises } from "@/modules/promises/schema";
import { auditLogs } from "@/modules/review/schema";
import { EditorialError, type Actor } from "@/modules/review/service";
import { sourceDocuments } from "@/modules/sources/schema";

export const SCAN_VERSION = "evidence-scan-1.0.0";

export interface ScanResult {
  aiRunId: string;
  /** Kolik slibů dostalo aspoň jeden návrh. */
  promisesWithMatches: number;
  suggestions: number;
  scannedLines: number;
  scannedPromises: number;
}

export async function scanSourceForEvidence(
  db: AppDatabase,
  actor: Actor,
  sourceDocumentId: string,
  options: { perPromise?: number } = {},
): Promise<ScanResult> {
  const [source] = await db
    .select({ rawText: sourceDocuments.rawText })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, sourceDocumentId))
    .limit(1);

  if (!source) throw new EditorialError("Zdrojový dokument neexistuje.");
  if (!source.rawText?.trim()) {
    throw new EditorialError("Dokument nemá uložený text, takže v něm není co hledat.");
  }

  /**
   * Hledá se podle citace, ne podle názvu slibu.
   *
   * Název je redakční zkratka („Nové mosty přes Vltavu"). Jméno konkrétní
   * stavby, podle kterého se doklad pozná, stojí až v citaci z programu.
   */
  const candidates = await db
    .select({
      id: promises.id,
      title: promises.title,
      originalText: promises.originalText,
      normalizedStatement: promises.normalizedStatement,
      excerpt: promiseSources.excerpt,
      listShortName: electoralLists.shortName,
    })
    .from(promises)
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .leftJoin(
      promiseSources,
      and(eq(promiseSources.promiseId, promises.id), eq(promiseSources.isPrimary, true)),
    )
    .where(isNull(promises.mergedIntoPromiseId));

  if (candidates.length === 0) {
    throw new EditorialError("V systému není žádný slib, ke kterému by šlo doklad hledat.");
  }

  const lines = source.rawText.split("\n");
  const inputHash = contentHash(`${SCAN_VERSION}|${sourceDocumentId}|${candidates.length}`);

  const [duplicate] = await db
    .select({ id: aiRuns.id })
    .from(aiRuns)
    .where(and(eq(aiRuns.inputHash, inputHash), eq(aiRuns.status, "SUCCEEDED")))
    .limit(1);

  if (duplicate) {
    throw new EditorialError(
      "Tenhle dokument už proti témuž počtu slibů proběhl. Výsledky najdeš ve frontě návrhů.",
    );
  }

  const [run] = await db
    .insert(aiRuns)
    .values({
      taskType: "EVIDENCE_MATCHING",
      provider: "lexical",
      model: SCAN_VERSION,
      promptVersion: SCAN_VERSION,
      sourceDocumentId,
      inputHash,
      status: "RUNNING",
      startedAt: new Date(),
    })
    .returning({ id: aiRuns.id });

  if (!run) throw new EditorialError("Běh se nepodařilo založit.");

  try {
    const payloads: {
      aiRunId: string;
      payload: Record<string, unknown>;
      status: "PENDING";
    }[] = [];
    let promisesWithMatches = 0;

    for (const candidate of candidates) {
      /**
       * Profil má přednost před hádáním z textu slibu.
       *
       * Obsahuje i to, co ze slibu vyčíst nejde — úřední název stavby a slova,
       * po kterých nález nesouvisí. Bez profilu se hledá dál podle textu, jen
       * s horším výsledkem; nástroj má fungovat i pro slib, který zatím nikdo
       * neprošel.
       */
      const profile = await loadSearchProfile(db, candidate.id);
      const terms = profile
        ? termsFromProfile(profile)
        : extractSearchTerms(
            candidate.excerpt,
            candidate.originalText,
            candidate.normalizedStatement,
          );
      if (terms.length === 0) continue;

      const excluded = profile?.excluded ?? [];
      const matches = scanLines(lines, terms, { limit: options.perPromise ?? 3 }).filter(
        (match) => !isExcluded(match.line, excluded),
      );
      if (matches.length === 0) continue;

      promisesWithMatches += 1;
      for (const match of matches) {
        payloads.push({
          aiRunId: run.id,
          payload: {
            promiseId: candidate.id,
            promiseTitle: candidate.title,
            sourceDocumentId,
            excerpt: match.line,
            relationType: "CONTEXT",
            // Redaktor musí vidět důvod, ne skóre. „Shoda na: Holešovicemi,
            // Karlínem" se dá posoudit; „skóre 7" ne.
            explanation: `Shoda na: ${match.matchedTerms.slice(0, 6).join(", ")}.`,
            limitationNote:
              "Nález je jen shoda slov. Jestli doklad se slibem opravdu souvisí, posuzuje redakce.",
          },
          status: "PENDING" as const,
        });
      }
    }

    if (payloads.length > 0) {
      await db.insert(aiSuggestions).values(payloads);
    }

    await db
      .update(aiRuns)
      .set({ status: "SUCCEEDED", finishedAt: new Date(), costUsd: "0.000000" })
      .where(eq(aiRuns.id, run.id));

    await db.insert(auditLogs).values({
      actorId: actor.id,
      action: "ai.scan.run",
      entityType: "ai_run",
      entityId: run.id,
      afterJson: { sourceDocumentId, suggestions: payloads.length },
    });

    return {
      aiRunId: run.id,
      promisesWithMatches,
      suggestions: payloads.length,
      scannedLines: lines.length,
      scannedPromises: candidates.length,
    };
  } catch (error) {
    await db
      .update(aiRuns)
      .set({
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      })
      .where(eq(aiRuns.id, run.id));
    throw error;
  }
}
