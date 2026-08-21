import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoBadge } from "@/app/_components/DemoBadge";
import { SourceLine } from "@/app/_components/SourceCitation";
import { AssessabilityChip, ExecutionChip, OutcomeChip } from "@/app/_components/StatusDisplay";
import { AssessabilityPanel } from "@/app/(public)/promises/_components/AssessabilityPanel";
import { CurrentAssessment } from "@/app/(public)/promises/_components/CurrentAssessment";
import { EvidenceBlock } from "@/app/(public)/promises/_components/EvidenceBlock";
import { EvidenceSummary } from "@/app/(public)/promises/_components/EvidenceSummary";
import { MetricPanel } from "@/app/(public)/promises/_components/MetricPanel";
import { OriginalPromise } from "@/app/(public)/promises/_components/OriginalPromise";
import { Timeline } from "@/app/(public)/promises/_components/Timeline";
import { db } from "@/db/client";
import {
  ASSESSABILITY_LABELS,
  EXECUTION_STATUS_LABELS,
  OUTCOME_STATUS_LABELS,
} from "@/modules/assessments/labels";
import { COALITION_CLASSIFICATION_LABELS } from "@/modules/coalition/labels";
import { TOPIC_LABELS } from "@/modules/promises/labels";
import { getPublishedPromiseDetail, type PromiseDetail } from "@/modules/promises/queries";
import { formatDate, formatDateLong, formatTimestamp } from "@/shared/format";

/**
 * Stránka čte z databáze, proto se vykresluje až při požadavku.
 *
 * Předgenerování při buildu by znamenalo, že nasazení vyžaduje dostupnou
 * databázi, a že by publikovaný slib byl vidět až po dalším buildu. Obsah se
 * mění redakční prací, ne nasazením kódu.
 */
export const dynamic = "force-dynamic";

const METHODOLOGY_SECTION = "jak-vzniklo-hodnoceni";

export async function generateMetadata({
  params,
}: PageProps<"/promises/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const promise = await getPublishedPromiseDetail(db, slug);

  if (!promise) return { title: "Slib nenalezen" };

  return {
    title: promise.title,
    description: promise.normalizedStatement ?? promise.originalText,
  };
}

/**
 * Detail slibu — vlajková obrazovka produktu.
 *
 * Pořadí sekcí odpovídá otázkám, které si čtenář klade, ne struktuře databáze:
 * co bylo slíbeno → jak to teď je → proč to tvrdíme → co se dělo → čím to
 * doložíme → jak vzniklo hodnocení → co se změnilo.
 *
 * Odpověď stojí nahoře. Auditovatelnost pod ní. Dřív bylo obojí promíchané
 * a stránka nutila čtenáře lovit závěr mezi metadaty.
 */
export default async function PromiseDetailPage({ params }: PageProps<"/promises/[slug]">) {
  const { slug } = await params;
  const promise = await getPublishedPromiseDetail(db, slug);

  if (!promise) notFound();

  const assessment = promise.assessment;
  const isNonAssessable = assessment?.assessability === "NOT_ASSESSABLE";

  return (
    <article className="mx-auto max-w-3xl space-y-12 px-4 py-10 sm:py-14">
      <header className="space-y-4">
        <nav aria-label="Drobečková navigace" className="text-muted text-sm">
          <Link href="/promises" className="hover:text-accent underline-offset-4 hover:underline">
            Sliby
          </Link>
          {" / "}
          <Link
            href={`/promises?list=${promise.electoralList.slug}`}
            className="hover:text-accent underline-offset-4 hover:underline"
          >
            {promise.electoralList.shortName}
          </Link>
          {" / "}
          <Link
            href={`/promises?topic=${promise.topic}`}
            className="hover:text-accent underline-offset-4 hover:underline"
          >
            {TOPIC_LABELS[promise.topic]}
          </Link>
        </nav>

        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          {promise.title}
        </h1>

        <p className="text-muted text-sm">
          {promise.electoralList.name}
          {promise.electoralList.isDemo ? <DemoBadge /> : null}
          {" · "}
          {TOPIC_LABELS[promise.topic]}
          {promise.primarySource?.source.publishedAt
            ? ` · slib zveřejněn ${formatDate(promise.primarySource.source.publishedAt)}`
            : null}
        </p>
      </header>

      <Section id="co-bylo-slibeno" title="Co bylo slíbeno">
        <OriginalPromise
          originalText={promise.originalText}
          normalizedStatement={promise.normalizedStatement}
          source={promise.primarySource}
          deadlineText={promise.deadlineText}
          deadlineOn={promise.deadlineOn}
        />
      </Section>

      {assessment ? (
        isNonAssessable ? (
          <NonAssessableVerdict promise={promise} />
        ) : (
          <CurrentAssessment
            assessment={assessment}
            evidenceCount={promise.evidence.length}
            methodologySectionId={METHODOLOGY_SECTION}
          />
        )
      ) : null}

      {!isNonAssessable ? (
        <Section
          id="jak-to-vime"
          title="Jak to víme"
          intro="Zobrazujeme jen zdroje, které prošly redakční kontrolou. Návrhy vytvořené strojově zůstávají skryté, dokud je někdo neověří."
        >
          <EvidenceSummary evidence={promise.evidence} />
        </Section>
      ) : null}

      {promise.metrics.length > 0 ? (
        <Section
          id="cim-se-meri"
          title="Čím se splnění měří"
          intro="Bez výchozí hodnoty, cíle a naměřeného čísla by závěr o výsledku byl jen názor."
        >
          <div className="space-y-4">
            {promise.metrics.map((metric, index) => (
              <MetricPanel key={index} metric={metric} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        id="co-se-delo"
        title="Co se od voleb dělo"
        intro="Příběh slibu. Doslovné citace ze zdrojů jsou v důkazním archivu níž."
      >
        <Timeline events={promise.timeline} />
      </Section>

      {promise.coalition ? <CoalitionSection promise={promise} /> : null}

      {promise.evidence.length > 0 ? (
        <Section id="dukazy" title="Důkazy a zdroje">
          <div className="space-y-4">
            {promise.evidence.map((item, index) => (
              <EvidenceBlock key={index} evidence={item} />
            ))}
          </div>
        </Section>
      ) : null}

      {assessment ? (
        <Section
          id={METHODOLOGY_SECTION}
          title="Jak vzniklo hodnocení"
          intro="Skóre zadává člověk, výsledný stupeň počítá deterministický postup. Postup je stejný pro všechny kandidátky."
        >
          <details className="border-border rounded-lg border p-5">
            <summary className="cursor-pointer font-medium">
              Hodnotitelnost: {ASSESSABILITY_LABELS[assessment.assessability].label}
            </summary>
            <div className="mt-5">
              <AssessabilityPanel assessment={assessment} />
            </div>
          </details>

          <p className="text-muted text-sm">
            Celý postup je popsaný v{" "}
            <Link href="/methodology" className="hover:text-accent underline underline-offset-4">
              metodice
            </Link>
            .
          </p>
        </Section>
      ) : null}

      {promise.corrections.length > 0 || promise.assessmentHistory.length > 0 ? (
        <Section
          id="historie"
          title="Opravy a starší verze"
          intro="Hodnocení se nepřepisuje. Když se změní, vznikne nová verze a ta předchozí zůstává dohledatelná."
        >
          {assessment?.changeReason ? (
            <div className="border-border-note bg-surface-note space-y-1 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Proč se hodnocení naposledy změnilo</h3>
              <p className="text-muted prose-measure text-sm">{assessment.changeReason}</p>
            </div>
          ) : null}

          {promise.corrections.length > 0 ? <Corrections promise={promise} /> : null}
          {promise.assessmentHistory.length > 0 ? <AssessmentHistory promise={promise} /> : null}
        </Section>
      ) : null}

      <footer className="border-border text-muted prose-measure border-t pt-6 text-sm">
        <p>
          Každý závěr na této stránce lze dohledat až k veřejnému zdroji. Hodnocení vytvářejí lidé a
          schvaluje je vždy někdo jiný, než kdo je napsal.{" "}
          <Link href="/methodology" className="hover:text-accent underline underline-offset-4">
            Jak hodnotíme
          </Link>
          .
        </p>
      </footer>
    </article>
  );
}

/**
 * Nehodnotitelný slib potřebuje jinou hierarchii.
 *
 * Tři téměř synonymní štítky („nehodnotitelné / neuplatňuje se / nehodnotitelný")
 * nedávaly odpověď, jen ji ztrojily. Odpovědí je věta, ne štítky.
 */
function NonAssessableVerdict({ promise }: { promise: PromiseDetail }) {
  const assessment = promise.assessment;
  if (!assessment) return null;

  const gate = assessment.derivation.appliedRules[0];

  return (
    <section
      aria-labelledby="nehodnotitelny"
      className="border-border-assessment bg-surface-assessment space-y-5 rounded-xl border p-6 sm:p-8"
    >
      <h2 id="nehodnotitelny" className="text-2xl font-semibold tracking-tight">
        Tento slib nelze objektivně vyhodnotit
      </h2>

      {gate ? (
        <p className="prose-measure text-[1.0625rem] leading-relaxed">{gate.explanation}</p>
      ) : null}

      {assessment.summary ? <p className="text-muted prose-measure">{assessment.summary}</p> : null}

      <div className="border-border-assessment flex flex-wrap gap-2 border-t pt-5">
        <ExecutionChip status={assessment.executionStatus} />
        <OutcomeChip status={assessment.outcomeStatus} />
        <AssessabilityChip level={assessment.assessability} />
      </div>

      <p className="text-muted text-sm">
        Posouzeno podle zdrojů prošlých k {formatDateLong(assessment.sourcesReviewedUpTo)}.
      </p>
    </section>
  );
}

function CoalitionSection({ promise }: { promise: PromiseDetail }) {
  const coalition = promise.coalition;
  if (!coalition) return null;

  const { label, meaning } = COALITION_CLASSIFICATION_LABELS[coalition.classification];

  return (
    <Section id="koalice" title="Co se se slibem stalo v koaliční smlouvě">
      <div className="space-y-1">
        <p className="text-xl font-semibold">{label}</p>
        <p className="text-muted prose-measure text-sm">{meaning}</p>
      </div>

      <p className="prose-measure">{coalition.reason}</p>

      {coalition.citation ? (
        <blockquote className="source-quote text-[0.95rem]">
          {coalition.citation.excerpt}
        </blockquote>
      ) : (
        <div className="border-border-note bg-surface-note space-y-1 rounded-lg border p-4">
          <p className="text-muted prose-measure text-sm">
            Odpovídající závazek jsme v koaliční smlouvě nenašli. Není to hodnocení toho, jestli byl
            nebo bude splněn.
          </p>
        </div>
      )}

      <SourceLine source={coalition.agreement} />

      <p className="text-sm">
        <Link
          href={`/compare?list=${promise.electoralList.slug}`}
          className="hover:text-accent underline underline-offset-4"
        >
          Porovnat celý program kandidátky s koaliční smlouvou
        </Link>
      </p>
    </Section>
  );
}

const CORRECTION_STATUS_LABELS: Record<PromiseDetail["corrections"][number]["status"], string> = {
  OPEN: "Přijato, zpracovává se",
  ACKNOWLEDGED: "Vzato na vědomí",
  APPLIED: "Promítnuto do hodnocení",
  REJECTED: "Neuznáno",
};

function Corrections({ promise }: { promise: PromiseDetail }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Podněty a reakce</h3>
      <ul className="space-y-4">
        {promise.corrections.map((correction, index) => (
          <li key={index} className="border-border space-y-2 rounded-lg border p-4">
            <p className="text-muted text-xs tracking-wide uppercase">
              {correction.kind === "PARTY_RESPONSE" ? "Reakce kandidátky" : "Podnět čtenáře"}
              {" · "}
              {CORRECTION_STATUS_LABELS[correction.status]}
            </p>
            <p className="prose-measure text-sm">{correction.body}</p>
            <p className="text-muted text-sm">
              {correction.submitterOrganization ?? correction.submitterName ?? "Bez uvedení"}
              {" · "}
              {formatTimestamp(correction.createdAt)}
            </p>
            {correction.response ? (
              <div className="border-border border-t pt-2">
                <p className="text-muted text-xs tracking-wide uppercase">Naše odpověď</p>
                <p className="prose-measure mt-1 text-sm">{correction.response}</p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssessmentHistory({ promise }: { promise: PromiseDetail }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Starší verze hodnocení</h3>
      <ul className="divide-border divide-y">
        {promise.assessmentHistory.map((version) => (
          <li key={version.version} className="space-y-1 py-3">
            <p className="text-muted text-sm">
              Verze {version.version} · {formatTimestamp(version.createdAt)} · zdroje k{" "}
              {formatDate(version.sourcesReviewedUpTo)}
            </p>
            <p className="text-sm">
              {EXECUTION_STATUS_LABELS[version.executionStatus].label}
              {" · "}
              {OUTCOME_STATUS_LABELS[version.outcomeStatus].label}
            </p>
            {version.summary ? (
              <p className="text-muted prose-measure text-sm">{version.summary}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Běžná sekce nemá vlastní povrch — jen nadpis, prostor a typografii.
 *
 * Obalovat každou významovou skupinu do zaobleného rámečku byl přesně ten
 * důvod, proč měla celá stránka stejnou vizuální váhu a nic z ní nevystupovalo.
 */
function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {intro ? <p className="text-muted prose-measure">{intro}</p> : null}
      {children}
    </section>
  );
}
