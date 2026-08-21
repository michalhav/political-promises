/**
 * České popisky stavů.
 *
 * Formulace jsou schválně nehodnotící: „opuštěno" místo „porušený slib",
 * „nedosaženo" místo „selhání". Produkt popisuje, co se stalo, a nevynáší soud
 * (produktový princip č. 3 a integritní pravidlo č. 9).
 *
 * Ke každému stavu patří i `meaning` — jednou větou, co ten stav znamená.
 * Bez toho by uživatel musel význam odhadovat z barvy, což je přesně to, co
 * přístupnost zakazuje.
 */
import { assessabilityEnum, executionStatusEnum, outcomeStatusEnum } from "@/db/enums";

export type AssessabilityLevel = (typeof assessabilityEnum.enumValues)[number];
export type ExecutionStatusValue = (typeof executionStatusEnum.enumValues)[number];
export type OutcomeStatusValue = (typeof outcomeStatusEnum.enumValues)[number];

export interface StatusLabel {
  label: string;
  meaning: string;
}

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatusValue, StatusLabel> = {
  NO_VERIFIED_PROGRESS: {
    label: "Bez doloženého postupu",
    meaning:
      "K rozhodnému datu jsme nenašli veřejně dostupný doklad o realizaci. Neznamená to, že se nic neděje — jen že o tom nemáme zdroj.",
  },
  NOT_STARTED: {
    label: "Nezahájeno",
    meaning: "Zdroj výslovně uvádí, že realizace zahájena nebyla.",
  },
  PLANNED: {
    label: "Naplánováno",
    meaning: "Existuje schválený záměr nebo vyčleněné peníze, realizace ještě neběží.",
  },
  IN_PROGRESS: { label: "Probíhá", meaning: "Realizace běží a je doložená zdrojem." },
  PARTIALLY_COMPLETED: {
    label: "Částečně splněno",
    meaning: "Část závazku je hotová, zbytek ne.",
  },
  COMPLETED: { label: "Splněno", meaning: "Závazek byl podle zdrojů realizován v plném rozsahu." },
  ABANDONED: {
    label: "Opuštěno",
    meaning: "Doložený krok ukazuje, že se od závazku ustoupilo.",
  },
  BLOCKED: {
    label: "Zastaveno",
    meaning: "Realizace se zastavila na překážce mimo běžný postup, například na námitkách.",
  },
  NOT_ASSESSABLE: {
    label: "Nehodnotitelné",
    meaning: "U tohoto slibu nelze určit, co by znamenalo splnění.",
  },
  UNKNOWN: {
    label: "Nezjištěno",
    meaning: "Slib jsme zatím systematicky neprošli, takže o jeho stavu netvrdíme nic.",
  },
};

export const OUTCOME_STATUS_LABELS: Record<OutcomeStatusValue, StatusLabel> = {
  NOT_MEASURABLE_YET: {
    label: "Zatím neměřitelné",
    meaning: "Cílový stav se ještě nedá změřit, například protože nenastal termín.",
  },
  ACHIEVED: { label: "Dosaženo", meaning: "Naměřená hodnota dosáhla slíbeného cíle." },
  PARTIALLY_ACHIEVED: {
    label: "Částečně dosaženo",
    meaning: "Naměřená hodnota se k cíli přiblížila, ale nedosáhla ho.",
  },
  NOT_ACHIEVED: { label: "Nedosaženo", meaning: "Naměřená hodnota slíbeného cíle nedosáhla." },
  UNKNOWN: { label: "Nezjištěno", meaning: "Nemáme naměřenou hodnotu, ze které by šlo vyjít." },
  NOT_APPLICABLE: {
    label: "Neuplatňuje se",
    meaning: "Slib neurčuje cílový stav, který by šlo měřit.",
  },
};

export const ASSESSABILITY_LABELS: Record<AssessabilityLevel, StatusLabel> = {
  HIGH: {
    label: "Dobře hodnotitelný",
    meaning: "Slib je konkrétní, měřitelný a spadá do pravomoci daného orgánu.",
  },
  MEDIUM: {
    label: "Částečně hodnotitelný",
    meaning: "Slib jde sledovat, ale v některé dimenzi chybí opora pro jednoznačný závěr.",
  },
  LOW: {
    label: "Obtížně hodnotitelný",
    meaning: "Slib je natolik obecný, že se závěr o splnění opírá hlavně o výklad.",
  },
  NOT_ASSESSABLE: {
    label: "Nehodnotitelný",
    meaning: "U slibu nelze objektivně určit, co by znamenalo splnění.",
  },
};
