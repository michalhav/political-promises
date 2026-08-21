import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoBadge } from "@/app/_components/DemoBadge";
import { Pill } from "@/app/_components/Pill";
import { CitationBlock, SourceLine } from "@/app/_components/SourceCitation";
import { AssessabilityPill, ExecutionPill, OutcomePill } from "@/app/_components/StatusPills";
import { AssessabilityPanel } from "@/app/(public)/promises/_components/AssessabilityPanel";
import { EvidenceList } from "@/app/(public)/promises/_components/EvidenceList";
import { MetricPanel } from "@/app/(public)/promises/_components/MetricPanel";
import { Timeline } from "@/app/(public)/promises/_components/Timeline";
import { db } from "@/db/client";
import { EXECUTION_STATUS_LABELS, OUTCOME_STATUS_LABELS } from "@/modules/assessments/labels";
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

export default async function PromiseDetailPage({ params }: PageProps<"/promises/[slug]">) {
  const { slug } = await params;
  const promise = await getPublishedPromiseDetail(db, slug);

  if (!promise) notFound();

  return (
    <article className="mx-auto max-w-3xl space-y-12 px-4 py-12">
      <header className="space-y-4">
        <p className="text-muted text-sm">
          <Link href="/promises" className="hover:text-accent underline underline-offset-4">
            Sliby
          </Link>
          {" · "}
          <Link
            href={`/promises?list=${promise.electoralList.slug}`}
            className="hover:text-accent underline underline-offset-4"
          >
            {promise.electoralList.name}
          </Link>
          {promise.electoralList.isDemo ? <DemoBadge /> : null}
          {" · "}
          <Link
            href={`/promises?topic=${promise.topic}`}
            className="hover:text-accent underline underline-offset-4"
          >
            {TOPIC_LABELS[promise.topic]}
          </Link>
        </p>

        <h1 className="text-3xl leading-tight font-semibold tracking-tight">{promise.title}</h1>

        {promise.electoralList.parties.length > 1 ? (
          <p className="text-muted text-sm">
            Kandidátku tvoří {promise.electoralList.parties.map((party) => party.name).join(", ")}.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {promise.assessment ? (
            <>
              <ExecutionPill status={promise.assessment.executionStatus} />
              <OutcomePill status={promise.assessment.outcomeStatus} />
              <AssessabilityPill level={promise.assessment.assessability} />
            </>
          ) : (
            <Pill tone="muted">Hodnocení zatím nevzniklo</Pill>
          )}
        </div>
      </header>

      <Section id="slib" title="Co bylo slíbeno">
        <blockquote className="border-accent border-l-2 pl-4 text-lg">
          „{promise.originalText}“
        </blockquote>

        {promise.normalizedStatement ? (
          <div className="space-y-1">
            <h3 className="text-muted text-xs tracking-wide uppercase">
              Redakční přepis do ověřitelné podoby
            </h3>
            <p>{promise.normalizedStatement}</p>
            <p className="text-muted text-sm">
              Přepis nenahrazuje původní znění. Slouží k tomu, aby šlo určit, co by znamenalo
              splnění.
            </p>
          </div>
        ) : null}

        {promise.deadlineText ? (
          <p className="text-muted text-sm">
            <span className="text-foreground">Termín podle zdroje: </span>
            {promise.deadlineText}
            {promise.deadlineOn ? ` (vykládáme jako ${formatDate(promise.deadlineOn)})` : null}
          </p>
        ) : (
          <p className="text-muted text-sm">Slib neuvádí žádný termín.</p>
        )}

        {promise.primarySource ? <CitationBlock citation={promise.primarySource} /> : null}
      </Section>

      {promise.assessment ? (
        <Section id="stav" title="V jakém je slib stavu">
          <dl className="divide-border divide-y">
            <StatusRow
              label="Stav plnění"
              value={EXECUTION_STATUS_LABELS[promise.assessment.executionStatus].label}
              meaning={EXECUTION_STATUS_LABELS[promise.assessment.executionStatus].meaning}
            />
            <StatusRow
              label="Stav výsledku"
              value={OUTCOME_STATUS_LABELS[promise.assessment.outcomeStatus].label}
              meaning={OUTCOME_STATUS_LABELS[promise.assessment.outcomeStatus].meaning}
            />
          </dl>

          <p className="border-border bg-surface rounded-lg border p-4 text-sm">
            Stav podle veřejně dostupných zdrojů k{" "}
            <strong>{formatDateLong(promise.assessment.sourcesReviewedUpTo)}</strong>. Novější
            dokumenty v něm zohledněné nejsou.
          </p>

          <p className="text-muted text-sm">
            Průběh a výsledek držíme oddělené schválně. Opatření může být realizované, a přesto
            nemusí nastat slíbený výsledek — a naopak.
          </p>

          {promise.assessment.summary ? <p>{promise.assessment.summary}</p> : null}

          <p className="text-muted text-sm">
            Hodnocení verze {promise.assessment.version}, zveřejněno{" "}
            {formatTimestamp(promise.assessment.createdAt)}.
          </p>

          {promise.assessment.changeReason ? (
            <div className="border-border bg-surface rounded-lg border p-4 text-sm">
              <p className="font-semibold">Proč se hodnocení změnilo</p>
              <p className="text-muted mt-1">{promise.assessment.changeReason}</p>
            </div>
          ) : null}
        </Section>
      ) : null}

      {promise.assessment ? (
        <Section
          id="hodnotitelnost"
          title="Nakolik jde slib vůbec hodnotit"
          intro="Ne každý slib se dá objektivně vyhodnotit. Tenhle rozpad ukazuje proč — a je stejný pro všechny kandidátky."
        >
          <AssessabilityPanel assessment={promise.assessment} />
          <p className="text-muted text-sm">
            Postup je popsaný v{" "}
            <Link href="/methodology" className="hover:text-accent underline underline-offset-4">
              metodice
            </Link>
            .
          </p>
        </Section>
      ) : null}

      {promise.metrics.length > 0 ? (
        <Section
          id="metriky"
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

      <Section id="timeline" title="Co se se slibem dělo">
        <Timeline events={promise.timeline} />
      </Section>

      {promise.coalition ? (
        <Section id="koalice" title="Jak slib dopadl v koaliční smlouvě">
          <div className="flex flex-wrap items-center gap-3">
            <Pill>{COALITION_CLASSIFICATION_LABELS[promise.coalition.classification].label}</Pill>
            <span className="text-muted text-sm">
              {COALITION_CLASSIFICATION_LABELS[promise.coalition.classification].meaning}
            </span>
          </div>

          <p>{promise.coalition.reason}</p>

          {promise.coalition.citation ? (
            <CitationBlock citation={promise.coalition.citation} />
          ) : (
            <div className="space-y-2">
              <p className="text-muted text-sm">
                V koaliční smlouvě jsme k tomuto slibu nenašli odpovídající pasáž.
              </p>
              <SourceLine source={promise.coalition.agreement} />
            </div>
          )}

          <p className="text-sm">
            <Link
              href={`/compare?list=${promise.electoralList.slug}`}
              className="hover:text-accent underline underline-offset-4"
            >
              Porovnat celý program kandidátky s koaliční smlouvou
            </Link>
          </p>
        </Section>
      ) : null}

      <Section
        id="dukazy"
        title="Čím je to doložené"
        intro="Zobrazujeme jen zdroje, které prošly redakční kontrolou. Návrhy vytvořené strojově zůstávají skryté, dokud je někdo neověří."
      >
        <EvidenceList evidence={promise.evidence} />
      </Section>

      {promise.corrections.length > 0 ? (
        <Section
          id="opravy"
          title="Podněty a reakce"
          intro="Opravy čtenářů i reakce dotčených kandidátek zveřejňujeme u slibu, kterého se týkají."
        >
          <ul className="space-y-6">
            {promise.corrections.map((correction, index) => (
              <li key={index} className="border-border space-y-2 rounded-lg border p-4">
                <p className="text-muted text-xs tracking-wide uppercase">
                  {correction.kind === "PARTY_RESPONSE" ? "Reakce kandidátky" : "Podnět čtenáře"}
                  {" · "}
                  {CORRECTION_STATUS_LABELS[correction.status]}
                </p>
                <p>{correction.body}</p>
                <p className="text-muted text-sm">
                  {correction.submitterOrganization ?? correction.submitterName ?? "Bez uvedení"}
                  {" · "}
                  {formatTimestamp(correction.createdAt)}
                </p>
                {correction.response ? (
                  <div className="border-border border-t pt-2">
                    <p className="text-muted text-xs tracking-wide uppercase">Naše odpověď</p>
                    <p className="mt-1">{correction.response}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {promise.assessmentHistory.length > 0 ? (
        <Section
          id="historie"
          title="Starší verze hodnocení"
          intro="Hodnocení se nepřepisuje. Když se změní, vznikne nová verze a ta předchozí zůstává dohledatelná."
        >
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
                {version.summary ? <p className="text-muted text-sm">{version.summary}</p> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </article>
  );
}

const CORRECTION_STATUS_LABELS: Record<PromiseDetail["corrections"][number]["status"], string> = {
  OPEN: "Přijato, zpracovává se",
  ACKNOWLEDGED: "Vzato na vědomí",
  APPLIED: "Promítnuto do hodnocení",
  REJECTED: "Neuznáno",
};

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
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {intro ? <p className="text-muted">{intro}</p> : null}
      {children}
    </section>
  );
}

function StatusRow({ label, value, meaning }: { label: string; value: string; meaning: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd>
        <span className="font-medium">{value}</span>
        <span className="text-muted block text-sm">{meaning}</span>
      </dd>
    </div>
  );
}
