"use client";

import { useActionState } from "react";

import type { CorrectionFormResult } from "@/app/(public)/promises/actions";

/**
 * Formulář pro podnět nebo reakci kandidátky.
 *
 * Je schválně schovaný v `<details>`: většina čtenářů ho nepotřebuje a
 * roztažený formulář pod hodnocením by odváděl pozornost od toho, co je na
 * stránce podstatné. Kdo se chce ozvat, ten ho najde.
 *
 * Text říká rovnou, co se s podáním stane. Slibovat „ozveme se vám" by bylo
 * nepoctivé — redakce má na podnět reagovat zveřejněním, ne odpovědí do mailu.
 */
export function CorrectionForm({
  promiseSlug,
  action,
}: {
  promiseSlug: string;
  action: (formData: FormData) => Promise<CorrectionFormResult>;
}) {
  const [state, formAction, pending] = useActionState<CorrectionFormResult | null, FormData>(
    async (_previous, formData) => action(formData),
    null,
  );

  return (
    <details className="border-border rounded-lg border p-5">
      <summary className="cursor-pointer font-medium">Máte k tomuhle slibu co dodat?</summary>

      <div className="mt-4 space-y-4">
        <p className="text-muted prose-measure text-sm">
          Když se domníváte, že je hodnocení nepřesné, napište nám. Reakci kandidátky, které se slib
          týká, zveřejníme i tehdy, když s ní nesouhlasíme. Podnět se na stránce objeví až poté, co
          ho redakce projde — ne hned po odeslání.
        </p>

        {state?.ok ? (
          <p role="status" className="text-sm font-medium">
            Děkujeme, podnět jsme přijali. Redakce ho projde a případnou reakci zveřejní u slibu.
          </p>
        ) : (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="promiseSlug" value={promiseSlug} />

            <label className="block space-y-1">
              <span className="text-sm font-medium">Píšete jako</span>
              <select
                name="kind"
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="PUBLIC_CORRECTION">Čtenář — mám podnět k hodnocení</option>
                <option value="PARTY_RESPONSE">Kandidátka, které se slib týká</option>
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium">Jméno</span>
                <input
                  name="submitterName"
                  maxLength={200}
                  className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Organizace</span>
                <input
                  name="submitterOrganization"
                  maxLength={200}
                  className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium">E-mail</span>
              <input
                type="email"
                name="submitterEmail"
                maxLength={320}
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
              <span className="text-muted block text-xs">
                Nezveřejňujeme ho. Slouží jen k tomu, abychom si mohli ověřit, kdo píše.
              </span>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">
                Co je podle vás špatně <span aria-hidden="true">*</span>
              </span>
              <textarea
                name="body"
                required
                minLength={20}
                maxLength={8000}
                rows={5}
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
              <span className="text-muted block text-xs">
                Nejvíc pomůže odkaz na dokument — usnesení, smlouvu, zprávu.
              </span>
            </label>

            {state?.errors && state.errors.length > 0 ? (
              <div
                role="alert"
                className="border-border rounded-md border border-dashed p-3 text-sm"
              >
                <p className="font-semibold">Odeslání neproběhlo</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {state.errors.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="border-border rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending ? "Odesílám…" : "Odeslat podnět"}
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
