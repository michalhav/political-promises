import { DemoBadge } from "@/app/_components/DemoBadge";
import { formatDate, formatTimestamp } from "@/shared/format";
import type { Citation, SourceRef } from "@/modules/promises/queries";
import { SOURCE_TYPE_LABELS } from "@/modules/sources/labels";
import { toReadableQuote } from "@/modules/ingestion/normalize";

/**
 * Odkaz na zdrojový dokument.
 *
 * Vždy se uvádí i datum stažení. Volební program se dá z webu stáhnout a bez
 * poznámky „staženo dne“ by u nefunkčního odkazu nešlo doložit, že tvrzení
 * mělo v době publikace oporu (produktový princip č. 4).
 */
export function SourceLine({ source }: { source: SourceRef }) {
  return (
    <p className="text-muted text-sm">
      <span className="text-foreground">{SOURCE_TYPE_LABELS[source.sourceType]}</span>
      {" · "}
      {source.url ? (
        <a
          href={source.url}
          className="hover:text-accent underline underline-offset-4"
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          {source.title}
        </a>
      ) : (
        <span>{source.title}</span>
      )}
      {source.isDemo ? <DemoBadge /> : null}
      {" · "}
      {source.publisher}
      {source.publishedAt ? ` · vydáno ${formatDate(source.publishedAt)}` : null}
      {` · staženo ${formatTimestamp(source.retrievedAt)}`}
    </p>
  );
}

/** Doslovný citát plus jeho místo ve zdroji. */
export function CitationBlock({ citation }: { citation: Citation }) {
  const locators = [
    citation.locator,
    citation.pageNumber === null ? null : `s. ${citation.pageNumber}`,
  ].filter((part): part is string => part !== null);

  return (
    <figure className="border-border border-l-2 pl-4">
      <blockquote className="text-[0.95rem] italic">
        „{toReadableQuote(citation.excerpt)}“
      </blockquote>
      <figcaption className="mt-2 space-y-0.5">
        {locators.length > 0 ? <p className="text-muted text-sm">{locators.join(", ")}</p> : null}
        <SourceLine source={citation.source} />
      </figcaption>
    </figure>
  );
}
