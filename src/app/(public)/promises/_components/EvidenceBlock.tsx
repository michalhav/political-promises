import { DemoBadge } from "@/app/_components/DemoBadge";
import type { EvidenceView } from "@/modules/promises/queries";
import { evidenceRoleLabel, SOURCE_TYPE_LABELS } from "@/modules/sources/labels";
import { formatDate, formatTimestamp } from "@/shared/format";
import { toReadableQuote } from "@/modules/ingestion/normalize";

/**
 * Důkazní blok — podpisový komponent produktu.
 *
 * Drží od sebe tři věci, které se v běžných aplikacích slévají do jednoho
 * odstavce, a právě jejich oddělení je hlavní důvod, proč se tomuhle produktu
 * má dát věřit:
 *
 *   1. **Role** — čím je zdroj pro tenhle slib.
 *   2. **Zdroj a doslovný citát** — co v dokumentu stojí. Ne naše slova.
 *   3. **Redakční výklad** — co z toho plyne. A hlavně co z toho *neplyne*.
 *
 * Ten poslední řádek je nejcennější a nejčastěji chybí. Zpráva dokládající
 * 910 bytů sama o sobě neříká nic o tom, že jich bude 2 000 — a kdyby to blok
 * nedokázal vyjádřit, tvářil by se doložitelněji, než jaké důkazy má.
 *
 * Citát není karta ani zvýrazněný box. Je to blockquote s levou linkou, aby
 * bylo poznat, že to napsala instituce, ne aplikace.
 */
export function EvidenceBlock({ evidence }: { evidence: EvidenceView }) {
  const { source } = evidence;
  const locators = [
    source.publishedAt ? formatDate(source.publishedAt) : null,
    evidence.locator,
    evidence.pageNumber === null ? null : `s. ${evidence.pageNumber}`,
  ].filter((part): part is string => part !== null);

  return (
    <article className="border-border-evidence bg-surface-evidence space-y-3 rounded-[10px] border p-5">
      <p className="text-muted text-xs font-semibold tracking-wide uppercase">
        {evidenceRoleLabel(evidence.relationType, source.sourceType)}
      </p>

      <div className="space-y-1">
        <h4 className="leading-snug font-semibold">
          {source.url ? (
            <a
              href={source.url}
              className="hover:text-accent underline-offset-4 hover:underline"
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              {source.title}
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (otevře se v novém okně)</span>
            </a>
          ) : (
            source.title
          )}
          {source.isDemo ? <DemoBadge /> : null}
        </h4>
        <p className="text-muted text-sm">
          {SOURCE_TYPE_LABELS[source.sourceType]} · {source.publisher}
          {locators.length > 0 ? ` · ${locators.join(" · ")}` : null}
        </p>
      </div>

      <blockquote className="source-quote text-[0.95rem]">
        {toReadableQuote(evidence.excerpt)}
      </blockquote>

      {evidence.note ? (
        <div className="space-y-1">
          <h5 className="text-sm font-semibold">Co tento zdroj dokládá</h5>
          <p className="text-muted text-sm">{evidence.note}</p>
        </div>
      ) : null}

      {evidence.limitationNote ? (
        <div className="border-border-note bg-surface-note space-y-1 rounded-lg border p-3">
          <h5 className="text-sm font-semibold">Co z něj nelze vyvodit</h5>
          <p className="text-muted text-sm">{evidence.limitationNote}</p>
        </div>
      ) : null}

      <p className="text-muted text-xs">Staženo {formatTimestamp(source.retrievedAt)}</p>
    </article>
  );
}
