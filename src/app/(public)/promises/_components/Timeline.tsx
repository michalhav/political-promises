import { CitationBlock } from "@/app/_components/SourceCitation";
import { EVENT_TYPE_LABELS } from "@/modules/promises/labels";
import type { TimelineEventView } from "@/modules/promises/queries";
import { formatDateLong, formatMonthYear } from "@/shared/format";

/**
 * Časová osa slibu.
 *
 * Každá položka nese vlastní citaci ze zdroje. Kdyby událost důkaz neměla,
 * bylo by to tvrzení bez opory — proto se taková položka vykreslí s výslovnou
 * poznámkou, ne potichu jako ostatní.
 */
export function Timeline({ events }: { events: TimelineEventView[] }) {
  if (events.length === 0) {
    return <p className="text-muted">K tomuto slibu zatím nemáme žádnou doloženou událost.</p>;
  }

  return (
    <ol className="border-border space-y-8 border-l pl-6">
      {events.map((event, index) => (
        <li key={`${event.eventDate}-${index}`} className="relative space-y-3">
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

          <h3 className="font-medium">{event.title}</h3>
          {event.description ? <p className="text-muted">{event.description}</p> : null}

          {event.citations.length > 0 ? (
            <div className="space-y-4">
              {event.citations.map((citation, citationIndex) => (
                <CitationBlock key={citationIndex} citation={citation} />
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">Ke této události zatím nemáme zdrojový dokument.</p>
          )}
        </li>
      ))}
    </ol>
  );
}
