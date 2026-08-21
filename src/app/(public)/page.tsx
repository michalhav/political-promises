import Link from "next/link";

import { DemoDatasetNotice } from "@/app/_components/DemoBadge";
import { PromiseCard } from "@/app/(public)/promises/_components/PromiseCard";
import { db } from "@/db/client";
import { promiseFiltersSchema } from "@/modules/promises/filters";
import { listPublishedPromises } from "@/modules/promises/queries";

/** Řetěz, na kterém celý produkt stojí. Na úvodní stránce je vidět hned. */
const CHAIN = [
  "Volební slib",
  "Koaliční smlouva",
  "Politické rozhodnutí",
  "Rozpočet",
  "Zakázka a realizace",
  "Skutečný výsledek",
] as const;

/**
 * Stránka čte z databáze, proto se vykresluje až při požadavku.
 *
 * Předgenerování při buildu by znamenalo, že nasazení vyžaduje dostupnou
 * databázi, a že by publikovaný slib byl vidět až po dalším buildu. Obsah se
 * mění redakční prací, ne nasazením kódu.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { items, total } = await listPublishedPromises(db, promiseFiltersSchema.parse({ page: 1 }));
  const examples = items.slice(0, 3);
  const hasDemoData = items.some((item) => item.electoralList.isDemo);

  return (
    <div className="mx-auto max-w-5xl space-y-16 px-4 py-16">
      <section className="space-y-6">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          Co politici slíbili.
          <br />
          Co se skutečně stalo.
        </h1>
        <p className="text-muted max-w-2xl text-lg">
          Sledujeme cestu od volebního programu přes politická rozhodnutí až k výsledku. Každé
          tvrzení na těchto stránkách odkazuje na zdrojový dokument, ze kterého vychází.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/promises"
            className="bg-accent text-accent-foreground rounded-md px-5 py-2.5 font-medium"
          >
            Prozkoumat sliby
          </Link>
          <Link
            href="/methodology"
            className="border-border rounded-md border px-5 py-2.5 font-medium"
          >
            Jak hodnotíme
          </Link>
        </div>
      </section>

      {hasDemoData ? <DemoDatasetNotice /> : null}

      <section aria-labelledby="retezec" className="space-y-4">
        <h2 id="retezec" className="text-xl font-semibold">
          Slib není jen věta v programu
        </h2>
        <p className="text-muted max-w-2xl">
          Je to sledovatelný objekt s původem, navazujícími rozhodnutími a doložitelným výsledkem.
          Tuhle cestu se snažíme u každého slibu poskládat celou.
        </p>
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {CHAIN.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="border-border bg-surface rounded-md border px-3 py-1.5">{step}</span>
              {index < CHAIN.length - 1 ? (
                <span className="text-muted" aria-hidden="true">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {examples.length > 0 ? (
        <section aria-labelledby="ukazky" className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="ukazky" className="text-xl font-semibold">
              Ukázka sledovaných slibů
            </h2>
            <Link
              href="/promises"
              className="hover:text-accent text-sm underline underline-offset-4"
            >
              Všech {total} slibů
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {examples.map((promise) => (
              <PromiseCard key={promise.slug} promise={promise} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="co-nedelame" className="border-border space-y-3 border-t pt-8">
        <h2 id="co-nedelame" className="text-xl font-semibold">
          Co tady nenajdete
        </h2>
        <ul className="text-muted max-w-2xl list-disc space-y-1.5 pl-5">
          <li>Žebříček stran podle důvěryhodnosti. Nepočítáme ho a počítat nebudeme.</li>
          <li>Tvrzení, že někdo lhal. Nesplněný slib není totéž co lež.</li>
          <li>
            Hodnocení vygenerované umělou inteligencí. Publikuje se jen to, co prošlo lidskou
            revizí.
          </li>
        </ul>
        <p className="text-muted text-sm">
          Podrobně v{" "}
          <Link href="/methodology" className="hover:text-accent underline underline-offset-4">
            metodice
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
