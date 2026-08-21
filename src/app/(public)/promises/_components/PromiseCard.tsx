import Link from "next/link";

import { DemoBadge } from "@/app/_components/DemoBadge";
import { AssessabilityPill, ExecutionPill } from "@/app/_components/StatusPills";
import { EVENT_TYPE_LABELS, TOPIC_LABELS } from "@/modules/promises/labels";
import type { PromiseListItem } from "@/modules/promises/queries";
import { formatDate } from "@/shared/format";

/**
 * Karta slibu.
 *
 * Brief výslovně říká „do not overload cards“. Karta proto nese jen to, podle
 * čeho se čtenář rozhoduje, jestli slib otevřít: kdo, co, v jakém stavu a kdy
 * se s ním naposledy něco stalo. Důkazy a metriky patří až do detailu.
 */
export function PromiseCard({ promise }: { promise: PromiseListItem }) {
  return (
    <article className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <span className="font-medium">
          {promise.electoralList.shortName}
          {promise.electoralList.isDemo ? <DemoBadge /> : null}
        </span>
        <span className="text-muted" aria-hidden="true">
          ·
        </span>
        <span className="text-muted">{TOPIC_LABELS[promise.topic]}</span>
      </div>

      <h3 className="text-lg leading-snug font-semibold">
        <Link
          href={`/promises/${promise.slug}`}
          className="hover:text-accent underline-offset-4 hover:underline"
        >
          {promise.title}
        </Link>
      </h3>

      <blockquote className="text-muted line-clamp-3 text-sm italic">
        „{promise.originalText}“
      </blockquote>

      <div className="flex flex-wrap gap-2">
        {promise.executionStatus ? <ExecutionPill status={promise.executionStatus} /> : null}
        {promise.assessability ? <AssessabilityPill level={promise.assessability} /> : null}
      </div>

      <dl className="text-muted mt-auto space-y-1 text-sm">
        {promise.latestEvent ? (
          <div className="flex gap-2">
            <dt className="sr-only">Poslední doložená událost</dt>
            <dd>
              {formatDate(promise.latestEvent.eventDate)} —{" "}
              {EVENT_TYPE_LABELS[promise.latestEvent.eventType]}
            </dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="sr-only">Počet doložených zdrojů</dt>
          <dd>
            {promise.evidenceCount === 0
              ? "Zatím bez doložených zdrojů"
              : `${promise.evidenceCount} ${plural(promise.evidenceCount)}`}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function plural(count: number): string {
  if (count === 1) return "doložený zdroj";
  if (count < 5) return "doložené zdroje";
  return "doložených zdrojů";
}
