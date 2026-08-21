/**
 * Redakční workflow hodnocení.
 *
 * Stav je explicitní sloupec, ne odvozenina z prázdných polí. „reviewed_by_id
 * je NULL" neumí odlišit hodnocení, které čeká na revizi, od hodnocení, které
 * se po vrácení právě přepisuje — a na tom rozdílu stojí celá fronta práce.
 *
 * Přechody jsou čisté funkce nad hodnotami, aby je šlo testovat bez databáze
 * a aby je nešlo obejít tím, že v UI zmizí tlačítko.
 */
import type { assessmentWorkflowStateEnum } from "@/db/enums";

export type AssessmentWorkflowState = (typeof assessmentWorkflowStateEnum.enumValues)[number];

export type WorkflowAction = "SUBMIT" | "REQUEST_CHANGES" | "APPROVE" | "PUBLISH";

interface TransitionRule {
  from: readonly AssessmentWorkflowState[];
  to: AssessmentWorkflowState;
  /**
   * Smí akci provést autor hodnocení?
   *
   * Pravidlo čtyř očí (B3) není o rolích, ale o dvojici autor–schvalovatel:
   * nikdo nesmí schválit vlastní práci. Role by k tomu nic nepřidaly.
   */
  authorAllowed: boolean;
  label: string;
}

export const WORKFLOW_TRANSITIONS: Record<WorkflowAction, TransitionRule> = {
  SUBMIT: {
    from: ["DRAFT", "CHANGES_REQUESTED"],
    to: "IN_REVIEW",
    authorAllowed: true,
    label: "Předat k revizi",
  },
  REQUEST_CHANGES: {
    from: ["IN_REVIEW"],
    to: "CHANGES_REQUESTED",
    authorAllowed: false,
    label: "Vrátit k přepracování",
  },
  APPROVE: {
    from: ["IN_REVIEW"],
    to: "APPROVED",
    authorAllowed: false,
    label: "Schválit",
  },
  PUBLISH: {
    from: ["APPROVED"],
    to: "PUBLISHED",
    authorAllowed: false,
    label: "Publikovat",
  },
};

export const WORKFLOW_STATE_LABELS: Record<AssessmentWorkflowState, string> = {
  DRAFT: "Rozpracováno",
  IN_REVIEW: "Čeká na revizi",
  CHANGES_REQUESTED: "Vráceno k přepracování",
  APPROVED: "Schváleno",
  PUBLISHED: "Publikováno",
};

/**
 * Upravovat obsah hodnocení lze jen tam, kde to nikoho nemate: dokud je
 * rozpracované. Ve stavu IN_REVIEW by se text měnil recenzentovi pod rukama,
 * ve stavu APPROVED by šlo schválené znění nepozorovaně vyměnit za jiné.
 */
export function isEditableState(state: AssessmentWorkflowState): boolean {
  return state === "DRAFT" || state === "CHANGES_REQUESTED";
}

export interface TransitionContext {
  currentState: AssessmentWorkflowState;
  authorId: string;
  actorId: string;
}

/** Vrací chybu jako text, nebo null, když je přechod v pořádku. */
export function checkTransition(action: WorkflowAction, context: TransitionContext): string | null {
  const rule = WORKFLOW_TRANSITIONS[action];

  if (!rule.from.includes(context.currentState)) {
    return `Akci „${rule.label}" nelze provést nad hodnocením ve stavu ${WORKFLOW_STATE_LABELS[context.currentState]}.`;
  }

  if (!rule.authorAllowed && context.authorId === context.actorId) {
    return `Hodnocení nemůže ${rule.label.toLowerCase()} jeho vlastní autor. Musí to udělat někdo jiný z redakce (pravidlo čtyř očí).`;
  }

  return null;
}

export function nextState(action: WorkflowAction): AssessmentWorkflowState {
  return WORKFLOW_TRANSITIONS[action].to;
}

/** Akce, které aktér nad daným hodnocením smí provést. Používá UI i server. */
export function availableActions(context: TransitionContext): WorkflowAction[] {
  return (Object.keys(WORKFLOW_TRANSITIONS) as WorkflowAction[]).filter(
    (action) => checkTransition(action, context) === null,
  );
}
