import { SourceLine } from "@/app/_components/SourceCitation";
import type { MetricView } from "@/modules/promises/queries";
import { formatDate, formatMeasurement } from "@/shared/format";

const DIRECTION_LABELS = {
  INCREASE: "Cílem je hodnotu zvýšit",
  DECREASE: "Cílem je hodnotu snížit",
  MAINTAIN: "Cílem je hodnotu udržet",
} as const;

/**
 * Metrika slibu.
 *
 * A2 — bez výchozí hodnoty, cíle a naměřeného čísla je „dosaženo“ jen názor
 * redaktora. Panel proto ukazuje všechny tři a u každého měření zdroj, ze
 * kterého číslo pochází. Vyhodnocení, jestli cíl padl, se tu záměrně nepočítá:
 * závěr patří do stavu výsledku, který schvaluje člověk.
 */
export function MetricPanel({ metric }: { metric: MetricView }) {
  return (
    <section className="border-border space-y-4 rounded-lg border p-5">
      <div className="space-y-1">
        <h3 className="font-medium">{metric.name}</h3>
        <p className="text-muted text-sm">{DIRECTION_LABELS[metric.direction]}</p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted text-sm">Výchozí stav</dt>
          <dd className="tabular-nums">
            {formatMeasurement(metric.baselineValue, metric.unit)}
            {metric.baselineOn ? (
              <span className="text-muted text-sm"> k {formatDate(metric.baselineOn)}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-muted text-sm">Slíbený cíl</dt>
          <dd className="tabular-nums">
            {formatMeasurement(metric.targetValue, metric.unit)}
            {metric.targetOn ? (
              <span className="text-muted text-sm"> do {formatDate(metric.targetOn)}</span>
            ) : null}
          </dd>
        </div>
      </dl>

      {metric.measurements.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-muted text-xs tracking-wide uppercase">Naměřené hodnoty</h4>
          <ul className="divide-border divide-y">
            {metric.measurements.map((measurement, index) => (
              <li key={index} className="space-y-1 py-3">
                <p className="tabular-nums">
                  {formatMeasurement(measurement.value, metric.unit)}
                  <span className="text-muted text-sm">
                    {" "}
                    k {formatDate(measurement.measuredOn)}
                  </span>
                </p>
                {measurement.note ? <p className="text-muted text-sm">{measurement.note}</p> : null}
                <SourceLine source={measurement.source} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted text-sm">
          Zatím nemáme žádnou naměřenou hodnotu doloženou zdrojem.
        </p>
      )}

      {metric.definitionNote ? (
        <p className="text-muted border-border border-t pt-3 text-sm">
          <span className="text-foreground">Jak se metrika počítá: </span>
          {metric.definitionNote}
        </p>
      ) : null}
    </section>
  );
}
