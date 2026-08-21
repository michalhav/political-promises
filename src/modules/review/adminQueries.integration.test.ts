/**
 * Čtecí model seznamu slibů proti skutečné databázi.
 *
 * Dotaz stojí na korelovaných poddotazech a na `greatest` s NULLem uvnitř —
 * to jsou věci, které TypeScript neuhlídá a mock by je jen zopakoval.
 * Testuje se proto přesně ono chování v SQL: řazení podle poslední práce,
 * dohledání revidenta a slib, u kterého žádné hodnocení neexistuje.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { promiseAssessments } from "@/modules/assessments/schema";
import { promises } from "@/modules/promises/schema";
import { listAdminPromises } from "@/modules/review/adminQueries";

let handle: TestDatabaseHandle;

const LIST_ID = seedId("electoral-list:demo-a-2022");
const CANDIDATE_SLUG = "test-kandidat-bez-hodnoceni";

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("listAdminPromises", () => {
  it("řadí od poslední práce k nejstarší", async () => {
    const rows = await listAdminPromises(handle.db);
    expect(rows.length).toBeGreaterThan(1);

    const times = rows.map((row) => row.latestActivityAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("u hodnoceného slibu dohledá revidenta", async () => {
    const rows = await listAdminPromises(handle.db);
    const assessed = rows.filter((row) => row.latestState !== null);

    expect(assessed.length).toBeGreaterThan(0);
    for (const row of assessed) {
      expect(row.reviewerName).toBe("Demo redaktor 2");
      expect(row.latestVersion).toBeGreaterThanOrEqual(1);
    }
  });

  it("poslední pohyb bere z hodnocení, ne ze založení slibu", async () => {
    const [assessed] = (await listAdminPromises(handle.db)).filter(
      (item) => item.latestState !== null,
    );
    if (!assessed) throw new Error("Ukázková data neobsahují hodnocený slib.");

    // Ukázková data vznikají teď, ale hodnocení v nich nesou historická data.
    // Aby test ověřoval `greatest`, a ne shodu okolností, se slib založí dřív
    // než hodnocení, které na něm visí.
    await handle.db
      .update(promises)
      .set({ createdAt: new Date("2020-01-01T00:00:00.000Z") })
      .where(eq(promises.slug, assessed.slug));

    const [newestRow] = await handle.db
      .select({
        newest: sql<Date>`max(${promiseAssessments.createdAt})`.mapWith(
          promiseAssessments.createdAt,
        ),
      })
      .from(promiseAssessments)
      .innerJoin(promises, eq(promiseAssessments.promiseId, promises.id))
      .where(eq(promises.slug, assessed.slug));

    const row = (await listAdminPromises(handle.db)).find((item) => item.slug === assessed.slug);

    expect(newestRow).toBeDefined();
    expect(row?.latestActivityAt.getTime()).toBe(newestRow?.newest.getTime());
  });

  it("slib bez hodnocení nezmizí a spadne na datum založení", async () => {
    await handle.db.insert(promises).values({
      electoralListId: LIST_ID,
      slug: CANDIDATE_SLUG,
      title: "Testovací kandidát bez hodnocení",
      originalText: "Postavíme testovací kandidátský slib.",
      topic: "TRANSPORT",
      published: false,
    });

    const rows = await listAdminPromises(handle.db);
    const candidate = rows.find((row) => row.slug === CANDIDATE_SLUG);

    expect(candidate).toBeDefined();
    expect(candidate!.latestState).toBeNull();
    expect(candidate!.latestVersion).toBeNull();
    expect(candidate!.reviewerName).toBeNull();

    // Právě založený kandidát je nejčerstvější práce, takže patří na první místo.
    expect(rows[0]?.slug).toBe(CANDIDATE_SLUG);
  });
});
