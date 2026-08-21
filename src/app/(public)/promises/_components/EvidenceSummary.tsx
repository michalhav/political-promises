import { EvidenceBlock } from "@/app/(public)/promises/_components/EvidenceBlock";
import type { EvidenceView } from "@/modules/promises/queries";
import { evidenceRoleLabel, EVIDENCE_ROLE_ORDER } from "@/modules/sources/labels";

/**
 * „Jak to víme" — most mezi závěrem a důkazním archivem.
 *
 * Vysypat čtenáři hned pod hodnocením deset dokumentů znamená, že je přeskočí.
 * Nejdřív tedy krátký rozpad, čím ty zdroje vlastně jsou, a teprve pak dva
 * nejvýznamnější doklady jako ukázka. Zbytek čeká v archivu níž.
 *
 * Pořadí rolí sleduje životní cyklus slibu, ne četnost — čtenář má vidět cestu
 * od závazku k výsledku, ne žebříček.
 */
const HIGHLIGHT_COUNT = 2;

/** Role, které nejlépe ukazují, kam slib došel. Ty se vypíchnou jako první. */
const HIGHLIGHT_PRIORITY = ["OUTCOME", "IMPLEMENTATION", "FUNDING", "SUPPORTS"] as const;

export function EvidenceSummary({ evidence }: { evidence: EvidenceView[] }) {
  if (evidence.length === 0) {
    return (
      <p className="text-muted prose-measure">
        K tomuto slibu zatím nemáme ověřený zdrojový dokument. Dokud nevznikne, netvrdíme o jeho
        plnění nic, co by šlo doložit.
      </p>
    );
  }

  const byRole = new Map<string, { label: string; count: number }>();
  for (const item of evidence) {
    const label = evidenceRoleLabel(item.relationType, item.source.sourceType);
    const entry = byRole.get(label) ?? { label, count: 0 };
    entry.count += 1;
    byRole.set(label, entry);
  }

  const roleOrder = (item: EvidenceView): number => EVIDENCE_ROLE_ORDER.indexOf(item.relationType);

  const summary = [...byRole.values()].sort((a, b) => {
    const first = evidence.find(
      (item) => evidenceRoleLabel(item.relationType, item.source.sourceType) === a.label,
    );
    const second = evidence.find(
      (item) => evidenceRoleLabel(item.relationType, item.source.sourceType) === b.label,
    );
    return (first ? roleOrder(first) : 99) - (second ? roleOrder(second) : 99);
  });

  const highlights = [...evidence]
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, HIGHLIGHT_COUNT);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-lg">
          <strong className="font-semibold tabular-nums">{evidence.length}</strong>{" "}
          {countLabel(evidence.length)} prošlo redakční kontrolou.
        </p>
        <ul className="text-muted space-y-1">
          {summary.map((role) => (
            <li key={role.label}>
              <span className="text-foreground font-semibold tabular-nums">{role.count}×</span>{" "}
              {role.label.toLowerCase()}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold">
          {highlights.length === 1 ? "Nejvýznamnější doklad" : "Nejvýznamnější doklady"}
        </h3>
        {highlights.map((item, index) => (
          <EvidenceBlock key={`${item.excerpt}-${index}`} evidence={item} />
        ))}
      </div>
    </div>
  );
}

function priority(item: EvidenceView): number {
  const index = HIGHLIGHT_PRIORITY.indexOf(
    item.relationType as (typeof HIGHLIGHT_PRIORITY)[number],
  );
  return index === -1 ? HIGHLIGHT_PRIORITY.length : index;
}

function countLabel(count: number): string {
  if (count === 1) return "ověřený zdroj";
  if (count < 5) return "ověřené zdroje";
  return "ověřených zdrojů";
}
