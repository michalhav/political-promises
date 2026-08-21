/**
 * Rozhraní pro vytěžování kandidátů na slib.
 *
 * Extraktor dostane kanonický dokument a vrátí kandidáty. Nic víc — nezapisuje
 * do databáze, nepublikuje, nerozhoduje. Kandidát je návrh k revizi, i když ho
 * vyrobila deterministická heuristika.
 *
 * Rozhraní je záměrně stejné pro heuristiku i pro budoucí jazykový model.
 * Díky tomu se dají porovnat na tomtéž zlatém datasetu a je vidět, jestli model
 * heuristiku vůbec překonává.
 */
import type { CanonicalDocument, PageSpan } from "@/modules/ingestion/canonical";
import type { Topic } from "@/modules/promises/labels";

export interface ExtractionCandidate {
  /**
   * Doslovný text ze stránky. Musí odpovídat `span` znak po znaku — kontroluje
   * to evaluace i budoucí redakční workflow.
   */
  quote: string;
  span: PageSpan;
  suggestedTitle?: string;
  normalizedStatement?: string;
  topic?: Topic;
  /** Proč to extraktor považuje za slib. U heuristiky výčet pravidel. */
  reasoning?: string;
  /** 0–1. Nemá význam pravděpodobnosti, jen pořadí jistoty v rámci extraktoru. */
  confidence?: number;
}

export interface PromiseExtractor {
  readonly name: string;
  readonly version: string;
  extract(document: CanonicalDocument): Promise<ExtractionCandidate[]>;
}
