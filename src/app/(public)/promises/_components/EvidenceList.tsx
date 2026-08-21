import { CitationBlock } from "@/app/_components/SourceCitation";
import type { EvidenceView } from "@/modules/promises/queries";
import { RELATION_TYPE_LABELS } from "@/modules/sources/labels";

/**
 * Doložené zdroje.
 *
 * Zobrazují se jen vazby potvrzené člověkem — filtruje je už dotaz, ne tahle
 * komponenta. U každé je vidět, čím zdroj pro slib je: jestli závazek potvrzuje,
 * dokládá jeho financování, nebo mu naopak odporuje.
 */
export function EvidenceList({ evidence }: { evidence: EvidenceView[] }) {
  if (evidence.length === 0) {
    return (
      <p className="text-muted">
        K tomuto slibu zatím nemáme ověřený zdrojový dokument. Dokud nevznikne, netvrdíme o jeho
        plnění nic, co by šlo doložit.
      </p>
    );
  }

  return (
    <ul className="space-y-6">
      {evidence.map((item, index) => (
        <li key={index} className="space-y-2">
          <p className="text-muted text-xs tracking-wide uppercase">
            {RELATION_TYPE_LABELS[item.relationType]}
          </p>
          <CitationBlock citation={item} />
          {item.note ? <p className="text-muted text-sm">{item.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}
