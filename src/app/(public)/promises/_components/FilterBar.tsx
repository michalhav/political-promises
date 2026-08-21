import Link from "next/link";

import { DemoBadge } from "@/app/_components/DemoBadge";
import {
  ASSESSABILITY_LABELS,
  EXECUTION_STATUS_LABELS,
  type AssessabilityLevel,
  type ExecutionStatusValue,
} from "@/modules/assessments/labels";
import { assessabilityEnum, executionStatusEnum } from "@/db/enums";
import { buildFilterHref, hasActiveFilters, type PromiseFilters } from "@/modules/promises/filters";
import { TOPIC_LABELS, TOPIC_ORDER, type Topic } from "@/modules/promises/labels";
import type { ElectoralListRef } from "@/modules/promises/queries";

/**
 * Filtry jako odkazy, ne jako klientský stav.
 *
 * Odkaz je sdílitelný, funguje bez JavaScriptu a dá se otevřít na novou kartu.
 * Pro filtrování seznamu není důvod posílat do prohlížeče interaktivní
 * komponentu — brief navíc žádá neposílat zbytečný JavaScript.
 */
interface FilterBarProps {
  filters: PromiseFilters;
  lists: ElectoralListRef[];
}

export function FilterBar({ filters, lists }: FilterBarProps) {
  return (
    <div className="border-border bg-surface space-y-5 rounded-lg border p-5">
      <form action="/promises" className="flex flex-wrap gap-2">
        {/* Skryté hodnoty drží ostatní filtry, když se odešle hledání. */}
        {filters.list ? <input type="hidden" name="list" value={filters.list} /> : null}
        {filters.topic ? <input type="hidden" name="topic" value={filters.topic} /> : null}
        {filters.execution ? (
          <input type="hidden" name="execution" value={filters.execution} />
        ) : null}
        {filters.assessability ? (
          <input type="hidden" name="assessability" value={filters.assessability} />
        ) : null}

        <label htmlFor="q" className="sr-only">
          Hledat ve slibech
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters.q ?? ""}
          placeholder="Hledat ve znění slibů"
          className="border-border bg-background min-w-0 flex-1 rounded-md border px-3 py-2"
        />
        <button type="submit" className="border-border rounded-md border px-4 py-2 font-medium">
          Hledat
        </button>
      </form>

      <FilterGroup label="Kandidátka">
        {lists.map((list) => (
          <FilterChip
            key={list.slug}
            href={buildFilterHref(filters, {
              list: filters.list === list.slug ? undefined : list.slug,
            })}
            active={filters.list === list.slug}
          >
            {list.shortName}
            {list.isDemo ? <DemoBadge /> : null}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup label="Téma">
        {TOPIC_ORDER.map((topic: Topic) => (
          <FilterChip
            key={topic}
            href={buildFilterHref(filters, {
              topic: filters.topic === topic ? undefined : topic,
            })}
            active={filters.topic === topic}
          >
            {TOPIC_LABELS[topic]}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup label="Stav plnění">
        {executionStatusEnum.enumValues.map((status: ExecutionStatusValue) => (
          <FilterChip
            key={status}
            href={buildFilterHref(filters, {
              execution: filters.execution === status ? undefined : status,
            })}
            active={filters.execution === status}
          >
            {EXECUTION_STATUS_LABELS[status].label}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup label="Hodnotitelnost">
        {assessabilityEnum.enumValues.map((level: AssessabilityLevel) => (
          <FilterChip
            key={level}
            href={buildFilterHref(filters, {
              assessability: filters.assessability === level ? undefined : level,
            })}
            active={filters.assessability === level}
          >
            {ASSESSABILITY_LABELS[level].label}
          </FilterChip>
        ))}
      </FilterGroup>

      {hasActiveFilters(filters) ? (
        <p>
          <Link href="/promises" className="hover:text-accent text-sm underline underline-offset-4">
            Zrušit všechny filtry
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-muted text-xs tracking-wide uppercase">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "bg-accent text-accent-foreground rounded-full px-3 py-1 text-sm"
          : "border-border hover:border-accent rounded-full border px-3 py-1 text-sm"
      }
    >
      {children}
      {active ? <span className="sr-only"> (aktivní filtr, kliknutím zrušíte)</span> : null}
    </Link>
  );
}
