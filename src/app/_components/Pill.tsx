import type { ReactNode } from "react";

/**
 * Štítek se stavem.
 *
 * Vědomě tu není zelená pro „splněno“ a červená pro „opuštěno“. Barevná škála
 * dobrý–špatný by ze stránky udělala hodnocení politiků, ne popis skutečnosti
 * (produktový princip č. 3). Odlišuje se jediná věc, a to ne kvalitou výsledku,
 * ale tím, jestli vůbec nějaký závěr máme: `muted` znamená „nevíme“ nebo
 * „neuplatňuje se“.
 *
 * Text nese celou informaci i bez barvy — brief, UI/UX: stav se nikdy nesmí
 * kódovat jen barvou.
 */
export type PillTone = "neutral" | "muted";

const TONE_CLASSES: Record<PillTone, string> = {
  neutral: "border-border bg-surface text-foreground",
  muted: "border-border border-dashed bg-transparent text-muted",
};

interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  /** Čeho se štítek týká, například „Stav plnění“. Čte se i odečítačem. */
  prefix?: string;
}

export function Pill({ children, tone = "neutral", prefix }: PillProps) {
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-sm ${TONE_CLASSES[tone]}`}
    >
      {prefix ? <span className="text-muted text-xs tracking-wide uppercase">{prefix}</span> : null}
      <span>{children}</span>
    </span>
  );
}
