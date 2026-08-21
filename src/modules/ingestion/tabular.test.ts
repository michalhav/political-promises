import { describe, expect, it } from "vitest";

import {
  detectDelimiter,
  renderTabularDocument,
  splitRow,
  TabularError,
} from "@/modules/ingestion/tabular";

const CSV = [
  "id;nazev_zakazky;faze_zakazky;smluvni_cena_bez_dph_kc;poznamka",
  "1;Tramvajová trať Barrandov;Ukončeno plnění smlouvy;12000000;",
  "2;Nákup kancelářských potřeb;Zadáno;15000;běžná objednávka",
  '3;"Oprava mostu; etapa 2";Zadáno;900000;',
].join("\n");

describe("čtení tabulky", () => {
  it("pozná středník i čárku", () => {
    expect(detectDelimiter("a;b;c")).toBe(";");
    expect(detectDelimiter("a,b,c")).toBe(",");
  });

  it("uvozovky ruší oddělovač uvnitř buňky", () => {
    expect(splitRow('1;"Oprava mostu; etapa 2";Zadáno', ";")).toEqual([
      "1",
      "Oprava mostu; etapa 2",
      "Zadáno",
    ]);
  });

  it("zdvojená uvozovka uvnitř znamená jednu", () => {
    expect(splitRow('1;"Stavba ""U Mostu""";Zadáno', ";")).toEqual([
      "1",
      'Stavba "U Mostu"',
      "Zadáno",
    ]);
  });
});

describe("renderTabularDocument", () => {
  it("z řádku tabulky udělá jeden řádek textu", () => {
    const result = renderTabularDocument(CSV, {
      columns: ["nazev_zakazky", "faze_zakazky", "smluvni_cena_bez_dph_kc"],
    });

    expect(result.selectedRows).toBe(3);
    expect(result.text.split("\n")[0]).toBe(
      "Řádek 1 | nazev_zakazky: Tramvajová trať Barrandov | faze_zakazky: Ukončeno plnění smlouvy | smluvni_cena_bez_dph_kc: 12000000",
    );
  });

  it("prázdné buňky vynechá, ať se citace nezalkne dvojtečkami", () => {
    const result = renderTabularDocument(CSV, { columns: ["nazev_zakazky", "poznamka"] });
    const [first] = result.text.split("\n");

    expect(first).not.toContain("poznamka:");
    expect(result.text).toContain("poznamka: běžná objednávka");
  });

  it("filtr vybere jen to, co má, a počty sedí", () => {
    const result = renderTabularDocument(CSV, {
      columns: ["nazev_zakazky"],
      match: /tramvaj/i,
    });

    expect(result.totalRows).toBe(3);
    expect(result.selectedRows).toBe(1);
    expect(result.text).toContain("Tramvajová trať Barrandov");
  });

  it("čísluje podle původního souboru, ne podle výřezu", () => {
    // Kdyby se číslovalo podle výřezu, po změně filtru by stará citace
    // ukazovala na jiný záznam.
    const result = renderTabularDocument(CSV, { columns: ["nazev_zakazky"], match: /mostu/i });

    expect(result.text.startsWith("Řádek 3 |")).toBe(true);
  });

  it("citace z vykresleného textu se v něm dá najít doslova", () => {
    // Přesně tahle vlastnost drží celý důkazní řetězec: co redaktor vybere
    // jako citaci, musí jít znak po znaku najít v uloženém textu.
    const result = renderTabularDocument(CSV, { columns: ["nazev_zakazky", "faze_zakazky"] });
    const quote = result.text.split("\n")[1];

    expect(quote).toBeDefined();
    expect(result.text.includes(quote!)).toBe(true);
  });

  it("neznámý sloupec odmítne a vypíše, co k dispozici je", () => {
    expect(() => renderTabularDocument(CSV, { columns: ["neexistuje"] })).toThrow(TabularError);
    expect(() => renderTabularDocument(CSV, { columns: ["neexistuje"] })).toThrow(/Dostupné/);
  });

  it("nepustí do dokumentu celý dataset", () => {
    expect(() => renderTabularDocument(CSV, { maxRows: 2 })).toThrow(/limit je 2/);
  });

  it("soubor bez hlavičky odmítne", () => {
    expect(() => renderTabularDocument("")).toThrow(TabularError);
  });
});
