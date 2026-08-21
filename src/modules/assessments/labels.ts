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
  COMPLETED: {
    // „Dokončeno" pro průběh, „Dosažen" pro výsledek. Rozdíl mezi oběma osami
    // má být patrný z jazyka, ne až z popisku pod ním.
    label: "Dokončeno",
    meaning: "Závazek byl podle zdrojů realizován v plném rozsahu.",
  },
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
    label: "Zatím neměřitelný",
    meaning: "Cílový stav se ještě nedá změřit, například protože nenastal termín.",
  },
  ACHIEVED: { label: "Dosažen", meaning: "Naměřená hodnota dosáhla slíbeného cíle." },
  PARTIALLY_ACHIEVED: {
    label: "Částečně dosažen",
    meaning: "Naměřená hodnota se k cíli přiblížila, ale nedosáhla ho.",
  },
  NOT_ACHIEVED: { label: "Nedosažen", meaning: "Naměřená hodnota slíbeného cíle nedosáhla." },
  UNKNOWN: { label: "Nezjištěn", meaning: "Nemáme naměřenou hodnotu, ze které by šlo vyjít." },
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

/**
 * Vizuální odstín stavu. **Sekundární signál** — význam vždy nese text.
 *
 * Škála není dobrý–špatný. Rozlišuje jen povahu tvrzení:
 *   active  — něco doloženě běží,
 *   settled — věc je uzavřená (dokončená i opuštěná; obojí je závěr),
 *   caution — realizace narazila, nebo je závěr nejistý,
 *   neutral — o skutečnosti netvrdíme nic.
 */
export type StatusTone = "active" | "settled" | "caution" | "neutral";

export const EXECUTION_STATUS_TONE: Record<ExecutionStatusValue, StatusTone> = {
  NO_VERIFIED_PROGRESS: "neutral",
  NOT_STARTED: "neutral",
  PLANNED: "active",
  IN_PROGRESS: "active",
  PARTIALLY_COMPLETED: "active",
  COMPLETED: "settled",
  // Opuštěno je uzavřená věc, zastaveno je překážka — proto různý odstín.
  ABANDONED: "settled",
  BLOCKED: "caution",
  NOT_ASSESSABLE: "neutral",
  UNKNOWN: "neutral",
};

export const OUTCOME_STATUS_TONE: Record<OutcomeStatusValue, StatusTone> = {
  NOT_MEASURABLE_YET: "neutral",
  ACHIEVED: "settled",
  PARTIALLY_ACHIEVED: "active",
  NOT_ACHIEVED: "caution",
  UNKNOWN: "neutral",
  NOT_APPLICABLE: "neutral",
};

/**
 * Znak před popiskem. Druhý nositel významu vedle textu, aby stav nešel
 * poznat jen podle odstínu. Je to text, ne obrázek — čte ho i odečítač
 * a přežije zvětšení písma.
 */
export const STATUS_TONE_MARK: Record<StatusTone, string> = {
  active: "◐",
  settled: "●",
  caution: "▲",
  neutral: "○",
};

/**
 * Stavy, u kterých se čtenář snadno splete a potřebuje vysvětlení přímo
 * u hodnoty, ne až v metodice. „Bez doloženého postupu" se dá číst jako
 * „nic se nestalo", což by bylo tvrzení, které nemáme z čeho doložit.
 */
export const EXECUTION_NEEDS_SAFEGUARD: readonly ExecutionStatusValue[] = [
  "NO_VERIFIED_PROGRESS",
  "NOT_STARTED",
];
