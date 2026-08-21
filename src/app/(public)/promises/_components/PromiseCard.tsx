import Link from "next/link";

import { DemoBadge } from "@/app/_components/DemoBadge";
import { ExecutionChip } from "@/app/_components/StatusDisplay";
import { ASSESSABILITY_LABELS, type AssessabilityLevel } from "@/modules/assessments/labels";
import { TOPIC_LABELS } from "@/modules/promises/labels";
import type { PromiseListItem } from "@/modules/promises/queries";
import { formatDate } from "@/shared/format";

/**
 * Karta slibu.
 *
 * Karta odpovídá na jedinou otázku: **mám tenhle slib otevřít?** Všechno
 * ostatní patří do detailu.
 *
 * Původní verze vedle sebe stavěla stav plnění i hodnotitelnost jako dva
 * rovnocenné štítky. Jenže u většiny slibů je hodnotitelnost normální, takže
 * ten druhý štítek nenesl žádnou informaci — jen ubíral pozornost tomu
 * prvnímu. Proto se hodnotitelnost píše jen tehdy, když je nízká: tam je to
 * varování, které mění, jak se má na výsledek dívat.
 *
 * Poslední řádek je epistemický, ne dekorativní. „Aktualizováno" znamená,
 * ke kterému dni jsme zdroje procházeli, ne kdy jsme sáhli do databáze —
 * bez toho by čtenář nevěděl, jak starý závěr čte.
 */

/** Úrovně, které stojí za zmínku v seznamu. Zbytek je běžný stav. */
const NOTABLE_ASSESSABILITY: readonly AssessabilityLevel[] = ["LOW", "NOT_ASSESSABLE"];

export function PromiseCard({ promise }: { promise: PromiseListItem }) {
  const notableAssessability =
    promise.assessability && NOTABLE_ASSESSABILITY.includes(promise.assessability)
      ? promise.assessability
      : null;

  return (
    <article className="border-border hover:border-accent/50 flex flex-col gap-3 rounded-lg border p-5 transition-colors">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">
          {promise.electoralList.shortName}
          {promise.electoralList.isDemo ? <DemoBadge /> : null}
        </span>
        <span className="text-muted" aria-hidden="true">
          ·
        </span>
        <span className="text-muted">{TOPIC_LABELS[promise.topic]}</span>
      </p>

      <h3 className="text-lg leading-snug font-semibold">
        <Link
          href={`/promises/${promise.slug}`}
          className="hover:text-accent underline-offset-4 hover:underline"
        >
          {promise.title}
        </Link>
      </h3>

      <blockquote className="text-muted line-clamp-2 text-sm italic">
        „{promise.originalText}“
      </blockquote>

      <div className="mt-auto space-y-2 pt-1">
        {promise.executionStatus ? (
          <div>
            <ExecutionChip status={promise.executionStatus} />
          </div>
        ) : null}

        {notableAssessability ? (
          <p className="text-muted text-sm">
            <span aria-hidden="true">▲ </span>
            {ASSESSABILITY_LABELS[notableAssessability].label}
          </p>
        ) : null}

        <p className="text-muted text-sm">
          {promise.sourcesReviewedUpTo ? (
            <>
              Zdroje k {formatDate(promise.sourcesReviewedUpTo)}
              <span aria-hidden="true"> · </span>
            </>
          ) : null}
          {promise.evidenceCount === 0
            ? "zatím bez doložených zdrojů"
            : `${promise.evidenceCount} ${plural(promise.evidenceCount)}`}
        </p>
      </div>
    </article>
  );
}

function plural(count: number): string {
  if (count === 1) return "doložený zdroj";
  if (count < 5) return "doložené zdroje";
  return "doložených zdrojů";
}
