import { ASSESSABILITY_LABELS } from "@/modules/assessments/labels";
import { ASSESSABILITY_DIMENSIONS } from "@/modules/assessments/dimensions";
import type { AssessmentView } from "@/modules/promises/queries";

/**
 * Rozpad hodnotitelnosti.
 *
 * Brief chce, aby čtenář na jedno kliknutí zjistil, proč má slib zrovna tenhle
 * stav. Proto se tu neukazuje jen výsledný stupeň, ale i všech pět dílčích
 * skóre a doslovné znění pravidla, které o výsledku rozhodlo. Text pravidel
 * chodí z téže funkce, která stupeň spočítala — nedá se tedy rozejít s tím,
 * co kód opravdu dělá.
 */
export function AssessabilityPanel({ assessment }: { assessment: AssessmentView }) {
  const { derivation, scores } = assessment;

  return (
    <div className="space-y-5">
      <p className="text-muted max-w-2xl">
        {ASSESSABILITY_LABELS[assessment.assessability].meaning}
      </p>

      <dl className="divide-border divide-y">
        {ASSESSABILITY_DIMENSIONS.map((dimension) => {
          const score = scores[dimension.key];
          return (
            <div key={dimension.key} className="grid gap-1 py-3 sm:grid-cols-[14rem_3rem_1fr]">
              <dt className="font-medium">{dimension.label}</dt>
              <dd className="tabular-nums">
                <span aria-hidden="true">{score} / 5</span>
                <span className="sr-only">{score} z 5 bodů</span>
              </dd>
              <dd className="text-muted text-sm">
                {dimension.question} {score <= 2 ? dimension.lowAnchor : dimension.highAnchor}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="border-border bg-surface space-y-3 rounded-lg border p-4">
        <p className="text-sm">
          <span className="text-muted">Vážené skóre </span>
          <span className="tabular-nums">{derivation.weightedScore.toFixed(2)} z 5</span>
          <span className="text-muted"> · metodika verze {derivation.methodologyVersion}</span>
        </p>
        <ul className="space-y-2 text-sm">
          {derivation.appliedRules.map((rule) => (
            <li key={rule.code}>{rule.explanation}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
