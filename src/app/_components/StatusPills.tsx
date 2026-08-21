import { Pill, type PillTone } from "@/app/_components/Pill";
import {
  ASSESSABILITY_LABELS,
  EXECUTION_STATUS_LABELS,
  OUTCOME_STATUS_LABELS,
  type AssessabilityLevel,
  type ExecutionStatusValue,
  type OutcomeStatusValue,
} from "@/modules/assessments/labels";

/** Stavy, které neříkají, co se stalo, ale že to zatím nevíme nebo se to neuplatňuje. */
const UNDETERMINED_EXECUTION: readonly ExecutionStatusValue[] = [
  "UNKNOWN",
  "NOT_ASSESSABLE",
  // Výrok o stavu našich zdrojů, ne o stavu města.
  "NO_VERIFIED_PROGRESS",
];
const UNDETERMINED_OUTCOME: readonly OutcomeStatusValue[] = [
  "UNKNOWN",
  "NOT_APPLICABLE",
  "NOT_MEASURABLE_YET",
];

function toneFor(isUndetermined: boolean): PillTone {
  return isUndetermined ? "muted" : "neutral";
}

export function ExecutionPill({ status }: { status: ExecutionStatusValue }) {
  return (
    <Pill prefix="Plnění" tone={toneFor(UNDETERMINED_EXECUTION.includes(status))}>
      {EXECUTION_STATUS_LABELS[status].label}
    </Pill>
  );
}

export function OutcomePill({ status }: { status: OutcomeStatusValue }) {
  return (
    <Pill prefix="Výsledek" tone={toneFor(UNDETERMINED_OUTCOME.includes(status))}>
      {OUTCOME_STATUS_LABELS[status].label}
    </Pill>
  );
}

export function AssessabilityPill({ level }: { level: AssessabilityLevel }) {
  return (
    <Pill prefix="Hodnotitelnost" tone={toneFor(level === "NOT_ASSESSABLE")}>
      {ASSESSABILITY_LABELS[level].label}
    </Pill>
  );
}
