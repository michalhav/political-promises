import {
  acceptEvidenceSuggestionAction,
  matchEvidenceAction,
  rejectSuggestionAction,
  scanEvidenceAction,
} from "@/app/admin/actions";
import { AdminForm } from "@/app/admin/_components/AdminForm";
import { Field, Select, TextInput } from "@/app/admin/_components/fields";
import { RELATION_TYPE_LABELS } from "@/modules/sources/labels";
import { relationTypeEnum } from "@/db/enums";
import type { EvidenceSuggestionRow } from "@/modules/review/suggestions";

/**
 * Fronta návrhů důkazů.
 *
 * Návrh říká „tenhle úryvek něco dokládá k tomuhle slibu". Redaktor rozhoduje
 * dvě věci: jestli to platí, a **jakou roli** ten důkaz má — jestli dokládá
 * průběh, výsledek, nebo je jen kontext. Model roli navrhuje, ale poslední
 * slovo má člověk, protože právě na téhle rozvaze stojí hodnocení.
 *
 * Připojený důkaz vzniká jako ověřený člověkem, pod jménem toho, kdo ho vzal.
 */
export function EvidenceSuggestions({
  sourceDocumentId,
  suggestions,
  canRun,
}: {
  sourceDocumentId: string;
  suggestions: EvidenceSuggestionRow[];
  canRun: boolean;
}) {
  const pending = suggestions.filter((row) => row.status === "PENDING");
  const decided = suggestions.filter((row) => row.status !== "PENDING");

  return (
    <section aria-labelledby="navrhy-dukazu" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id="navrhy-dukazu" className="text-lg font-semibold">
          Návrhy důkazů
        </h2>
        {canRun ? (
          <div className="flex flex-wrap gap-2">
            {/* Lexikální průchod je zdarma a okamžitý, proto stojí první. Model
                se vyplatí až tam, kde shoda slov nestačí. */}
            <AdminForm action={scanEvidenceAction} submitLabel="Projít všechny sliby">
              <input type="hidden" name="sourceDocumentId" value={sourceDocumentId} />
            </AdminForm>
            <AdminForm action={matchEvidenceAction} submitLabel="Hledat modelem">
              <input type="hidden" name="sourceDocumentId" value={sourceDocumentId} />
            </AdminForm>
          </div>
        ) : null}
      </div>

      <p className="text-muted text-sm">
        <strong>Projít všechny sliby</strong> porovná dokument se všemi sliby podle výrazů z jejich
        citací — je to okamžité, zdarma a u každého nálezu je vidět, kvůli kterým slovům prošel.{" "}
        <strong>Hledat modelem</strong> pošle dokument jazykovému modelu; ten pozná i souvislost bez
        shody slov, ale stojí peníze. Obojí končí jako návrh, který připojí až člověk.
      </p>

      {pending.length === 0 ? (
        <p className="text-muted text-sm">Žádný návrh důkazu nečeká na rozhodnutí.</p>
      ) : (
        <ul className="space-y-4">
          {pending.map((suggestion) => (
            <li key={suggestion.id} className="border-border space-y-3 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="font-medium">{suggestion.promiseTitle}</p>
                <p className="text-muted text-xs">
                  Navrženo jako: {RELATION_TYPE_LABELS[suggestion.relationType]} ·{" "}
                  {suggestion.provider}/{suggestion.model}
                </p>
              </div>

              <blockquote className="border-border border-l-2 pl-3 text-sm">
                {suggestion.excerpt}
              </blockquote>

              <p className="text-muted text-sm">{suggestion.explanation}</p>
              {suggestion.limitationNote ? (
                <p className="text-sm">
                  <span className="font-medium">Co z toho neplyne: </span>
                  {suggestion.limitationNote}
                </p>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <AdminForm action={acceptEvidenceSuggestionAction} submitLabel="Připojit důkaz">
                  <input type="hidden" name="suggestionId" value={suggestion.id} />
                  <input type="hidden" name="sourceDocumentId" value={sourceDocumentId} />
                  <Field label="Vztah ke slibu" required>
                    <Select
                      name="relationType"
                      required
                      defaultValue={suggestion.relationType}
                      options={relationTypeEnum.enumValues.map((value) => ({
                        value,
                        label: RELATION_TYPE_LABELS[value],
                      }))}
                    />
                  </Field>
                </AdminForm>

                <AdminForm action={rejectSuggestionAction} submitLabel="Odmítnout">
                  <input type="hidden" name="suggestionId" value={suggestion.id} />
                  <Field label="Důvod odmítnutí" required>
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
            Rozhodnuté návrhy důkazů ({decided.length})
          </summary>
          <ul className="divide-border mt-3 divide-y text-sm">
            {decided.map((suggestion) => (
              <li key={suggestion.id} className="space-y-1 py-3">
                <p>
                  <span className="font-medium">{suggestion.promiseTitle}</span>{" "}
                  <span className="text-muted">
                    · {suggestion.status === "ACCEPTED" ? "připojeno" : "odmítnuto"}
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
