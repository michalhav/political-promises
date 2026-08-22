/**
 * Naplnění databáze **skutečnými** daty volebního období 2022–2026.
 *
 * Ukázkový dataset je psaný tak, aby vypadal dobře. Tohle ne: bere doslovné
 * věty z programu Praha Sobě, doklady z otevřených dat města a prožene je
 * stejným redakčním postupem jako cokoli jiného — včetně pravidla čtyř očí.
 * Slouží k tomu, aby šlo na vlastní oči ověřit, že myšlenka drží od zdroje až
 * k veřejné stránce.
 *
 * **Není to publikovatelný obsah.** Hodnocení tu nepíše redakce, ale skript,
 * a proto jsou stavy schválně nejopatrnější, jaké pravidla dovolí: kde není
 * doklad, stojí „bez doloženého postupu". Nic se tu netvrdí o tom, jestli
 * politik slib splnil.
 */
import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";

import type { AppDatabase } from "@/db/types";
import { eventTypeEnum } from "@/db/enums";
import { seedId } from "@/db/seed/ids";
import { promiseEvidence } from "@/modules/evidence/schema";
import { electoralLists } from "@/modules/parties/schema";
import { promises } from "@/modules/promises/schema";
import {
  addPromiseEvent,
  attachEvidence,
  createAssessmentDraft,
  createCandidatePromise,
  publishAssessment,
  transitionAssessment,
  type Actor,
} from "@/modules/review/service";
import { createElectoralList, createParty } from "@/modules/review/registry";
import { computeMeasurementsFromTable, defineMetric } from "@/modules/review/metrics";
import { importCorpusDocument } from "@/modules/sources/importCorpus";
import { sourceDocuments } from "@/modules/sources/schema";
import type { Topic } from "@/modules/promises/labels";

const PROGRAM_DIRECTORY = "corpus/praha-sobe-2022";

interface PromiseSpec {
  slug: string;
  title: string;
  /** Doslovné znění, které musí v programu stát znak po znaku. */
  originalText: string;
  /** Kde citace v programu končí — úryvek se bere od začátku slibu sem. */
  excerptEndsWith: string;
  page: number;
  topic: Topic;
  /** Doklady ze zakázek. Bez shody zůstane slib nedoložený. */
  evidence?: {
    contains: string;
    note: string;
    limitation: string;
    /** Událost na časovou ose, kterou tenhle doklad dokládá. */
    event?: { type: EventType; date: string; title: string; description?: string };
  }[];
}

type EventType = (typeof eventTypeEnum.enumValues)[number];

const PROMISES: PromiseSpec[] = [
  {
    slug: "praha-sobe-nove-mosty-pres-vltavu",
    title: "Nové mosty přes Vltavu",
    originalText: "Postavíme nové mosty přes Vltavu",
    // Citace musí dosáhnout až tam, kde program jmenuje konkrétní mosty.
    // Kratší výřez končil u „rozvíjejících se čtvrtí" a jména staveb, podle
    // kterých se doklad pozná, v něm vůbec nebyla.
    excerptEndsWith: "u vytížené zastávky Lihovar.",
    page: 33,
    topic: "TRANSPORT",
    evidence: [
      {
        contains: 'Lávka Holešovice - Karlín"',
        note: "Město zadalo stavbu lávky mezi Holešovicemi a Karlínem za 298 mil. Kč bez DPH.",
        limitation: "Zakázka dokládá zadání stavby, ne její dokončení ani otevření pro veřejnost.",
        event: {
          type: "CONTRACT_SIGNED",
          date: "2021-09-29",
          title: "Podepsána smlouva na stavbu Lávky Holešovice – Karlín",
          description:
            "Zakázka č. 42822 v hodnotě 298 mil. Kč bez DPH. Jde o jeden ze tří mostů, které program jmenuje.",
        },
      },
      {
        contains: 'Dvorecký most; stavební práce"',
        note: "Město zadalo stavební práce na Dvoreckém mostě za 1,07 mld. Kč bez DPH.",
        limitation: "Ze zadané zakázky neplyne, že je most dokončený a otevřený.",
        event: {
          type: "CONTRACT_SIGNED",
          date: "2022-06-21",
          title: "Podepsána smlouva na stavební práce Dvoreckého mostu",
          description: "Zakázka č. 42821 v hodnotě 1 074 965 748 Kč bez DPH.",
        },
      },
    ],
  },
  {
    slug: "praha-sobe-vystaviste-a-prumyslovy-palac",
    title: "Dokončení rekonstrukce Výstaviště a Průmyslového paláce",
    originalText: "Dokončíme rekonstrukci areálu Výstaviště",
    excerptEndsWith: "pro Pražany.",
    page: 59,
    topic: "URBAN_DEVELOPMENT",
    evidence: [
      {
        contains: "Rek. a dost. Průmyslového paláce",
        note: "Město zadalo práce na rekonstrukci a dostavbě Průmyslového paláce.",
        limitation: "Zakázka se týká jedné budovy, ne celého areálu, a o dokončení nevypovídá.",
        event: {
          type: "CONTRACT_SIGNED",
          date: "2022-05-10",
          title: "Zadány práce na rekonstrukci Průmyslového paláce",
        },
      },
    ],
  },
  {
    slug: "praha-sobe-nove-tramvajove-trate",
    title: "Nové tramvajové tratě",
    originalText: "Postavíme nové tramvajové tratě",
    excerptEndsWith: "na Barrandov.",
    page: 22,
    topic: "TRANSPORT",
  },
  {
    slug: "praha-sobe-bezbarierove-stanice-metra",
    title: "Více bezbariérových stanic metra",
    originalText: "Rozšíříme počet bezbariérových stanic metra",
    excerptEndsWith: "lepší.",
    page: 25,
    topic: "TRANSPORT",
  },
  {
    slug: "praha-sobe-nove-cyklostezky",
    title: "Nové cyklostezky",
    originalText: "Vybudujeme nové cyklostezky a vylepšíme ty stávající",
    excerptEndsWith: "zdvojnásobil.",
    page: 28,
    topic: "TRANSPORT",
  },
  {
    slug: "praha-sobe-parkovaci-mista-na-sidlistich",
    title: "Nová parkovací místa na sídlištích",
    originalText: "Vybudujeme nová parkovací místa",
    excerptEndsWith: "nedostatků.",
    page: 63,
    topic: "TRANSPORT",
  },
  {
    slug: "praha-sobe-navyseni-platu-ucitelu",
    title: "Navýšení platů učitelů o miliardu korun",
    originalText: "Navýšíme platy učitelům o miliardu korun.",
    excerptEndsWith: "korun.",
    page: 39,
    topic: "EDUCATION",
  },
  {
    slug: "praha-sobe-zarizeni-pro-deti-od-dvou-let",
    title: "Síť zařízení pro děti od dvou let",
    originalText: "Vybudujeme síť zařízení pro děti od 2 let",
    excerptEndsWith: "od 2 let věku.",
    page: 36,
    topic: "EDUCATION",
  },
  {
    slug: "praha-sobe-kapacita-ctyrletych-gymnazii",
    title: "Vyšší kapacita čtyřletých gymnázií",
    originalText: "Navýšíme kapacitu čtyřletých gymnázií",
    excerptEndsWith: "nestačí.",
    page: 37,
    topic: "EDUCATION",
  },
  {
    slug: "praha-sobe-centra-dusevniho-zdravi",
    title: "Nová centra duševního zdraví",
    originalText: "Otevřeme nová centra duševního zdraví",
    excerptEndsWith: "pět center duševního zdraví.",
    page: 48,
    topic: "SOCIAL_POLICY",
  },
  {
    slug: "praha-sobe-vice-mestskych-bytu",
    title: "Více městských bytů ve spolupráci se soukromým sektorem",
    // Nadpis je v programu zalomený přes dva řádky; citace to musí respektovat.
    originalText: "Ve spolupráci se soukromým sektorem\nzvýšíme počet městských bytů",
    excerptEndsWith: "jasná pravidla.",
    page: 52,
    topic: "HOUSING",
  },
  {
    slug: "praha-sobe-verejne-pristupne-toalety",
    title: "Více veřejně přístupných toalet",
    originalText: "Rozšíříme veřejně přístupné toalety",
    excerptEndsWith: "situace.",
    page: 58,
    topic: "URBAN_DEVELOPMENT",
  },
  {
    slug: "praha-sobe-energeticka-bezpecnost",
    title: "Energetická bezpečnost a soběstačnost Prahy",
    originalText: "Zvýšíme energetickou bezpečnost",
    excerptEndsWith: "budoucí výzvy.",
    page: 79,
    topic: "ENVIRONMENT",
  },
];

export interface RealDataResult {
  published: string[];
  skipped: string[];
  withEvidence: number;
  events: number;
  measurements: number;
}

export async function seedRealPraha(
  db: AppDatabase,
  options: { tenderDirectory?: string; budgetDirectory?: string } = {},
): Promise<RealDataResult> {
  const editor: Actor = { id: seedId("user:redaktor-1"), displayName: "Demo redaktor 1" };
  const reviewer: Actor = { id: seedId("user:redaktor-2"), displayName: "Demo redaktor 2" };

  const program = await importCorpusDocument(db, editor, PROGRAM_DIRECTORY);

  const partyId = await createParty(db, editor, {
    name: "Praha Sobě",
    shortName: "Praha Sobě",
    slug: "praha-sobe",
  });
  const listId = await createElectoralList(db, editor, {
    electionId: seedId("election:praha-2022"),
    name: "Praha Sobě",
    shortName: "Praha Sobě",
    slug: "praha-sobe-2022",
    // Číslo kandidátky i počet mandátů podle ČSÚ, volby do ZHMP 2022:
    // https://volby.gov.cz/pls/kv2022/kv1111?xjazyk=CZ&xid=1&xdz=1&xnumnuts=1100&xobec=554782
    // Praha Sobě: číslo 4, 14,72 % hlasů, 11 z 65 mandátů.
    ballotNumber: 4,
    seatsWon: 11,
    partyIds: [partyId],
  });

  const [programRow] = await db
    .select({ rawText: sourceDocuments.rawText })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, program.sourceDocumentId));
  const programText = programRow?.rawText ?? "";

  // Doklady jsou volitelné: bez nich zůstanou sliby poctivě nedoložené.
  let tenderSourceId: string | null = null;
  let tenderText = "";
  if (options.tenderDirectory && existsSync(`${options.tenderDirectory}/provenance.json`)) {
    const tenders = await importCorpusDocument(db, editor, options.tenderDirectory);
    tenderSourceId = tenders.sourceDocumentId;
    const [tenderRow] = await db
      .select({ rawText: sourceDocuments.rawText })
      .from(sourceDocuments)
      .where(eq(sourceDocuments.id, tenders.sourceDocumentId));
    tenderText = tenderRow?.rawText ?? "";
  }

  const result: RealDataResult = {
    published: [],
    skipped: [],
    withEvidence: 0,
    events: 0,
    measurements: 0,
  };

  for (const spec of PROMISES) {
    const start = programText.indexOf(spec.originalText);
    const end = programText.indexOf(spec.excerptEndsWith, start);
    if (start < 0 || end < 0) {
      // Citace, která v programu nestojí, se nezakládá. Radši slib chybí, než
      // aby ukazoval na text, který tam není.
      result.skipped.push(spec.slug);
      continue;
    }

    const promiseId = await createCandidatePromise(db, editor, {
      electoralListId: listId,
      slug: spec.slug,
      title: spec.title,
      originalText: spec.originalText,
      topic: spec.topic,
      sourceDocumentId: program.sourceDocumentId,
      sourceExcerpt: programText.slice(start, end + spec.excerptEndsWith.length),
      sourcePageNumber: spec.page,
    });

    let hasEvidence = false;
    for (const wanted of spec.evidence ?? []) {
      if (!tenderSourceId) break;

      const line = tenderText.split("\n").find((candidate) => candidate.includes(wanted.contains));
      if (!line) continue;

      const linkId = await attachEvidence(db, editor, {
        promiseId,
        sourceDocumentId: tenderSourceId,
        excerpt: line,
        relationType: "IMPLEMENTATION",
        note: wanted.note,
        limitationNote: wanted.limitation,
      });
      hasEvidence = true;
      result.withEvidence += 1;

      // Časová osa je narativní páteř: bez ní stránka říká, co je doložené,
      // ale ne co se kdy stalo.
      if (wanted.event) {
        const [link] = await db
          .select({ evidenceId: promiseEvidence.evidenceId })
          .from(promiseEvidence)
          .where(eq(promiseEvidence.id, linkId));

        await addPromiseEvent(db, editor, {
          promiseId,
          eventType: wanted.event.type,
          eventDate: wanted.event.date,
          title: wanted.event.title,
          description: wanted.event.description,
          evidenceIds: link ? [link.evidenceId] : [],
        });
        result.events += 1;
      }
    }

    const assessmentId = await createAssessmentDraft(db, editor, {
      promiseId,
      specificityScore: 2,
      measurabilityScore: 2,
      deadlineScore: 1,
      jurisdictionScore: 4,
      outcomeDefinitionScore: 2,
      // Bez dokladu se netvrdí nic než to, že jsme doklad nenašli.
      executionStatus: hasEvidence ? "IN_PROGRESS" : "NO_VERIFIED_PROGRESS",
      outcomeStatus: "NOT_MEASURABLE_YET",
      summary: hasEvidence
        ? "Doložena zadaná zakázka města. O dokončení tím není řečeno nic."
        : "Rešerši k tomuhle slibu jsme neprováděli; žádný doklad zatím nemáme.",
      sourcesReviewedUpTo: new Date().toISOString().slice(0, 10),
    });

    await transitionAssessment(db, editor, { assessmentId, action: "SUBMIT" });
    await transitionAssessment(db, reviewer, {
      assessmentId,
      action: "APPROVE",
      conflictFree: true,
    });
    await publishAssessment(db, reviewer, assessmentId);

    result.published.push(spec.slug);
  }

  /**
   * Měřitelný slib.
   *
   * „Navýšíme platy učitelům o miliardu" je jediný z třinácti, u kterého číslo
   * leží v otevřených datech. Filtr je na oblast **i** účelový znak: bez oblasti
   * se přičte přijatý transfer, který je součtem výdajových položek, a částka
   * vyjde dvojnásobná.
   */
  if (options.budgetDirectory && existsSync(`${options.budgetDirectory}/provenance.json`)) {
    const budget = await importCorpusDocument(db, editor, options.budgetDirectory);
    const [platy] = await db
      .select({ id: promises.id })
      .from(promises)
      .where(eq(promises.slug, "praha-sobe-navyseni-platu-ucitelu"));

    if (platy) {
      const metricId = await defineMetric(db, editor, {
        promiseId: platy.id,
        name: "Přímé náklady školství v rozpočtu MHMP",
        unit: "tis. Kč",
        direction: "INCREASE",
        definitionNote:
          'Součet čerpání u výdajových položek školství s účelovým znakem „přímé náklady". Jde převážně o státní transfer procházející městem — růst sám o sobě nedokládá, že peníze přidalo město.',
      });

      const computed = await computeMeasurementsFromTable(db, editor, {
        metricId,
        sourceDocumentId: budget.sourceDocumentId,
        valueColumn: "cerpani",
        groupColumn: "rok",
        filters: [
          { column: "nazev_oblast", contains: "Školství" },
          { column: "nazev_uz", contains: "přímé náklady" },
        ],
      });
      result.measurements = computed.measurements.length;
    }
  }

  // Kontrola, že kandidátka opravdu vznikla jako skutečná, ne demo.
  const [list] = await db
    .select({ slug: electoralLists.slug })
    .from(electoralLists)
    .where(eq(electoralLists.id, listId));
  if (!list) throw new Error("Kandidátka se nezaložila.");

  return result;
}
