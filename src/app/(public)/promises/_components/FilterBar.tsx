import Link from "next/link";

import { DemoBadge } from "@/app/_components/DemoBadge";
import { FilterDrawer } from "@/app/(public)/promises/_components/FilterDrawer";
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
 * komponentu — brief navíc žádá neposílat zbytečný JavaScript. Jediné, co
 * klientský kód dělá, je složení panelu do zásuvky na mobilu.
 */
interface FilterBarProps {
  filters: PromiseFilters;
  lists: ElectoralListRef[];
}

/** Kolik filtrů čtenář zapnul. Stránkování se nepočítá, to filtr není. */
export function activeFilterCount(filters: PromiseFilters): number {
  return [filters.list, filters.topic, filters.execution, filters.assessability, filters.q].filter(
    (value) => value !== undefined && value !== null && value !== "",
  ).length;
}

export function FilterBar({ filters, lists }: FilterBarProps) {
  return (
    <div className="space-y-3">
      <FilterDrawer activeCount={activeFilterCount(filters)}>
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
      </FilterDrawer>
    </div>
  );
}

/**
 * Zapnuté filtry nad výsledky.
 *
 * Na mobilu je panel schovaný v zásuvce, takže by čtenář jinak viděl zkrácený
 * seznam a nevěděl proč. Každý filtr je zároveň tlačítko, kterým se ruší —
 * zrušit filtr nesmí vyžadovat znovu otevřít zásuvku a hledat v ní ten správný.
 */
export function ActiveFilters({ filters, lists }: FilterBarProps) {
  if (!hasActiveFilters(filters)) return null;

  const active: { key: string; label: string; href: string }[] = [];

  if (filters.q) {
    active.push({
      key: "q",
      label: `Hledání: „${filters.q}“`,
      href: buildFilterHref(filters, { q: undefined }),
    });
  }
  if (filters.list) {
    const list = lists.find((item) => item.slug === filters.list);
    active.push({
      key: "list",
      label: list ? list.shortName : filters.list,
      href: buildFilterHref(filters, { list: undefined }),
    });
  }
  if (filters.topic) {
    active.push({
      key: "topic",
      label: TOPIC_LABELS[filters.topic],
      href: buildFilterHref(filters, { topic: undefined }),
    });
  }
  if (filters.execution) {
    active.push({
      key: "execution",
      label: EXECUTION_STATUS_LABELS[filters.execution].label,
      href: buildFilterHref(filters, { execution: undefined }),
    });
  }
  if (filters.assessability) {
    active.push({
      key: "assessability",
      label: ASSESSABILITY_LABELS[filters.assessability].label,
      href: buildFilterHref(filters, { assessability: undefined }),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted text-sm">Filtruje se podle:</span>
      {active.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="border-border hover:border-accent inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-sm"
        >
          {item.label}
          <span aria-hidden="true">×</span>
          <span className="sr-only"> — zrušit tento filtr</span>
        </Link>
      ))}
      <Link href="/promises" className="hover:text-accent text-sm underline underline-offset-4">
        Zrušit vše
      </Link>
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

/**
 * Zapnutý filtr se nepozná jen barvou.
 *
 * Barva vypadává při vysokém kontrastu, v tisku i u části čtenářů. Nese ji
 * proto značka a tučný řez; výplň je až třetí signál, ne jediný.
 */
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
          ? "bg-accent text-accent-foreground border-accent inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold"
          : "border-border hover:border-accent inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-sm"
      }
    >
      {active ? <span aria-hidden="true">✓</span> : null}
      {children}
      {active ? <span className="sr-only"> (aktivní filtr, kliknutím zrušíte)</span> : null}
    </Link>
  );
}
