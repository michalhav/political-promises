import type { Metadata } from "next";
import Link from "next/link";

import { DemoBadge } from "@/app/_components/DemoBadge";
import { Pill } from "@/app/_components/Pill";
import { SourceLine } from "@/app/_components/SourceCitation";
import { db } from "@/db/client";
import {
  COALITION_CLASSIFICATION_LABELS,
  COALITION_CLASSIFICATION_ORDER,
} from "@/modules/coalition/labels";
import {
  getCoalitionComparison,
  listComparableElectoralLists,
  type ComparisonItem,
} from "@/modules/coalition/queries";
import { TOPIC_LABELS } from "@/modules/promises/labels";

export const metadata: Metadata = {
  title: "Program vs. koaliční smlouva",
  description:
    "Co se stalo s volebními sliby po sestavení koalice — slib po slibu, s doslovnými citacemi.",
};

/**
 * Stránka čte z databáze, proto se vykresluje až při požadavku.
 *
 * Předgenerování při buildu by znamenalo, že nasazení vyžaduje dostupnou
 * databázi, a že by publikovaný slib byl vidět až po dalším buildu. Obsah se
 * mění redakční prací, ne nasazením kódu.
 */
export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const params = await searchParams;
  const requested = Array.isArray(params.list) ? params.list[0] : params.list;
  const lists = await listComparableElectoralLists(db);

  const selectedSlug = requested ?? lists[0]?.slug;
  const comparison = selectedSlug ? await getCoalitionComparison(db, selectedSlug) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Program vs. koaliční smlouva</h1>
        <p className="text-muted">
          Volební program je nabídka. Koaliční smlouva je to, na čem se strany po volbách skutečně
          domluvily. Tady je vidět, co z programu do smlouvy prošlo a v jaké podobě.
        </p>
        <p className="text-muted text-sm">
          Záměrně tu nenajdete žádné souhrnné počty ani žebříček kandidátek. Číslo „sedm slibů
          nezahrnuto“ by se četlo jako známka, ne jako popis — a o kvalitě politiky nevypovídá.
          Ukazujeme proto vždy jednu kandidátku a obě znění vedle sebe.
        </p>
      </header>

      {lists.length === 0 ? (
        <p className="text-muted">Zatím nemáme žádné ověřené porovnání s koaliční smlouvou.</p>
      ) : (
        <>
          <nav aria-label="Volba kandidátky" className="flex flex-wrap gap-2">
            {lists.map((list) => {
              const active = list.slug === selectedSlug;
              return (
                <Link
                  key={list.slug}
                  href={`/compare?list=${list.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "bg-accent text-accent-foreground rounded-full px-4 py-2 text-sm"
                      : "border-border hover:border-accent rounded-full border px-4 py-2 text-sm"
                  }
                >
                  {list.name}
                  {list.isDemo ? <DemoBadge /> : null}
                </Link>
              );
            })}
          </nav>

          {comparison ? (
            <>
              <section className="border-border bg-surface space-y-2 rounded-lg border p-4">
                <h2 className="text-sm font-semibold">Porovnáváme proti dokumentu</h2>
                <SourceLine source={comparison.agreement} />
              </section>

              <div className="space-y-10">
                {COALITION_CLASSIFICATION_ORDER.map((classification) => {
                  const items = comparison.items.filter(
                    (item) => item.classification === classification,
                  );
                  if (items.length === 0) return null;

                  return (
                    <section key={classification} className="space-y-4">
                      <div className="space-y-1">
                        <h2 className="text-xl font-semibold">
                          {COALITION_CLASSIFICATION_LABELS[classification].label}
                        </h2>
                        <p className="text-muted text-sm">
                          {COALITION_CLASSIFICATION_LABELS[classification].meaning}
                        </p>
                      </div>
                      <ul className="space-y-4">
                        {items.map((item) => (
                          <li key={item.promiseSlug}>
                            <ComparisonCard item={item} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-muted">Pro tuto kandidátku zatím žádné ověřené porovnání nemáme.</p>
          )}
        </>
      )}
    </div>
  );
}

function ComparisonCard({ item }: { item: ComparisonItem }) {
  return (
    <article className="border-border space-y-4 rounded-lg border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          <Link
            href={`/promises/${item.promiseSlug}`}
            className="hover:text-accent underline-offset-4 hover:underline"
          >
            {item.promiseTitle}
          </Link>
        </h3>
        <Pill tone="muted">{TOPIC_LABELS[item.topic]}</Pill>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <h4 className="text-muted text-xs tracking-wide uppercase">Volební program</h4>
          <blockquote className="border-border border-l-2 pl-3 text-sm italic">
            „{item.originalText}“
          </blockquote>
        </div>
        <div className="space-y-1">
          <h4 className="text-muted text-xs tracking-wide uppercase">Koaliční smlouva</h4>
          {item.coalitionExcerpt ? (
            <>
              <blockquote className="border-border border-l-2 pl-3 text-sm italic">
                „{item.coalitionExcerpt}“
              </blockquote>
              {item.coalitionLocator || item.coalitionPageNumber !== null ? (
                <p className="text-muted pl-3 text-xs">
                  {[
                    item.coalitionLocator,
                    item.coalitionPageNumber === null ? null : `s. ${item.coalitionPageNumber}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted text-sm">Odpovídající pasáž jsme ve smlouvě nenašli.</p>
          )}
        </div>
      </div>

      <p className="border-border border-t pt-3 text-sm">
        <span className="text-muted">Proč tato klasifikace: </span>
        {item.reason}
      </p>
    </article>
  );
}
