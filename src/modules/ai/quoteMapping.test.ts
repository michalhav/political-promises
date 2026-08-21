import { describe, expect, it } from "vitest";

import { buildView, toCanonicalQuote } from "@/modules/ai/quoteMapping";

/**
 * Mapování citace zpátky na kanonický text.
 *
 * Tady se rozhoduje, jestli je citace citací. Model čte spojený text, ale
 * uložit se musí doslovný výřez z originálu — včetně dělení slov, které
 * v dokumentu doopravdy je.
 */
describe("toCanonicalQuote", () => {
  it("vrátí doslovný výřez včetně dělení slova přes řádek", () => {
    const canonical = "Rozšíříme síť cyklo-\nstezek v celém městě. Konec.";
    const view = buildView(canonical);

    // Model vidí slovo spojené, protože normalizace dělení odstraní.
    expect(view.normalized.text).toContain("cyklostezek");

    const quote = toCanonicalQuote(view, "Rozšíříme síť cyklostezek v celém městě.");
    expect(quote).toBe("Rozšíříme síť cyklo-\nstezek v celém městě.");
    expect(canonical).toContain(quote!);
  });

  it("vrácený výřez ve zdroji vždy doslova stojí", () => {
    const canonical = "Před tím.  Zavedeme\nbezplatnou MHD pro seniory.\n\nPo tom.";
    const view = buildView(canonical);

    const quote = toCanonicalQuote(view, "Zavedeme bezplatnou MHD pro seniory.");
    expect(quote).not.toBeNull();
    expect(canonical.includes(quote!)).toBe(true);
  });

  it("vymyšlenou citaci nenajde", () => {
    const view = buildView("Postavíme nové tramvajové tratě.");

    expect(toCanonicalQuote(view, "Zrušíme školné na vysokých školách.")).toBeNull();
  });

  it("prázdný úryvek odmítne", () => {
    const view = buildView("Nějaký text.");

    expect(toCanonicalQuote(view, "   ")).toBeNull();
  });

  it("poradí si se sjednocenou interpunkcí", () => {
    // V dokumentu jsou typografické uvozovky, model dostane rovné.
    const canonical = 'Slíbili jsme „nové byty" a stavíme je.';
    const view = buildView(canonical);

    const quote = toCanonicalQuote(view, 'Slíbili jsme "nové byty" a stavíme je.');
    expect(quote).toBe(canonical);
  });
});
