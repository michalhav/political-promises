/**
 * Dělení stránky na věty.
 *
 * Vstupy jsou **doslovné řádky ze stránky 26 korpusu praha-sobe-2022**, včetně
 * zalomení uprostřed vět a dělení slov na konci řádku. Přesně na nich se
 * ukázalo, že dělení po řádcích je k anotaci nepoužitelné: z 3 302 úseků jich
 * jen 29 % končilo tečkou a některé byly přeťaté uprostřed slova.
 */
import { describe, expect, it } from "vitest";

import {
  splitPageIntoSegments,
  splitPageIntoSentences,
  SEGMENTATION_VERSION,
} from "@/modules/extraction/segments";
import type { CanonicalPage } from "@/modules/ingestion/canonical";
import { normalizeText } from "@/modules/ingestion/normalize";
import type { ExcludedRange } from "@/modules/ingestion/structure";

const FOOTER = "PRAHA SOBĚ I Naše vize a konkrétních 218 zlepšení26";

/** Doslovně ze stránky 26, i s tvrdými zalomeními a dělením slov. */
const PAGE_26: CanonicalPage = {
  pageNumber: 26,
  text: [
    FOOTER,
    "Proto jsme přišli s plánem prověřit vznik nové linky O: páté, okružní",
    "trasy pražského metra. Metro O by mělo v první fázi propojit místa",
    "nového developmentu a místa, mezi nimiž lidé dojíždějí do prá-",
    "ce. Jde o úsek Dejvice – Smíchov – Pankrác – Slatiny – Žižkov –",
    "Vysočany. Metro O má současně protnout tři již fun-",
    "gující linky i rozestavěnou čtvrtou.",
  ].join("\n"),
};

const FOOTER_RANGE: ExcludedRange[] = [
  { start: 0, end: FOOTER.length, kind: "RUNNING_HEADER", text: FOOTER },
];

describe("dělení na věty", () => {
  it("spojí větu roztrženou přes víc řádků", () => {
    const sentences = splitPageIntoSentences(PAGE_26, FOOTER_RANGE);
    const first = sentences[0];

    expect(first?.normalized).toBe(
      "Proto jsme přišli s plánem prověřit vznik nové linky O: páté, okružní trasy pražského metra.",
    );
    // Citace zůstává doslovná — se zalomením, jak v dokumentu stojí.
    expect(first?.text).toContain("\n");
  });

  it("spojí slovo rozdělené na konci řádku", () => {
    const sentences = splitPageIntoSentences(PAGE_26, FOOTER_RANGE);
    const withHyphen = sentences.find((segment) => segment.normalized.includes("do práce"));

    expect(withHyphen).toBeDefined();
    // V normalizované podobě je slovo celé, v citaci pořád rozdělené.
    expect(withHyphen?.text).toContain("prá-\nce");
  });

  it("téměř všechny věty končí větnou interpunkcí", () => {
    const sentences = splitPageIntoSentences(PAGE_26, FOOTER_RANGE);
    const ending = sentences.filter((segment) => /[.!?]$/.test(segment.normalized));

    // Dělení po řádcích dávalo na tomhle korpusu 29 %.
    expect(ending.length / sentences.length).toBeGreaterThan(0.9);
  });

  it("nerozdělí větu na zkratce ani na pořadovém čísle", () => {
    const page: CanonicalPage = {
      pageNumber: 1,
      text: "Schválili jsme usnesení č. 2 o 1. etapě výstavby. Další věta pokračuje.",
    };

    const sentences = splitPageIntoSentences(page);
    expect(sentences).toHaveLength(2);
    expect(sentences[0]?.normalized).toBe("Schválili jsme usnesení č. 2 o 1. etapě výstavby.");
  });

  it("vynechá stránkovou výbavu", () => {
    const sentences = splitPageIntoSentences(PAGE_26, FOOTER_RANGE);
    expect(sentences.some((segment) => segment.text.includes("PRAHA SOBĚ"))).toBe(false);
  });

  it("rozsahy pořád ukazují do kanonického textu", () => {
    for (const segment of splitPageIntoSentences(PAGE_26, FOOTER_RANGE)) {
      expect(PAGE_26.text.slice(segment.span.start, segment.span.end)).toBe(segment.text);
      expect(normalizeText(segment.text).text).toBe(segment.normalized);
    }
  });
});

describe("dělení po řádcích zůstává beze změny", () => {
  it("stará funkce dělí pořád stejně jako dřív", () => {
    const segments = splitPageIntoSegments(PAGE_26);

    // Heuristická laťka měří dál totéž; nová segmentace na ni nesahá.
    expect(segments[0]?.text).toBe(FOOTER);
    expect(segments[1]?.text).toBe(
      "Proto jsme přišli s plánem prověřit vznik nové linky O: páté, okružní",
    );
  });

  it("dává výrazně víc a kratších úseků než dělení na věty", () => {
    const byLine = splitPageIntoSegments(PAGE_26, FOOTER_RANGE);
    const bySentence = splitPageIntoSentences(PAGE_26, FOOTER_RANGE);

    expect(byLine.length).toBeGreaterThan(bySentence.length);
  });

  it("verze segmentace je zaznamenaná", () => {
    expect(SEGMENTATION_VERSION).toBe("1.0.0");
  });
});
