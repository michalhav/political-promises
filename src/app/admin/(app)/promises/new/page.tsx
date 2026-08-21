import type { Metadata } from "next";

import { createPromiseAction } from "@/app/admin/actions";
import { AdminForm } from "@/app/admin/_components/AdminForm";
import { Field, Select, TextArea, TextInput } from "@/app/admin/_components/fields";
import { db } from "@/db/client";
import { topicEnum } from "@/db/enums";
import { TOPIC_LABELS } from "@/modules/promises/labels";
import { listElectoralListChoices, listSourceChoices } from "@/modules/review/adminQueries";
import { SOURCE_TYPE_LABELS } from "@/modules/sources/labels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nový kandidát na slib", robots: { index: false } };

export default async function NewPromisePage() {
  const [lists, sources] = await Promise.all([listElectoralListChoices(db), listSourceChoices(db)]);

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Nový kandidát na slib</h1>
        <p className="text-muted text-sm">
          Vzniká jako nepublikovaný. Publikovat ho půjde teprve přes hodnocení, které schválí někdo
          jiný.
        </p>
      </header>

      {sources.length === 0 ? (
        <p className="border-border rounded-md border border-dashed p-4 text-sm">
          Nejdřív je potřeba založit zdrojový dokument. Bez něj nemá slib původ.
        </p>
      ) : (
        <AdminForm action={createPromiseAction} submitLabel="Založit kandidáta" variant="primary">
          <Field label="Kandidátka" hint="Slib patří kandidátce, ne straně." required>
            <Select
              name="electoralListId"
              required
              options={lists.map((list) => ({ value: list.id, label: list.name }))}
            />
          </Field>

          <Field label="Krátký název" hint="Zobrazuje se v přehledu a na kartě." required>
            <TextInput name="title" required maxLength={300} />
          </Field>

          <Field
            label="Adresa (slug)"
            hint="Malá písmena bez diakritiky a pomlčky. Po publikaci se nemění."
            required
          >
            <TextInput name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} />
          </Field>

          <Field label="Téma" required>
            <Select
              name="topic"
              required
              options={topicEnum.enumValues.map((value) => ({
                value,
                label: TOPIC_LABELS[value],
              }))}
            />
          </Field>

          <fieldset className="border-border space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Původ ze zdroje</legend>

            <Field label="Zdrojový dokument" required>
              <Select
                name="sourceDocumentId"
                required
                options={sources.map((source) => ({
                  value: source.id,
                  label: `${SOURCE_TYPE_LABELS[source.sourceType]} — ${source.title}`,
                }))}
              />
            </Field>

            <Field
              label="Citace ze zdroje"
              hint="Zkopíruj přesně. U dokumentů s uloženým textem se shoda ověřuje doslova."
              required
            >
              <TextArea name="sourceExcerpt" required rows={4} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Strana">
                <TextInput type="number" name="sourcePageNumber" min={1} />
              </Field>
              <Field label="Místo v dokumentu" hint="Např. kapitola nebo bod programu.">
                <TextInput name="sourceLocator" maxLength={200} />
              </Field>
            </div>
          </fieldset>

          <Field
            label="Doslovné znění slibu"
            hint="Musí být obsaženo v citaci výše. Po publikaci se už nikdy nemění."
            required
          >
            <TextArea name="originalText" required rows={3} />
          </Field>

          <Field
            label="Přepis do ověřitelné podoby"
            hint="Nepovinné. Nenahrazuje původní znění, jen upřesňuje, co by znamenalo splnění."
          >
            <TextArea name="normalizedStatement" rows={3} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Termín podle zdroje" hint="Tak, jak ho uvádí dokument.">
              <TextInput name="deadlineText" maxLength={200} />
            </Field>
            <Field label="Termín jako datum" hint="Jen když to jde bez dohadů.">
              <TextInput type="date" name="deadlineOn" />
            </Field>
          </div>
        </AdminForm>
      )}
    </div>
  );
}
