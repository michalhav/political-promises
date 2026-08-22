/**
 * Časová osa slibu proti skutečné databázi.
 *
 * Osa je podle briefu hlavní narativní páteř — odpovídá na otázku „co se s tím
 * od voleb dělo". Do teď se dala naplnit jedině seedem, takže u každého
 * skutečného slibu zůstávala prázdná.
 *
 * Testuje se hlavně pravidlo, které brání tomu, aby osa vyráběla zdánlivé
 * souvislosti: událost smí citovat jen důkaz, který u téhož slibu opravdu visí.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { promiseEvidence } from "@/modules/evidence/schema";
import { getPublishedPromiseDetail } from "@/modules/promises/queries";
import { promises } from "@/modules/promises/schema";
import { addPromiseEvent, EditorialError, type Actor } from "@/modules/review/service";

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };
const SLUG = "demo-a-2000-mestskych-najemnich-bytu";

let promiseId = "";
let ownEvidenceId = "";
let foreignEvidenceId = "";

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);

  const [promise] = await handle.db
    .select({ id: promises.id })
    .from(promises)
    .where(eq(promises.slug, SLUG))
    .limit(1);
  if (!promise) throw new Error("Ukázková data neobsahují očekávaný slib.");
  promiseId = promise.id;

  const links = await handle.db
    .select({ promiseId: promiseEvidence.promiseId, evidenceId: promiseEvidence.evidenceId })
    .from(promiseEvidence);

  ownEvidenceId = links.find((link) => link.promiseId === promiseId)?.evidenceId ?? "";
  foreignEvidenceId = links.find((link) => link.promiseId !== promiseId)?.evidenceId ?? "";
  if (!ownEvidenceId || !foreignEvidenceId) throw new Error("Ukázková data nemají dost důkazů.");
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("addPromiseEvent", () => {
  it("přidá událost i s citací důkazu, který u slibu visí", async () => {
    await addPromiseEvent(handle.db, editor, {
      promiseId,
      eventType: "CONTRACT_SIGNED",
      eventDate: "2024-05-06",
      title: "Podepsána smlouva se zhotovitelem",
      description: "Zakázka na stavební práce.",
      evidenceIds: [ownEvidenceId],
    });

    const detail = await getPublishedPromiseDetail(handle.db, SLUG);
    const event = detail?.timeline.find((item) => item.eventDate === "2024-05-06");

    expect(event?.title).toBe("Podepsána smlouva se zhotovitelem");
    // Citace u události není ozdoba: bez ní je událost tvrzení redakce.
    expect(event?.citations.length).toBeGreaterThan(0);
  });

  it("cizí důkaz na osu nepustí", async () => {
    // Jinak by osa vyráběla souvislost tam, kde žádná není.
    await expect(
      addPromiseEvent(handle.db, editor, {
        promiseId,
        eventType: "MILESTONE_REACHED",
        eventDate: "2024-06-01",
        title: "Milník doložený cizím důkazem",
        evidenceIds: [foreignEvidenceId],
      }),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("událost bez důkazu projde, ale zůstane bez citace", async () => {
    // Ne všechno jde doložit dokumentem; osa to nesmí zakazovat, jen přiznat.
    await addPromiseEvent(handle.db, editor, {
      promiseId,
      eventType: "BLOCKED",
      eventDate: "2025-01-15",
      title: "Realizace se zastavila",
    });

    const detail = await getPublishedPromiseDetail(handle.db, SLUG);
    const event = detail?.timeline.find((item) => item.eventDate === "2025-01-15");

    expect(event?.citations).toHaveLength(0);
  });

  it("události se čtou v čase, ne v pořadí zápisu", async () => {
    const detail = await getPublishedPromiseDetail(handle.db, SLUG);
    const dates = detail?.timeline.map((item) => item.eventDate) ?? [];

    expect(dates).toEqual([...dates].sort());
  });

  it("neplatné datum neprojde", async () => {
    await expect(
      addPromiseEvent(handle.db, editor, {
        promiseId,
        eventType: "COMPLETED",
        eventDate: "loni na jaře",
        title: "Dokončeno",
      }),
    ).rejects.toBeInstanceOf(EditorialError);
  });
});
