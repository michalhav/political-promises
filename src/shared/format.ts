/**
 * Formátování pro české prostředí.
 *
 * Data typu `date` chodí z Postgresu jako "2024-03-11", tedy den bez času.
 * Kdyby se prohnala přes `new Date()`, prohlížeč nebo server v jiné časové zóně
 * by z nich mohl udělat předchozí den — u data usnesení zastupitelstva je
 * takový posun věcná chyba, ne kosmetika. Proto se řetězec rozebírá ručně.
 */

const MONTHS = [
  "ledna",
  "února",
  "března",
  "dubna",
  "května",
  "června",
  "července",
  "srpna",
  "září",
  "října",
  "listopadu",
  "prosince",
] as const;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseIsoDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match?.[1] || !match[2] || !match[3]) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;

  return { year, month, day };
}

/** "2024-03-11" → "11. 3. 2024" */
export function formatDate(value: string | null): string {
  if (!value) return "—";
  const parts = parseIsoDate(value);
  if (!parts) return value;

  return `${parts.day}. ${parts.month}. ${parts.year}`;
}

/** "2024-03-11" → "11. března 2024". Pro delší texty, kde číslice působí úředně. */
export function formatDateLong(value: string | null): string {
  if (!value) return "—";
  const parts = parseIsoDate(value);
  if (!parts) return value;

  return `${parts.day}. ${MONTHS[parts.month - 1]} ${parts.year}`;
}

/** "2024-03-11" → "3/2024". Pro časovou osu, kde jde o pořadí, ne o přesný den. */
export function formatMonthYear(value: string): string {
  const parts = parseIsoDate(value);
  if (!parts) return value;

  return `${parts.month}/${parts.year}`;
}

const timestampFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Europe/Prague",
});

export function formatTimestamp(value: Date | null): string {
  return value ? timestampFormatter.format(value) : "—";
}

/** Uplynulý čas rozpadlý na jednotku a počet. Hranice jsou společné oběma tvarům níž. */
type ElapsedUnit = "now" | "minute" | "hour" | "day" | "month";

function elapsed(value: Date, now: Date): { unit: ElapsedUnit; count: number } {
  const minutes = Math.floor((now.getTime() - value.getTime()) / 60_000);
  if (minutes < 1) return { unit: "now", count: 0 };
  if (minutes < 60) return { unit: "minute", count: minutes };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hour", count: hours };

  const days = Math.floor(hours / 24);
  if (days < 31) return { unit: "day", count: days };

  return { unit: "month", count: Math.floor(days / 30) };
}

/**
 * Jak dlouho něco čeká — „3 dny", „1 hodinu".
 *
 * Ve frontě je datum skoro k ničemu — redaktor z „14. 6." nepozná, jestli to
 * leží tři dny nebo tři týdny. Naléhavost nese uplynulý čas, ne kalendář.
 *
 * Tvar je akuzativ, aby seděl do věty „čeká {age}". Pro „před {…}" je
 * [formatAgo], protože čeština tam vyžaduje instrumentál.
 *
 * `now` je parametr schválně: bez něj by se funkce nedala otestovat, protože
 * by si čas brala ze systému.
 */
export function formatAge(value: Date, now: Date = new Date()): string {
  const { unit, count } = elapsed(value, now);
  const few = count < 5;

  switch (unit) {
    case "now":
      return "právě teď";
    case "minute":
      return `${count} min`;
    case "hour":
      return count === 1 ? "1 hodinu" : `${count} ${few ? "hodiny" : "hodin"}`;
    case "day":
      return count === 1 ? "1 den" : `${count} ${few ? "dny" : "dní"}`;
    case "month":
      return count === 1 ? "1 měsíc" : `${count} ${few ? "měsíce" : "měsíců"}`;
  }
}

/**
 * Kdy se něco naposledy stalo — „před 3 dny", „právě teď".
 *
 * Předložka je součástí návratové hodnoty schválně. Kdyby ji lepil volající
 * k [formatAge], vzniklo by „před 1 den" a „před 6 měsíců" — instrumentál po
 * „před" má jiné tvary než akuzativ a u „právě teď" se předložka vynechává
 * úplně. Tohle je přesně ten druh detailu, který se v redakčním nástroji čte
 * stokrát denně.
 */
export function formatAgo(value: Date, now: Date = new Date()): string {
  const { unit, count } = elapsed(value, now);

  switch (unit) {
    case "now":
      return "právě teď";
    case "minute":
      return count === 1 ? "před 1 minutou" : `před ${count} minutami`;
    case "hour":
      return count === 1 ? "před 1 hodinou" : `před ${count} hodinami`;
    case "day":
      return count === 1 ? "před 1 dnem" : `před ${count} dny`;
    case "month":
      return count === 1 ? "před 1 měsícem" : `před ${count} měsíci`;
  }
}

const numberFormatter = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 4 });

/**
 * Numeric z Postgresu chodí jako řetězec ("2000.0000"), aby se cestou neztratila
 * přesnost. Před zobrazením se tedy převádí až tady, ne v dotazu.
 */
export function formatNumeric(value: string | null): string {
  if (value === null) return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? numberFormatter.format(parsed) : value;
}

export function formatMeasurement(value: string | null, unit: string): string {
  return value === null ? "—" : `${formatNumeric(value)} ${unit}`;
}
