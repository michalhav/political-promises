/**
 * Veřejný datový kontrakt.
 *
 * Analytik dnes vidí webovou stránku a nic víc. Kdo chce s daty pracovat, musí
 * je opisovat — čímž se ztratí přesně to, na čem produkt stojí: že tvrzení má
 * doložitelný zdroj. Otevřená data o plnění slibů přitom nikdo jiný nemá.
 *
 * **Proč vlastní tvary, a ne rovnou ty z `queries.ts`.** Vnitřní tvary se mění
 * podle toho, co potřebuje UI. Veřejný kontrakt se měnit nesmí, protože na něm
 * někdo postaví svůj graf nebo článek. Tahle vrstva ty dvě věci odděluje: až se
 * `PromiseListItem` přejmenuje, kontrakt zůstane, nebo se změní vědomě a s novou
 * verzí v adrese.
 *
 * **Co ven nejde.** Kontrakt staví výhradně nad čtecí vrstvou pro veřejnost,
 * která vrací jen publikované a ověřené záznamy. Nepotvrzený návrh modelu ani
 * rozpracované hodnocení se sem nemají jak dostat — a hlídá to test.
 *
 * **Licence putuje s daty.** Kdo si stáhne JSON, musí z něj poznat, za jakých
 * podmínek ho smí použít. Odkaz v README je málo; data se přeposílají dál.
 */
import type {
  AssessmentView,
  Citation,
  EvidenceView,
  PromiseDetail,
  PromiseListItem,
  SourceRef,
  TimelineEventView,
} from "@/modules/promises/queries";

/** Verze kontraktu. Nekompatibilní změna dostane novou adresu, ne tiše jiný tvar. */
export const API_VERSION = "v1";

export interface DatasetLicence {
  data: string;
  dataUrl: string;
  attribution: string;
  note: string;
}

export const DATASET_LICENCE: DatasetLicence = {
  data: "CC BY-SA 4.0",
  dataUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  attribution: "Slib → Skutek",
  note:
    "Hodnocení jsou redakční závěry, ne fakta. Zdrojové dokumenty patří svým vydavatelům; " +
    "u každého je uvedeno, odkud pochází a kdy byl stažen.",
};

export interface PublicSource {
  title: string;
  publisher: string;
  url: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  sourceType: string;
  isDemo: boolean;
  /** Vyplněné jen u dokumentu z webového archivu. */
  archive: { service: string; originalUrl: string; snapshotAt: string } | null;
}

export interface PublicCitation {
  excerpt: string;
  pageNumber: number | null;
  locator: string | null;
  source: PublicSource;
}

export interface PublicEvidence extends PublicCitation {
  relationType: string;
  note: string | null;
  /** Co ze zdroje naopak vyvodit nelze. Oddělené schválně. */
  limitationNote: string | null;
}

export interface PublicAssessment {
  version: number;
  assessability: string;
  executionStatus: string;
  outcomeStatus: string;
  summary: string | null;
  methodologyVersion: string;
  sourcesReviewedUpTo: string;
  createdAt: string;
  scores: AssessmentView["scores"];
}

export interface PublicPromiseSummary {
  slug: string;
  title: string;
  originalText: string;
  topic: string;
  deadlineText: string | null;
  electoralList: { slug: string; name: string; shortName: string | null };
  /**
   * Slib patří ke smyšlené kandidátce z ukázkového datasetu.
   *
   * V aplikaci to nese odznak u karty. Ve vývozu musí být taky — jinak si
   * analytik smyšlený slib stáhne jako skutečný a nemá jak poznat rozdíl.
   * Pravidlo, že ukázková data nesmí být zaměnitelná se skutečnými, neplatí
   * jen na obrazovce.
   */
  isDemo: boolean;
  assessability: string | null;
  executionStatus: string | null;
  outcomeStatus: string | null;
  sourcesReviewedUpTo: string | null;
  evidenceCount: number;
}

export interface PublicPromiseDetail extends PublicPromiseSummary {
  normalizedStatement: string | null;
  deadlineOn: string | null;
  publishedAt: string | null;
  electionName: string;
  primarySource: PublicCitation | null;
  assessment: PublicAssessment | null;
  timeline: {
    eventType: string;
    eventDate: string;
    title: string;
    description: string | null;
    citations: PublicCitation[];
  }[];
  evidence: PublicEvidence[];
}

function toPublicSource(source: SourceRef): PublicSource {
  return {
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    publishedAt: source.publishedAt,
    retrievedAt: source.retrievedAt.toISOString(),
    sourceType: source.sourceType,
    isDemo: source.isDemo,
    archive: source.archive
      ? {
          service: source.archive.service,
          originalUrl: source.archive.originalUrl,
          snapshotAt: source.archive.snapshotAt.toISOString(),
        }
      : null,
  };
}

function toPublicCitation(citation: Citation): PublicCitation {
  return {
    excerpt: citation.excerpt,
    pageNumber: citation.pageNumber,
    locator: citation.locator,
    source: toPublicSource(citation.source),
  };
}

function toPublicEvidence(item: EvidenceView): PublicEvidence {
  return {
    ...toPublicCitation(item),
    relationType: item.relationType,
    note: item.note,
    limitationNote: item.limitationNote,
  };
}

function toPublicAssessment(assessment: AssessmentView): PublicAssessment {
  return {
    version: assessment.version,
    assessability: assessment.assessability,
    executionStatus: assessment.executionStatus,
    outcomeStatus: assessment.outcomeStatus,
    summary: assessment.summary,
    methodologyVersion: assessment.methodologyVersion,
    sourcesReviewedUpTo: assessment.sourcesReviewedUpTo,
    createdAt: assessment.createdAt.toISOString(),
    scores: assessment.scores,
  };
}

function toPublicTimelineEvent(event: TimelineEventView): PublicPromiseDetail["timeline"][number] {
  return {
    eventType: event.eventType,
    eventDate: event.eventDate,
    title: event.title,
    description: event.description,
    citations: event.citations.map(toPublicCitation),
  };
}

export function toPublicSummary(item: PromiseListItem): PublicPromiseSummary {
  return {
    slug: item.slug,
    title: item.title,
    originalText: item.originalText,
    topic: item.topic,
    deadlineText: item.deadlineText,
    electoralList: {
      slug: item.electoralList.slug,
      name: item.electoralList.name,
      shortName: item.electoralList.shortName,
    },
    isDemo: item.electoralList.isDemo,
    assessability: item.assessability,
    executionStatus: item.executionStatus,
    outcomeStatus: item.outcomeStatus,
    sourcesReviewedUpTo: item.sourcesReviewedUpTo,
    evidenceCount: item.evidenceCount,
  };
}

export function toPublicDetail(detail: PromiseDetail): PublicPromiseDetail {
  return {
    slug: detail.slug,
    title: detail.title,
    originalText: detail.originalText,
    normalizedStatement: detail.normalizedStatement,
    topic: detail.topic,
    deadlineText: detail.deadlineText,
    deadlineOn: detail.deadlineOn,
    publishedAt: detail.publishedAt?.toISOString() ?? null,
    electoralList: {
      slug: detail.electoralList.slug,
      name: detail.electoralList.name,
      shortName: detail.electoralList.shortName,
    },
    electionName: detail.electionName,
    isDemo: detail.electoralList.isDemo,
    assessability: detail.assessment?.assessability ?? null,
    executionStatus: detail.assessment?.executionStatus ?? null,
    outcomeStatus: detail.assessment?.outcomeStatus ?? null,
    sourcesReviewedUpTo: detail.assessment?.sourcesReviewedUpTo ?? null,
    evidenceCount: detail.evidence.length,
    primarySource: detail.primarySource ? toPublicCitation(detail.primarySource) : null,
    assessment: detail.assessment ? toPublicAssessment(detail.assessment) : null,
    timeline: detail.timeline.map(toPublicTimelineEvent),
    evidence: detail.evidence.map(toPublicEvidence),
  };
}

/** Sloupce plochého vývozu. Pořadí je součástí kontraktu, ne detail. */
const CSV_COLUMNS = [
  "slug",
  "title",
  "original_text",
  "topic",
  "electoral_list",
  "is_demo",
  "deadline_text",
  "assessability",
  "execution_status",
  "outcome_status",
  "sources_reviewed_up_to",
  "evidence_count",
] as const;

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  // Uvozovky vždy: text slibu obsahuje čárky i konce řádků a bez nich by se
  // řádek rozpadl. Vnitřní uvozovka se zdvojuje, jak žádá RFC 4180.
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * Plochý vývoz pro tabulkové nástroje.
 *
 * Vejde se do něj jen souhrn — doklady a časová osa jsou seznamy a do buňky
 * nepatří. Kdo je potřebuje, sáhne po JSON; CSV je pro ty, kdo chtějí slib na
 * řádek a otevřít to v tabulkovém procesoru.
 */
export function toCsv(items: readonly PublicPromiseSummary[]): string {
  const rows = items.map((item) =>
    [
      item.slug,
      item.title,
      item.originalText,
      item.topic,
      item.electoralList.name,
      item.isDemo ? "true" : "false",
      item.deadlineText,
      item.assessability,
      item.executionStatus,
      item.outcomeStatus,
      item.sourcesReviewedUpTo,
      item.evidenceCount,
    ]
      .map(csvCell)
      .join(","),
  );

  // BOM kvůli Excelu: bez něj čte UTF-8 jako windows-1250 a diakritika se rozsype.
  return `﻿${CSV_COLUMNS.join(",")}\n${rows.join("\n")}\n`;
}
