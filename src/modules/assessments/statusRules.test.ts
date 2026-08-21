import { describe, expect, it } from "vitest";

import { validateAssessmentConsistency } from "@/modules/assessments/statusRules";

describe("validateAssessmentConsistency", () => {
  it("propustí doložený výrok o splněném výsledku", () => {
    const errors = validateAssessmentConsistency({
      assessability: "HIGH",
      executionStatus: "COMPLETED",
      outcomeStatus: "ACHIEVED",
      hasMeasuredMetric: true,
      hasVerifiedEvidence: true,
    });

    expect(errors).toEqual([]);
  });

  it("nepustí výrok o výsledku bez naměřené hodnoty", () => {
    const errors = validateAssessmentConsistency({
      assessability: "HIGH",
      executionStatus: "COMPLETED",
      outcomeStatus: "ACHIEVED",
      hasMeasuredMetric: false,
      hasVerifiedEvidence: true,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("naměřenou hodnotu");
  });

  it("nedovolí u nehodnotitelného slibu tvrdit splnění", () => {
    const errors = validateAssessmentConsistency({
      assessability: "NOT_ASSESSABLE",
      executionStatus: "COMPLETED",
      outcomeStatus: "ACHIEVED",
      hasMeasuredMetric: true,
      hasVerifiedEvidence: true,
    });

    expect(errors).toHaveLength(2);
    expect(errors.join(" ")).toContain("stav plnění COMPLETED");
    expect(errors.join(" ")).toContain("stav výsledku ACHIEVED");
  });

  it("povolí nehodnotitelný slib s neutrálními statusy", () => {
    const errors = validateAssessmentConsistency({
      assessability: "NOT_ASSESSABLE",
      executionStatus: "NOT_ASSESSABLE",
      outcomeStatus: "NOT_APPLICABLE",
      hasMeasuredMetric: false,
      hasVerifiedEvidence: false,
    });

    expect(errors).toEqual([]);
  });

  it("nedovolí stav plnění NOT_ASSESSABLE u hodnotitelného slibu", () => {
    const errors = validateAssessmentConsistency({
      assessability: "MEDIUM",
      executionStatus: "NOT_ASSESSABLE",
      outcomeStatus: "UNKNOWN",
      hasMeasuredMetric: false,
      hasVerifiedEvidence: false,
    });

    expect(errors).toHaveLength(1);
  });

  it("nechává průběh a výsledek oddělené: slib bez doloženého postupu smí mít doložený výsledek", () => {
    // Cíl nastal bez přičinění radnice. Produktový princip č. 2 to musí unést.
    const errors = validateAssessmentConsistency({
      assessability: "HIGH",
      executionStatus: "NO_VERIFIED_PROGRESS",
      outcomeStatus: "ACHIEVED",
      hasMeasuredMetric: true,
      hasVerifiedEvidence: false,
    });

    expect(errors).toEqual([]);
  });

  it("nepustí tvrzení o zahájené realizaci bez jediného důkazu", () => {
    const errors = validateAssessmentConsistency({
      assessability: "HIGH",
      executionStatus: "IN_PROGRESS",
      outcomeStatus: "NOT_MEASURABLE_YET",
      hasMeasuredMetric: false,
      hasVerifiedEvidence: false,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ověřenou vazbu");
  });

  it("nevyžaduje důkaz tam, kde se jen konstatuje, že jsme ho nenašli", () => {
    const errors = validateAssessmentConsistency({
      assessability: "MEDIUM",
      executionStatus: "NO_VERIFIED_PROGRESS",
      outcomeStatus: "NOT_MEASURABLE_YET",
      hasMeasuredMetric: false,
      hasVerifiedEvidence: false,
    });

    expect(errors).toEqual([]);
  });

  it("nepustí tvrzení, že realizace nezačala, bez zdroje, který to uvádí", () => {
    // "Nezahájeno" je výrok o městě, ne o našich zdrojích. Projekt může běžet
    // interně dřív, než o něm vznikne veřejný dokument.
    const errors = validateAssessmentConsistency({
      assessability: "MEDIUM",
      executionStatus: "NOT_STARTED",
      outcomeStatus: "NOT_MEASURABLE_YET",
      hasMeasuredMetric: false,
      hasVerifiedEvidence: false,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("NO_VERIFIED_PROGRESS");
  });

  it("doložené nezahájení projde", () => {
    const errors = validateAssessmentConsistency({
      assessability: "MEDIUM",
      executionStatus: "NOT_STARTED",
      outcomeStatus: "NOT_MEASURABLE_YET",
      hasMeasuredMetric: false,
      hasVerifiedEvidence: true,
    });

    expect(errors).toEqual([]);
  });
});
