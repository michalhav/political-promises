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

/**
 * Upozornění na ukázková data.
 *
 * Text se liší podle toho, jestli jsou v datech i skutečné záznamy. Věta
 * „sliby na těchto stránkách jsou smyšlené" nad skutečným volebním programem
 * není neškodná nepřesnost — je to nepravda na produktu, jehož jediná hodnota
 * je, že se mu dá věřit. U smíšených dat proto rozlišuje značka `demo`
 * u jednotlivých záznamů, ne plošné tvrzení.
 */
export function DemoDatasetNotice({ mixed = false }: { mixed?: boolean }) {
  return (
    <aside className="border-border bg-surface rounded-lg border p-4 text-sm" role="note">
      <p className="font-semibold">{mixed ? "Část dat je ukázková" : "Ukázková data"}</p>
      <p className="text-muted mt-1">
        {mixed ? (
          <>
            Záznamy označené značkou <span className="font-semibold">demo</span> jsou smyšlené a
            slouží k předvedení aplikace. Neodpovídají žádné skutečné politické straně ani
            skutečnému veřejnému dokumentu. Ostatní záznamy pocházejí ze skutečných zdrojů.
          </>
        ) : (
          <>
            Kandidátky, dokumenty i sliby na těchto stránkách jsou smyšlené a slouží k předvedení
            aplikace. Neodpovídají žádné skutečné politické straně ani skutečnému veřejnému
            dokumentu.
          </>
        )}
      </p>
    </aside>
  );
}
