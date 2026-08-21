import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db/client";
import { getDashboardData, type QueueItem } from "@/modules/review/adminQueries";
import { WORKFLOW_STATE_LABELS } from "@/modules/review/workflow";
import { SOURCE_TYPE_LABELS } from "@/modules/sources/labels";
import { formatTimestamp } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Redakční přehled", robots: { index: false } };

/**
 * Přehled řadí práci podle toho, co blokuje ostatní.
 *
 * Nahoře je revize a vrácené hodnocení, protože tam čeká někdo jiný. Vlastní
 * rozepsaná práce je až níž — tu má autor v hlavě i bez seznamu.
 */
export default async function AdminDashboardPage() {
  const data = await getDashboardData(db);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Přehled</h1>
        <p className="text-muted text-sm">
          Publikuje se jen to, co prošlo revizí někoho jiného, než kdo hodnocení psal.
        </p>
      </header>

      <section aria-labelledby="pocty" className="space-y-3">
        <h2 id="pocty" className="sr-only">
          Počty ve frontách
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Čeká na revizi" value={data.counts.inReview} />
          <Stat label="Vráceno" value={data.counts.changesRequested} />
          <Stat label="K publikaci" value={data.counts.readyToPublish} />
          <Stat label="Kandidáti" value={data.counts.candidatePromises} />
          <Stat label="Zdroje ke zpracování" value={data.counts.sourcesAwaiting} />
          <Stat label="Otevřené podněty" value={data.counts.openCorrections} />
        </dl>
      </section>

      <Queue
        id="k-revizi"
        title="Čeká na revizi"
        description="Hodnocení, které napsal někdo jiný a čeká na druhý pár očí."
        items={data.inReview}
        emptyText="Nic nečeká na revizi."
      />

      <Queue
        id="k-publikaci"
        title="Schváleno, čeká na publikaci"
        items={data.readyToPublish}
        emptyText="Nic není připraveno k publikaci."
      />

      <Queue
        id="vraceno"
        title="Vráceno k přepracování"
        items={data.changesRequested}
        emptyText="Nic není vrácené."
      />

      <section aria-labelledby="kandidati" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="kandidati" className="text-lg font-semibold">
            Kandidáti na slib
          </h2>
          <Link href="/admin/promises/new" className="text-sm underline underline-offset-4">
            Nový kandidát
          </Link>
        </div>
        {data.candidatePromises.length === 0 ? (
          <p className="text-muted text-sm">Žádný nepublikovaný slib.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {data.candidatePromises.map((item) => (
              <li key={item.slug} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                <Link
                  href={`/admin/promises/${item.slug}`}
                  className="underline-offset-4 hover:underline"
                >
                  {item.title}
                </Link>
                <span className="text-muted text-sm">
                  {item.listShortName} · {formatTimestamp(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="zdroje" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="zdroje" className="text-lg font-semibold">
            Zdroje ke zpracování
          </h2>
          <Link href="/admin/sources" className="text-sm underline underline-offset-4">
            Všechny zdroje
          </Link>
        </div>
        {data.sourcesAwaiting.length === 0 ? (
          <p className="text-muted text-sm">Žádný zdroj nečeká na zpracování.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {data.sourcesAwaiting.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                <Link
                  href={`/admin/sources/${item.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {item.title}
                </Link>
                <span className="text-muted text-sm">
                  {SOURCE_TYPE_LABELS[item.sourceType]} · {formatTimestamp(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Queue
        id="publikovano"
        title="Nedávno publikováno"
        items={data.recentlyPublished}
        emptyText="Zatím nic publikovaného."
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border rounded-lg border p-3">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Queue({
  id,
  title,
  description,
  items,
  emptyText,
}: {
  id: string;
  title: string;
  description?: string;
  items: QueueItem[];
  emptyText: string;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="space-y-1">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-muted text-sm">{description}</p> : null}
      </div>

      {items.length === 0 ? (
        <p className="text-muted text-sm">{emptyText}</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {items.map((item) => (
            <li
              key={`${item.promiseSlug}-${item.version}`}
              className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
            >
              <Link
                href={`/admin/promises/${item.promiseSlug}`}
                className="underline-offset-4 hover:underline"
              >
                {item.promiseTitle}
              </Link>
              <span className="text-muted text-sm">
                {item.listShortName} · v{item.version} · {WORKFLOW_STATE_LABELS[item.workflowState]}{" "}
                · {item.authorName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
