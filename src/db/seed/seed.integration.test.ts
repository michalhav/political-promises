/**
 * Seed proti skutečnému Postgresu.
 *
 * Nejde jen o to, že příkaz doběhne. Ukázková data jsou zároveň jediný dataset,
 * na kterém se do fáze 3 dá vidět celý produkt, takže musí splňovat tatáž
 * integritní pravidla, jaká bude aplikace vynucovat na reálných datech —
 * jinak by veřejné stránky vznikaly proti datům, která by v produkci nesměla
 * existovat.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { deriveAssessability } from "@/modules/assessments/assessability";
import { promiseAssessments } from "@/modules/assessments/schema";
import { evidence, promiseEvidence } from "@/modules/evidence/schema";
import { metricMeasurements, promises, promiseSources } from "@/modules/promises/schema";
import { validateAssessmentConsistency } from "@/modules/assessments/statusRules";
import { sourceDocuments } from "@/modules/sources/schema";

let handle: TestDatabaseHandle;

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("seed", () => {
  it("je idempotentní — druhé spuštění nespadne na duplicitách", async () => {
    await expect(reseed(handle.db)).resolves.toBeDefined();
  });

  it("nahraje publikované i nepublikované sliby", async () => {
    const rows = await handle.db.select({ published: promises.published }).from(promises);

    expect(rows.length).toBeGreaterThanOrEqual(12);
    expect(rows.filter((row) => row.published)).not.toHaveLength(0);
    expect(rows.filter((row) => !row.published)).not.toHaveLength(0);
  });

  it("každý smyšlený dokument i strana jsou označené jako demo", async () => {
    const undeclared = await handle.db
      .select({ id: sourceDocuments.id })
      .from(sourceDocuments)
      .where(eq(sourceDocuments.isDemo, false));

    expect(undeclared).toEqual([]);
  });
});

describe("provenience", () => {
  it("každý citát doslova stojí ve zdroji, ze kterého je odvozený", async () => {
    const rows = await handle.db
      .select({
        excerpt: evidence.excerpt,
        rawText: sourceDocuments.rawText,
        licenseMode: sourceDocuments.licenseMode,
        title: sourceDocuments.title,
      })
      .from(evidence)
      .innerJoin(sourceDocuments, eq(evidence.sourceDocumentId, sourceDocuments.id));

    const mismatched = rows.filter(
      (row) => row.licenseMode === "FULL_TEXT_STORED" && !row.rawText?.includes(row.excerpt),
    );

    expect(mismatched).toEqual([]);
  });

  it("citace slibu doslova stojí ve zdrojovém programu", async () => {
    const rows = await handle.db
      .select({
        excerpt: promiseSources.excerpt,
        originalText: promises.originalText,
        rawText: sourceDocuments.rawText,
      })
      .from(promiseSources)
      .innerJoin(promises, eq(promiseSources.promiseId, promises.id))
      .innerJoin(sourceDocuments, eq(promiseSources.sourceDocumentId, sourceDocuments.id));

    for (const row of rows) {
      expect(row.rawText).toContain(row.excerpt);
      expect(row.excerpt).toContain(row.originalText);
    }
  });

  it("u dokumentu bez licence k plnému textu se text neukládá (B2)", async () => {
    const quoteOnly = await handle.db
      .select({ rawText: sourceDocuments.rawText })
      .from(sourceDocuments)
      .where(eq(sourceDocuments.licenseMode, "QUOTE_ONLY"));

    expect(quoteOnly).not.toHaveLength(0);
    expect(quoteOnly.every((row) => row.rawText === null)).toBe(true);
  });
});

describe("hodnocení", () => {
  it("každý publikovaný slib má právě jedno aktuální hodnocení", async () => {
    const rows = await handle.db
      .select({
        slug: promises.slug,
        current: sql<number>`count(${promiseAssessments.id})`,
      })
      .from(promises)
      .leftJoin(
        promiseAssessments,
        sql`${promiseAssessments.promiseId} = ${promises.id} AND ${promiseAssessments.isCurrent}`,
      )
      .where(eq(promises.published, true))
      .groupBy(promises.slug);

    for (const row of rows) {
      expect(Number(row.current), `slib ${row.slug}`).toBe(1);
    }
  });

  it("uložený stupeň hodnotitelnosti odpovídá tomu, co vrací algoritmus", async () => {
    const rows = await handle.db.select().from(promiseAssessments);

    expect(rows).not.toHaveLength(0);
    for (const row of rows) {
      const derived = deriveAssessability({
        specificityScore: row.specificityScore,
        measurabilityScore: row.measurabilityScore,
        deadlineScore: row.deadlineScore,
        jurisdictionScore: row.jurisdictionScore,
        outcomeDefinitionScore: row.outcomeDefinitionScore,
      });

      expect(row.assessability).toBe(derived.level);
      expect(row.methodologyVersion).toBe(derived.methodologyVersion);
    }
  });

  it("žádné aktuální hodnocení neporušuje pravidla konzistence", async () => {
    const rows = await handle.db
      .select({
        slug: promises.slug,
        promiseId: promises.id,
        assessability: promiseAssessments.assessability,
        executionStatus: promiseAssessments.executionStatus,
        outcomeStatus: promiseAssessments.outcomeStatus,
      })
      .from(promiseAssessments)
      .innerJoin(promises, eq(promiseAssessments.promiseId, promises.id))
      .where(eq(promiseAssessments.isCurrent, true));

    for (const row of rows) {
      const measurements = await handle.db
        .select({ id: metricMeasurements.id })
        .from(metricMeasurements)
        .innerJoin(
          sql`promise_metric`,
          sql`promise_metric.id = ${metricMeasurements.metricId} AND promise_metric.promise_id = ${row.promiseId}`,
        );

      const verifiedEvidence = await handle.db
        .select({ id: promiseEvidence.id })
        .from(promiseEvidence)
        .where(
          sql`${promiseEvidence.promiseId} = ${row.promiseId} AND ${promiseEvidence.humanVerified}`,
        );

      const errors = validateAssessmentConsistency({
        assessability: row.assessability,
        executionStatus: row.executionStatus,
        outcomeStatus: row.outcomeStatus,
        hasMeasuredMetric: measurements.length > 0,
        hasVerifiedEvidence: verifiedEvidence.length > 0,
      });

      expect(errors, `slib ${row.slug}`).toEqual([]);
    }
  });

  it("každé hodnocení uvádí, ke kterému dni sahá rešerše", async () => {
    const rows = await handle.db
      .select({
        slug: promises.slug,
        reviewedUpTo: promiseAssessments.sourcesReviewedUpTo,
      })
      .from(promiseAssessments)
      .innerJoin(promises, eq(promiseAssessments.promiseId, promises.id));

    expect(rows).not.toHaveLength(0);
    for (const row of rows) {
      expect(row.reviewedUpTo, `slib ${row.slug}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("kde nemáme doklad, netvrdí dataset, že se nic nedělo", async () => {
    // NOT_STARTED je výrok o městě a bez zdroje ho pravidla konzistence nepustí.
    // Dataset proto musí používat NO_VERIFIED_PROGRESS — a používat ho opravdu.
    const rows = await handle.db
      .select({ executionStatus: promiseAssessments.executionStatus })
      .from(promiseAssessments)
      .where(eq(promiseAssessments.isCurrent, true));

    const statuses = rows.map((row) => row.executionStatus);
    expect(statuses).toContain("NO_VERIFIED_PROGRESS");
    expect(statuses).not.toContain("NOT_STARTED");
  });

  it("hodnocení schvaluje někdo jiný, než kdo ho vytvořil (B3)", async () => {
    const rows = await handle.db
      .select({
        createdById: promiseAssessments.createdById,
        reviewedById: promiseAssessments.reviewedById,
      })
      .from(promiseAssessments);

    for (const row of rows) {
      expect(row.reviewedById).not.toBeNull();
      expect(row.reviewedById).not.toBe(row.createdById);
    }
  });
});

describe("návrhy AI", () => {
  it("dataset obsahuje neověřený návrh, který se veřejně zobrazit nesmí", async () => {
    const unverified = await handle.db
      .select({ id: promiseEvidence.id, aiSuggestionId: promiseEvidence.aiSuggestionId })
      .from(promiseEvidence)
      .where(eq(promiseEvidence.humanVerified, false));

    expect(unverified).not.toHaveLength(0);
    expect(unverified.every((row) => row.aiSuggestionId !== null)).toBe(true);
  });
});
