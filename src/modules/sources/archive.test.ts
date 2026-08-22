/**
 * Rozpoznání archivní adresy.
 *
 * Podstatné je, že se pozná **z adresy**. Kdyby archivní původ vyplňoval
 * člověk přepínačem, dřív nebo později by ho někdo zapomněl a kopie by se
 * tvářila jako originál od vydavatele.
 */
import { describe, expect, it } from "vitest";

import { parseArchiveUrl } from "@/modules/sources/archive";

const SNIMEK = "http://web.archive.org/web/20220629005413/https://praha.pirati.cz/volby/2022.html";

describe("parseArchiveUrl", () => {
  it("rozloží snímek Wayback Machine na původ", () => {
    const origin = parseArchiveUrl(SNIMEK);

    expect(origin?.service).toBe("Internet Archive");
    expect(origin?.originalUrl).toBe("https://praha.pirati.cz/volby/2022.html");
    expect(origin?.snapshotAt.toISOString()).toBe("2022-06-29T00:54:13.000Z");
  });

  it("stahuje archivované původní bajty, ne verzi s lištou archivu", () => {
    // Lišta se časem mění, originál ne. Bez `id_` by se otisk rozešel při
    // každé úpravě archivu a týdenní kontrola by hlásila změnu dokumentu,
    // ke které nedošlo.
    expect(parseArchiveUrl(SNIMEK)?.rawUrl).toBe(
      "https://web.archive.org/web/20220629005413id_/https://praha.pirati.cz/volby/2022.html",
    );
  });

  it("poradí si s adresou, která už `id_` obsahuje", () => {
    const origin = parseArchiveUrl(
      "https://web.archive.org/web/20220629005413id_/https://example.org/a.pdf",
    );

    expect(origin?.originalUrl).toBe("https://example.org/a.pdf");
    expect(origin?.rawUrl).toContain("id_/https://example.org/a.pdf");
  });

  it("bere i variantu bez subdomény web", () => {
    expect(
      parseArchiveUrl("https://archive.org/web/20220629005413/https://example.org/a")?.originalUrl,
    ).toBe("https://example.org/a");
  });

  it("běžnou adresu nechá být", () => {
    expect(parseArchiveUrl("https://prahasobe.cz/program.pdf")).toBeNull();
  });

  it("odmítne nesmyslné razítko místo tichého posunu data", () => {
    // Date.UTC přebere i 31. února a tiše ho posune na 3. března. Takový
    // dokument by tvrdil, že snímek vznikl jindy, než vznikl.
    expect(
      parseArchiveUrl("https://web.archive.org/web/20220231005413/https://example.org/a"),
    ).toBeNull();
  });

  it("odmítne zkrácené razítko", () => {
    expect(parseArchiveUrl("https://web.archive.org/web/2022/https://example.org/a")).toBeNull();
  });
});
