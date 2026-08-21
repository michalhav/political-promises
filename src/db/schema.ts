/**
 * Jediný barrel, který vidí drizzle-kit. Tabulky žijí ve svých modulech,
 * aby doménové hranice zůstaly čitelné, ale migrace potřebují jeden vstupní bod.
 */
export * from "@/db/enums";
export * from "@/modules/accounts/schema";
export * from "@/modules/ai/schema";
export * from "@/modules/assessments/schema";
export * from "@/modules/coalition/schema";
export * from "@/modules/evidence/schema";
export * from "@/modules/jurisdictions/schema";
export * from "@/modules/parties/schema";
export * from "@/modules/promises/schema";
export * from "@/modules/review/schema";
export * from "@/modules/sources/schema";
