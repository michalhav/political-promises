import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db/client";
import { TOPIC_LABELS } from "@/modules/promises/labels";
import { listAdminPromises } from "@/modules/review/adminQueries";
import { WORKFLOW_STATE_LABELS } from "@/modules/review/workflow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sliby v redakci", robots: { index: false } };

export default async function AdminPromisesPage() {
  const rows = await listAdminPromises(db);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sliby</h1>
          <p className="text-muted text-sm">Publikované i rozpracované, celkem {rows.length}.</p>
        </div>
        <Link
          href="/admin/promises/new"
          className="bg-accent text-accent-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          Nový kandidát
        </Link>
      </header>

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-border bg-surface border-b text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Slib</th>
              <th className="px-4 py-2 font-medium">Kandidátka</th>
              <th className="px-4 py-2 font-medium">Téma</th>
              <th className="px-4 py-2 font-medium">Hodnocení</th>
              <th className="px-4 py-2 font-medium">Veřejné</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/promises/${row.slug}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {row.title}
                  </Link>
                </td>
                <td className="px-4 py-2">{row.listShortName}</td>
                <td className="px-4 py-2">{TOPIC_LABELS[row.topic]}</td>
                <td className="px-4 py-2">
                  {row.latestState
                    ? `v${row.latestVersion} · ${WORKFLOW_STATE_LABELS[row.latestState]}`
                    : "Zatím žádné"}
                </td>
                <td className="px-4 py-2">{row.published ? "Ano" : "Ne"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
