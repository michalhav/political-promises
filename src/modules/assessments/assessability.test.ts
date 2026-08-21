import { describe, expect, it } from "vitest";

import { METHODOLOGY_VERSION, deriveAssessability } from "@/modules/assessments/assessability";

const scores = (
  specificity: number,
  measurability: number,
  deadline: number,
  jurisdiction: number,
  outcomeDefinition: number,
) => ({
  specificityScore: specificity,
  measurabilityScore: measurability,
  deadlineScore: deadline,
  jurisdictionScore: jurisdiction,
  outcomeDefinitionScore: outcomeDefinition,
});

describe("deriveAssessability", () => {
  it("označí za dobře hodnotitelný slib, který je konkrétní, měřitelný a v pravomoci města", () => {
    // "Postavíme 5 000 obecních bytů do konce volebního období."
    const result = deriveAssessability(scores(5, 5, 4, 5, 5));

    expect(result.level).toBe("HIGH");
    expect(result.weightedScore).toBe(4.85);
    expect(result.methodologyVersion).toBe(METHODOLOGY_VERSION);
  });

  it("kompetence funguje jako vstupní brána bez ohledu na ostatní skóre", () => {
    // Dokonalá formulace, ale o věci nerozhoduje magistrát.
    const result = deriveAssessability(scores(5, 5, 5, 1, 5));

    expect(result.level).toBe("NOT_ASSESSABLE");
    expect(result.appliedRules.map((rule) => rule.code)).toEqual(["GATE_OUT_OF_JURISDICTION"]);
  });

  it("obecné prohlášení bez konkrétnosti i měřitelnosti je nehodnotitelné", () => {
    // "Budeme dbát na kvalitu života v Praze."
    const result = deriveAssessability(scores(1, 1, 3, 5, 2));

    expect(result.level).toBe("NOT_ASSESSABLE");
    expect(result.appliedRules.map((rule) => rule.code)).toEqual(["GATE_PURE_DECLARATION"]);
  });

  it("nízká měřitelnost strhne i jinak vysoký průměr nejvýš na MEDIUM", () => {
    const result = deriveAssessability(scores(5, 2, 5, 5, 5));

    expect(result.weightedScore).toBeGreaterThan(4);
    expect(result.level).toBe("MEDIUM");
    expect(result.appliedRules.map((rule) => rule.code)).toContain("CAP_LOW_MEASURABILITY");
  });

  it("chybějící definice výsledku strhne hodnocení na MEDIUM", () => {
    const result = deriveAssessability(scores(5, 5, 5, 5, 1));

    expect(result.level).toBe("MEDIUM");
    expect(result.appliedRules.map((rule) => rule.code)).toContain("CAP_NO_OUTCOME_DEFINITION");
  });

  it("úplně chybějící termín strhne hodnocení na MEDIUM", () => {
    const result = deriveAssessability(scores(5, 5, 0, 5, 5));

    expect(result.level).toBe("MEDIUM");
    expect(result.appliedRules.map((rule) => rule.code)).toContain("CAP_NO_DEADLINE");
  });

  it("strop nikdy hodnocení nezvyšuje", () => {
    // Slabý slib se stropem MEDIUM musí zůstat LOW, ne vyskočit nahoru.
    const result = deriveAssessability(scores(2, 2, 1, 2, 1));

    expect(result.level).toBe("LOW");
  });

  it("je deterministický", () => {
    const input = scores(3, 4, 2, 4, 3);

    expect(deriveAssessability(input)).toEqual(deriveAssessability(input));
  });

  it("odmítne skóre mimo rozsah 0–5", () => {
    expect(() => deriveAssessability(scores(6, 3, 3, 3, 3))).toThrow();
    expect(() => deriveAssessability(scores(-1, 3, 3, 3, 3))).toThrow();
  });

  it("odmítne neceločíselné skóre", () => {
    expect(() => deriveAssessability(scores(3.5, 3, 3, 3, 3))).toThrow();
  });

  it("vrací vysvětlení ke každému uplatněnému pravidlu", () => {
    const result = deriveAssessability(scores(4, 2, 0, 4, 1));

    expect(result.appliedRules.length).toBeGreaterThan(1);
    for (const rule of result.appliedRules) {
      expect(rule.explanation.length).toBeGreaterThan(20);
    }
  });
});
