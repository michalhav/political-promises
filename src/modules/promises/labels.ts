import { eventTypeEnum, topicEnum } from "@/db/enums";

export type Topic = (typeof topicEnum.enumValues)[number];
export type EventTypeValue = (typeof eventTypeEnum.enumValues)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  HOUSING: "Bydlení",
  TRANSPORT: "Doprava",
  EDUCATION: "Školství",
  ENVIRONMENT: "Životní prostředí",
  DIGITALIZATION: "Digitalizace",
  PUBLIC_FINANCE: "Veřejné finance",
  SECURITY: "Bezpečnost",
  SOCIAL_POLICY: "Sociální politika",
  URBAN_DEVELOPMENT: "Rozvoj města",
  OTHER: "Ostatní",
};

/** Pořadí pro filtry. Držíme abecední, ať se nedá číst jako důležitost témat. */
export const TOPIC_ORDER: readonly Topic[] = [...topicEnum.enumValues].sort((a, b) =>
  TOPIC_LABELS[a].localeCompare(TOPIC_LABELS[b], "cs"),
);

export const EVENT_TYPE_LABELS: Record<EventTypeValue, string> = {
  PROMISE_CREATED: "Slib zveřejněn",
  COALITION_INCLUDED: "Převzato do koaliční smlouvy",
  COALITION_MODIFIED: "Změněno v koaliční smlouvě",
  COUNCIL_DECISION: "Rozhodnutí zastupitelstva",
  BUDGET_ALLOCATED: "Vyčleněno v rozpočtu",
  PROCUREMENT_STARTED: "Vyhlášena veřejná zakázka",
  CONTRACT_SIGNED: "Podepsána smlouva",
  IMPLEMENTATION_STARTED: "Zahájena realizace",
  MILESTONE_REACHED: "Dosažen milník",
  COMPLETED: "Dokončeno",
  BLOCKED: "Realizace zastavena",
  ABANDONED: "Od záměru se ustoupilo",
};
