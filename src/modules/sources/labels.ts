import { relationTypeEnum, sourceTypeEnum } from "@/db/enums";

export type SourceTypeValue = (typeof sourceTypeEnum.enumValues)[number];
export type RelationTypeValue = (typeof relationTypeEnum.enumValues)[number];

export const SOURCE_TYPE_LABELS: Record<SourceTypeValue, string> = {
  ELECTION_PROGRAM: "Volební program",
  COALITION_AGREEMENT: "Koaliční smlouva",
  COUNCIL_RESOLUTION: "Usnesení zastupitelstva",
  COUNCIL_VOTE: "Hlasování zastupitelstva",
  BUDGET: "Rozpočet",
  CONTRACT: "Smlouva",
  PUBLIC_PROCUREMENT: "Veřejná zakázka",
  OFFICIAL_REPORT: "Úřední zpráva",
  MEDIA_REPORT: "Mediální zpráva",
  OTHER: "Jiný dokument",
};

/** Čím je zdroj pro slib. Popisek říká vztah, ne hodnocení. */
export const RELATION_TYPE_LABELS: Record<RelationTypeValue, string> = {
  SUPPORTS: "Potvrzuje závazek",
  CONTRADICTS: "Je v rozporu se závazkem",
  PROGRESS: "Dokládá průběh",
  IMPLEMENTATION: "Dokládá realizaci",
  FUNDING: "Dokládá financování",
  OUTCOME: "Dokládá výsledek",
  CONTEXT: "Kontext",
};
