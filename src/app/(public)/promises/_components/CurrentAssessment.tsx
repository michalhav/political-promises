import Link from "next/link";

import { ExecutionAxis, needsSafeguard, OutcomeAxis } from "@/app/_components/StatusDisplay";
import type { AssessmentView } from "@/modules/promises/queries";
import { formatDateLong } from "@/shared/format";

/**
 * Aktuální stav — hlavní odpověď stránky.
 *
 * Po samotném slibu je tohle nejdůležitější blok. Má během několika sekund
 * odpovědět na „tak jak to tedy je?", a to i tomu, kdo dál nescrolluje.
 *
 * Proto to není řádka štítků. Štítek je zhuštěná hodnota, ne informace —
 * a tři štítky vedle sebe odpověď spíš rozdrobí, než dají.
 *
 * Blok vědomě obsahuje i to, co **neví**: rozhodné datum a poznámku, že
 * novější dokumenty v hodnocení nemusí být. Bez toho by se závěr tvářil
 * jako trvalá pravda, přestože je to snímek k jednomu dni.
 */
interface CurrentAssessmentProps {
  assessment: AssessmentView;
  evidenceCount: number;
  /** Odkaz na sekci s rozpadem metodiky na téže stránce. */
  methodologySectionId: string;
}

export function CurrentAssessment({
  assessment,
  evidenceCount,
  methodologySectionId,
}: CurrentAssessmentProps) {
  return (
    <section
      aria-labelledby="aktualni-stav"
      className="border-border-assessment bg-surface-assessment space-y-6 rounded-xl border p-6 sm:p-8"
    >
      <div className="space-y-1">
        <h2 id="aktualni-stav" className="text-2xl font-semibold tracking-tight">
          Aktuální stav
        </h2>
        <p className="text-muted text-sm">
          Podle veřejných zdrojů prošlých k{" "}
          <strong className="text-foreground font-semibold">
            {formatDateLong(assessment.sourcesReviewedUpTo)}
          </strong>
        </p>
      </div>

      {/* Dvě osy vedle sebe na šířku, pod sebou na mobilu. Nikdy sloučené. */}
      <div className="grid gap-6 sm:grid-cols-2">
        <ExecutionAxis status={assessment.executionStatus} />
        <OutcomeAxis status={assessment.outcomeStatus} />
      </div>

      {assessment.summary ? (
        <div className="border-border-assessment space-y-2 border-t pt-5">
          <h3 className="text-sm font-semibold">Co to znamená</h3>
          <p className="prose-measure text-[1.0625rem] leading-relaxed">{assessment.summary}</p>
        </div>
      ) : null}

      {needsSafeguard(assessment.executionStatus) ? <ProgressSafeguard /> : null}

      <dl className="border-border-assessment flex flex-wrap gap-x-8 gap-y-3 border-t pt-5 text-sm">
        <div>
          <dt className="text-muted">Ověřených zdrojů</dt>
          <dd className="font-semibold tabular-nums">{evidenceCount}</dd>
        </div>
        <div>
          <dt className="text-muted">Verze hodnocení</dt>
          <dd className="font-semibold tabular-nums">v{assessment.version}</dd>
        </div>
        <div>
          <dt className="text-muted">Jak vzniklo</dt>
          <dd>
            <Link
              href={`#${methodologySectionId}`}
              className="hover:text-accent font-semibold underline underline-offset-4"
            >
              Rozpad hodnocení
            </Link>
          </dd>
        </div>
      </dl>

      <p className="text-muted text-xs">
        Dokumenty zveřejněné po rozhodném datu v hodnocení zahrnuté nejsou.
      </p>
    </section>
  );
}

/**
 * Pojistka u stavů, které se snadno přečtou jako „nic se nestalo".
 *
 * Je to nejzneužitelnější místo celého produktu: nenalezený důkaz není důkaz
 * neexistence. Vysvětlení proto stojí přímo u hodnoty, ne až v metodice, kam
 * se čtenář nedostane.
 */
function ProgressSafeguard() {
  return (
    <div className="border-border-note bg-surface-note space-y-2 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Co to neznamená</h3>
      <p className="text-muted prose-measure text-sm">
        Že jsme ve zkontrolovaných veřejných zdrojích nenašli doklad o realizaci, neznamená, že se
        nic neděje. Znamená to, že k rozhodnému datu nemáme co doložit — a dokud nemáme, netvrdíme
        nic.
      </p>
    </div>
  );
}
