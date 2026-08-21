/**
 * Označení smyšleného záznamu.
 *
 * Brief (sekce DEMO DATA) to vyžaduje výslovně: ukázková data se nesmí dát
 * splést se skutečnými. Značka proto stojí přímo u jména kandidátky a u názvu
 * dokumentu, ne jen v patičce stránky, kterou nikdo nečte.
 */
export function DemoBadge() {
  return (
    <span
      // Barvu dědí po okolí (`current`), ne pevný odstín. Značka se objevuje
      // i na tmavém pozadí aktivního tlačítka, kde by tlumená šedá nebyla
      // čitelná — což odhalila přístupnostní kontrola na /compare.
      className="ml-1.5 inline-block rounded border border-current/40 px-1.5 py-0.5 align-middle text-[0.65rem] font-semibold tracking-wide text-current uppercase"
      title="Smyšlený záznam z ukázkového datasetu"
    >
      demo
    </span>
  );
}

export function DemoDatasetNotice() {
  return (
    <aside className="border-border bg-surface rounded-lg border p-4 text-sm" role="note">
      <p className="font-semibold">Ukázková data</p>
      <p className="text-muted mt-1">
        Kandidátky, dokumenty i sliby na těchto stránkách jsou smyšlené a slouží k předvedení
        aplikace. Neodpovídají žádné skutečné politické straně ani skutečnému veřejnému dokumentu.
      </p>
    </aside>
  );
}
