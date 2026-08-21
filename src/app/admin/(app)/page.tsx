import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db/client";
import { getDashboardData, type QueueItem } from "@/modules/review/adminQueries";
import type { AssessmentWorkflowState } from "@/modules/review/workflow";
import { WORKFLOW_STATE_LABELS } from "@/modules/review/workflow";
import { SOURCE_TYPE_LABELS } from "@/modules/sources/labels";
import { formatAge, formatAgo } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Redakční přehled", robots: { index: false } };

/**
 * Přehled odpovídá na jedinou otázku: **co mám udělat teď?**
 *
 * Dřív stálo nahoře šest rovnocenných dlaždic s čísly. Pět z nich obvykle
 * ukazovalo nulu, a i to šesté číslo redaktorovi neřeklo, co má otevřít —
 * jen kolik toho je. Souhrn se proto vrátil tam, kam patří: do nadpisu sekce,
 * kde stojí vedle konkrétních položek.
 *
 * Řazení je podle toho, co blokuje někoho jiného. Revize je první, protože na
 * ni čeká autor. Vlastní rozepsaná práce v seznamu není vůbec — tu má člověk
 * v hlavě.
 *
 * Každý řádek nese **stáří**. Bez něj fronta neříká, co je naléhavé: z data
 * „14. 6." se nepozná, jestli věc leží tři dny, nebo tři týdny.
 */

/** Co je nad položkou v tomhle stavu ta správná další akce. */
const NEXT_ACTION: Partial<Record<AssessmentWorkflowState, string>> = {
  IN_REVIEW: "Zrevidovat",
  CHANGES_REQUESTED: "Přepracovat",
  APPROVED: "Publikovat",
};

export default async function AdminDashboardPage() {
  const data = await getDashboardData(db);

  // Pořadí front je pořadí naléhavosti, ne abecedy.
  const attention = [...data.inReview, ...data.changesRequested, ...data.readyToPublish];
  const intake = data.candidatePromises.length + data.sourcesAwaiting.length;

  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Přehled</h1>
        <p className="text-muted text-sm">
          Publikuje se jen to, co prošlo revizí někoho jiného, než kdo hodnocení psal.
        </p>
      </header>

      <section aria-labelledby="pozornost" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="pozornost" className="text-lg font-semibold">
            Vyžaduje pozornost
          </h2>
          {attention.length > 0 ? (
            <p className="text-muted text-sm tabular-nums">
              {attention.length} {itemLabel(attention.length)}
            </p>
          ) : null}
        </div>

        {attention.length === 0 ? (
          <p className="text-muted text-sm">Nic nečeká na revizi ani na publikaci.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {attention.map((item) => (
              <AttentionRow key={`${item.promiseSlug}-${item.version}`} item={item} />
            ))}
          </ul>
        )}

        {data.counts.openCorrections > 0 ? (
          <p className="text-sm">
            <span className="tabular-nums">{data.counts.openCorrections}</span>{" "}
            {correctionLabel(data.counts.openCorrections)} čeká na vyřízení. Otevřou se na detailu
            příslušného slibu.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="prichozi" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="prichozi" className="text-lg font-semibold">
            Nová práce
          </h2>
          <p className="text-muted text-sm">
            {intake === 0 ? "Nic nového nepřišlo." : "Zatím se nikdo neblokuje."}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <IntakeList
            id="kandidati"
            title="Kandidáti na slib"
            actionHref="/admin/promises/new"
            actionLabel="Nový kandidát"
            emptyText="Žádný nepublikovaný slib."
            items={data.candidatePromises.map((item) => ({
              key: item.slug,
              href: `/admin/promises/${item.slug}`,
              title: item.title,
              meta: item.listShortName,
              createdAt: item.createdAt,
            }))}
          />

          <IntakeList
            id="zdroje"
            title="Zdroje ke zpracování"
            actionHref="/admin/sources"
            actionLabel="Všechny zdroje"
            emptyText="Žádný zdroj nečeká na zpracování."
            items={data.sourcesAwaiting.map((item) => ({
              key: item.id,
              href: `/admin/sources/${item.id}`,
              title: item.title,
              meta: SOURCE_TYPE_LABELS[item.sourceType],
              createdAt: item.createdAt,
            }))}
          />
        </div>
      </section>

      <section aria-labelledby="publikovano" className="space-y-4">
        <h2 id="publikovano" className="text-lg font-semibold">
          Nedávno publikováno
        </h2>
        {data.recentlyPublished.length === 0 ? (
          <p className="text-muted text-sm">Zatím nic publikovaného.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {data.recentlyPublished.map((item) => (
              <li
                key={`${item.promiseSlug}-${item.version}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <Link
                  href={`/admin/promises/${item.promiseSlug}`}
                  className="underline-offset-4 hover:underline"
                >
                  {item.promiseTitle}
                </Link>
                <span className="text-muted text-sm">
                  {item.listShortName} · v{item.version} · {formatAgo(item.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Řádek fronty.
 *
 * Další akce stojí jako první věc za názvem, protože to je informace, kvůli
 * které redaktor na přehled chodí. Stav je až za ní — vysvětluje, proč je
 * ta akce ta správná.
 */
function AttentionRow({ item }: { item: QueueItem }) {
  const action = NEXT_ACTION[item.workflowState];

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href={`/admin/promises/${item.promiseSlug}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {item.promiseTitle}
        </Link>
        {action ? (
          <span className="border-border rounded-full border px-2.5 py-0.5 text-xs font-semibold">
            {action}
          </span>
        ) : null}
      </span>

      <span className="text-muted text-sm">
        {WORKFLOW_STATE_LABELS[item.workflowState]} · {item.listShortName} · v{item.version} ·{" "}
        {item.authorName} · čeká {formatAge(item.updatedAt)}
      </span>
    </li>
  );
}

interface IntakeItem {
  key: string;
  href: string;
  title: string;
  meta: string;
  createdAt: Date;
}

function IntakeList({
  id,
  title,
  actionHref,
  actionLabel,
  emptyText,
  items,
}: {
  id: string;
  title: string;
  actionHref: string;
  actionLabel: string;
  emptyText: string;
  items: IntakeItem[];
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={id} className="text-sm font-semibold">
          {title}
          {items.length > 0 ? (
            <span className="text-muted ml-2 font-normal tabular-nums">{items.length}</span>
          ) : null}
        </h3>
        <Link href={actionHref} className="text-sm underline underline-offset-4">
          {actionLabel}
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-muted text-sm">{emptyText}</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.key} className="space-y-0.5 px-4 py-3">
              <Link href={item.href} className="underline-offset-4 hover:underline">
                {item.title}
              </Link>
              <p className="text-muted text-sm">
                {item.meta} · {formatAgo(item.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function itemLabel(count: number): string {
  if (count === 1) return "položka";
  if (count < 5) return "položky";
  return "položek";
}

function correctionLabel(count: number): string {
  if (count === 1) return "otevřený podnět";
  if (count < 5) return "otevřené podněty";
  return "otevřených podnětů";
}
