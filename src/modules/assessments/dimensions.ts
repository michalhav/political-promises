/**
 * Popis pěti dimenzí hodnotitelnosti pro veřejnou stránku /methodology.
 *
 * Texty žijí vedle algoritmu schválně: kdyby se metodika psala zvlášť v CMS
 * nebo v Markdownu, po první změně vah by se rozešla s tím, co kód doopravdy dělá.
 */
import type { AssessabilityScores } from "@/modules/assessments/assessability";

export interface AssessabilityDimension {
  key: keyof AssessabilityScores;
  label: string;
  question: string;
  /** Co znamená 0 a co 5. Redaktor podle toho boduje, čtenář podle toho kontroluje. */
  lowAnchor: string;
  highAnchor: string;
}

export const ASSESSABILITY_DIMENSIONS: readonly AssessabilityDimension[] = [
  {
    key: "specificityScore",
    label: "Konkrétnost",
    question: "Je jasné, co přesně se má stát?",
    lowAnchor: "Obecné prohlášení o směřování.",
    highAnchor: "Pojmenované opatření, místo, rozsah.",
  },
  {
    key: "measurabilityScore",
    label: "Měřitelnost",
    question: "Dá se splnění doložit číslem nebo doložitelnou skutečností?",
    lowAnchor: "Nelze určit, co by bylo splnění.",
    highAnchor: "Existuje veličina, kterou lze změřit a ověřit ze zdroje.",
  },
  {
    key: "deadlineScore",
    label: "Termín",
    question: "Je určeno, do kdy?",
    lowAnchor: "Žádný časový rámec.",
    highAnchor: "Konkrétní datum nebo jasně vymezené období.",
  },
  {
    key: "jurisdictionScore",
    label: "Pravomoc",
    question: "Rozhoduje o věci orgán, do kterého se kandidovalo?",
    lowAnchor: "Rozhoduje stát, kraj nebo soukromý subjekt.",
    highAnchor: "Věc je plně v pravomoci daného orgánu.",
  },
  {
    key: "outcomeDefinitionScore",
    label: "Definice výsledku",
    question: "Je řečeno, jaký stav světa má nastat?",
    lowAnchor: "Popisuje jen činnost, ne výsledek.",
    highAnchor: "Popisuje měřitelný cílový stav.",
  },
];
