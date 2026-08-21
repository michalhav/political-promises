import {
  ASSESSABILITY_LABELS,
  EXECUTION_NEEDS_SAFEGUARD,
  EXECUTION_STATUS_LABELS,
  EXECUTION_STATUS_TONE,
  OUTCOME_STATUS_LABELS,
  OUTCOME_STATUS_TONE,
  STATUS_TONE_MARK,
  type AssessabilityLevel,
  type ExecutionStatusValue,
  type OutcomeStatusValue,
  type StatusTone,
} from "@/modules/assessments/labels";

/**
 * Zobrazení stavu slibu.
 *
 * Dvě varianty, protože stav není jedna věc:
 *
 *   `compact` — hodnota v seznamu nebo v hlavičce. Znak plus text.
 *   `full`    — stav jako **informace**, ne jako štítek: co znamená a k čemu
 *               se vztahuje. Tohle je odpověď na „tak jak to tedy je?".
 *
 * Původní verze uměla jen štítek. Tři téměř synonymní štítky vedle sebe
 * ale nedávaly odpověď, jen ji rozdrobily na tři metadata.
 *
 * Barva je vždy až druhý signál. Význam nese text a znak před ním — proto
 * stav funguje i černobíle, i po zvětšení písma, i v odečítači.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  active: "border-tint-active-border bg-tint-active",
  settled: "border-tint-settled-border bg-tint-settled",
  caution: "border-tint-caution-border bg-tint-caution",
  neutral: "border-tint-neutral-border bg-tint-neutral",
};

interface StatusChipProps {
  tone: StatusTone;
  label: string;
  /** Čeho se hodnota týká. Čte ho i odečítač, proto není jen vizuální. */
  axis: string;
}

function StatusChip({ tone, label, axis }: StatusChipProps) {
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-sm ${TONE_CLASSES[tone]}`}
    >
      <span aria-hidden="true">{STATUS_TONE_MARK[tone]}</span>
      <span className="sr-only">{axis}: </span>
      <span>{label}</span>
    </span>
  );
}

export function ExecutionChip({ status }: { status: ExecutionStatusValue }) {
  return (
    <StatusChip
      tone={EXECUTION_STATUS_TONE[status]}
      label={EXECUTION_STATUS_LABELS[status].label}
      axis="Průběh realizace"
    />
  );
}

export function OutcomeChip({ status }: { status: OutcomeStatusValue }) {
  return (
    <StatusChip
      tone={OUTCOME_STATUS_TONE[status]}
      label={OUTCOME_STATUS_LABELS[status].label}
      axis="Výsledek"
    />
  );
}

export function AssessabilityChip({ level }: { level: AssessabilityLevel }) {
  return (
    <StatusChip
      tone={level === "NOT_ASSESSABLE" ? "neutral" : "active"}
      label={ASSESSABILITY_LABELS[level].label}
      axis="Hodnotitelnost"
    />
  );
}

/**
 * Plná podoba jedné osy stavu.
 *
 * Průběh a výsledek zůstávají oddělené i vizuálně. Slít je do jednoho čísla
 * by bylo pohodlné, ale nepravdivé: opatření může být hotové, aniž by nastal
 * slíbený výsledek — a naopak.
 */
export function StatusAxis({
  axis,
  label,
  meaning,
  tone,
}: {
  axis: string;
  label: string;
  meaning: string;
  tone: StatusTone;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted text-sm">{axis}</p>
      <p className="flex items-baseline gap-2 text-xl font-semibold">
        <span aria-hidden="true" className="text-base">
          {STATUS_TONE_MARK[tone]}
        </span>
        {label}
      </p>
      <p className="text-muted text-sm">{meaning}</p>
    </div>
  );
}

export function ExecutionAxis({ status }: { status: ExecutionStatusValue }) {
  const { label, meaning } = EXECUTION_STATUS_LABELS[status];
  return (
    <StatusAxis
      axis="Průběh realizace"
      label={label}
      meaning={meaning}
      tone={EXECUTION_STATUS_TONE[status]}
    />
  );
}

export function OutcomeAxis({ status }: { status: OutcomeStatusValue }) {
  const { label, meaning } = OUTCOME_STATUS_LABELS[status];
  return (
    <StatusAxis
      axis="Výsledek"
      label={label}
      meaning={meaning}
      tone={OUTCOME_STATUS_TONE[status]}
    />
  );
}

export function needsSafeguard(status: ExecutionStatusValue): boolean {
  return EXECUTION_NEEDS_SAFEGUARD.includes(status);
}
