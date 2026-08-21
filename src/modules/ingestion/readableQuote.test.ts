import { describe, expect, it } from "vitest";

import { toReadableQuote } from "@/modules/ingestion/normalize";

/**
 * Citace pro čtenáře.
 *
 * Zobrazení se smí od uloženého textu lišit jen v tom, co do výroku nepatří:
 * v artefaktech sazby. Ani jedno slovo navíc, ani jedno pryč.
 */
describe("toReadableQuote", () => {
  it("spojí slovo rozdělené přes řádek", () => {
    expect(toReadableQuote("Rozšíříme síť cyklo-\nstezek.")).toBe("Rozšíříme síť cyklostezek.");
  });

  it("nechá spojovník, který dělením není", () => {
    expect(toReadableQuote("Praha-východ dostane novou linku.")).toBe(
      "Praha-východ dostane novou linku.",
    );
  });

  it("scvrkne zalomení a dvojité mezery na jednu", () => {
    expect(toReadableQuote("Zavedeme\nbezplatnou   MHD  pro seniory.")).toBe(
      "Zavedeme bezplatnou MHD pro seniory.",
    );
  });

  it("nemění slova ani interpunkci uvnitř věty", () => {
    const quote = "Postavíme 2 000 nových městských nájemních bytů do konce volebního období.";
    expect(toReadableQuote(quote)).toBe(quote);
  });

  it("nepřidá ani neubere obsah, jen sazbu", () => {
    const stored = "Navýšíme\nkapacitu mateř-\nských škol o 1 200 míst.";
    const shown = toReadableQuote(stored);

    expect(shown).toBe("Navýšíme kapacitu mateřských škol o 1 200 míst.");
    // Kontrola proti tichému mizení textu: počet písmen a číslic musí sedět.
    const alnum = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, "");
    expect(alnum(shown)).toBe(alnum(stored));
  });
});
