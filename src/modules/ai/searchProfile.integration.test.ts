/**
 * Profil hledání proti skutečné databázi.
 *
 * Profil existuje kvůli jediné věci, kterou lexikální hledání neumí: úřad
 * pojmenovává tutéž stavbu jinak než volební program. Testuje se proto hlavně
 * to, že se znalost analytika („Štvanická lávka = Lávka Holešovice – Karlín")
 * opravdu promítne do nálezů.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { isExcluded, termsFromProfile, scanLines } from "@/modules/ai/evidenceScan";
import { HeuristicProvider } from "@/modules/ai/heuristicProvider";
import {
  generateSearchProfile,
  loadSearchProfile,
  saveSearchProfile,
} from "@/modules/ai/searchProfile";
import { promises } from "@/modules/promises/schema";
import { EditorialError, type Actor } from "@/modules/review/service";

let handle: TestDatabaseHandle;

const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };
const SLUG = "demo-a-2000-mestskych-najemnich-bytu";

let promiseId = "";

const ROWS = [
  "Řádek 1 | nazev_zakazky: St.č.42822 Lávka Holešovice-Karlín, etapa 0001 Štvanická lávka | faze_zakazky: Dokončen/Zadán",
  "Řádek 2 | nazev_zakazky: Výroba videa k propagaci Štvanické lávky | faze_zakazky: Dokončen/Zadán",
  "Řádek 3 | nazev_zakazky: Nákup kancelářských potřeb | faze_zakazky: Zadáno",
];

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
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("uložení a čtení profilu", () => {
  it("uloží, co analytik ví, a odliší to od návrhu stroje", async () => {
    await saveSearchProfile(
      handle.db,
      editor,
      promiseId,
      {
        names: ["Štvanická lávka", "Dvorecký most"],
        synonyms: ["Lávka Holešovice"],
        excluded: ["propagace", "videa"],
      },
      "human",
    );

    const stored = await loadSearchProfile(handle.db, promiseId);

    expect(stored?.names).toContain("Štvanická lávka");
    // Ruční oprava se nesmí tvářit jako návrh modelu; jinak by nešlo poznat,
    // čemu se dá věřit víc.
    expect(stored?.generatedBy).toBe("human");
  });

  it("druhé uložení profil přepíše, nezaloží druhý", async () => {
    await saveSearchProfile(
      handle.db,
      editor,
      promiseId,
      { names: ["Trojská lávka"], synonyms: [], excluded: [] },
      "human",
    );

    const stored = await loadSearchProfile(handle.db, promiseId);

    expect(stored?.names).toEqual(["Trojská lávka"]);
  });

  it("duplicity a prázdné výrazy zahodí", async () => {
    await saveSearchProfile(
      handle.db,
      editor,
      promiseId,
      { names: ["lávka", " lávka ", ""], synonyms: [], excluded: [] },
      "human",
    );

    expect((await loadSearchProfile(handle.db, promiseId))?.names).toEqual(["lávka"]);
  });

  it("nesmyslně dlouhý seznam neprojde", async () => {
    await expect(
      saveSearchProfile(
        handle.db,
        editor,
        promiseId,
        {
          names: Array.from({ length: 30 }, (_, index) => `jméno ${index}`),
          synonyms: [],
          excluded: [],
        },
        "human",
      ),
    ).rejects.toBeInstanceOf(EditorialError);
  });
});

describe("hledání podle profilu", () => {
  it("najde doklad, který se ve slibu jmenuje jinak než v zakázce", () => {
    // Tohle je celý důvod, proč profil existuje: „Lávka Holešovice – Karlín"
    // se ze slibu vyčíst nedá, ví to jen člověk nebo model.
    const terms = termsFromProfile({
      names: ["Štvanická lávka"],
      synonyms: ["Lávka Holešovice"],
    });

    const found = scanLines(ROWS, terms).map((match) => match.line);
    expect(found.some((line) => line.includes("Lávka Holešovice-Karlín"))).toBe(true);
  });

  it("vyloučená slova nález zahodí, i když jinak sedí", () => {
    expect(isExcluded(ROWS[1]!, ["propagace"])).toBe(true);
    expect(isExcluded(ROWS[0]!, ["propagace"])).toBe(false);
  });
});

describe("návrh profilu bez modelu", () => {
  it("heuristika vrátí aspoň jména ze slibu, místo aby spadla", async () => {
    // Nástroj musí fungovat i bez API klíče; horší profil je lepší než žádný.
    const { profile } = await generateSearchProfile(
      handle.db,
      editor,
      new HeuristicProvider(),
      promiseId,
    );

    expect(Array.isArray(profile.names)).toBe(true);
    expect((await loadSearchProfile(handle.db, promiseId))?.generatedBy).toBe("model");
  });
});
