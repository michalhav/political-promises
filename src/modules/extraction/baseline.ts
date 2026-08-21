/**
 * Heuristický extraktor — základní laťka pro budoucí model.
 *
 * Nemá být chytrý. Má být **deterministický, vysvětlitelný a nenulový**, aby
 * bylo o čem mluvit, až se objeví jazykový model: model, který tuhle laťku
 * nepřekoná, se nevyplatí platit ani provozovat.
 *
 * Pravidla stojí na tom, jak volební programy v češtině skutečně vypadají:
 * závazek se píše v první osobě množného čísla budoucího času („postavíme",
 * „zavedeme"). Nadpisy, hesla a popisy stavu se tak nepíšou.
 *
 * Slabiny jsou známé a záměrné — jsou to přesně ty, na kterých se pozná, jestli
 * model něco přidává: neumí souvětí, kde je závazek ve druhé větě, neumí
 * „chceme, aby…" a neodliší závazek od popisu cizího záměru.
 */
import type { CanonicalDocument } from "@/modules/ingestion/canonical";
import { splitPageIntoSegments, type Segment } from "@/modules/extraction/segments";
import type { ExtractionCandidate, PromiseExtractor } from "@/modules/extraction/types";

export const BASELINE_VERSION = "heuristic-1.0.0";

/**
 * Slovesa závazku v 1. osobě množného čísla.
 *
 * Výčtem, ne koncovkou. Pravidlo „končí na -íme" chytá i „myslíme", „vidíme"
 * nebo „nesouhlasíme", což jsou postoje, ne závazky.
 */
const COMMITMENT_VERBS = [
  "postavíme",
  "vybudujeme",
  "zavedeme",
  "rozšíříme",
  "zvýšíme",
  "snížíme",
  "zajistíme",
  "prosadíme",
  "podpoříme",
  "dokončíme",
  "zahájíme",
  "připravíme",
  "zmodernizujeme",
  "modernizujeme",
  "obnovíme",
  "vytvoříme",
  "zřídíme",
  "navýšíme",
  "zrychlíme",
  "zpřístupníme",
  "omezíme",
  "zrušíme",
  "vyčleníme",
  "napojíme",
  "zlepšíme",
  "zefektivníme",
  "opravíme",
  "postavíme",
  "udržíme",
  "nezvýšíme",
  "nedopustíme",
  "zasadíme",
  "prosazujeme",
  "dobudujeme",
  "rekonstruujeme",
  "zainvestujeme",
];

/** Slova, po kterých následuje popis stavu nebo úmyslu, ne závazek. */
const WEAK_MARKERS = ["chceme", "usilujeme", "budeme usilovat", "je naším cílem", "věříme"];

/** Kolik znaků musí úsek mít, aby dávalo smysl ho někomu předložit k revizi. */
const MIN_LENGTH = 25;
const MAX_LENGTH = 600;

interface Assessment {
  matched: boolean;
  reasons: string[];
  confidence: number;
}

function looksLikeHeading(segment: Segment): boolean {
  const letters = [...segment.normalized].filter((character) => /\p{L}/u.test(character));
  if (letters.length === 0) return true;

  const upper = letters.filter((character) => character === character.toUpperCase()).length;
  // Nadpisy bývají celé verzálkami a bez koncové tečky.
  return upper / letters.length > 0.8;
}

function assess(segment: Segment): Assessment {
  const reasons: string[] = [];
  const haystack = segment.normalized.toLowerCase();

  if (segment.text.length < MIN_LENGTH) {
    return { matched: false, reasons: ["Úsek je příliš krátký."], confidence: 0 };
  }
  if (segment.text.length > MAX_LENGTH) {
    return { matched: false, reasons: ["Úsek je příliš dlouhý na jeden závazek."], confidence: 0 };
  }
  if (looksLikeHeading(segment)) {
    return { matched: false, reasons: ["Vypadá jako nadpis."], confidence: 0 };
  }

  const verb = COMMITMENT_VERBS.find((candidate) => haystack.includes(candidate));
  if (!verb) {
    return {
      matched: false,
      reasons: ["Chybí sloveso závazku v 1. osobě množného čísla."],
      confidence: 0,
    };
  }

  reasons.push(`Sloveso závazku: „${verb}".`);
  let confidence = 0.5;

  if (/\d/.test(haystack)) {
    reasons.push("Obsahuje číslo, závazek je tedy pravděpodobně měřitelný.");
    confidence += 0.2;
  }

  if (/\b(do roku|do konce|nejpozději|do\s+\d{1,2}\.)/.test(haystack)) {
    reasons.push("Obsahuje termín.");
    confidence += 0.2;
  }

  const weak = WEAK_MARKERS.find((marker) => haystack.includes(marker));
  if (weak) {
    reasons.push(`Oslabeno formulací „${weak}".`);
    confidence -= 0.2;
  }

  return { matched: true, reasons, confidence: Math.min(1, Math.max(0.1, confidence)) };
}

export class HeuristicPromiseExtractor implements PromiseExtractor {
  readonly name = "baseline-heuristic";
  readonly version = BASELINE_VERSION;

  extract(document: CanonicalDocument): Promise<ExtractionCandidate[]> {
    const candidates: ExtractionCandidate[] = [];

    for (const page of document.pages) {
      for (const segment of splitPageIntoSegments(page)) {
        const assessment = assess(segment);
        if (!assessment.matched) continue;

        candidates.push({
          quote: segment.text,
          span: segment.span,
          normalizedStatement: segment.normalized,
          reasoning: assessment.reasons.join(" "),
          confidence: Number(assessment.confidence.toFixed(2)),
        });
      }
    }

    return Promise.resolve(candidates);
  }
}
