/**
 * Extrakce z HTML.
 *
 * Testuje se hlavně to, na čem stojí doložitelnost: že se text shoduje s tím,
 * co čtenář na stránce viděl, a že extrakce nepřidává ani nemlčí o tom, co
 * neumí.
 */
import { describe, expect, it } from "vitest";

import { extractHtml, HTML_EXTRACTOR_VERSION } from "@/modules/ingestion/html";
import { findExactSpans, sliceSpan } from "@/modules/ingestion/canonical";

function extract(html: string) {
  return extractHtml(new TextEncoder().encode(html), "test.html");
}

function textOf(html: string): string {
  return extract(html).document.pages[0]!.text;
}

describe("extractHtml", () => {
  it("vyhodí skript a styl, protože to není text dokumentu", () => {
    const text = textOf(
      "<body><style>p{color:red}</style><p>Slib</p><script>var a=1</script></body>",
    );

    expect(text).toBe("Slib");
  });

  it("dekóduje entity — citovat se musí to, co čtenář viděl", () => {
    expect(textOf("<body><p>Doprava &amp; bydlení</p></body>")).toBe("Doprava & bydlení");
  });

  it("sloučí odsazení zdrojáku do jedné mezery", () => {
    // V HTML je posloupnost bílých znaků vykreslena jako jedna mezera.
    // Zachovat odsazení by znamenalo text, který nikdo nikdy neviděl.
    const text = textOf("<body><p>Postavíme\n\n     nové     mosty</p></body>");

    expect(text).toBe("Postavíme nové mosty");
  });

  it("uvnitř <pre> bílé znaky zachová, tam jsou významové", () => {
    expect(textOf("<body><pre>a   b\n  c</pre></body>")).toBe("a   b\n  c");
  });

  it("odděluje blokové prvky koncem řádku", () => {
    const text = textOf("<body><h1>Doprava</h1><p>První</p><p>Druhý</p></body>");

    expect(text).toBe("Doprava\nPrvní\nDruhý");
  });

  it("nespojí sousední položky seznamu do jednoho slova", () => {
    // Bez konců řádků by z <li>Metro</li><li>Tramvaje</li> vzniklo
    // „MetroTramvaje" a citace na jednu položku by přestala sedět.
    expect(textOf("<body><ul><li>Metro</li><li>Tramvaje</li></ul></body>")).toBe("Metro\nTramvaje");
  });

  it("řádkový prvek slovo neroztrhne", () => {
    expect(textOf("<body><p>bez<strong>bariérové</strong> stanice</p></body>")).toBe(
      "bezbariérové stanice",
    );
  });

  it("je deterministická — stejné bajty dají stejný text i otisk", () => {
    const html = "<body><p>Slib</p></body>";
    const first = extract(html);
    const second = extract(html);

    expect(second.document.pages).toEqual(first.document.pages);
    expect(second.document.contentHash).toBe(first.document.contentHash);
  });

  it("má právě jednu stránku, protože HTML stránkování nemá", () => {
    const report = extract("<body><p>Slib</p></body>");

    expect(report.document.pageCount).toBe(1);
    expect(report.document.pages[0]?.pageNumber).toBe(1);
    expect(report.document.extractorVersion).toBe(HTML_EXTRACTOR_VERSION);
  });

  it("vytažený text jde adresovat rozsahem, na kterém stojí citace", () => {
    const report = extract("<body><h1>Doprava</h1><p>Postavíme nové mosty přes Vltavu</p></body>");
    const [span] = findExactSpans(report.document, "nové mosty");

    expect(span).toBeDefined();
    expect(sliceSpan(report.document, span!)).toBe("nové mosty");
  });

  it("přečte název stránky", () => {
    expect(extract("<head><title>Dvorecký most</title></head><body>x</body>").title).toBe(
      "Dvorecký most",
    );
  });

  it("ohlásí stránku bez textu místo tichého prázdna", () => {
    // Stránka vykreslovaná až v prohlížeči. Mlčky uložit prázdný kanonický
    // text by znamenalo dokument, ze kterého nejde citovat, a nikdo by nevěděl proč.
    expect(extract('<body><div id="app"></div></body>').isEmpty).toBe(true);
  });

  it("ohlásí cizí kódování místo rozsypaného textu", () => {
    // Bajty čteme jako UTF-8. Když stránka tvrdí něco jiného, je to nález.
    const report = extract('<head><meta charset="windows-1250"></head><body><p>x</p></body>');

    expect(report.declaredCharset).toBe("windows-1250");
  });

  it("u UTF-8 nehlásí nic", () => {
    expect(
      extract('<head><meta charset="UTF-8"></head><body><p>x</p></body>').declaredCharset,
    ).toBeNull();
  });
});
