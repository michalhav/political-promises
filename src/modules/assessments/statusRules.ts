/**
 * Pravidla konzistence mezi hodnotitelností a statusy.
 *
 * Produktový princip č. 2 říká, že průběh a výsledek se nesmí slévat: slib může
 * být realizovaný a výsledek přesto nenastal, a naopak výsledek může nastat bez
 * přičinění radnice. Proto zde záměrně NENÍ pravidlo "bez zahájené realizace
 * nemůže být ACHIEVED" — to by ty dvě osy spojilo zpátky dohromady.
 *
 * Co pravidla naopak hlídají: aby se u nehodnotitelného slibu netvrdilo splnění
 * a aby výrok o výsledku měl vždy oporu v naměřené hodnotě (A2).
 */
import type { AssessabilityLevel } from "@/modules/assessments/assessability";

export type ExecutionStatus =
  | "NO_VERIFIED_PROGRESS"
  | "NOT_STARTED"
  | "PLANNED"
  | "IN_PROGRESS"
  | "PARTIALLY_COMPLETED"
  | "COMPLETED"
  | "ABANDONED"
  | "BLOCKED"
  | "NOT_ASSESSABLE"
  | "UNKNOWN";

export type OutcomeStatus =
  | "NOT_MEASURABLE_YET"
  | "ACHIEVED"
  | "PARTIALLY_ACHIEVED"
  | "NOT_ACHIEVED"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

export interface AssessmentConsistencyInput {
  assessability: AssessabilityLevel;
  executionStatus: ExecutionStatus;
  outcomeStatus: OutcomeStatus;
  /** Existuje aspoň jedna naměřená hodnota metriky doložená zdrojem? */
  hasMeasuredMetric: boolean;
  /** Existuje aspoň jedna lidsky ověřená vazba na důkaz? */
  hasVerifiedEvidence: boolean;
}

const ALLOWED_EXECUTION_WHEN_NOT_ASSESSABLE: readonly ExecutionStatus[] = [
  "NOT_ASSESSABLE",
  "UNKNOWN",
];

const ALLOWED_OUTCOME_WHEN_NOT_ASSESSABLE: readonly OutcomeStatus[] = ["NOT_APPLICABLE", "UNKNOWN"];

/**
 * Stavy plnění, které tvrdí něco o skutečnosti. Integritní pravidlo č. 2 pro ně
 * vyžaduje důkaz.
 *
 * Je mezi nimi i NOT_STARTED, a to schválně. "Nezahájeno" je tvrzení o světě —
 * že se realizace nerozběhla. Systém ale zpravidla ví jen to, že o ní nenašel
 * veřejný doklad, což je něco jiného: projekt může běžet interně dřív, než
 * o něm vznikne usnesení nebo zpráva. Bez důkazu proto patří výrok do
 * NO_VERIFIED_PROGRESS, který mluví o stavu našich zdrojů, ne o stavu města.
 * NOT_STARTED zůstává pro doložený případ — třeba když magistrát sám uvádí,
 * že realizace zahájena nebyla.
 *
 * Mimo seznam zůstávají NO_VERIFIED_PROGRESS, NOT_ASSESSABLE a UNKNOWN. Ty
 * netvrdí o skutečnosti nic, co by šlo doložit; vyžadovat u nich důkaz by
 * redakci tlačilo k tomu, aby si nějaký vymyslela.
 */
const EXECUTION_REQUIRING_EVIDENCE: readonly ExecutionStatus[] = [
  "NOT_STARTED",
  "PLANNED",
  "IN_PROGRESS",
  "PARTIALLY_COMPLETED",
  "COMPLETED",
  "ABANDONED",
  "BLOCKED",
];

/** Výroky o výsledku, které bez naměřené hodnoty nejsou doložitelné. */
const OUTCOME_REQUIRING_MEASUREMENT: readonly OutcomeStatus[] = [
  "ACHIEVED",
  "PARTIALLY_ACHIEVED",
  "NOT_ACHIEVED",
];

export function validateAssessmentConsistency(input: AssessmentConsistencyInput): string[] {
  const errors: string[] = [];

  if (input.assessability === "NOT_ASSESSABLE") {
    if (!ALLOWED_EXECUTION_WHEN_NOT_ASSESSABLE.includes(input.executionStatus)) {
      errors.push(
        `Nehodnotitelný slib nemůže mít stav plnění ${input.executionStatus}. Povoleno: ${ALLOWED_EXECUTION_WHEN_NOT_ASSESSABLE.join(", ")}.`,
      );
    }
    if (!ALLOWED_OUTCOME_WHEN_NOT_ASSESSABLE.includes(input.outcomeStatus)) {
      errors.push(
        `Nehodnotitelný slib nemůže mít stav výsledku ${input.outcomeStatus}. Povoleno: ${ALLOWED_OUTCOME_WHEN_NOT_ASSESSABLE.join(", ")}.`,
      );
    }
  } else if (input.executionStatus === "NOT_ASSESSABLE") {
    errors.push(
      "Stav plnění NOT_ASSESSABLE smí mít jen slib, jehož hodnotitelnost je NOT_ASSESSABLE.",
    );
  }

  if (EXECUTION_REQUIRING_EVIDENCE.includes(input.executionStatus) && !input.hasVerifiedEvidence) {
    errors.push(
      `Stav plnění ${input.executionStatus} tvrdí něco o skutečnosti a vyžaduje aspoň jednu ověřenou vazbu na zdrojový dokument. Bez doloženého zdroje použij NO_VERIFIED_PROGRESS.`,
    );
  }

  if (OUTCOME_REQUIRING_MEASUREMENT.includes(input.outcomeStatus) && !input.hasMeasuredMetric) {
    errors.push(
      `Stav výsledku ${input.outcomeStatus} vyžaduje aspoň jednu naměřenou hodnotu metriky doloženou zdrojem.`,
    );
  }

  return errors;
}

/**
 * Stavy, které nepopisují svět, ale to, že jsme se k slibu zatím nedostali.
 *
 * `UNKNOWN` u stavu plnění zní jako závěr, ale znamená „neprošli jsme to".
 * Po zavedení NO_VERIFIED_PROGRESS (rešerše proběhla, doklad nenalezen),
 * NOT_STARTED (doložený nezačátek) a NOT_ASSESSABLE už pro něj mezi
 * publikovatelnými stavy není místo: nepřítomnost hodnocení se pozná podle
 * toho, že žádné publikované hodnocení neexistuje.
 *
 * Hodnotu z enumu neodstraňujeme — migrace odstraňující hodnotu z Postgres
 * enumu je zbytečně riziková a nic by nepřinesla. Zakazujeme jen publikaci
 * a úklid necháváme na později.
 *
 * U stavu výsledku `UNKNOWN` naopak smysl dává: liší se od NOT_MEASURABLE_YET
 * („měřit ještě nejde") tím, že měřit by šlo, ale hodnotu nemáme.
 */
const EXECUTION_NOT_PUBLISHABLE: readonly ExecutionStatus[] = ["UNKNOWN"];

export interface PublicationReadinessInput extends AssessmentConsistencyInput {
  /** Má slib doslovnou citaci z primárního zdroje? Bez ní nemá co publikovat. */
  hasPrimarySource: boolean;
}

/**
 * Kontrola před publikací. Je přísnější než kontrola konzistence: rozpracované
 * hodnocení smí být neúplné, publikované ne.
 */
export function validateReadyForPublication(input: PublicationReadinessInput): string[] {
  const errors = validateAssessmentConsistency(input);

  if (EXECUTION_NOT_PUBLISHABLE.includes(input.executionStatus)) {
    errors.push(
      "Stav plnění „Nezjištěno“ znamená, že slib zatím nebyl prozkoumán, a nedá se publikovat. Použij NO_VERIFIED_PROGRESS, pokud rešerše proběhla a doklad se nenašel.",
    );
  }

  if (!input.hasPrimarySource) {
    errors.push(
      "Slib nemá doslovnou citaci z primárního zdroje. Bez ní není doložené ani to, co bylo slíbeno.",
    );
  }

  return errors;
}
