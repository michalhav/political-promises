/**
 * Slučování duplicit proti skutečné databázi.
 *
 * Sloučení je jediná operace, která **odebírá** obsah z veřejných stránek, aniž
 * by cokoli mazala. Testuje se proto hlavně to, co se stát nesmí: aby zmizel
 * publikovaný slib, aby vznikl řetěz sloučení, nebo aby se spojily sliby dvou
 * různých kandidátek.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { listPublishedPromises } from "@/modules/promises/queries";
import { promises } from "@/modules/promises/schema";
import { promiseSources } from "@/modules/promises/schema";
import { listMergeTargets, mergePromise, unmergePromise } from "@/modules/review/merge";
import { auditLogs } from "@/modules/review/schema";
import { createCandidatePromise, EditorialError, type Actor } from "@/modules/review/service";
import { sourceDocuments } from "@/modules/sources/schema";

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };

/** Nepublikovaní kandidáti z ukázkových dat — na nich se slučuje. */
const CANDIDATE = "demo-a-chranene-cyklotrasy-v-centru";
const PUBLISHED = "demo-a-2000-mestskych-najemnich-bytu";
const OTHER_LIST = "demo-bc-300-bytu-pro-seniory";

async function idOf(slug: string): Promise<string> {
  const [row] = await handle.db
    .select({ id: promises.id })
    .from(promises)
    .where(eq(promises.slug, slug))
    .limit(1);
  if (!row) throw new Error(`Ukázková data neobsahují slib ${slug}.`);
  return row.id;
}

/** Druhý nepublikovaný kandidát téže kandidátky. Ukázková data mají jen jeden. */
let secondCandidateId = "";

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);

  const [origin] = await handle.db
    .select({
      promiseId: promises.id,
      listId: promises.electoralListId,
      sourceId: promiseSources.sourceDocumentId,
      rawText: sourceDocuments.rawText,
    })
    .from(promises)
    .innerJoin(promiseSources, eq(promiseSources.promiseId, promises.id))
    .innerJoin(sourceDocuments, eq(sourceDocuments.id, promiseSources.sourceDocumentId))
    .where(eq(promises.slug, CANDIDATE))
    .limit(1);
  if (!origin?.rawText) throw new Error("Ukázkový kandidát nemá zdroj s textem.");

  // Doslovná věta z téhož zdroje — jinak by ji kontrola citace nepustila.
  const sentence = origin.rawText
    .split("\n")
    .find((line) => line.trim().length > 40)
    ?.trim();
  if (!sentence) throw new Error("Ve zdroji není dost dlouhá věta.");

  secondCandidateId = await createCandidatePromise(handle.db, editor, {
    electoralListId: origin.listId,
    slug: "test-druhy-kandidat-ke-slouceni",
    title: "Druhý kandidát ke sloučení",
    originalText: sentence,
    topic: "TRANSPORT",
    sourceDocumentId: origin.sourceId,
    sourceExcerpt: sentence,
  });
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("co sloučit nejde", () => {
  it("publikovaný slib ne — zmizel by z veřejných stránek", async () => {
    await expect(
      mergePromise(handle.db, editor, {
        promiseId: await idOf(PUBLISHED),
        targetPromiseId: await idOf(CANDIDATE),
      }),
    ).rejects.toThrow(/Publikovaný slib/);
  });

  it("sám do sebe ne", async () => {
    const id = await idOf(CANDIDATE);

    await expect(
      mergePromise(handle.db, editor, { promiseId: id, targetPromiseId: id }),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("do slibu jiné kandidátky ne", async () => {
    // Dvě strany, dva závazky. Že znějí stejně, z nich duplicitu nedělá.
    await expect(
      mergePromise(handle.db, editor, {
        promiseId: await idOf(CANDIDATE),
        targetPromiseId: await idOf(OTHER_LIST),
      }),
    ).rejects.toThrow(/téže kandidátky/);
  });
});

describe("sloučení a jeho zrušení", () => {
  it("sloučený slib zmizí z veřejného výpisu, ale zůstane v datech", async () => {
    const sourceId = await idOf(CANDIDATE);
    const targetId = await idOf(PUBLISHED);

    await mergePromise(handle.db, editor, { promiseId: sourceId, targetPromiseId: targetId });

    const [row] = await handle.db
      .select({ merged: promises.mergedIntoPromiseId })
      .from(promises)
      .where(eq(promises.id, sourceId));
    expect(row?.merged).toBe(targetId);

    const list = await listPublishedPromises(handle.db, { page: 1 });
    expect(list.items.map((item) => item.slug)).not.toContain(CANDIDATE);
  });

  it("řetěz sloučení nevznikne", async () => {
    // Cíl je sám sloučený → nabídnout ho jako cíl by vyrobilo graf místo dvojice.
    const alreadyMerged = await idOf(CANDIDATE);

    await expect(
      mergePromise(handle.db, editor, {
        promiseId: secondCandidateId,
        targetPromiseId: alreadyMerged,
      }),
    ).rejects.toThrow(/sám sloučený/);
  });

  it("už sloučený slib se podruhé sloučit nedá", async () => {
    await expect(
      mergePromise(handle.db, editor, {
        promiseId: await idOf(CANDIDATE),
        targetPromiseId: secondCandidateId,
      }),
    ).rejects.toThrow(/už je sloučený/);
  });

  it("nabídka cílů vynechá sloučené i sám sebe", async () => {
    const targets = await listMergeTargets(handle.db, secondCandidateId);
    const slugs = targets.map((target) => target.slug);

    // CANDIDATE je v tu chvíli sloučený, takže se nenabízí.
    expect(slugs).not.toContain(CANDIDATE);
    expect(slugs).not.toContain("test-druhy-kandidat-ke-slouceni");
    expect(slugs).toContain(PUBLISHED);
  });

  it("zrušení sloučení vrátí slib zpátky", async () => {
    const sourceId = await idOf(CANDIDATE);
    await unmergePromise(handle.db, editor, sourceId);

    const [row] = await handle.db
      .select({ merged: promises.mergedIntoPromiseId })
      .from(promises)
      .where(eq(promises.id, sourceId));
    expect(row?.merged).toBeNull();
  });

  it("obojí zůstane v auditním logu", async () => {
    const rows = await handle.db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, await idOf(CANDIDATE)));
    const actions = rows.map((row) => row.action);

    expect(actions).toContain("promise.merge");
    expect(actions).toContain("promise.unmerge");
  });
});
