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
import { seedId } from "@/db/seed/ids";
import { electoralLists } from "@/modules/parties/schema";
import {
  attachEvidence,
  createAssessmentDraft,
  createCandidatePromise,
  publishAssessment,
  transitionAssessment,
  type Actor,
} from "@/modules/review/service";
import { createElectoralList, createParty } from "@/modules/review/registry";
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
  /** Podle čeho se v zakázkách hledá doklad. Bez shody zůstane slib nedoložený. */
  evidenceContains?: string;
  evidenceNote?: string;
  evidenceLimitation?: string;
}

const PROMISES: PromiseSpec[] = [
  {
    slug: "praha-sobe-nove-mosty-pres-vltavu",
    title: "Nové mosty přes Vltavu",
    originalText: "Postavíme nové mosty přes Vltavu",
    excerptEndsWith: "čtvrtí.",
    page: 33,
    topic: "TRANSPORT",
    evidenceContains: 'Dvorecký most; stavební práce"',
    evidenceNote: "Město zadalo stavební práce na novém mostě přes Vltavu.",
    evidenceLimitation: "Ze zadané zakázky neplyne, že je most dokončený a otevřený.",
  },
  {
    slug: "praha-sobe-vystaviste-a-prumyslovy-palac",
    title: "Dokončení rekonstrukce Výstaviště a Průmyslového paláce",
    originalText: "Dokončíme rekonstrukci areálu Výstaviště",
    excerptEndsWith: "pro Pražany.",
    page: 59,
    topic: "URBAN_DEVELOPMENT",
    evidenceContains: "Rek. a dost. Průmyslového paláce",
    evidenceNote: "Město zadalo práce na rekonstrukci a dostavbě Průmyslového paláce.",
    evidenceLimitation: "Zakázka se týká jedné budovy, ne celého areálu, a o dokončení nevypovídá.",
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
}

export async function seedRealPraha(
  db: AppDatabase,
  options: { tenderDirectory?: string } = {},
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
    ballotNumber: 25,
    seatsWon: 13,
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

  const result: RealDataResult = { published: [], skipped: [], withEvidence: 0 };

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
    if (spec.evidenceContains && tenderSourceId) {
      const line = tenderText
        .split("\n")
        .find((candidate) => candidate.includes(spec.evidenceContains!));

      if (line) {
        await attachEvidence(db, editor, {
          promiseId,
          sourceDocumentId: tenderSourceId,
          excerpt: line,
          relationType: "IMPLEMENTATION",
          note: spec.evidenceNote,
          limitationNote: spec.evidenceLimitation,
        });
        hasEvidence = true;
        result.withEvidence += 1;
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

  // Kontrola, že kandidátka opravdu vznikla jako skutečná, ne demo.
  const [list] = await db
    .select({ slug: electoralLists.slug })
    .from(electoralLists)
    .where(eq(electoralLists.id, listId));
  if (!list) throw new Error("Kandidátka se nezaložila.");

  return result;
}
