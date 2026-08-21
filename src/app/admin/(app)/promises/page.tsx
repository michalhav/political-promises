import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db/client";
import { TOPIC_LABELS } from "@/modules/promises/labels";
import { listAdminPromises, type AdminPromiseRow } from "@/modules/review/adminQueries";
import { WORKFLOW_STATE_LABELS } from "@/modules/review/workflow";
import { formatAgo, formatTimestamp } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sliby v redakci", robots: { index: false } };

/**
 * Inventář všech slibů — na rozdíl od přehledu, který ukazuje jen fronty.
 *
 * Seznam odpovídá na dvě otázky: *kde ten slib je* a *kdo za něj naposledy
 * ručil*. Proto přibyla revize a stáří posledního pohybu: bez nich tabulka
 * ukazovala stav, ale ne to, jestli se v něm někdo hýbe, nebo jestli tam
 * hodnocení leží od jara.
 *
 * Kandidátka a téma se sloučily pod název. Byly to dva sloupce, které se
 * skoro nikdy nečetly samostatně, a braly šířku informacím, na které se
 * redakce ptá častěji.
 */
export default async function AdminPromisesPage() {
  const rows = await listAdminPromises(db);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sliby</h1>
          <p className="text-muted text-sm">
            Publikované i rozpracované, celkem {rows.length}. Nahoře to, s čím se naposledy něco
            dělo.
          </p>
        </div>
        <Link
          href="/admin/promises/new"
          className="bg-accent text-accent-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          Nový kandidát
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="text-muted text-sm">Zatím není založený žádný slib.</p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-border bg-surface border-b text-left">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Slib
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Hodnocení
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Revize
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Poslední pohyb
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Veřejné
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((row) => (
                <PromiseRow key={row.slug} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PromiseRow({ row }: { row: AdminPromiseRow }) {
  return (
    <tr>
      <td className="px-4 py-3">
        <Link
          href={`/admin/promises/${row.slug}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {row.title}
        </Link>
        <p className="text-muted text-xs">
          {row.listShortName} · {TOPIC_LABELS[row.topic]}
        </p>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        {row.latestState ? (
          <>
            <span className="tabular-nums">v{row.latestVersion}</span> ·{" "}
            {WORKFLOW_STATE_LABELS[row.latestState]}
          </>
        ) : (
          <span className="text-muted">Zatím žádné</span>
        )}
      </td>

      <td className="px-4 py-3">
        {row.reviewerName ?? <span className="text-muted">Zatím nikdo</span>}
      </td>

      {/* Přesné datum zůstává v titulku: stáří odpovídá na „je to naléhavé?",
          datum na „co se tehdy dělo?". */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span title={formatTimestamp(row.latestActivityAt)}>{formatAgo(row.latestActivityAt)}</span>
      </td>

      <td className="px-4 py-3">{row.published ? "Ano" : "Ne"}</td>
    </tr>
  );
}
