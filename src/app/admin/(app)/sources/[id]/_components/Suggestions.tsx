import {
  acceptSuggestionAction,
  extractPromisesAction,
  rejectSuggestionAction,
} from "@/app/admin/actions";
import { AdminForm } from "@/app/admin/_components/AdminForm";
import { Field, Select, TextInput } from "@/app/admin/_components/fields";
import { TOPIC_LABELS } from "@/modules/promises/labels";
import type { Topic } from "@/modules/promises/labels";
import type { SuggestionRow } from "@/modules/review/suggestions";
import { formatAgo } from "@/shared/format";

/**
 * Fronta návrhů od stroje.
 *
 * Návrh vypadá schválně jinak než slib: nemá vlastní stránku, nedá se
 * publikovat a jediné, co s ním jde udělat, je přijmout ho jako **kandidáta**,
 * nebo odmítnout s důvodem. Stroj tu nemá poslední slovo v ničem.
 *
 * Citace se zobrazuje celá a doslova. Redaktor ji má porovnat s textem
 * dokumentu o kus výš na téže stránce — ne věřit tomu, že model opsal správně.
 */
export function Suggestions({
  sourceDocumentId,
  suggestions,
  lists,
  canExtract,
}: {
  sourceDocumentId: string;
  suggestions: SuggestionRow[];
  lists: { id: string; name: string }[];
  canExtract: boolean;
}) {
  const pending = suggestions.filter((row) => row.status === "PENDING");
  const decided = suggestions.filter((row) => row.status !== "PENDING");

  return (
    <section aria-labelledby="navrhy" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id="navrhy" className="text-lg font-semibold">
          Návrhy kandidátů
        </h2>
        {canExtract ? (
          <AdminForm action={extractPromisesAction} submitLabel="Vytěžit kandidáty">
            <input type="hidden" name="sourceDocumentId" value={sourceDocumentId} />
          </AdminForm>
        ) : null}
      </div>

      <p className="text-muted text-sm">
        Stroj hledá v textu závazky a navrhuje je k revizi. Návrh, jehož citace v dokumentu doslova
        nestojí, se do fronty vůbec nedostane. Slibem se návrh stává až tím, že ho někdo přijme.
      </p>

      {pending.length === 0 ? (
        <p className="text-muted text-sm">Žádný návrh nečeká na rozhodnutí.</p>
      ) : (
        <ul className="space-y-4">
          {pending.map((suggestion) => (
            <li key={suggestion.id} className="border-border space-y-3 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="font-medium">{suggestion.suggestedTitle}</p>
                <p className="text-muted text-xs">
                  {TOPIC_LABELS[suggestion.topic as Topic] ?? suggestion.topic} ·{" "}
                  {suggestion.provider}/{suggestion.model} · {formatAgo(suggestion.createdAt)}
                </p>
              </div>

              <blockquote className="border-border border-l-2 pl-3 text-sm">
                {suggestion.sourceExcerpt}
              </blockquote>

              <p className="text-muted text-sm">{suggestion.reasoningSummary}</p>

              <div className="grid gap-4 lg:grid-cols-2">
                <AdminForm action={acceptSuggestionAction} submitLabel="Přijmout jako kandidáta">
                  <input type="hidden" name="suggestionId" value={suggestion.id} />
                  <Field label="Kandidátka" required>
                    <Select
                      name="electoralListId"
                      required
                      options={lists.map((list) => ({ value: list.id, label: list.name }))}
                    />
                  </Field>
                  <Field
                    label="Adresa (slug)"
                    hint="Malá písmena bez diakritiky, číslice a pomlčky."
                    required
                  >
                    <TextInput
                      name="slug"
                      required
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      maxLength={120}
                    />
                  </Field>
                  <Field label="Krátký název" hint="Prázdné = převezme se návrh stroje.">
                    <TextInput name="title" maxLength={300} />
                  </Field>
                </AdminForm>

                <AdminForm action={rejectSuggestionAction} submitLabel="Odmítnout">
                  <input type="hidden" name="suggestionId" value={suggestion.id} />
                  <Field
                    label="Důvod odmítnutí"
                    hint="Bez důvodu nepoznáme, jestli chyboval stroj, nebo je věta hraniční."
                    required
                  >
                    <TextInput name="note" required maxLength={2000} />
                  </Field>
                </AdminForm>
              </div>
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 ? (
        <details className="border-border rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Rozhodnuté návrhy ({decided.length})
          </summary>
          <ul className="divide-border mt-3 divide-y text-sm">
            {decided.map((suggestion) => (
              <li key={suggestion.id} className="space-y-1 py-3">
                <p>
                  <span className="font-medium">{suggestion.suggestedTitle}</span>{" "}
                  <span className="text-muted">
                    · {suggestion.status === "ACCEPTED" ? "přijato" : "odmítnuto"}
                  </span>
                </p>
                {suggestion.reviewNote ? (
                  <p className="text-muted">{suggestion.reviewNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
