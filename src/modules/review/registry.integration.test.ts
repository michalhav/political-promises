/**
 * Zakládání stran a kandidátek proti skutečné databázi.
 *
 * Cena chyby je tu vyšší než u běžného formuláře: kandidátka je to, k čemu se
 * navěsí sliby, a špatně založená koalice zkreslí, komu se slib připisuje.
 * Testuje se proto vazba na strany, jejich pořadí a unikátnost adres —
 * všechno věci, které drží databáze, ne TypeScript.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { electoralListParties } from "@/modules/parties/schema";
import { createElectoralList, createParty, getRegistryData } from "@/modules/review/registry";
import { EditorialError, type Actor } from "@/modules/review/service";

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };
const ELECTION_ID = seedId("election:praha-2022");

let partyId = "";
let secondPartyId = "";

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("createParty", () => {
  it("založí skutečnou stranu, která není označená jako smyšlená", async () => {
    partyId = await createParty(handle.db, editor, {
      name: "Praha Sobě",
      shortName: "Praha Sobě",
      slug: "praha-sobe",
    });
    secondPartyId = await createParty(handle.db, editor, {
      name: "Zelení pro Prahu",
      shortName: "Zelení",
      slug: "zeleni-pro-prahu",
    });

    const { parties } = await getRegistryData(handle.db);
    const created = parties.find((party) => party.id === partyId);

    expect(created?.name).toBe("Praha Sobě");
    expect(created?.isDemo).toBe(false);
  });

  it("obsazenou adresu nepřepíše", async () => {
    await expect(
      createParty(handle.db, editor, {
        name: "Jiná strana se stejnou adresou",
        shortName: "Jiná",
        slug: "praha-sobe",
      }),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("adresu s diakritikou odmítne", async () => {
    await expect(
      createParty(handle.db, editor, {
        name: "Strana s diakritikou",
        shortName: "Diakritika",
        slug: "praha-sobě",
      }),
    ).rejects.toBeInstanceOf(EditorialError);
  });
});

describe("createElectoralList", () => {
  it("založí kandidátku jedné strany", async () => {
    const listId = await createElectoralList(handle.db, editor, {
      electionId: ELECTION_ID,
      name: "Praha Sobě",
      shortName: "Praha Sobě",
      slug: "praha-sobe-2022",
      ballotNumber: 25,
      seatsWon: 13,
      partyIds: [partyId],
    });

    const { lists } = await getRegistryData(handle.db);
    const created = lists.find((list) => list.id === listId);

    expect(created?.partyNames).toBe("Praha Sobě");
    expect(created?.seatsWon).toBe(13);
    // Nová kandidátka nemá slib — a čtecí model to musí ukázat jako nulu.
    expect(created?.promiseCount).toBe(0);
  });

  it("koalice drží pořadí stran podle výběru", async () => {
    const listId = await createElectoralList(handle.db, editor, {
      electionId: ELECTION_ID,
      name: "Koalice Zelení a Praha Sobě",
      shortName: "Zelení + PS",
      slug: "zeleni-praha-sobe-2022",
      partyIds: [secondPartyId, partyId],
    });

    const rows = await handle.db
      .select({ partyId: electoralListParties.partyId, order: electoralListParties.displayOrder })
      .from(electoralListParties)
      .where(eq(electoralListParties.electoralListId, listId));

    expect(rows.sort((a, b) => a.order - b.order).map((row) => row.partyId)).toEqual([
      secondPartyId,
      partyId,
    ]);

    const { lists } = await getRegistryData(handle.db);
    expect(lists.find((list) => list.id === listId)?.partyNames).toBe("Zelení, Praha Sobě");
  });

  it("kandidátku bez strany nezaloží", async () => {
    await expect(
      createElectoralList(handle.db, editor, {
        electionId: ELECTION_ID,
        name: "Kandidátka bez strany",
        shortName: "Bez strany",
        slug: "bez-strany-2022",
        partyIds: [],
      }),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("stranu, která v systému není, odmítne", async () => {
    await expect(
      createElectoralList(handle.db, editor, {
        electionId: ELECTION_ID,
        name: "Kandidátka s neznámou stranou",
        shortName: "Neznámá",
        slug: "neznama-strana-2022",
        partyIds: ["00000000-0000-4000-8000-000000000000"],
      }),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("neexistující volby odmítne", async () => {
    await expect(
      createElectoralList(handle.db, editor, {
        electionId: "00000000-0000-4000-8000-000000000000",
        name: "Kandidátka bez voleb",
        shortName: "Bez voleb",
        slug: "bez-voleb-2022",
        partyIds: [partyId],
      }),
    ).rejects.toBeInstanceOf(EditorialError);
  });

  it("počet slibů u seedované kandidátky sedí", async () => {
    const { lists } = await getRegistryData(handle.db);
    const demoA = lists.find((list) => list.slug === "demo-a-2022");

    expect(demoA?.promiseCount).toBeGreaterThan(0);
  });
});
