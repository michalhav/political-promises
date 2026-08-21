import type { Metadata } from "next";
import Link from "next/link";

import { DemoDatasetNotice } from "@/app/_components/DemoBadge";
import { ActiveFilters, FilterBar } from "@/app/(public)/promises/_components/FilterBar";
import { PromiseCard } from "@/app/(public)/promises/_components/PromiseCard";
import { db } from "@/db/client";
import { buildFilterHref, parsePromiseFilters } from "@/modules/promises/filters";
import { listElectoralListOptions, listPublishedPromises } from "@/modules/promises/queries";

export const metadata: Metadata = {
  title: "Sliby",
  description: "Přehled sledovaných politických slibů s doloženým stavem plnění.",
};

/**
 * Stránka čte z databáze, proto se vykresluje až při požadavku.
 *
 * Předgenerování při buildu by znamenalo, že nasazení vyžaduje dostupnou
 * databázi, a že by publikovaný slib byl vidět až po dalším buildu. Obsah se
 * mění redakční prací, ne nasazením kódu.
 */
export const dynamic = "force-dynamic";

export default async function PromisesPage({ searchParams }: PageProps<"/promises">) {
  const filters = parsePromiseFilters(await searchParams);
  const [result, lists] = await Promise.all([
    listPublishedPromises(db, filters),
    listElectoralListOptions(db),
  ]);
  const hasDemoData = lists.some((list) => list.isDemo);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Sliby</h1>
        <p className="text-muted max-w-2xl">
          Sliby z volebních programů pro komunální volby 2022. U každého sledujeme, co se s ním po
          volbách stalo a čím je to doložené.
        </p>
      </header>

      {hasDemoData ? <DemoDatasetNotice /> : null}

      <FilterBar filters={filters} lists={lists} />

      <div className="space-y-3">
        <ActiveFilters filters={filters} lists={lists} />

        <p className="text-muted text-sm" role="status">
          {result.total === 0
            ? "Žádný slib neodpovídá zvoleným filtrům."
            : `Nalezeno ${result.total} ${countLabel(result.total)}.`}
        </p>
      </div>

      {result.items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {result.items.map((promise) => (
            <PromiseCard key={promise.slug} promise={promise} />
          ))}
        </div>
      ) : (
        <p>
          <Link href="/promises" className="hover:text-accent underline underline-offset-4">
            Zobrazit všechny sliby
          </Link>
        </p>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Stránkování" className="flex items-center justify-between gap-4">
          {result.page > 1 ? (
            <Link
              href={buildFilterHref(filters, { page: result.page - 1 })}
              className="border-border rounded-md border px-4 py-2"
              rel="prev"
            >
              Předchozí
            </Link>
          ) : (
            <span />
          )}

          <span className="text-muted text-sm">
            Stránka {result.page} z {result.pageCount}
          </span>

          {result.page < result.pageCount ? (
            <Link
              href={buildFilterHref(filters, { page: result.page + 1 })}
              className="border-border rounded-md border px-4 py-2"
              rel="next"
            >
              Další
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

function countLabel(count: number): string {
  if (count === 1) return "slib";
  if (count < 5) return "sliby";
  return "slibů";
}
