import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addPromiseEventAction,
  generateSearchProfileAction,
  saveSearchProfileAction,
  attachEvidenceAction,
  createAssessmentAction,
  createCorrectionAction,
  detachEvidenceAction,
  publishAssessmentAction,
  resolveCorrectionAction,
  transitionAssessmentAction,
  updateAssessmentAction,
  updatePromiseAction,
} from "@/app/admin/actions";
import { AdminForm } from "@/app/admin/_components/AdminForm";
import { Field, ScoreInput, Select, TextArea, TextInput } from "@/app/admin/_components/fields";
import { db } from "@/db/client";
import {
  eventTypeEnum,
  executionStatusEnum,
  outcomeStatusEnum,
  relationTypeEnum,
  topicEnum,
} from "@/db/enums";
import { requireEditorialUser } from "@/modules/accounts/auth";
import { ASSESSABILITY_DIMENSIONS } from "@/modules/assessments/dimensions";
import {
  ASSESSABILITY_LABELS,
  EXECUTION_STATUS_LABELS,
  OUTCOME_STATUS_LABELS,
} from "@/modules/assessments/labels";
import { loadSearchProfile } from "@/modules/ai/searchProfile";
import { EVENT_TYPE_LABELS, TOPIC_LABELS } from "@/modules/promises/labels";
import {
  getAdminPromiseDetail,
  listSourceChoices,
  type AdminAssessmentRow,
} from "@/modules/review/adminQueries";
import { checkPublicationReadiness } from "@/modules/review/service";
import { availableActions, WORKFLOW_STATE_LABELS } from "@/modules/review/workflow";
import { RELATION_TYPE_LABELS, SOURCE_TYPE_LABELS } from "@/modules/sources/labels";
import { formatDate, formatTimestamp } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Slib v redakci", robots: { index: false } };

const EXECUTION_OPTIONS = executionStatusEnum.enumValues.map((value) => ({
  value,
  label: EXECUTION_STATUS_LABELS[value].label,
}));

const OUTCOME_OPTIONS = outcomeStatusEnum.enumValues.map((value) => ({
  value,
  label: OUTCOME_STATUS_LABELS[value].label,
}));

export default async function AdminPromiseDetailPage({
  params,
}: PageProps<"/admin/promises/[slug]">) {
  const { slug } = await params;
  const [user, promise, sources] = await Promise.all([
    requireEditorialUser(),
    getAdminPromiseDetail(db, slug),
    listSourceChoices(db),
  ]);

  if (!promise) notFound();

  const searchProfile = await loadSearchProfile(db, promise.id);
  /** Profil se edituje jako text: jeden výraz na řádek. */
  const asLines = (values: string[] | undefined): string => (values ?? []).join("\n");

  const latest = promise.assessments[0] ?? null;
  const working = latest && latest.workflowState !== "PUBLISHED" ? latest : null;
  const published = promise.assessments.find((row) => row.isCurrent) ?? null;

  const actions = working
    ? availableActions({
        currentState: working.workflowState,
        authorId: working.authorId,
        actorId: user.id,
      })
    : [];

  const readiness =
    working && working.workflowState === "APPROVED"
      ? await checkPublicationReadiness(db, working.id)
      : null;

  const verifiedEvidence = promise.evidence.filter((item) => item.humanVerified);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-muted text-sm">
          <Link href="/admin/promises" className="underline underline-offset-4">
            Sliby
          </Link>
          {" · "}
          {promise.listShortName} · {TOPIC_LABELS[promise.topic]}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{promise.title}</h1>
        <p className="text-muted text-sm">
          {promise.published ? (
            <>
              Veřejné od {formatTimestamp(promise.publishedAt)} ·{" "}
              <Link href={`/promises/${promise.slug}`} className="underline underline-offset-4">
                zobrazit veřejnou stránku
              </Link>
            </>
          ) : (
            "Nepublikováno — veřejně není vidět."
          )}
          {working
            ? ` · Rozpracované hodnocení v${working.version}: ${WORKFLOW_STATE_LABELS[working.workflowState]}`
            : null}
        </p>
      </header>

      <Section id="slib" title="Slib">
        <blockquote className="border-accent border-l-2 pl-4">{promise.originalText}</blockquote>
        <p className="text-muted text-xs">
          Doslovné znění. Po publikaci ho nelze změnit ani přes databázi.
        </p>

        {promise.primarySource ? (
          <div className="border-border space-y-1 rounded-lg border p-4 text-sm">
            <p className="text-muted text-xs tracking-wide uppercase">Primární zdroj</p>
            <p>
              <Link
                href={`/admin/sources/${promise.primarySource.sourceId}`}
                className="underline underline-offset-4"
              >
                {promise.primarySource.sourceTitle}
              </Link>
            </p>
            <p className="text-muted">
              {[
                promise.primarySource.locator,
                promise.primarySource.pageNumber === null
                  ? null
                  : `s. ${promise.primarySource.pageNumber}`,
              ]
                .filter(Boolean)
                .join(", ") || "bez určení místa"}
            </p>
            <blockquote className="border-border mt-2 border-l-2 pl-3 italic">
              {promise.primarySource.excerpt}
            </blockquote>
          </div>
        ) : (
          <p role="alert" className="border-border rounded-md border border-dashed p-3 text-sm">
            Slib nemá primární zdroj. Bez něj nepůjde publikovat.
          </p>
        )}

        {promise.published ? (
          <p className="text-muted text-sm">
            Publikovaný slib se upravuje jen novou verzí hodnocení nebo korekcí.
          </p>
        ) : (
          <details className="border-border rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-medium">Upravit kandidáta</summary>
            <div className="mt-4">
              <AdminForm action={updatePromiseAction} submitLabel="Uložit">
                <input type="hidden" name="promiseId" value={promise.id} />
                <input type="hidden" name="slug" value={promise.slug} />

                <Field label="Krátký název" required>
                  <TextInput name="title" defaultValue={promise.title} required maxLength={300} />
                </Field>
                <Field label="Téma" required>
                  <Select
                    name="topic"
                    defaultValue={promise.topic}
                    required
                    options={topicEnum.enumValues.map((value) => ({
                      value,
                      label: TOPIC_LABELS[value],
                    }))}
                  />
                </Field>
                <Field label="Přepis do ověřitelné podoby">
                  <TextArea
                    name="normalizedStatement"
                    defaultValue={promise.normalizedStatement ?? ""}
                    rows={3}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Termín podle zdroje">
                    <TextInput name="deadlineText" defaultValue={promise.deadlineText ?? ""} />
                  </Field>
                  <Field label="Termín jako datum">
                    <TextInput
                      type="date"
                      name="deadlineOn"
                      defaultValue={promise.deadlineOn ?? ""}
                    />
                  </Field>
                </div>
              </AdminForm>
            </div>
          </details>
        )}
      </Section>

      <Section
        id="dukazy"
        title={`Důkazy (${verifiedEvidence.length} ověřených z ${promise.evidence.length})`}
      >
        <p className="text-muted text-sm">
          Dokument říká fakt. Vazba říká, proč je ten fakt pro tenhle slib podstatný. Závěr z toho
          vyvozuje až hodnocení — proto jsou to tři různé věci, ne jedno textové pole.
        </p>

        {promise.evidence.length === 0 ? (
          <p className="text-muted text-sm">Zatím žádný důkaz.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {promise.evidence.map((item) => (
              <li key={item.linkId} className="space-y-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {RELATION_TYPE_LABELS[item.relationType]}
                    {!item.humanVerified ? (
                      <span className="text-muted"> · neověřeno, veřejně skryto</span>
                    ) : null}
                  </span>
                  <Link
                    href={`/admin/sources/${item.sourceId}`}
                    className="text-muted underline underline-offset-4"
                  >
                    {item.sourceTitle}
                  </Link>
                </div>
                <blockquote className="border-border border-l-2 pl-3 italic">
                  {item.excerpt}
                </blockquote>
                {item.note ? <p className="text-muted">{item.note}</p> : null}
                {!promise.published ? (
                  <AdminForm
                    action={detachEvidenceAction}
                    submitLabel="Odebrat"
                    variant="danger"
                    confirm="Opravdu odebrat tuto vazbu na důkaz?"
                  >
                    <input type="hidden" name="linkId" value={item.linkId} />
                    <input type="hidden" name="slug" value={promise.slug} />
                  </AdminForm>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <details className="border-border rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Profil hledání {searchProfile ? "" : "(zatím nevyplněný)"}
          </summary>
          <div className="mt-4 space-y-3">
            <p className="text-muted text-sm">
              Podle čeho se k tomuhle slibu hledají doklady v úředních datech. Úřad pojmenovává
              stavby jinak než volební program — &bdquo;Štvanická lávka&ldquo; je v zakázkách
              &bdquo;Lávka Holešovice – Karlín&ldquo;. Co sem napíšeš jednou, platí při každém
              dalším průchodu daty.
            </p>
            {searchProfile ? (
              <p className="text-muted text-xs">
                Naposledy upravil: {searchProfile.generatedBy === "human" ? "člověk" : "stroj"}.
              </p>
            ) : null}

            <AdminForm action={saveSearchProfileAction} submitLabel="Uložit profil">
              <input type="hidden" name="promiseId" value={promise.id} />
              <input type="hidden" name="slug" value={promise.slug} />

              <Field label="Vlastní jména" hint="Jedno na řádek. Stavby, místa, projekty.">
                <TextArea name="names" defaultValue={asLines(searchProfile?.names)} />
              </Field>
              <Field
                label="Jiná pojmenování"
                hint="Hlavně úřední názvy téhož — podle nich dokument mluví."
              >
                <TextArea name="synonyms" defaultValue={asLines(searchProfile?.synonyms)} />
              </Field>
              <Field label="Vyloučit" hint="Slova, po kterých nález skoro jistě nesouvisí.">
                <TextArea name="excluded" defaultValue={asLines(searchProfile?.excluded)} />
              </Field>
            </AdminForm>

            <AdminForm action={generateSearchProfileAction} submitLabel="Navrhnout strojem">
              <input type="hidden" name="promiseId" value={promise.id} />
              <input type="hidden" name="slug" value={promise.slug} />
            </AdminForm>
          </div>
        </details>

        <details className="border-border rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">Přidat na časovou osu</summary>
          <div className="mt-4 space-y-3">
            <p className="text-muted text-sm">
              Časová osa odpovídá na otázku, co se se slibem od voleb dělo. Připojit jde jen důkaz,
              který u slibu už visí — bez něj je událost jen tvrzení redakce.
            </p>
            <AdminForm action={addPromiseEventAction} submitLabel="Přidat událost">
              <input type="hidden" name="promiseId" value={promise.id} />
              <input type="hidden" name="slug" value={promise.slug} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Co se stalo" required>
                  <Select
                    name="eventType"
                    required
                    options={eventTypeEnum.enumValues.map((value) => ({
                      value,
                      label: EVENT_TYPE_LABELS[value],
                    }))}
                  />
                </Field>
                <Field label="Kdy" required>
                  <TextInput type="date" name="eventDate" required />
                </Field>
              </div>

              <Field label="Popis události" hint="Krátce a věcně, bez hodnocení." required>
                <TextInput name="title" required maxLength={300} />
              </Field>

              <Field label="Podrobnosti">
                <TextArea name="description" maxLength={4000} />
              </Field>

              {promise.evidence.length > 0 ? (
                <Field
                  label="Doloženo důkazem"
                  hint="Bez doloženého zdroje je událost jen tvrzení."
                >
                  <select
                    name="evidenceIds"
                    multiple
                    size={Math.min(promise.evidence.length, 4)}
                    className="border-border bg-background w-full rounded-md border px-3 py-2"
                  >
                    {promise.evidence.map((item) => (
                      <option key={item.linkId} value={item.evidenceId}>
                        {item.sourceTitle} — {item.excerpt.slice(0, 70)}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-muted text-sm">
                  U slibu zatím není žádný důkaz, takže událost nepůjde doložit.
                </p>
              )}
            </AdminForm>
          </div>
        </details>

        <details className="border-border rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">Připojit důkaz</summary>
          <div className="mt-4">
            <AdminForm action={attachEvidenceAction} submitLabel="Připojit důkaz">
              <input type="hidden" name="promiseId" value={promise.id} />
              <input type="hidden" name="slug" value={promise.slug} />

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
              <Field label="Citace ze zdroje" hint="Doslova, včetně interpunkce." required>
                <TextArea name="excerpt" required rows={3} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Strana">
                  <TextInput type="number" name="pageNumber" min={1} />
                </Field>
                <Field label="Místo v dokumentu">
                  <TextInput name="locator" maxLength={200} />
                </Field>
                <Field label="Vztah ke slibu" required>
                  <Select
                    name="relationType"
                    required
                    options={relationTypeEnum.enumValues.map((value) => ({
                      value,
                      label: RELATION_TYPE_LABELS[value],
                    }))}
                  />
                </Field>
              </div>
              <Field label="Co zdroj dokládá" hint="Proč je tenhle zdroj pro slib podstatný.">
                <TextArea name="note" rows={2} />
              </Field>
              <Field
                label="Co z něj nelze vyvodit"
                hint="Kam už zdroj nesahá. Nejcennější věta celého důkazu — bez ní se tvrzení tváří doložitelněji, než je."
              >
                <TextArea name="limitationNote" rows={2} />
              </Field>
            </AdminForm>
          </div>
        </details>
      </Section>

      <Section id="hodnoceni" title="Hodnocení">
        {working ? (
          <>
            <AssessmentSummary assessment={working} />

            {working.workflowState === "CHANGES_REQUESTED" || working.workflowState === "DRAFT" ? (
              working.authorId === user.id ? (
                <details className="border-border rounded-lg border p-4" open>
                  <summary className="cursor-pointer text-sm font-medium">
                    Upravit hodnocení
                  </summary>
                  <div className="mt-4">
                    <AdminForm action={updateAssessmentAction} submitLabel="Uložit hodnocení">
                      <input type="hidden" name="assessmentId" value={working.id} />
                      <input type="hidden" name="slug" value={promise.slug} />
                      <AssessmentFields assessment={working} defaultCutoff={today} />
                    </AdminForm>
                  </div>
                </details>
              ) : (
                <p className="text-muted text-sm">
                  Hodnocení píše {working.authorName}. Upravit ho může jen autor — když je potřeba
                  změna, vrať mu ho s poznámkou.
                </p>
              )
            ) : null}

            <div className="border-border space-y-4 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Revize</h3>

              {actions.length === 0 ? (
                <p className="text-muted text-sm">
                  {working.authorId === user.id
                    ? "Vlastní hodnocení schválit nemůžeš. Musí to udělat někdo jiný z redakce."
                    : "Teď tu pro tebe není žádná akce."}
                </p>
              ) : null}

              {actions.includes("SUBMIT") ? (
                <AdminForm
                  action={transitionAssessmentAction}
                  submitLabel="Předat k revizi"
                  variant="primary"
                >
                  <input type="hidden" name="assessmentId" value={working.id} />
                  <input type="hidden" name="slug" value={promise.slug} />
                  <input type="hidden" name="action" value="SUBMIT" />
                </AdminForm>
              ) : null}

              {actions.includes("APPROVE") ? (
                <AdminForm
                  action={transitionAssessmentAction}
                  submitLabel="Schválit"
                  variant="primary"
                >
                  <input type="hidden" name="assessmentId" value={working.id} />
                  <input type="hidden" name="slug" value={promise.slug} />
                  <input type="hidden" name="action" value="APPROVE" />
                  {/* B3: čtyři oči hlídají, že neschvaluje autor. Že recenzent
                      není z téže kandidátky, nehlídá nic — proto prohlášení. */}
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="conflictFree" required className="mt-1 size-4" />
                    <span>
                      Prohlašuji, že k tomuto slibu ani ke kandidátce nemám vztah, který by mi
                      bránil rozhodovat.
                    </span>
                  </label>
                </AdminForm>
              ) : null}

              {actions.includes("REQUEST_CHANGES") ? (
                <AdminForm action={transitionAssessmentAction} submitLabel="Vrátit k přepracování">
                  <input type="hidden" name="assessmentId" value={working.id} />
                  <input type="hidden" name="slug" value={promise.slug} />
                  <input type="hidden" name="action" value="REQUEST_CHANGES" />
                  <Field label="Co je potřeba změnit" required>
                    <TextArea name="note" required rows={3} />
                  </Field>
                </AdminForm>
              ) : null}

              {working.workflowState === "APPROVED" ? (
                <div className="space-y-3">
                  {readiness && !readiness.ready ? (
                    <div
                      role="alert"
                      className="border-border rounded-md border border-dashed p-3 text-sm"
                    >
                      <p className="font-semibold">Publikaci brání:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {readiness.issues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-muted text-sm">Podmínky publikace jsou splněné.</p>
                  )}

                  {actions.includes("PUBLISH") ? (
                    <AdminForm
                      action={publishAssessmentAction}
                      submitLabel="Publikovat"
                      variant="primary"
                      confirm="Publikovat hodnocení? Publikovaná verze už nepůjde změnit, jen nahradit novou."
                    >
                      <input type="hidden" name="assessmentId" value={working.id} />
                      <input type="hidden" name="slug" value={promise.slug} />
                    </AdminForm>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <details className="border-border rounded-lg border p-4" open={!published}>
            <summary className="cursor-pointer text-sm font-medium">
              {published ? "Založit novou verzi hodnocení" : "Založit hodnocení"}
            </summary>
            <div className="mt-4">
              <AdminForm
                action={createAssessmentAction}
                submitLabel="Založit jako rozpracované"
                variant="primary"
              >
                <input type="hidden" name="promiseId" value={promise.id} />
                <input type="hidden" name="slug" value={promise.slug} />
                <AssessmentFields
                  assessment={published}
                  defaultCutoff={today}
                  requireReason={Boolean(published)}
                />
              </AdminForm>
            </div>
          </details>
        )}
      </Section>

      <Section id="historie" title="Verze hodnocení">
        {promise.assessments.length === 0 ? (
          <p className="text-muted text-sm">Zatím žádné hodnocení.</p>
        ) : (
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-border bg-surface border-b text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Verze</th>
                  <th className="px-4 py-2 font-medium">Vznik</th>
                  <th className="px-4 py-2 font-medium">Zdroje k</th>
                  <th className="px-4 py-2 font-medium">Plnění</th>
                  <th className="px-4 py-2 font-medium">Výsledek</th>
                  <th className="px-4 py-2 font-medium">Autor / revize</th>
                  <th className="px-4 py-2 font-medium">Stav</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {promise.assessments.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 tabular-nums">v{row.version}</td>
                    <td className="px-4 py-2 tabular-nums">{formatTimestamp(row.createdAt)}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatDate(row.sourcesReviewedUpTo)}
                    </td>
                    <td className="px-4 py-2">
                      {EXECUTION_STATUS_LABELS[row.executionStatus].label}
                    </td>
                    <td className="px-4 py-2">{OUTCOME_STATUS_LABELS[row.outcomeStatus].label}</td>
                    <td className="px-4 py-2">
                      {row.authorName}
                      {row.reviewerName ? ` / ${row.reviewerName}` : " / —"}
                    </td>
                    <td className="px-4 py-2">
                      {WORKFLOW_STATE_LABELS[row.workflowState]}
                      {row.isCurrent ? " (veřejné)" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {promise.reviewNotes.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Poznámky z revize</h3>
            <ul className="divide-border border-border divide-y rounded-lg border text-sm">
              {promise.reviewNotes.map((note, index) => (
                <li key={index} className="px-4 py-2">
                  <span className="text-muted">
                    {formatTimestamp(note.createdAt)} · {note.reviewer} · {note.decision}
                  </span>
                  {note.note ? <p>{note.note}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section id="podnety" title="Podněty a korekce">
        {promise.corrections.length === 0 ? (
          <p className="text-muted text-sm">Žádný podnět.</p>
        ) : (
          <ul className="space-y-4">
            {promise.corrections.map((correction) => (
              <li key={correction.id} className="border-border space-y-3 rounded-lg border p-4">
                <p className="text-muted text-xs tracking-wide uppercase">
                  {correction.kind} · {correction.status} · {formatTimestamp(correction.createdAt)}
                </p>
                <p className="text-sm">{correction.body}</p>
                {correction.response ? (
                  <p className="text-muted text-sm">Odpověď: {correction.response}</p>
                ) : null}

                <details>
                  <summary className="cursor-pointer text-sm font-medium">Vyřídit</summary>
                  <div className="mt-3">
                    <AdminForm action={resolveCorrectionAction} submitLabel="Uložit vyřízení">
                      <input type="hidden" name="correctionId" value={correction.id} />
                      <input type="hidden" name="slug" value={promise.slug} />
                      <Field label="Stav" required>
                        <Select
                          name="status"
                          required
                          options={[
                            { value: "ACKNOWLEDGED", label: "Vzato na vědomí" },
                            { value: "APPLIED", label: "Promítnuto do hodnocení" },
                            { value: "REJECTED", label: "Neuznáno" },
                          ]}
                        />
                      </Field>
                      <Field label="Veřejná odpověď">
                        <TextArea name="response" rows={3} />
                      </Field>
                      <Field
                        label="Verze hodnocení, která z podnětu vzešla"
                        hint="Povinné při promítnutí do hodnocení."
                      >
                        <Select
                          name="appliedAssessmentId"
                          options={[
                            { value: "", label: "—" },
                            ...promise.assessments.map((row) => ({
                              value: row.id,
                              label: `v${row.version} (${WORKFLOW_STATE_LABELS[row.workflowState]})`,
                            })),
                          ]}
                        />
                      </Field>
                    </AdminForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        <details className="border-border rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">Zaznamenat podnět</summary>
          <div className="mt-4">
            <AdminForm action={createCorrectionAction} submitLabel="Zaznamenat">
              <input type="hidden" name="promiseId" value={promise.id} />
              <input type="hidden" name="slug" value={promise.slug} />
              <Field label="Druh" required>
                <Select
                  name="kind"
                  required
                  options={[
                    { value: "PUBLIC_CORRECTION", label: "Podnět čtenáře" },
                    { value: "PARTY_RESPONSE", label: "Reakce kandidátky" },
                    { value: "INTERNAL_REVISION", label: "Interní revize" },
                  ]}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jméno odesílatele">
                  <TextInput name="submitterName" maxLength={200} />
                </Field>
                <Field label="Organizace">
                  <TextInput name="submitterOrganization" maxLength={200} />
                </Field>
              </div>
              <Field label="Obsah podnětu" required>
                <TextArea name="body" required rows={4} />
              </Field>
            </AdminForm>
          </div>
        </details>
      </Section>

      <Section id="audit" title="Audit">
        <p className="text-muted text-sm">
          Záznamy auditu nejdou upravit ani smazat — brání tomu trigger v databázi.
        </p>
        {promise.audit.length === 0 ? (
          <p className="text-muted text-sm">Zatím žádný záznam.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border text-sm">
            {promise.audit.map((entry, index) => (
              <li key={index} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="font-mono text-xs">{entry.action}</span>
                <span className="text-muted">
                  {entry.actor ?? "—"} · {formatTimestamp(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function AssessmentSummary({ assessment }: { assessment: AdminAssessmentRow }) {
  return (
    <dl className="border-border grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted">Stav plnění</dt>
        <dd>{EXECUTION_STATUS_LABELS[assessment.executionStatus].label}</dd>
      </div>
      <div>
        <dt className="text-muted">Stav výsledku</dt>
        <dd>{OUTCOME_STATUS_LABELS[assessment.outcomeStatus].label}</dd>
      </div>
      <div>
        <dt className="text-muted">Hodnotitelnost</dt>
        <dd>{ASSESSABILITY_LABELS[assessment.assessability].label}</dd>
      </div>
      <div>
        <dt className="text-muted">Zdroje prošlé k</dt>
        <dd className="tabular-nums">{formatDate(assessment.sourcesReviewedUpTo)}</dd>
      </div>
      {assessment.summary ? (
        <div className="sm:col-span-2">
          <dt className="text-muted">Shrnutí</dt>
          <dd>{assessment.summary}</dd>
        </div>
      ) : null}
      {assessment.changeReason ? (
        <div className="sm:col-span-2">
          <dt className="text-muted">Důvod změny</dt>
          <dd>{assessment.changeReason}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/**
 * Skóre zadává člověk, výsledný stupeň hodnotitelnosti počítá doména.
 * V UI se proto nepočítá nic — jinak by se výpočet rozešel s tím, co ukládá server.
 */
function AssessmentFields({
  assessment,
  defaultCutoff,
  requireReason = false,
}: {
  assessment: AdminAssessmentRow | null;
  defaultCutoff: string;
  requireReason?: boolean;
}) {
  return (
    <>
      <fieldset className="border-border space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Hodnotitelnost (0–5)</legend>
        {ASSESSABILITY_DIMENSIONS.map((dimension) => (
          <ScoreInput
            key={dimension.key}
            name={dimension.key}
            label={dimension.label}
            question={dimension.question}
            defaultValue={assessment?.[dimension.key] ?? 0}
          />
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Stav plnění"
          hint="Nezahájeno tvrdí, že realizace nezačala, a vyžaduje zdroj. Bez dokladu použij Bez doloženého postupu."
          required
        >
          <Select
            name="executionStatus"
            required
            defaultValue={assessment?.executionStatus ?? "NO_VERIFIED_PROGRESS"}
            options={EXECUTION_OPTIONS}
          />
        </Field>
        <Field
          label="Stav výsledku"
          hint="Výrok o dosažení cíle vyžaduje naměřenou hodnotu doloženou zdrojem."
          required
        >
          <Select
            name="outcomeStatus"
            required
            defaultValue={assessment?.outcomeStatus ?? "NOT_MEASURABLE_YET"}
            options={OUTCOME_OPTIONS}
          />
        </Field>
      </div>

      <Field
        label="Rozhodné datum rešerše"
        hint="Ke kterému dni jsi zdroje procházel. Není to datum vzniku hodnocení."
        required
      >
        <TextInput
          type="date"
          name="sourcesReviewedUpTo"
          required
          defaultValue={assessment?.sourcesReviewedUpTo ?? defaultCutoff}
        />
      </Field>

      <Field label="Shrnutí" hint="Co se se slibem stalo a z čeho to plyne.">
        <TextArea name="summary" rows={4} defaultValue={assessment?.summary ?? ""} />
      </Field>

      <Field
        label="Důvod změny"
        hint="Povinné od druhé verze. Čtenář má vidět, proč se závěr posunul."
        required={requireReason}
      >
        <TextArea
          name="changeReason"
          rows={3}
          required={requireReason}
          defaultValue={assessment?.changeReason ?? ""}
        />
      </Field>
    </>
  );
}
