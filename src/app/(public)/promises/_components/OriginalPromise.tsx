import { DemoBadge } from "@/app/_components/DemoBadge";
import type { Citation } from "@/modules/promises/queries";
import { formatDate } from "@/shared/format";
import { toReadableQuote } from "@/modules/ingestion/normalize";

/**
 * Původní znění slibu.
 *
 * Musí být na první pohled poznat, že tohle **napsal politik**, ne aplikace.
 * Proto blockquote s levou linkou a bez barevné karty: karta by citaci
 * vizuálně povýšila na sdělení produktu, a přesně tomu se chceme vyhnout.
 *
 * Provenience stojí pod citací, oddělená od ní — je to náš údaj o zdroji,
 * ne součást toho, co bylo řečeno.
 */
export function OriginalPromise({
  originalText,
  normalizedStatement,
  source,
  deadlineText,
  deadlineOn,
}: {
  originalText: string;
  normalizedStatement: string | null;
  source: Citation | null;
  deadlineText: string | null;
  deadlineOn: string | null;
}) {
  return (
    <div className="space-y-5">
      <blockquote className="source-quote prose-measure text-xl leading-relaxed">
        {toReadableQuote(originalText)}
      </blockquote>

      {source ? <SourceLine citation={source} /> : null}

      {normalizedStatement ? (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">Přepsáno do ověřitelné podoby</h3>
          <p className="prose-measure">{normalizedStatement}</p>
          <p className="text-muted text-sm">
            Přepis původní znění nenahrazuje. Slouží k tomu, aby šlo určit, co by znamenalo splnění.
          </p>
        </div>
      ) : null}

      <p className="text-muted text-sm">
        {deadlineText ? (
          <>
            <span className="text-foreground">Termín podle zdroje: </span>
            {deadlineText}
            {deadlineOn ? ` (vykládáme jako ${formatDate(deadlineOn)})` : null}
          </>
        ) : (
          "Slib neuvádí žádný termín."
        )}
      </p>
    </div>
  );
}

/** Odkud citace pochází. Jeden řádek, ne karta. */
function SourceLine({ citation }: { citation: Citation }) {
  const { source } = citation;
  const locators = [
    citation.locator,
    citation.pageNumber === null ? null : `strana ${citation.pageNumber}`,
    source.publishedAt ? formatDate(source.publishedAt) : null,
  ].filter((part): part is string => part !== null);

  return (
    <p className="text-muted text-sm">
      {source.publisher}
      {source.isDemo ? <DemoBadge /> : null}
      {locators.length > 0 ? ` · ${locators.join(" · ")}` : null}
      {source.url ? (
        <>
          {" · "}
          <a
            href={source.url}
            className="hover:text-accent underline underline-offset-4"
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            Otevřít zdroj
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (otevře se v novém okně)</span>
          </a>
        </>
      ) : null}
    </p>
  );
}
