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
