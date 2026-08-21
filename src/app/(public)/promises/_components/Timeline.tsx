import { EVENT_TYPE_LABELS } from "@/modules/promises/labels";
import type { TimelineEventView } from "@/modules/promises/queries";
import { formatDateLong, formatMonthYear } from "@/shared/format";

/**
 * Časová osa — narativní páteř stránky.
 *
 * Odpovídá na „co se od voleb skutečně stalo". Je to **příběh**, ne druhý
 * důkazní archiv: u každé události stojí datum, co se stalo a odkud to víme,
 * ale plná provenience s doslovnými citáty patří níž do archivu.
 *
 * Dřív se tady vypisovaly celé citace i s vydavatelem a datem stažení, takže
 * stejný obsah stál na stránce dvakrát a osa se v něm ztrácela.
 *
 * Sémanticky je to seznam. Svislá linka je dekorace nakreslená přes něj —
 * odečítač čte položky, ne čáru.
 */
export function Timeline({ events }: { events: TimelineEventView[] }) {
  if (events.length === 0) {
    return (
      <p className="text-muted prose-measure">
        K tomuto slibu zatím nemáme žádnou doloženou událost.
      </p>
    );
  }

  return (
    <ol className="border-border space-y-6 border-l pl-6">
      {events.map((event, index) => (
        <li key={`${event.eventDate}-${index}`} className="relative space-y-1.5">
          <span
            className="bg-border absolute top-2 -left-[1.8125rem] size-2.5 rounded-full"
            aria-hidden="true"
          />

          <p className="text-muted text-sm tabular-nums">
            <time dateTime={event.eventDate}>
              <span aria-hidden="true">{formatMonthYear(event.eventDate)}</span>
              <span className="sr-only">{formatDateLong(event.eventDate)}</span>
            </time>
            {" · "}
            {EVENT_TYPE_LABELS[event.eventType]}
          </p>

          <h3 className="leading-snug font-semibold">{event.title}</h3>
          {event.description ? (
            <p className="text-muted prose-measure text-sm">{event.description}</p>
          ) : null}

          <EventSources event={event} />
        </li>
      ))}
    </ol>
  );
}

/**
 * Odkaz na zdroje události, ne jejich obsah.
 *
 * Kdyby tu byly plné citace, osa přestane být čitelná jako příběh a čtenář
 * bude číst tytéž odstavce podruhé v archivu.
 */
function EventSources({ event }: { event: TimelineEventView }) {
  if (event.citations.length === 0) {
    return <p className="text-muted text-sm">Bez zdrojového dokumentu.</p>;
  }

  const linked = event.citations.filter((citation) => citation.source.url !== null);
  const first = linked[0] ?? event.citations[0];
  if (!first) return null;

  return (
    <p className="text-muted text-sm">
      {first.source.url ? (
        <a
          href={first.source.url}
          className="hover:text-accent underline underline-offset-4"
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          {first.source.title}
          <span aria-hidden="true"> ↗</span>
          <span className="sr-only"> (otevře se v novém okně)</span>
        </a>
      ) : (
        first.source.title
      )}
      {event.citations.length > 1 ? ` a další ${event.citations.length - 1}` : null}
    </p>
  );
}
