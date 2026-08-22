/**
 * Smíření manifestu se skutečností.
 *
 * Testuje se hlavně to, co má odhalit chybějící data — protože přesně tahle
 * kontrola v projektu chyběla a jeden doklad kvůli tomu tiše zmizel.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  acquisitionCommand,
  parseManifest,
  reconcile,
  type Manifest,
} from "@/modules/sources/manifest";

function manifestOf(...entries: unknown[]): Manifest {
  return parseManifest({ version: 1, sources: entries });
}

const program = {
  kind: "DOCUMENT",
  dir: "corpus/program-2022",
  chainLink: "PROMISE",
  why: "Doslovné znění slibů.",
  url: "https://example.org/program.pdf",
  title: "Program",
  publisher: "Strana",
  sourceType: "ELECTION_PROGRAM",
};

describe("parseManifest", () => {
  it("doplní výchozí licenci", () => {
    const manifest = manifestOf(program);

    expect(manifest.sources[0]?.license).toBe("FULL_TEXT_STORED");
  });

  it("odmítne dva záznamy do stejného adresáře", () => {
    // Dva zdroje v jednom adresáři znamenají, že jeden přepíše druhý —
    // a přepsaný dokument bere s sebou všechny citace, které se na něj vážou.
    expect(() => manifestOf(program, { ...program, url: "https://example.org/jiny.pdf" })).toThrow(
      /stejného adresáře/,
    );
  });

  it("odmítne adresář mimo korpus", () => {
    expect(() => manifestOf({ ...program, dir: "../mimo" })).toThrow(/corpus\//);
  });

  it("vyžaduje u tabulky filtr i sloupce", () => {
    // Výřez bez filtru není výřez, ale celý dataset vydávaný za výběr.
    expect(() => manifestOf({ ...program, kind: "TABLE" })).toThrow();
  });
});

describe("reconcile", () => {
  const manifest = manifestOf(
    program,
    {
      ...program,
      dir: "corpus/chybejici",
      url: "https://example.org/chybejici.pdf",
    },
    {
      ...program,
      dir: "corpus/zablokovany",
      url: "https://example.org/zablokovany.pdf",
      blockedBy: "Extrakce z HTML zatím neexistuje.",
    },
  );

  it("rozdělí zdroje na stažené, chybějící a zablokované", () => {
    const report = reconcile(manifest, ["corpus/program-2022"]);

    expect(report.frozen.map((entry) => entry.dir)).toEqual(["corpus/program-2022"]);
    expect(report.missing.map((entry) => entry.dir)).toEqual(["corpus/chybejici"]);
    expect(report.blocked.map((entry) => entry.dir)).toEqual(["corpus/zablokovany"]);
  });

  it("zablokovaný zdroj přestane být zablokovaný, jakmile ho někdo stáhne", () => {
    const report = reconcile(manifest, ["corpus/zablokovany"]);

    expect(report.blocked).toHaveLength(0);
    expect(report.frozen.map((entry) => entry.dir)).toEqual(["corpus/zablokovany"]);
  });

  it("nahlásí adresář, který nikdo nedeklaroval", () => {
    // Dokument bez záznamu v manifestu nikdo neschválil a nikdo neví, proč tu je.
    const report = reconcile(manifest, ["corpus/program-2022", "corpus/odnikud"]);

    expect(report.undeclared).toEqual(["corpus/odnikud"]);
  });
});

describe("acquisitionCommand", () => {
  it("u tabulky předá filtr i sloupce", () => {
    const [entry] = manifestOf({
      ...program,
      kind: "TABLE",
      match: "most",
      columns: ["nazev", "cena"],
    }).sources;

    const command = acquisitionCommand(entry!);

    expect(command).toContain("npm run corpus:table --");
    expect(command).toContain('--match "most"');
    expect(command).toContain("--columns nazev,cena");
  });

  it("u chráněného díla nese licenci", () => {
    const [entry] = manifestOf({ ...program, license: "QUOTE_ONLY" }).sources;

    expect(acquisitionCommand(entry!)).toContain("--license QUOTE_ONLY");
  });
});

describe("corpus/sources.json", () => {
  it("je platný", () => {
    // Manifest v repozitáři musí projít schématem, jinak sync spadne až v CI.
    const manifest = parseManifest(JSON.parse(readFileSync("corpus/sources.json", "utf8")));

    expect(manifest.sources.length).toBeGreaterThan(0);
  });

  it("deklaruje program Prahy Sobě, na kterém stojí reálný dataset", () => {
    const manifest = parseManifest(JSON.parse(readFileSync("corpus/sources.json", "utf8")));

    expect(manifest.sources.map((entry) => entry.dir)).toContain("corpus/praha-sobe-2022");
  });
});
