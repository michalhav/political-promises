import { describe, expect, it } from "vitest";

import { extractSearchTerms, scanLines } from "@/modules/ai/evidenceScan";

/**
 * Vyhledávání dokladů podle výrazů ze slibu.
 *
 * Dvě věci, které musí platit: najít doklad, který tam je, a **nezavalit**
 * redakci vším ostatním. Druhá je těžší a stojí na pravidle, že řádek musí
 * trefit aspoň jedno vlastní jméno.
 */
const PROMISE_EXCERPT = [
  "Postavíme nové mosty přes Vltavu",
  "Za třicet let od sametové revoluce se v Praze postavily jen dva nové mosty.",
  "Pod jeden rok jsme stlačili stavbu nové Trojské lávky, která už stojí,",
  "a na jaře 2023 otevřeme také Štvanickou lávku mezi Holešovicemi a Karlínem.",
].join("\n");

const ROWS = [
  'Řádek 1 | nazev_zakazky: Stavba č. 42822 "Lávka Holešovice - Karlín" | smluvni_cena_bez_dph_kc: 298040000',
  'Řádek 2 | nazev_zakazky: Stavba č. 42821 "Dvorecký most; stavební práce" | smluvni_cena_bez_dph_kc: 1074965748',
  "Řádek 3 | nazev_zakazky: Nákup kancelářských potřeb pro magistrát | smluvni_cena_bez_dph_kc: 15000",
  "Řádek 4 | nazev_zakazky: Rekonstrukce školní jídelny v Praze 6 | smluvni_cena_bez_dph_kc: 900000",
  "Řádek 5 | nazev_zakazky: Oprava Trojské lávky po havárii | smluvni_cena_bez_dph_kc: 8780000",
];

describe("extractSearchTerms", () => {
  it("vytáhne víceslovné vlastní názvy z citace", () => {
    const labels = extractSearchTerms(PROMISE_EXCERPT).map((term) => term.label);

    expect(labels).toContain("Trojské lávky");
    expect(labels.some((label) => label.startsWith("Štvanickou"))).toBe(true);
  });

  it("zahodí slova, která v Praze nic nerozlišují", () => {
    const keys = extractSearchTerms("Postavíme nové městské byty v Praze").map((term) =>
      term.keys.join("+"),
    );

    expect(keys).not.toContain("praze");
    expect(keys.some((key) => key.startsWith("mest"))).toBe(false);
  });

  it("spojí slovo rozdělené přes řádek", () => {
    const keys = extractSearchTerms("Vybudujeme nové cyklo-\nstezky").map((term) =>
      term.keys.join("+"),
    );

    // Kmen, ne celé slovo: „cyklostezky" se zkrátí, aby sedlo i na „cyklostezka".
    expect(keys.some((key) => key.startsWith("cyklost"))).toBe(true);
  });
});

describe("scanLines", () => {
  const terms = extractSearchTerms(PROMISE_EXCERPT);

  it("najde lávku, aniž by ji někdo zadal ručně", () => {
    const matches = scanLines(ROWS, terms);
    const found = matches.map((match) => match.line);

    expect(found.some((line) => line.includes("Lávka Holešovice - Karlín"))).toBe(true);
  });

  it("u každého nálezu řekne, kvůli čemu prošel", () => {
    const [best] = scanLines(ROWS, terms);

    // Bez tohohle seznamu by kontrola stála redakci víc než ruční hledání.
    expect(best?.matchedTerms.length).toBeGreaterThan(0);
  });

  it("nesouvisející zakázky nepustí", () => {
    const found = scanLines(ROWS, terms).map((match) => match.line);

    expect(found.some((line) => line.includes("kancelářských potřeb"))).toBe(false);
    expect(found.some((line) => line.includes("školní jídelny"))).toBe(false);
  });

  it("bez vlastního jména radši nevrátí nic", () => {
    // „Zlepšíme prostředí ve městě" nemá podle čeho hledat; vrátit cokoli by
    // znamenalo tvářit se, že doklad existuje.
    const vague = extractSearchTerms("Zlepšíme prostředí a rozvineme možnosti");

    expect(scanLines(ROWS, vague)).toHaveLength(0);
  });

  it("nevysype víc, než kolik si redakce vyžádá", () => {
    expect(scanLines(ROWS, terms, { limit: 1 })).toHaveLength(1);
  });

  it("řadí od nejsilnější shody", () => {
    const matches = scanLines(ROWS, terms, { limit: 5 });
    const scores = matches.map((match) => match.score);

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});
