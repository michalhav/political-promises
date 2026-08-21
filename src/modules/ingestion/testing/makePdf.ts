/**
 * Generátor jednoduchého PDF pro testy.
 *
 * Extrakce textu se nedá otestovat bez PDF a přibalit cizí dokument do
 * repozitáře je právně nepříjemné. Generátor proto vyrobí deterministický
 * soubor, u kterého přesně víme, co v něm stojí — a tedy i co má z extrakce
 * vypadnout.
 *
 * Umí schválně i českou diakritiku přes `/Differences`. Právě na ní extrakce
 * nejčastěji selhává: znak se v souboru neuloží jako Unicode, ale jako kód
 * s odkazem na jméno glyfu, a teprve pdf.js ho překládá zpátky.
 *
 * Není to obecný nástroj na tvorbu PDF a nemá jím být.
 */

/** Jména glyfů podle Adobe Glyph List pro znaky, které v testech používáme. */
const GLYPH_NAMES = new Map<string, string>([
  [" ", "space"],
  ["!", "exclam"],
  ['"', "quotedbl"],
  ["%", "percent"],
  ["(", "parenleft"],
  [")", "parenright"],
  [",", "comma"],
  ["-", "hyphen"],
  [".", "period"],
  ["/", "slash"],
  [":", "colon"],
  [";", "semicolon"],
  ["?", "question"],
  ["0", "zero"],
  ["1", "one"],
  ["2", "two"],
  ["3", "three"],
  ["4", "four"],
  ["5", "five"],
  ["6", "six"],
  ["7", "seven"],
  ["8", "eight"],
  ["9", "nine"],
  ["á", "aacute"],
  ["č", "ccaron"],
  ["ď", "dcaron"],
  ["é", "eacute"],
  ["ě", "ecaron"],
  ["í", "iacute"],
  ["ň", "ncaron"],
  ["ó", "oacute"],
  ["ř", "rcaron"],
  ["š", "scaron"],
  ["ť", "tcaron"],
  ["ú", "uacute"],
  ["ů", "uring"],
  ["ý", "yacute"],
  ["ž", "zcaron"],
  ["Č", "Ccaron"],
  ["Ř", "Rcaron"],
  ["Š", "Scaron"],
  ["Ž", "Zcaron"],
  ["Í", "Iacute"],
  ["Á", "Aacute"],
  ["É", "Eacute"],
]);

function glyphName(character: string): string {
  const known = GLYPH_NAMES.get(character);
  if (known) return known;
  if (/^[A-Za-z]$/.test(character)) return character;

  throw new Error(
    `Znak „${character}" nemá v generátoru přiřazené jméno glyfu. Doplň ho do GLYPH_NAMES.`,
  );
}

export interface PdfPageSpec {
  lines: string[];
}

/**
 * Vyrobí PDF s jednou stránkou na položku. Text je nekomprimovaný, takže je
 * soubor čitelný i v editoru — u testovací fixtury je to výhoda.
 */
export function makePdf(pages: PdfPageSpec[]): Uint8Array {
  // Kódování: každý použitý znak dostane vlastní kód, mapa jde do /Differences.
  const characters = [...new Set(pages.flatMap((page) => [...page.lines.join("")]))].sort();
  if (characters.length > 255) {
    throw new Error("Generátor zvládne nejvýš 255 různých znaků na dokument.");
  }

  const codeByCharacter = new Map<string, number>();
  characters.forEach((character, index) => codeByCharacter.set(character, index + 1));

  const differences = ["1"];
  for (const character of characters) differences.push(`/${glyphName(character)}`);

  const encodeLine = (line: string): string => {
    const bytes: string[] = [];
    for (const character of line) {
      const code = codeByCharacter.get(character);
      if (code === undefined) throw new Error(`Znak „${character}" nemá kód.`);
      bytes.push(`\\${code.toString(8).padStart(3, "0")}`);
    }
    return bytes.join("");
  };

  const objects: string[] = [];
  const pageCount = pages.length;
  const firstPageObject = 3;
  const contentObjectOffset = firstPageObject + pageCount;
  const fontObject = contentObjectOffset + pageCount;

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");

  const kids = pages.map((_, index) => `${firstPageObject + index} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);

  pages.forEach((_, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
        `/Resources << /Font << /F1 ${fontObject} 0 R >> >> ` +
        `/Contents ${contentObjectOffset + index} 0 R >>`,
    );
  });

  pages.forEach((page) => {
    const body = [
      "BT",
      "/F1 12 Tf",
      "14 TL",
      "50 780 Td",
      ...page.lines.map((line) => `(${encodeLine(line)}) Tj T*`),
      "ET",
    ].join("\n");
    objects.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  });

  objects.push(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica ` +
      `/Encoding << /Type /Encoding /Differences [${differences.join(" ")}] >> >>`,
  );

  // Sestavení souboru včetně tabulky odkazů; ta potřebuje bajtové posuny.
  const header = "%PDF-1.4\n";
  const chunks: string[] = [header];
  const offsets: number[] = [];
  let offset = header.length;

  objects.forEach((body, index) => {
    const serialized = `${index + 1} 0 obj\n${body}\nendobj\n`;
    offsets.push(offset);
    chunks.push(serialized);
    offset += serialized.length;
  });

  const xrefOffset = offset;
  const xrefRows = ["0000000000 65535 f "];
  for (const objectOffset of offsets) {
    xrefRows.push(`${objectOffset.toString().padStart(10, "0")} 00000 n `);
  }

  chunks.push(
    `xref\n0 ${objects.length + 1}\n${xrefRows.join("\n")}\n`,
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  // latin1: každý znak řetězce odpovídá jednomu bajtu, což PDF vyžaduje.
  return new Uint8Array(Buffer.from(chunks.join(""), "latin1"));
}
