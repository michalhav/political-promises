import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/db/client";
import { getAdminSource } from "@/modules/review/adminQueries";
import { SOURCE_TYPE_LABELS } from "@/modules/sources/labels";
import { formatDate, formatTimestamp } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Zdrojový dokument", robots: { index: false } };

export default async function AdminSourceDetailPage({ params }: PageProps<"/admin/sources/[id]">) {
  const { id } = await params;
  const source = await getAdminSource(db, id);

  if (!source) notFound();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-muted text-sm">{SOURCE_TYPE_LABELS[source.sourceType]}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{source.title}</h1>
        <p className="text-muted text-sm">
          {source.publisher}
          {source.isDemo ? " · smyšlený dokument z ukázkového datasetu" : null}
        </p>
      </header>

      <section aria-labelledby="provenience" className="space-y-3">
        <h2 id="provenience" className="text-lg font-semibold">
          Provenience
        </h2>
        <p className="text-muted text-sm">
          Tyhle údaje se po uložení nemění. Kdyby odkaz přestal fungovat, musí z nich jít doložit, s
          čím jsme v době publikace pracovali.
        </p>

        <dl className="divide-border border-border divide-y rounded-lg border">
          <Row label="Adresa">
            {source.url ? (
              <a
                href={source.url}
                className="break-all underline underline-offset-4"
                rel="noopener noreferrer nofollow"
                target="_blank"
              >
                {source.url}
              </a>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Vydáno">{formatDate(source.publishedAt)}</Row>
          <Row label="Staženo">{formatTimestamp(source.retrievedAt)}</Row>
          <Row label="Otisk obsahu (SHA-256)">
            <code className="font-mono text-xs break-all">{source.contentHash}</code>
          </Row>
          <Row label="Nakládání s textem">
            {source.licenseMode === "FULL_TEXT_STORED"
              ? "Uložen plný text"
              : "Jen odkaz a citát (chráněné dílo)"}
          </Row>
          <Row label="Počet stran">{source.pageCount ?? "—"}</Row>
          <Row label="Stav zpracování">{source.processingState}</Row>
          <Row label="Použito v záznamech">{source.usageCount}×</Row>
        </dl>

        {source.processingError ? (
          <p className="border-border rounded-md border border-dashed p-3 text-sm" role="alert">
            <span className="font-semibold">Chyba zpracování: </span>
            {source.processingError}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="text" className="space-y-3">
        <h2 id="text" className="text-lg font-semibold">
          Text dokumentu
        </h2>
        {source.rawText === null ? (
          <p className="text-muted text-sm">
            U tohoto dokumentu plný text neukládáme. Pracuje se jen s citacemi v jednotlivých
            důkazech.
          </p>
        ) : (
          <>
            <p className="text-muted text-sm">
              Text pochází z cizího zdroje a zobrazuje se jako prostý text, nikdy jako HTML. Citace
              slibů a důkazů se proti němu ověřují doslova.
            </p>
            {/* Vykresluje React jako textový uzel, takže se případné značky
                v dokumentu nikdy neprovedou (prompt injection, XSS). */}
            <pre className="border-border bg-surface max-h-[32rem] overflow-auto rounded-lg border p-4 text-sm whitespace-pre-wrap">
              {source.rawText}
            </pre>
          </>
        )}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[14rem_1fr]">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
