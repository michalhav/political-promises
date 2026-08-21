import Link from "next/link";

/**
 * Mapa dlouhé stránky.
 *
 * Detail slibu má na mobilu přes devět tisíc pixelů — jedenáct obrazovek.
 * Obsah sám se láme dobře, ale bez mapy čtenář neví, co ho ještě čeká, a
 * hlavně se nedostane zpátky k odpovědi, když se zavrtá do archivu.
 *
 * Nejsou to odkazy na jinou stránku, ale kotvy: navigace se proto drží
 * nahoře i při scrollování. Jde o obyčejné `<a href="#…">`, takže funguje
 * bez JavaScriptu i po odeslání odkazu někomu dalšímu.
 *
 * Vědomě tu **není** zvýrazňování právě čtené sekce. Vyžadovalo by pozorovatel
 * v prohlížeči a u stránky, kde jsou sekce různě vysoké, se plete víc, než
 * pomáhá. Hodnota téhle lišty je skok, ne poloha.
 */
export interface SectionLink {
  id: string;
  label: string;
}

export function SectionNav({ sections }: { sections: SectionLink[] }) {
  // Pod dvě sekce je lišta jen šum — skákat není kam.
  if (sections.length < 3) return null;

  return (
    <nav
      aria-label="Části stránky"
      className="border-border bg-background sticky top-0 z-30 -mx-4 border-b px-4"
    >
      <ul className="flex scrollbar-none gap-x-5 overflow-x-auto py-3 text-sm whitespace-nowrap">
        {sections.map((section) => (
          <li key={section.id}>
            <Link
              href={`#${section.id}`}
              className="hover:text-accent underline-offset-4 hover:underline"
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
