import { describe, expect, it } from "vitest";

import { sliceSpan, type CanonicalDocument } from "@/modules/ingestion/canonical";
import { normalizeText, toCanonicalSpan } from "@/modules/ingestion/normalize";

function documentWith(text: string): CanonicalDocument {
  return {
    contentHash: "0".repeat(64),
    extractorVersion: "test",
    pageCount: 1,
    pages: [{ pageNumber: 1, text }],
    sourceName: "test",
    extractedAt: "2026-08-21T00:00:00.000Z",
  };
}

describe("normalizace", () => {
  it("scvrkne bílé znaky na jednu mezeru a ořízne okraje", () => {
    expect(normalizeText("  Postavíme\n\n  2 000   bytů.  ").text).toBe("Postavíme 2 000 bytů.");
  });

  it("spojí slovo rozdělené na konci řádku", () => {
    expect(normalizeText("nájem-\nních bytů").text).toBe("nájemních bytů");
  });

  it("spojovník uprostřed řádku nechá být", () => {
    expect(normalizeText("Demo-východ").text).toBe("Demo-východ");
  });

  it("sjednotí typografické uvozovky a pomlčky", () => {
    expect(normalizeText("„citát“ a — pomlčka").text).toBe('"citát" a - pomlčka');
  });

  it("složí rozloženou diakritiku", () => {
    // PDF občas vysype „ě" jako „e" plus samostatný háček. Bez složení by
    // hledání „zavedeme" tuhle větu minulo.
    const decomposed = "zavědeme";
    expect(decomposed).not.toBe("zavěděme");
    expect(decomposed.length).toBe(9);

    const normalized = normalizeText(decomposed);
    expect(normalized.text).toBe("zavědeme");
    expect(normalized.text.length).toBe(8);
  });

  it("zahodí neviditelné znaky", () => {
    // Měkký spojovník a nulová mezera se v PDF objevují běžně.
    expect(normalizeText("by­t​ů").text).toBe("bytů");
  });
});

describe("mapování zpět na originál", () => {
  it("nález v normalizovaném textu ukazuje na správné místo v originále", () => {
    const canonical = "BYDLENÍ\n\nPostavíme  2 000\nnájem-\nních bytů do roku 2026.";
    const document = documentWith(canonical);
    const normalized = normalizeText(canonical);

    const needle = "Postavíme 2 000 nájemních bytů";
    const start = normalized.text.indexOf(needle);
    expect(start).toBeGreaterThanOrEqual(0);

    const span = toCanonicalSpan(normalized, 1, start, start + needle.length, canonical.length);
    expect(span).not.toBeNull();

    const quoted = sliceSpan(document, span!);
    // V originále je text pořád rozsekaný na řádky — a to je správně, protože
    // citace musí odpovídat tomu, co v dokumentu doslova stojí.
    expect(quoted).toBe("Postavíme  2 000\nnájem-\nních bytů");
    expect(normalizeText(quoted ?? "").text).toBe(needle);
  });

  it("posuny jsou neklesající, takže rozsah nikdy nejde pozpátku", () => {
    const normalized = normalizeText("  a  b\n\nc-\nd  ");

    for (let i = 1; i < normalized.sourceOffsets.length; i += 1) {
      expect(normalized.sourceOffsets[i]).toBeGreaterThan(normalized.sourceOffsets[i - 1]!);
    }
  });

  it("prázdný nebo obrácený rozsah vrací null místo nesmyslu", () => {
    const normalized = normalizeText("text");

    expect(toCanonicalSpan(normalized, 1, 2, 2, 4)).toBeNull();
    expect(toCanonicalSpan(normalized, 1, 3, 1, 4)).toBeNull();
    expect(toCanonicalSpan(normalized, 1, 0, 99, 4)).toBeNull();
  });
});
