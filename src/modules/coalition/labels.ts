import { coalitionMappingTypeEnum } from "@/db/enums";

export type CoalitionClassification = (typeof coalitionMappingTypeEnum.enumValues)[number];

export interface ClassificationLabel {
  label: string;
  meaning: string;
}

export const COALITION_CLASSIFICATION_LABELS: Record<CoalitionClassification, ClassificationLabel> =
  {
    RETAINED: {
      label: "Převzato",
      meaning: "Koaliční smlouva obsahuje týž závazek. Formulace se může lišit, obsah ne.",
    },
    MODIFIED: {
      label: "Změněno",
      meaning:
        "Koaliční smlouva závazek obsahuje, ale v jiné podobě — typicky bez čísla, rozsahu nebo termínu.",
    },
    MERGED: {
      label: "Sloučeno",
      meaning: "Závazek se v koaliční smlouvě rozplynul do širšího programu spolu s dalšími.",
    },
    NOT_INCLUDED: {
      label: "Nezahrnuto",
      meaning: "Koaliční smlouva se k závazku nevyjadřuje.",
    },
    UNCLEAR: {
      label: "Nejednoznačné",
      meaning:
        "V koaliční smlouvě je pasáž, kterou k závazku nelze jednoznačně přiřadit ani ho vyloučit.",
    },
  };

/** Pořadí od nejtěsnější shody po žádnou. Není to hodnocení, ale míra překryvu. */
export const COALITION_CLASSIFICATION_ORDER: readonly CoalitionClassification[] = [
  "RETAINED",
  "MODIFIED",
  "MERGED",
  "UNCLEAR",
  "NOT_INCLUDED",
];
