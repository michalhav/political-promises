/**
 * Ukázkové zdrojové dokumenty.
 *
 * Texty jsou smyšlené. Nesmí ale být smyšlené *nahodile*: každý citát, který
 * kdekoli v datasetu použijeme jako důkaz, musí doslova stát v `rawText` toho
 * dokumentu, na který odkazuje. Proto jsou citáty vytažené do `QUOTES` a texty
 * dokumentů se z nich skládají — invariant pak jde otestovat, ne jen slíbit.
 */
import { contentHash, seedId } from "@/db/seed/ids";
import type { sourceDocuments } from "@/modules/sources/schema";

/** Kdy jsme dokumenty stáhli. Pevné datum, ať je seed deterministický. */
const RETRIEVED_AT = new Date("2026-08-20T09:00:00.000Z");

export const QUOTES = {
  programA_byty:
    "Do konce volebního období postavíme 2 000 nových městských nájemních bytů a udržíme je v majetku města.",
  programA_tramvaj: "Zahájíme stavbu tramvajové trati do Demo čtvrti nejpozději v roce 2025.",
  programA_skolky:
    "Navýšíme kapacitu mateřských škol zřizovaných městem o 1 200 míst do roku 2026.",
  programA_zelen: "Budeme pokračovat v péči o městskou zeleň a rozvíjet ji.",
  programA_dph: "Prosadíme snížení daně z přidané hodnoty na stavební práce u dostupného bydlení.",
  programA_cyklo: "Rozšíříme síť chráněných cyklotras v centru města.",
  programBC_parkovani:
    "Postavíme tři parkovací domy u konečných stanic metra a zavedeme jednotné parkovací předplatné.",
  programBC_digital:
    "Zavedeme jednotné přihlášení do všech digitálních služeb města do konce roku 2025.",
  programBC_seniori: "Vyčleníme 300 městských bytů pro seniory a zavedeme transparentní pořadník.",
  programBC_dluh:
    "Nezvýšíme celkové zadlužení města nad úroveň roku 2022, tedy nad 30 miliard korun.",
  programBC_voda: "Zmodernizujeme vodohospodářskou infrastrukturu ve svěřených objektech.",
  programD_kamery:
    "Rozšíříme městský kamerový systém o 500 kamer a napojíme ho na jednotný dispečink.",
  programD_brownfieldy:
    "Zahájíme přeměnu tří brownfieldů na plnohodnotné městské čtvrti se smíšenou funkcí.",
  koalice_byty:
    "Koalice se zavazuje zahájit výstavbu nejméně 2 000 městských nájemních bytů a udržet je v majetku města.",
  koalice_tramvaj:
    "Budeme pokračovat v přípravě tramvajových tratí do rozvojových oblastí podle aktuálních možností rozpočtu.",
  koalice_skolky:
    "Navýšíme kapacitu mateřských škol o 1 200 míst a současně rozšíříme kapacitu školních družin.",
  koalice_parkovani:
    "Rozvoj záchytného parkování u konečných stanic metra sloučíme s programem parkovacích domů do jednoho investičního programu.",
  koalice_digital:
    "Sjednotíme přihlašování do digitálních služeb města a zavedeme jednotný uživatelský účet.",
  koalice_seniori:
    "Podpoříme dostupné bydlení pro seniory prostřednictvím městského bytového fondu.",
  usneseni_byty:
    "Zastupitelstvo schvaluje investiční program Městský nájemní fond 2023–2026 v rozsahu 2 000 bytových jednotek.",
  usneseni_skolky:
    "Zastupitelstvo schvaluje navýšení kapacit mateřských škol o 1 200 míst v letech 2023 až 2026.",
  usneseni_dluh:
    "Zastupitelstvo bere na vědomí ukončení programu snižování zadluženosti a schvaluje emisi dluhopisů ve výši 4,2 miliardy korun.",
  rozpocet_byty:
    "Kapitola 08 – Bytový fond: investiční výdaje na program Městský nájemní fond 2023–2026 ve výši 600 000 tis. Kč.",
  rozpocet_skolky: "Kapitola 04 – Školství: navýšení kapacit mateřských škol, 310 000 tis. Kč.",
  zakazka_byty:
    "Předmětem veřejné zakázky je výstavba 340 bytových jednotek v lokalitě Demo sever, první etapa programu Městský nájemní fond.",
  smlouva_byty:
    "Zhotovitel se zavazuje dokončit 340 bytových jednotek první etapy do 31. 12. 2025.",
  zprava_byty:
    "K 31. 12. 2025 bylo v rámci programu Městský nájemní fond zkolaudováno 910 bytových jednotek.",
  zprava_skolky:
    "Ve školním roce 2025/2026 činí meziroční navýšení kapacit mateřských škol zřizovaných městem 1 265 míst oproti roku 2022.",
  zprava_dluh:
    "Celkový dluh města k 31. 12. 2025 činí 34,2 miliardy korun oproti 30,0 miliardy korun k 31. 12. 2022.",
  zprava_doprava:
    "Stavební povolení pro tramvajovou trať do Demo čtvrti nabylo právní moci dne 14. 4. 2025, stavba byla zahájena 2. 6. 2025.",
  zakazka_parkovani:
    "Zadávací řízení na parkovací dům Demo-východ bylo přerušeno z důvodu podaných námitek.",
  clanek_vystavba: "Na staveništi v Demo severu stojí hrubá stavba prvních tří bytových domů.",
} as const;

interface DemoSourceInput {
  key: string;
  sourceType: (typeof sourceDocuments.$inferInsert)["sourceType"];
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  /** Plný text ukládáme jen tam, kde to jde právně obhájit (B2). */
  rawText?: string;
  pageCount?: number;
  processingState?: (typeof sourceDocuments.$inferInsert)["processingState"];
}

function demoSource(input: DemoSourceInput): typeof sourceDocuments.$inferInsert {
  const licenseMode = input.rawText === undefined ? "QUOTE_ONLY" : "FULL_TEXT_STORED";

  return {
    id: seedId(`source:${input.key}`),
    sourceType: input.sourceType,
    title: input.title,
    publisher: input.publisher,
    url: input.url,
    publishedAt: input.publishedAt,
    retrievedAt: RETRIEVED_AT,
    contentHash: contentHash(input.rawText ?? `${input.title}|${input.url}`),
    licenseMode,
    rawText: input.rawText ?? null,
    mimeType: "text/plain",
    pageCount: input.pageCount ?? null,
    isDemo: true,
    processingState: input.processingState ?? "PUBLISHED",
    metadataJson: { seedKey: input.key },
  };
}

export const SOURCE_KEYS = {
  programA: "program-demo-a-2022",
  programBC: "program-demo-bc-2022",
  programD: "program-demo-d-2022",
  koalicniSmlouva: "koalicni-smlouva-2022",
  usneseniByty: "usneseni-zmp-2023-0456",
  usneseniDluh: "usneseni-zmp-2025-0912",
  rozpocet: "rozpocet-2024",
  zakazkaByty: "zakazka-2024-bytovy-fond",
  zakazkaParkovani: "zakazka-2025-parkovaci-dum",
  smlouvaByty: "smlouva-2024-vystavba-sever",
  zpravaBydleni: "vyrocni-zprava-bydleni-2025",
  zpravaDoprava: "zprava-doprava-2025",
  clanek: "clanek-demo-media-2025",
  rejstrik: "rejstrik-stran-vypis",
  nezpracovany: "zapis-vyboru-2026-03",
} as const;

export function sourceId(key: string): string {
  return seedId(`source:${key}`);
}

export const DEMO_SOURCE_DOCUMENTS: (typeof sourceDocuments.$inferInsert)[] = [
  demoSource({
    key: SOURCE_KEYS.programA,
    sourceType: "ELECTION_PROGRAM",
    title: "Volební program Demo strany A pro komunální volby 2022",
    publisher: "Demo strana A",
    url: "https://example.org/demo/program-a-2022.pdf",
    publishedAt: "2022-08-15",
    pageCount: 24,
    rawText: [
      "VOLEBNÍ PROGRAM DEMO STRANY A PRO KOMUNÁLNÍ VOLBY 2022",
      "",
      "BYDLENÍ",
      QUOTES.programA_byty,
      "Zrychlíme povolovací procesy u městských investic.",
      "",
      "DOPRAVA",
      QUOTES.programA_tramvaj,
      QUOTES.programA_cyklo,
      "",
      "ŠKOLSTVÍ",
      QUOTES.programA_skolky,
      "",
      "ŽIVOTNÍ PROSTŘEDÍ",
      QUOTES.programA_zelen,
      "",
      "VEŘEJNÉ FINANCE",
      QUOTES.programA_dph,
    ].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.programBC,
    sourceType: "ELECTION_PROGRAM",
    title: "Volební program Demo koalice B+C pro komunální volby 2022",
    publisher: "Demo koalice B+C",
    url: "https://example.org/demo/program-bc-2022.pdf",
    publishedAt: "2022-08-20",
    pageCount: 31,
    rawText: [
      "SPOLEČNÝ PROGRAM DEMO KOALICE B+C",
      "",
      "DOPRAVA A PARKOVÁNÍ",
      QUOTES.programBC_parkovani,
      "",
      "DIGITALIZACE",
      QUOTES.programBC_digital,
      "",
      "SOCIÁLNÍ POLITIKA",
      QUOTES.programBC_seniori,
      "",
      "HOSPODAŘENÍ MĚSTA",
      QUOTES.programBC_dluh,
      "",
      "ŽIVOTNÍ PROSTŘEDÍ",
      QUOTES.programBC_voda,
    ].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.programD,
    sourceType: "ELECTION_PROGRAM",
    title: "Volební program Demo strany D pro komunální volby 2022",
    publisher: "Demo strana D",
    url: "https://example.org/demo/program-d-2022.pdf",
    publishedAt: "2022-08-18",
    pageCount: 18,
    rawText: [
      "PROGRAM DEMO STRANY D",
      "",
      "BEZPEČNOST",
      QUOTES.programD_kamery,
      "",
      "ROZVOJ MĚSTA",
      QUOTES.programD_brownfieldy,
    ].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.koalicniSmlouva,
    sourceType: "COALITION_AGREEMENT",
    title: "Koaliční smlouva pro volební období 2022–2026 (demo)",
    publisher: "Demo strana A a Demo koalice B+C",
    url: "https://example.org/demo/koalicni-smlouva-2022.pdf",
    publishedAt: "2022-11-04",
    pageCount: 12,
    rawText: [
      "KOALIČNÍ SMLOUVA PRO VOLEBNÍ OBDOBÍ 2022–2026",
      "",
      "I. BYDLENÍ",
      QUOTES.koalice_byty,
      QUOTES.koalice_seniori,
      "",
      "II. DOPRAVA",
      QUOTES.koalice_tramvaj,
      QUOTES.koalice_parkovani,
      "",
      "III. ŠKOLSTVÍ",
      QUOTES.koalice_skolky,
      "",
      "IV. DIGITALIZACE",
      QUOTES.koalice_digital,
    ].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.usneseniByty,
    sourceType: "COUNCIL_RESOLUTION",
    title: "Usnesení zastupitelstva č. 2023/0456 — investiční program Městský nájemní fond",
    publisher: "Zastupitelstvo demo města",
    url: "https://example.org/demo/usneseni-2023-0456",
    publishedAt: "2023-06-15",
    rawText: [
      "USNESENÍ č. 2023/0456 ze dne 15. 6. 2023",
      QUOTES.usneseni_byty,
      QUOTES.usneseni_skolky,
    ].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.usneseniDluh,
    sourceType: "COUNCIL_RESOLUTION",
    title: "Usnesení zastupitelstva č. 2025/0912 — emise dluhopisů",
    publisher: "Zastupitelstvo demo města",
    url: "https://example.org/demo/usneseni-2025-0912",
    publishedAt: "2025-09-09",
    rawText: ["USNESENÍ č. 2025/0912 ze dne 9. 9. 2025", QUOTES.usneseni_dluh].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.rozpocet,
    sourceType: "BUDGET",
    title: "Rozpočet demo města na rok 2024",
    publisher: "Demo město",
    url: "https://example.org/demo/rozpocet-2024.pdf",
    publishedAt: "2023-12-14",
    pageCount: 156,
    rawText: ["ROZPOČET NA ROK 2024", QUOTES.rozpocet_byty, QUOTES.rozpocet_skolky].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.zakazkaByty,
    sourceType: "PUBLIC_PROCUREMENT",
    title: "Veřejná zakázka: Městský nájemní fond, 1. etapa Demo sever",
    publisher: "Demo město",
    url: "https://example.org/demo/zakazka-2024-001",
    publishedAt: "2024-03-11",
    rawText: ["OZNÁMENÍ O ZAHÁJENÍ ZADÁVACÍHO ŘÍZENÍ", QUOTES.zakazka_byty].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.zakazkaParkovani,
    sourceType: "PUBLIC_PROCUREMENT",
    title: "Veřejná zakázka: Parkovací dům Demo-východ",
    publisher: "Demo město",
    url: "https://example.org/demo/zakazka-2025-014",
    publishedAt: "2025-05-20",
    rawText: ["OZNÁMENÍ O PŘERUŠENÍ ZADÁVACÍHO ŘÍZENÍ", QUOTES.zakazka_parkovani].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.smlouvaByty,
    sourceType: "CONTRACT",
    title: "Smlouva o dílo: výstavba 340 bytových jednotek Demo sever",
    publisher: "Demo město",
    url: "https://example.org/demo/smlouva-2024-0731",
    publishedAt: "2024-07-30",
    rawText: ["SMLOUVA O DÍLO č. 2024/0731", QUOTES.smlouva_byty].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.zpravaBydleni,
    sourceType: "OFFICIAL_REPORT",
    title: "Zpráva o stavu městského bytového fondu a hospodaření za rok 2025",
    publisher: "Demo město",
    url: "https://example.org/demo/zprava-bydleni-2025.pdf",
    publishedAt: "2026-01-31",
    pageCount: 44,
    rawText: [
      "ZPRÁVA O STAVU MĚSTSKÉHO BYTOVÉHO FONDU A HOSPODAŘENÍ ZA ROK 2025",
      QUOTES.zprava_byty,
      QUOTES.zprava_skolky,
      QUOTES.zprava_dluh,
    ].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.zpravaDoprava,
    sourceType: "OFFICIAL_REPORT",
    title: "Zpráva o přípravě dopravních staveb za rok 2025",
    publisher: "Demo město",
    url: "https://example.org/demo/zprava-doprava-2025.pdf",
    publishedAt: "2026-02-10",
    pageCount: 22,
    rawText: ["ZPRÁVA O PŘÍPRAVĚ DOPRAVNÍCH STAVEB ZA ROK 2025", QUOTES.zprava_doprava].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.clanek,
    sourceType: "MEDIA_REPORT",
    title: "Reportáž o průběhu výstavby v lokalitě Demo sever",
    publisher: "Demo deník",
    url: "https://example.org/demo/clanek-2025-vystavba",
    publishedAt: "2025-11-12",
    // Bez rawText: chráněné dílo. Pracuje se jen s krátkým citátem v evidence (B2).
  }),
  demoSource({
    key: SOURCE_KEYS.rejstrik,
    sourceType: "OTHER",
    title: "Výpis z rejstříku politických stran a hnutí (demo)",
    publisher: "Demo rejstřík",
    url: "https://example.org/demo/rejstrik-vypis",
    publishedAt: "2021-06-01",
    rawText: [
      "VÝPIS Z REJSTŘÍKU",
      "Demo hnutí C změnilo dne 1. 6. 2021 název na Demo strana C.",
    ].join("\n"),
  }),
  demoSource({
    key: SOURCE_KEYS.nezpracovany,
    sourceType: "COUNCIL_RESOLUTION",
    title: "Zápis z jednání výboru pro územní rozvoj, březen 2026",
    publisher: "Demo město",
    url: "https://example.org/demo/vybor-2026-03",
    publishedAt: "2026-03-18",
    processingState: "PENDING",
    rawText: [
      "ZÁPIS Z JEDNÁNÍ VÝBORU PRO ÚZEMNÍ ROZVOJ",
      "Výbor projednal přípravu přeměny brownfieldu Demo-jih.",
    ].join("\n"),
  }),
];
