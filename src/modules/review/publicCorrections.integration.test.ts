/**
 * Veřejné podání podnětu proti skutečné databázi.
 *
 * Je to jediné místo, kam smí psát kdokoli zvenčí, a týká se stránek
 * o jmenovaných lidech. Testuje se proto hlavně to, co se stát **nesmí**:
 * aby se nezrevidovaný text objevil veřejně a aby šlo formulářem zahltit
 * databázi.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { getPublishedPromiseDetail } from "@/modules/promises/queries";
import { corrections } from "@/modules/review/schema";
import { MAX_SUBMISSIONS_PER_IP, submitPublicCorrection } from "@/modules/review/publicCorrections";
import { resolveCorrection, EditorialError, type Actor } from "@/modules/review/service";

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };
const PUBLISHED_SLUG = "demo-a-2000-mestskych-najemnich-bytu";

const BODY =
  "Uvádíte, že stavba nezačala, ale rada ji schválila v červnu. Přikládáme číslo usnesení.";

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("podání zvenčí", () => {
  it("uloží reakci kandidátky bez přihlášení a bez redaktora", async () => {
    const id = await submitPublicCorrection(
      handle.db,
      {
        promiseSlug: PUBLISHED_SLUG,
        kind: "PARTY_RESPONSE",
        submitterOrganization: "Demo strana A",
        submitterEmail: "tiskove@example.org",
        body: BODY,
      },
      "a".repeat(64),
    );

    const [row] = await handle.db
      .select({
        status: corrections.status,
        handledById: corrections.handledById,
        ipHash: corrections.submitterIpHash,
      })
      .from(corrections)
      .where(eq(corrections.id, id));

    expect(row?.status).toBe("OPEN");
    // Podání není redakční úkon a nesmí se tvářit jako redakční.
    expect(row?.handledById).toBeNull();
    expect(row?.ipHash).toBe("a".repeat(64));
  });

  it("nezrevidovaný podnět se veřejně neukáže", async () => {
    const detail = await getPublishedPromiseDetail(handle.db, PUBLISHED_SLUG);

    expect(detail).not.toBeNull();
    expect(detail?.corrections.map((item) => item.body)).not.toContain(BODY);
  });

  it("po vzetí na vědomí se ukáže", async () => {
    const [pending] = await handle.db
      .select({ id: corrections.id })
      .from(corrections)
      .where(eq(corrections.body, BODY));
    if (!pending) throw new Error("Podnět se neuložil.");

    await resolveCorrection(handle.db, editor, {
      correctionId: pending.id,
      status: "ACKNOWLEDGED",
      response: "Děkujeme, prověřujeme.",
    });

    const detail = await getPublishedPromiseDetail(handle.db, PUBLISHED_SLUG);
    expect(detail?.corrections.map((item) => item.body)).toContain(BODY);
  });

  it("k nepublikovanému slibu podnět poslat nejde", async () => {
    await expect(
      submitPublicCorrection(
        handle.db,
        { promiseSlug: "demo-a-cyklotrasy-v-centru", kind: "PUBLIC_CORRECTION", body: BODY },
        null,
      ),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("prázdný nebo příliš krátký text neprojde", async () => {
    await expect(
      submitPublicCorrection(
        handle.db,
        { promiseSlug: PUBLISHED_SLUG, kind: "PUBLIC_CORRECTION", body: "chyba" },
        null,
      ),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("z jedné adresy nejde poslat neomezeně", async () => {
    const ip = "b".repeat(64);

    for (let i = 0; i < MAX_SUBMISSIONS_PER_IP; i += 1) {
      await submitPublicCorrection(
        handle.db,
        {
          promiseSlug: PUBLISHED_SLUG,
          kind: "PUBLIC_CORRECTION",
          body: `Podnět číslo ${i}, dost dlouhý na to, aby prošel kontrolou délky.`,
        },
        ip,
      );
    }

    await expect(
      submitPublicCorrection(
        handle.db,
        {
          promiseSlug: PUBLISHED_SLUG,
          kind: "PUBLIC_CORRECTION",
          body: "Ještě jeden podnět, který už se vejít nemá, ale je dost dlouhý.",
        },
        ip,
      ),
    ).rejects.toThrow(/příliš mnoho/);
  });

  it("limit platí na adresu, ne na celý web", async () => {
    // Jinak by jeden robot umlčel všechny ostatní.
    const id = await submitPublicCorrection(
      handle.db,
      {
        promiseSlug: PUBLISHED_SLUG,
        kind: "PUBLIC_CORRECTION",
        body: "Podnět z úplně jiného místa, který projít musí.",
      },
      "c".repeat(64),
    );

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
