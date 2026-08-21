/**
 * Podklad pro ruční kontrolu sazby vybraných stránek.
 *
 *   npm run corpus:inspect -- corpus/praha-sobe-2022/plan-pro-prahu-2022.pdf --pages 1,5,9,14
 *
 * Nemám jak se na PDF podívat očima, ale mám něco skoro lepšího: polohy všech
 * kusů textu. Z nich se dá pořadí čtení zrekonstruovat a porovnat s tím, v jakém
 * pořadí text vypadl z extrakce. Kde se ty dvě věci rozejdou, je vada — a je to
 * doložitelné číslo, ne dojem.
 *
 * Nástroj **nic neopravuje**. Jen popisuje, co na stránce je.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { extractPdf, type GeometryItem, type PageGeometry } from "@/modules/ingestion/pdf";

interface Line {
  y: number;
  items: GeometryItem[];
  text: string;
  xStart: number;
  xEnd: number;
}

/**
 * Seskupí kusy textu do řádků podle svislé polohy.
 *
 * Tolerance se odvozuje z výšky písma, ne z pevné hodnoty — jinak by se
 * u velkých nadpisů rozpadl jeden řádek na několik.
 */
function buildLines(items: GeometryItem[]): Line[] {
  const visible = items.filter((item) => item.str.trim().length > 0);
  if (visible.length === 0) return [];

  const heights = visible.map((item) => item.height).filter((height) => height > 0);
  const tolerance = (heights.length > 0 ? Math.min(...heights) : 10) * 0.6;

  const sorted = [...visible].sort((a, b) => b.y - a.y);
  const lines: Line[] = [];

  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (line) {
      line.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item], text: "", xStart: 0, xEnd: 0 });
    }
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items
      .map((item) => item.str)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    line.xStart = line.items[0]?.x ?? 0;
    const last = line.items.at(-1);
    line.xEnd = last ? last.x + last.width : 0;
  }

  return lines;
}

/**
 * Rozdělí kusy textu do sloupců podle vodorovné polohy.
 *
 * Bez toho je rekonstrukce k ničemu: řazení podle svislé polohy přes celou
 * šířku stránky prokládá dva sloupce dohromady a vyrobí nesmysl — což je přesně
 * chyba, kterou tenhle nástroj napoprvé udělal a málem vykázal jako vadu
 * extrakce.
 */
function detectColumnBands(items: GeometryItem[], pageWidth: number): number[] {
  const starts = items.map((item) => item.x).sort((a, b) => a - b);
  if (starts.length < 8) return [0];

  const minimumGap = pageWidth * 0.12;
  const bands: number[] = [];
  let bandStart = starts[0] ?? 0;

  for (let i = 1; i < starts.length; i += 1) {
    const previous = starts[i - 1] ?? 0;
    const current = starts[i] ?? 0;
    if (current - previous > minimumGap) {
      bands.push(bandStart);
      bandStart = current;
    }
  }
  bands.push(bandStart);

  // Sloupce jsou nejvýš čtyři; víc znamená, že jsme rozsekali odsazení.
  return bands.length > 4 ? [0] : bands;
}

function bandIndex(item: GeometryItem, bands: number[]): number {
  let best = 0;
  for (let i = 0; i < bands.length; i += 1) {
    if (item.x >= (bands[i] ?? 0) - 1) best = i;
  }
  return best;
}

/** Rekonstrukce pořadí čtení: po sloupcích zleva doprava, uvnitř shora dolů. */
function reconstructReadingOrder(geometry: PageGeometry): { text: string; columns: number } {
  const visible = geometry.items.filter((item) => item.str.trim().length > 0);
  const bands = detectColumnBands(visible, geometry.viewportWidth);

  const perBand: GeometryItem[][] = bands.map(() => []);
  for (const item of visible) {
    perBand[bandIndex(item, bands)]?.push(item);
  }

  const chunks = perBand.map((bandItems) =>
    buildLines(bandItems)
      .map((line) => line.text)
      .join("\n"),
  );

  return { text: chunks.filter((chunk) => chunk.length > 0).join("\n"), columns: bands.length };
}

/** Podobnost dvou textů po sjednocení bílých znaků. */
function similarity(a: string, b: string): number {
  const left = a.replace(/\s+/g, " ").trim();
  const right = b.replace(/\s+/g, " ").trim();
  if (left.length === 0 && right.length === 0) return 1;

  // Porovnáváme mnohomnožiny slov: pořadí uvnitř řádku nás nezajímá, zajímá
  // nás, jestli se text neztratil nebo nezdvojil.
  const count = (text: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (const word of text.split(" ")) map.set(word, (map.get(word) ?? 0) + 1);
    return map;
  };

  const leftWords = count(left);
  const rightWords = count(right);
  let shared = 0;
  for (const [word, times] of leftWords) {
    shared += Math.min(times, rightWords.get(word) ?? 0);
  }

  const total = Math.max(
    [...leftWords.values()].reduce((sum, value) => sum + value, 0),
    [...rightWords.values()].reduce((sum, value) => sum + value, 0),
  );
  return total === 0 ? 1 : Number((shared / total).toFixed(4));
}

const BULLET = /^[•‣▪◦●·–—-]\s/u;

function analysePage(geometry: PageGeometry, canonicalText: string) {
  const reconstruction = reconstructReadingOrder(geometry);
  const lines = buildLines(geometry.items);

  const wordOverlap = similarity(reconstruction.text, canonicalText);

  const digitsOnly = geometry.items.filter((item) => /^\s*\d+\s*$/.test(item.str));
  const splitNumbers = geometry.items.filter(
    (item, index) =>
      /\d$/.test(item.str.trim()) &&
      /^\s*\d/.test(geometry.items[index + 1]?.str ?? "") &&
      (geometry.items[index + 1]?.hasEOL ?? true) === false,
  );

  return {
    pageNumber: geometry.pageNumber,
    lineCount: lines.length,
    itemCount: geometry.items.length,
    characterCount: canonicalText.length,
    columns: reconstruction.columns,
    /** 1 = z rekonstrukce i z extrakce vyšla stejná slova ve stejném počtu. */
    wordOverlap,
    bulletLines: lines.filter((line) => BULLET.test(line.text)).length,
    barePageNumberItems: digitsOnly.length,
    possiblySplitNumbers: splitNumbers.length,
    firstCanonicalLine: canonicalText.split("\n")[0] ?? "",
    lastCanonicalLine: canonicalText.trimEnd().split("\n").at(-1) ?? "",
    visualText: reconstruction.text,
  };
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [input] = args;
  const pagesArg = argValue(args, "--pages");

  if (!input || !pagesArg) {
    console.error("Použití: npm run corpus:inspect -- <soubor.pdf> --pages 1,5,9");
    process.exitCode = 1;
    return;
  }

  const wanted = new Set(pagesArg.split(",").map((value) => Number(value.trim())));
  const bytes = await readFile(input);
  const report = await extractPdf(bytes, path.basename(input), { collectGeometry: true });

  const directory = path.join(path.dirname(input), "qa");
  await mkdir(directory, { recursive: true });

  const summaries = [];

  for (const geometry of report.pageGeometry ?? []) {
    if (!wanted.has(geometry.pageNumber)) continue;

    const canonical =
      report.document.pages.find((page) => page.pageNumber === geometry.pageNumber)?.text ?? "";
    const analysis = analysePage(geometry, canonical);
    const { visualText, ...summary } = analysis;
    summaries.push(summary);

    await writeFile(
      path.join(directory, `page-${String(geometry.pageNumber).padStart(3, "0")}.txt`),
      [
        `=== STRÁNKA ${geometry.pageNumber} ===`,
        `Rozměr: ${geometry.viewportWidth} × ${geometry.viewportHeight}`,
        JSON.stringify(summary, null, 2),
        "",
        "--- VIZUÁLNÍ POŘADÍ (rekonstruované z poloh) ---",
        visualText,
        "",
        "--- KANONICKÝ TEXT (pořadí z extrakce) ---",
        canonical,
        "",
      ].join("\n"),
      "utf8",
    );
  }

  await writeFile(
    path.join(directory, "summary.json"),
    `${JSON.stringify(summaries, null, 2)}\n`,
    "utf8",
  );

  console.log(`Podklady pro ${summaries.length} stránek: ${directory}`);
  for (const summary of summaries) {
    console.log(
      `  s. ${String(summary.pageNumber).padStart(3)}  ` +
        `shoda slov ${(summary.wordOverlap * 100).toFixed(1).padStart(5)} %  ` +
        `sloupců ${summary.columns}  řádků ${String(summary.lineCount).padStart(3)}  ` +
        `odrážek ${String(summary.bulletLines).padStart(2)}  ` +
        `dělená čísla ${summary.possiblySplitNumbers}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error("Kontrola selhala:", error);
  process.exitCode = 1;
});
