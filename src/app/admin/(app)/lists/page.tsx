import type { Metadata } from "next";

import { createElectoralListAction, createPartyAction } from "@/app/admin/actions";
import { AdminForm } from "@/app/admin/_components/AdminForm";
import { Field, Select, TextInput } from "@/app/admin/_components/fields";
import { db } from "@/db/client";
import { getRegistryData, type RegistryList, type RegistryParty } from "@/modules/review/registry";
import { formatDate } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kandidátky", robots: { index: false } };

/**
 * Evidence stran a kandidátek.
 *
 * Bez téhle stránky nešel do systému dostat žádný skutečný subjekt — strany
 * i kandidátky vznikaly jedině seedem, takže onboarding znamenal ruční SQL.
 *
 * Strana a kandidátka se zakládají zvlášť, protože to jsou dvě různé věci:
 * kandidátka jde do voleb s programem a nese slib, strana ji tvoří a přežívá
 * ji. Koalice se založí tak, že se do kandidátky vybere víc stran.
 */
export default async function AdminListsPage() {
  const { elections, parties, lists } = await getRegistryData(db);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Kandidátky a strany</h1>
        <p className="text-muted text-sm">
          Slib patří kandidátce, ne straně — kandidátka totiž šla do voleb s programem. Koalici
          založíš tak, že do kandidátky vybereš víc stran.
        </p>
      </header>

      <section aria-labelledby="kandidatky" className="space-y-3">
        <h2 id="kandidatky" className="text-lg font-semibold">
          Kandidátky
        </h2>
        {lists.length === 0 ? (
          <p className="text-muted text-sm">Zatím žádná kandidátka.</p>
        ) : (
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-border bg-surface border-b text-left">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Kandidátka
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Volby
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Strany za ní
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Mandáty
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Slibů
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {lists.map((list) => (
                  <ListRow key={list.id} list={list} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="nova-kandidatka"
        className="border-border space-y-4 rounded-lg border p-5"
      >
        <h2 id="nova-kandidatka" className="text-lg font-semibold">
          Nová kandidátka
        </h2>

        {parties.length === 0 ? (
          <p className="text-muted text-sm">
            Nejdřív založ aspoň jednu stranu — bez ní není kandidátka za koho.
          </p>
        ) : (
          <AdminForm
            action={createElectoralListAction}
            submitLabel="Založit kandidátku"
            variant="primary"
          >
            <Field label="Volby" required>
              <Select
                name="electionId"
                required
                options={elections.map((election) => ({
                  value: election.id,
                  label: `${election.name} (${formatDate(election.electionDate)})`,
                }))}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Název" hint="Tak, jak stál na hlasovacím lístku." required>
                <TextInput name="name" required maxLength={200} />
              </Field>
              <Field label="Krátký název" hint="Zobrazuje se u slibů." required>
                <TextInput name="shortName" required maxLength={60} />
              </Field>
            </div>

            <Field
              label="Adresa (slug)"
              hint="Malá písmena bez diakritiky, číslice a pomlčky. Používá se ve filtru na webu."
              required
            >
              <TextInput name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Číslo na hlasovacím lístku">
                <TextInput type="number" name="ballotNumber" min={1} max={1000} />
              </Field>
              <Field label="Získané mandáty">
                <TextInput type="number" name="seatsWon" min={0} max={1000} />
              </Field>
            </div>

            <Field
              label="Strany za kandidátkou"
              hint="Vyber jednu, nebo víc u koalice. Pořadí výběru určuje pořadí zobrazení."
              required
            >
              <select
                name="partyIds"
                multiple
                required
                size={Math.min(parties.length, 6)}
                className="border-border bg-background w-full rounded-md border px-3 py-2"
              >
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                    {party.isDemo ? " (smyšlená)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </AdminForm>
        )}
      </section>

      <section aria-labelledby="strany" className="space-y-3">
        <h2 id="strany" className="text-lg font-semibold">
          Strany
        </h2>
        {parties.length === 0 ? (
          <p className="text-muted text-sm">Zatím žádná strana.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {parties.map((party) => (
              <PartyRow key={party.id} party={party} />
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="nova-strana"
        className="border-border space-y-4 rounded-lg border p-5"
      >
        <h2 id="nova-strana" className="text-lg font-semibold">
          Nová strana
        </h2>

        <AdminForm action={createPartyAction} submitLabel="Založit stranu">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Název" required>
              <TextInput name="name" required maxLength={200} />
            </Field>
            <Field label="Krátký název" required>
              <TextInput name="shortName" required maxLength={60} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adresa (slug)" required>
              <TextInput name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} />
            </Field>
            <Field label="IČO" hint="Registrační číslo, pokud ho známe.">
              <TextInput name="registrationId" maxLength={60} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isDemo" className="size-4" />
            Smyšlená strana z ukázkového datasetu
          </label>
        </AdminForm>
      </section>
    </div>
  );
}

function ListRow({ list }: { list: RegistryList }) {
  return (
    <tr>
      <td className="px-4 py-2">
        <span className="font-medium">{list.name}</span>
        <p className="text-muted text-xs">
          {list.shortName} · /{list.slug}
          {list.ballotNumber ? ` · č. ${list.ballotNumber}` : ""}
        </p>
      </td>
      <td className="px-4 py-2">{list.electionName}</td>
      <td className="px-4 py-2">{list.partyNames}</td>
      <td className="px-4 py-2 tabular-nums">{list.seatsWon ?? "—"}</td>
      <td className="px-4 py-2 tabular-nums">{list.promiseCount}</td>
    </tr>
  );
}

function PartyRow({ party }: { party: RegistryParty }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
      <span className="font-medium">{party.name}</span>
      <span className="text-muted text-sm">
        {party.shortName} · /{party.slug}
        {party.isDemo ? " · smyšlená" : ""}
      </span>
    </li>
  );
}
