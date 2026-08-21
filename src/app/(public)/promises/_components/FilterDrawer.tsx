"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

/**
 * Zásuvka s filtry pro malé displeje.
 *
 * Psané ručně, ne přes knihovnu: potřebujeme jediný dialog na celém webu a
 * závislost by sem přinesla portály, animační runtime a vlastní focus systém
 * kvůli dvěma stům řádků chování.
 *
 * Zásadní je, že jde o **progresivní vylepšení**. Filtry samy jsou obyčejné
 * odkazy a musí fungovat i bez JavaScriptu — proto se na serveru vykreslí
 * rovnou rozbalené a teprve po připojení Reactu se na mobilu složí do
 * zásuvky. Kdyby se skript nenačetl, čtenář dostane filtry pod sebou; kdyby
 * se panel skrýval už v HTML, nedostal by je vůbec.
 *
 * Na širokém displeji zásuvka neexistuje — tam je místa dost a schovávat
 * navigační prvek za tlačítko by byl jen ztracený klik.
 */
export function FilterDrawer({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const opener = openerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.focus();

    // Focus nesmí utéct pod otevřenou zásuvku — pro odečítač i pro klávesnici
    // je to jinak past: tabuje se po odkazech, které nejsou vidět.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panel!.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  const panelClass = !mounted
    ? "space-y-5"
    : open
      ? "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] space-y-5 overflow-y-auto rounded-t-2xl border-t border-border bg-background p-5 shadow-2xl lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none"
      : "hidden space-y-5 lg:block";

  return (
    <>
      {mounted ? (
        <button
          ref={openerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="border-border w-full rounded-md border px-4 py-2.5 text-left font-medium lg:hidden"
        >
          Filtry a hledání
          {activeCount > 0 ? (
            <span className="text-muted font-normal">
              {" · "}
              {activeCount} {activeCount === 1 ? "aktivní" : "aktivních"}
            </span>
          ) : null}
        </button>
      ) : null}

      {mounted && open ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div
        ref={panelRef}
        className={panelClass}
        {...(mounted && open
          ? { role: "dialog", "aria-modal": true, "aria-labelledby": titleId, tabIndex: -1 }
          : {})}
      >
        {mounted && open ? (
          <div className="flex items-baseline justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold">
              Filtry a hledání
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-border rounded-md border px-3 py-1.5 text-sm"
            >
              Zavřít
            </button>
          </div>
        ) : null}

        {children}
      </div>
    </>
  );
}

/**
 * Rozlišení serverového a klientského vykreslení.
 *
 * Hodnota se nikdy nemění, takže není co odebírat — jde jen o to, že snapshot
 * na serveru je `false` a v prohlížeči `true`. Proti `useState` + `useEffect`
 * to nevyvolá druhý průchod renderem.
 */
function subscribeToNothing(): () => void {
  return () => {};
}
