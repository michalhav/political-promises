/**
 * A3 — odvození hodnotitelnosti slibu z pěti dílčích skóre.
 *
 * Je to nejcitlivější editorský algoritmus v produktu, proto je deterministický,
 * verzovaný a doslovně vypsaný na /methodology. Nikdy ho nesmí nahradit AI ani
 * úsudek jednotlivého redaktora — vstupem jsou skóre, výstupem vždy totéž.
 *
 * Návrh stojí na třech úvahách:
 *  1. Kompetence je vstupní brána. Slib mimo pravomoc města nelze férově hodnotit,
 *     ať je formulovaný sebepřesněji.
 *  2. Průměr sám o sobě lže. Slib s nulovou měřitelností a pěti body ve zbytku
 *     by průměrem vyšel jako dobře hodnotitelný, přitom se u něj nedá říct "splněno".
 *     Proto jsou nad váženým průměrem ještě stropy.
 *  3. Stropy smí hodnocení jen snížit, nikdy zvýšit.
 */
import { z } from "zod";

/** Zvyš při každé změně vah, prahů nebo pravidel. Ukládá se ke každému hodnocení. */
export const METHODOLOGY_VERSION = "1.0.0";

const scoreSchema = z.number().int().min(0).max(5);

export const assessabilityScoresSchema = z.object({
  specificityScore: scoreSchema,
  measurabilityScore: scoreSchema,
  deadlineScore: scoreSchema,
  jurisdictionScore: scoreSchema,
  outcomeDefinitionScore: scoreSchema,
});

export type AssessabilityScores = z.infer<typeof assessabilityScoresSchema>;

export type AssessabilityLevel = "HIGH" | "MEDIUM" | "LOW" | "NOT_ASSESSABLE";

/** Kód pravidla, které se uplatnilo. Jde do UI jako odpověď na "proč zrovna tohle?". */
export type AssessabilityRuleCode =
  | "GATE_OUT_OF_JURISDICTION"
  | "GATE_PURE_DECLARATION"
  | "CAP_LOW_MEASURABILITY"
  | "CAP_NO_OUTCOME_DEFINITION"
  | "CAP_NO_DEADLINE"
  | "THRESHOLD";

export interface AppliedRule {
  code: AssessabilityRuleCode;
  /** Vysvětlení v češtině, zobrazitelné veřejně beze změny. */
  explanation: string;
}

export interface AssessabilityResult {
  level: AssessabilityLevel;
  /** Vážený průměr 0–5, zaokrouhlený na dvě desetinná místa. */
  weightedScore: number;
  appliedRules: AppliedRule[];
  methodologyVersion: string;
}

/** Součet vah je 1. Měřitelnost váží nejvíc — bez ní nejde doložit výsledek. */
export const WEIGHTS = {
  specificityScore: 0.25,
  measurabilityScore: 0.3,
  outcomeDefinitionScore: 0.2,
  deadlineScore: 0.15,
  jurisdictionScore: 0.1,
} as const satisfies Record<keyof AssessabilityScores, number>;

export const THRESHOLDS = { HIGH: 4.0, MEDIUM: 2.5, LOW: 1.2 } as const;

export const LEVEL_ORDER: readonly AssessabilityLevel[] = [
  "NOT_ASSESSABLE",
  "LOW",
  "MEDIUM",
  "HIGH",
];

function capAt(current: AssessabilityLevel, ceiling: AssessabilityLevel): AssessabilityLevel {
  return LEVEL_ORDER.indexOf(current) <= LEVEL_ORDER.indexOf(ceiling) ? current : ceiling;
}

function weightedAverage(scores: AssessabilityScores): number {
  const total = (Object.keys(WEIGHTS) as (keyof AssessabilityScores)[]).reduce(
    (sum, key) => sum + scores[key] * WEIGHTS[key],
    0,
  );
  return Math.round(total * 100) / 100;
}

function levelFromThreshold(score: number): AssessabilityLevel {
  if (score >= THRESHOLDS.HIGH) return "HIGH";
  if (score >= THRESHOLDS.MEDIUM) return "MEDIUM";
  if (score >= THRESHOLDS.LOW) return "LOW";
  return "NOT_ASSESSABLE";
}

export function deriveAssessability(input: AssessabilityScores): AssessabilityResult {
  const scores = assessabilityScoresSchema.parse(input);
  const weightedScore = weightedAverage(scores);

  // Brány. Uplatní se před prahy a končí rovnou na NOT_ASSESSABLE.
  if (scores.jurisdictionScore <= 1) {
    return {
      level: "NOT_ASSESSABLE",
      weightedScore,
      methodologyVersion: METHODOLOGY_VERSION,
      appliedRules: [
        {
          code: "GATE_OUT_OF_JURISDICTION",
          explanation:
            "Slib se netýká pravomoci daného orgánu. Splnění by nezáleželo na tom, kdo slib dal, proto ho nehodnotíme.",
        },
      ],
    };
  }

  if (scores.specificityScore <= 1 && scores.measurabilityScore <= 1) {
    return {
      level: "NOT_ASSESSABLE",
      weightedScore,
      methodologyVersion: METHODOLOGY_VERSION,
      appliedRules: [
        {
          code: "GATE_PURE_DECLARATION",
          explanation:
            "Slib je obecné prohlášení bez konkrétního obsahu i bez měřitelného cíle. Nelze u něj určit, co by znamenalo splnění.",
        },
      ],
    };
  }

  const appliedRules: AppliedRule[] = [
    {
      code: "THRESHOLD",
      explanation: `Vážené skóre ${weightedScore.toFixed(2)} z 5 odpovídá stupni ${levelFromThreshold(weightedScore)}.`,
    },
  ];

  let level = levelFromThreshold(weightedScore);

  // Stropy. Smí hodnocení jen snížit.
  if (scores.measurabilityScore <= 2) {
    level = capAt(level, "MEDIUM");
    appliedRules.push({
      code: "CAP_LOW_MEASURABILITY",
      explanation:
        "Slib nemá dost měřitelný obsah, proto ho neoznačujeme za dobře hodnotitelný ani při jinak vysokém skóre.",
    });
  }

  if (scores.outcomeDefinitionScore <= 1) {
    level = capAt(level, "MEDIUM");
    appliedRules.push({
      code: "CAP_NO_OUTCOME_DEFINITION",
      explanation:
        "Slib neurčuje, jaký výsledek by znamenal splnění. Průběh se sledovat dá, výsledek nikoli.",
    });
  }

  if (scores.deadlineScore === 0) {
    level = capAt(level, "MEDIUM");
    appliedRules.push({
      code: "CAP_NO_DEADLINE",
      explanation:
        "Slib neuvádí žádný časový rámec, ani odkaz na volební období. Nelze určit, kdy měl být splněn.",
    });
  }

  return { level, weightedScore, appliedRules, methodologyVersion: METHODOLOGY_VERSION };
}
