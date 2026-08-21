import type { Metadata } from "next";
import Link from "next/link";

import { createSourceAction } from "@/app/admin/actions";
import { AdminForm } from "@/app/admin/_components/AdminForm";
import { Field, Select, TextArea, TextInput } from "@/app/admin/_components/fields";
import { db } from "@/db/client";
import { sourceTypeEnum } from "@/db/enums";
import { listAdminSources } from "@/modules/review/adminQueries";
import { SOURCE_TYPE_LABELS } from "@/modules/sources/labels";
import { formatDate } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Zdroje", robots: { index: false } };

const PROCESSING_LABELS: Record<string, string> = {
  PENDING: "Čeká na zpracování",
  PROCESSING: "Zpracovává se",
  REVIEW_REQUIRED: "Ke kontrole",
  FAILED: "Zpracování selhalo",
  PUBLISHED: "Zpracováno",
};

export default async function AdminSourcesPage() {
  const sources = await listAdminSources(db);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Zdrojové dokumenty</h1>
        <p className="text-muted text-sm">
          Bez zdroje nemůže vzniknout žádné publikované tvrzení. Provenience se po uložení
          nepřepisuje.
        </p>
      </header>

      <section aria-labelledby="novy" className="border-border space-y-4 rounded-lg border p-5">
        <h2 id="novy" className="text-lg font-semibold">
          Nový zdroj
        </h2>

        <AdminForm action={createSourceAction} submitLabel="Uložit zdroj" variant="primary">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Typ dokumentu" required>
              <Select
                name="sourceType"
                required
                options={sourceTypeEnum.enumValues.map((value) => ({
                  value,
                  label: SOURCE_TYPE_LABELS[value],
                }))}
              />
            </Field>
            <Field label="Vydavatel" hint="Kdo dokument vydal." required>
              <TextInput name="publisher" required maxLength={200} />
            </Field>
          </div>

          <Field label="Název dokumentu" required>
            <TextInput name="title" required maxLength={500} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="URL" hint="Adresa, odkud dokument pochází.">
              <TextInput type="url" name="url" maxLength={2000} />
            </Field>
            <Field label="Datum vydání">
              <TextInput type="date" name="publishedAt" />
            </Field>
          </div>

          <Field
            label="Nakládání s textem"
            hint="Volební programy, koaliční smlouvy a usnesení ukládáme celé. U chráněných děl (články) jen odkaz a citát."
            required
          >
            <Select
              name="licenseMode"
              required
              options={[
                { value: "FULL_TEXT_STORED", label: "Ukládáme plný text" },
                { value: "QUOTE_ONLY", label: "Jen odkaz a citát" },
              ]}
            />
          </Field>

          <Field
            label="Text dokumentu"
            hint="Vyplň jen u dokumentů s plným textem. Citace slibů a důkazů se proti němu ověřují doslova."
          >
            <TextArea name="rawText" rows={10} />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isDemo" />
            Smyšlený dokument z ukázkového datasetu
          </label>
        </AdminForm>
      </section>

      <section aria-labelledby="seznam" className="space-y-3">
        <h2 id="seznam" className="text-lg font-semibold">
          Uložené zdroje ({sources.length})
        </h2>

        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-border bg-surface border-b text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Dokument</th>
                <th className="px-4 py-2 font-medium">Typ</th>
                <th className="px-4 py-2 font-medium">Vydáno</th>
                <th className="px-4 py-2 font-medium">Stav</th>
                <th className="px-4 py-2 font-medium">Použití</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {sources.map((source) => (
                <tr key={source.id}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/sources/${source.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {source.title}
                    </Link>
                    {source.isDemo ? <span className="text-muted"> (demo)</span> : null}
                    <span className="text-muted block text-xs">{source.publisher}</span>
                  </td>
                  <td className="px-4 py-2">{SOURCE_TYPE_LABELS[source.sourceType]}</td>
                  <td className="px-4 py-2 tabular-nums">{formatDate(source.publishedAt)}</td>
                  <td className="px-4 py-2">
                    {PROCESSING_LABELS[source.processingState] ?? source.processingState}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{source.usageCount}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
