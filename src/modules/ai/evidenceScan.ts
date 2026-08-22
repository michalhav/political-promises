/**
 * Automatické hledání dokladů ke **všem** slibům naráz.
 *
 * Do teď musel analytik u každého slibu vymyslet, co v datech hledat („Dvorecký
 * most"), vyrobit výřez a projít ho očima. To je práce, kterou má dělat nástroj:
 * je mechanická, opakuje se u každého slibu a nic se při ní nerozhoduje.
 *
 * Postup je schválně **deterministický a vysvětlitelný**, ne statistický:
 *
 * 1. Ze slibu se vytáhnou rozlišující výrazy — vlastní jména, víceslovné názvy
 *    a dost dlouhá podstatná jména. Ne z názvu, ale z **celé citace**: právě
 *    tam bývá „Trojské lávky" nebo „Štvanickou lávku", podle kterých se doklad
 *    pozná.
 * 2. Každý řádek zdroje dostane skóre podle toho, kolik různých výrazů trefil
 *    a jak jsou vzácné.
 * 3. Vrátí se jen několik nejlepších — a s nimi seznam slov, kvůli kterým
 *    prošly.
 *
 * Ten seznam je důležitější než skóre. Redaktor musí na první pohled vidět,
 * **proč** mu nástroj řádek podstrčil, jinak by kontrola byla dražší než ruční
 * hledání. Vektorové vyhledávání by tuhle vlastnost ztratilo a u produktu, kde
 * se doklad musí obhájit, se to nevyplatí.
 */

/** Slova, která v češtině nic nerozlišují, i když jsou dlouhá. */
const STOPWORDS = new Set([
  "praha",
  "prahy",
  "praze",
  "pražský",
  "pražské",
  "pražských",
  "město",
  "města",
  "městě",
  "městských",
  "městské",
  "nové",
  "nových",
  "nový",
  "další",
  "dalších",
  "budeme",
  "chceme",
  "naším",
  "cílem",
  "které",
  "která",
  "kterou",
  "kteří",
  "jejich",
  "proto",
  "také",
  "kolem",
  "podle",
  "aby",
  "jsme",
  "bude",
  "budou",
  "více",
  "méně",
  "všech",
  "všechny",
  "musí",
  "může",
  "svou",
  "této",
  "tento",
  "tomto",
]);

/** Kratší slovo je v češtině skoro vždycky předložka, spojka nebo tvar slovesa. */
const MIN_TERM_LENGTH = 5;

/**
 * Krátká slova, která se za vlastní jméno nepovažují ani s velkým písmenem.
 *
 * V programu nestojí za nadpisem tečka, takže odstavec začíná uprostřed „věty"
 * a předložka na jeho začátku vypadá jako jméno. Bez tohohle seznamu hledal
 * nástroj doklady podle „Za třicet" a „Pro investory" a nabízel školení
 * o bezbariérovosti jako doklad slibu o bytech.
 */
const NEVER_NAMES = new Set([
  "za",
  "do",
  "pro",
  "na",
  "od",
  "ve",
  "se",
  "po",
  "při",
  "pod",
  "nad",
  "mezi",
  "bez",
  "díky",
  "podle",
  "kolem",
  "před",
  "však",
  "také",
  "proto",
  "naši",
  "naše",
  "náš",
  "jsme",
  "tam",
  "kde",
  "když",
  "aby",
]);

/** Jméno stavby má aspoň čtyři písmena; „Za" nebo „Do" ne. */
const MIN_NAME_LENGTH = 4;

function normalise(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      // Diakritika se zahazuje: v otevřených datech města se „Průmyslový" píše
      // i bez ní a shoda by na tom neměla padat.
      .replace(/[̀-ͯ]/gu, "")
  );
}

/**
 * Kmen slova, ne celé slovo.
 *
 * Čeština skloňuje: ve slibu stojí „mezi Holešovicemi a Karlínem", v zakázce
 * „Lávka Holešovice - Karlín". Porovnávat celá slova by tenhle doklad minulo,
 * a přitom jde o tutéž stavbu.
 *
 * Odřezávají se tři znaky, ne konkrétní koncovky. Seznam koncovek by byl delší,
 * křehčí a stejně by nepokryl všechno; tři znaky spolehlivě sundají „-emi",
 * „-ách", „-ovi" i „-ům" a u čtyřpísmenného zbytku ještě nehrozí, že slovo
 * splyne s cizím.
 */
function stem(word: string): string {
  const base = normalise(word);
  return base.slice(0, Math.max(4, base.length - 3));
}

export interface SearchTerm {
  /** Kmeny, které musí řádek obsahovat všechny. U víceslovného názvu je jich víc. */
  keys: string[];
  /** Jak to stálo v textu. Ukazuje se redaktorovi. */
  label: string;
  /**
   * Vlastní jméno váží víc: „Dvorecký most" identifikuje stavbu, „rekonstrukce"
   * ne.
   */
  weight: number;
}

/**
 * Rozlišující výrazy ze slibu.
 *
 * Klíčové je, co se za rozlišující **nepovažuje**. První pokus bral velké
 * písmeno jako známku vlastního jména — jenže česká věta v programu začíná
 * slovesem závazku („Rozšíříme…", „Navýšíme…"), takže nástroj hledal doklady
 * podle slova „rozšíříme" a našel každé rozšíření čehokoli ve městě. Fronta
 * byla plná a k ničemu.
 *
 * Vlastní jméno se proto pozná podle velkého písmene **uprostřed věty**:
 * „přes Vltavu", „mezi Holešovicemi a Karlínem", „Průmyslového paláce". To je
 * přesně to, podle čeho hledá i člověk.
 */
export function extractSearchTerms(...texts: (string | null | undefined)[]): SearchTerm[] {
  const found = new Map<string, SearchTerm>();
  const source = texts.filter((text): text is string => Boolean(text)).join("\n");

  // Dělení slov přes řádek by rozsekalo „cyklo-\nstezky" na dva neužitečné kusy.
  const text = source.replace(/-\s*\n\s*/g, "").replace(/\s+/g, " ");

  const tokens = [...text.matchAll(/\p{L}{2,}|[.!?;:]/gu)].map((match) => ({
    value: match[0],
    index: match.index,
  }));

  const isProperNoun = (position: number): boolean => {
    const token = tokens[position];
    if (!token || !/^\p{Lu}/u.test(token.value)) return false;
    if (token.value.length < MIN_NAME_LENGTH) return false;
    if (NEVER_NAMES.has(token.value.toLowerCase())) return false;

    // Na začátku textu nebo hned po tečce velké písmeno nic neznamená.
    const previous = tokens[position - 1];
    if (!previous) return false;
    return !/^[.!?;:]$/.test(previous.value);
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token || /^[.!?;:]$/.test(token.value)) continue;

    const lower = token.value.toLowerCase();
    if (STOPWORDS.has(lower)) continue;

    if (isProperNoun(i)) {
      // Víceslovný název: „Průmyslového paláce", „Dvorecký most". Druhé slovo
      // bývá obecné, ale teprve dvojice identifikuje konkrétní stavbu.
      const next = tokens[i + 1];
      if (next && next.value.length >= 4 && !/^[.!?;:]$/.test(next.value)) {
        const label = `${token.value} ${next.value}`;
        const keys = [stem(token.value), stem(next.value)];
        const id = keys.join("+");
        if (!found.has(id)) found.set(id, { keys, label, weight: 3 });
      }

      const id = stem(token.value);
      if (!found.has(id)) found.set(id, { keys: [id], label: token.value, weight: 2 });
      continue;
    }

    if (token.value.length < MIN_TERM_LENGTH) continue;
    const id = stem(token.value);
    if (!found.has(id)) found.set(id, { keys: [id], label: token.value, weight: 1 });
  }

  return [...found.values()];
}

export interface ScanMatch {
  /** Řádek zdroje tak, jak v něm doslova stojí. */
  line: string;
  score: number;
  /** Výrazy, kvůli kterým řádek prošel. Bez nich by kontrola byla dražší než hledání. */
  matchedTerms: string[];
}

export interface ScanOptions {
  /** Kolik nálezů na jeden slib. Fronta, kterou nikdo neprojde, je k ničemu. */
  limit?: number;
  /** Minimální skóre. Chrání redakci před tím, aby ji nástroj zavalil. */
  minimumScore?: number;
}

/**
 * Projde řádky zdroje a vrátí ty, které ke slibu nejspíš patří.
 *
 * Vyžaduje **aspoň jeden silný výraz** (vlastní jméno nebo víceslovný název).
 * Bez toho pravidla by „rekonstrukce" spárovala každý slib s každou stavbou
 * ve městě a fronta by ztratila smysl.
 */
export function scanLines(
  lines: string[],
  terms: SearchTerm[],
  options: ScanOptions = {},
): ScanMatch[] {
  const limit = options.limit ?? 5;
  const minimumScore = options.minimumScore ?? 4;
  const strong = terms.filter((term) => term.weight >= 2);
  if (strong.length === 0) return [];

  const matches: ScanMatch[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const haystack = normalise(line);

    let score = 0;
    let strongHits = 0;
    const matchedTerms: string[] = [];

    for (const term of terms) {
      // U víceslovného názvu musí sedět všechny kmeny; jinak by „Trojské lávky"
      // trefila každá lávka ve městě.
      if (!term.keys.every((key) => haystack.includes(key))) continue;
      score += term.weight;
      if (term.weight >= 2) strongHits += 1;
      matchedTerms.push(term.label);
    }

    if (strongHits === 0 || score < minimumScore) continue;
    matches.push({ line, score, matchedTerms });
  }

  return matches
    .sort((a, b) => b.score - a.score || a.line.localeCompare(b.line, "cs"))
    .slice(0, limit);
}
