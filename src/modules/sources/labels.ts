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

/**
 * Role důkazu tak, jak ji čte návštěvník.
 *
 * Redesign brief chce role typu „Dokládá politické rozhodnutí" nebo „Potvrzuje
 * převzetí do koaliční dohody". Ty ale nejdou odvodit ze samotného typu vazby —
 * `SUPPORTS` u koaliční smlouvy a `SUPPORTS` u volebního programu znamenají pro
 * čtenáře něco jiného. Roli proto skládáme z **typu vazby a typu dokumentu**;
 * obojí v datech máme, takže se nic nedomýšlí.
 *
 * Doménové enumy zůstávají beze změny — tohle je čistě prezentační vrstva.
 */
export function evidenceRoleLabel(
  relationType: RelationTypeValue,
  sourceType: SourceTypeValue,
): string {
  if (relationType === "SUPPORTS") {
    if (sourceType === "COALITION_AGREEMENT") return "Potvrzuje převzetí do koaliční smlouvy";
    if (sourceType === "ELECTION_PROGRAM") return "Potvrzuje původní závazek";
    return "Potvrzuje závazek";
  }

  if (relationType === "IMPLEMENTATION" || relationType === "PROGRESS") {
    if (sourceType === "COUNCIL_RESOLUTION" || sourceType === "COUNCIL_VOTE") {
      return "Dokládá politické rozhodnutí";
    }
    if (sourceType === "PUBLIC_PROCUREMENT" || sourceType === "CONTRACT") {
      return "Dokládá zadání a smlouvy";
    }
    return relationType === "IMPLEMENTATION" ? "Dokládá realizaci" : "Dokládá průběh";
  }

  return RELATION_TYPE_LABELS[relationType];
}

/**
 * Pořadí rolí v souhrnu „Jak to víme".
 *
 * Sleduje životní cyklus slibu, ne abecedu ani četnost — čtenář má vidět cestu
 * od závazku k výsledku.
 */
export const EVIDENCE_ROLE_ORDER: readonly RelationTypeValue[] = [
  "SUPPORTS",
  "IMPLEMENTATION",
  "FUNDING",
  "PROGRESS",
  "OUTCOME",
  "CONTRADICTS",
  "CONTEXT",
];
