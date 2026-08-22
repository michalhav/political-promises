/**
 * Tabulková data jako citovatelný dokument.
 *
 * Otevřená data měst jsou z velké části tabulky, ne próza: veřejné zakázky,
 * čerpání rozpočtu, faktury. Náš důkazní řetězec ale stojí na tom, že citace
 * stojí **doslova** v uloženém textu.
 *
 * Řešení je otupělé schválně: každý řádek se vykreslí do jednoho řádku textu
 * v ustáleném tvaru. Tím se z tabulky stane obyčejný dokument a platí pro něj
 * beze změny všechno ostatní — otisk, ověření citace znak po znaku, důkazy,
 * hledání shod. Žádná nová entita, žádná migrace.
 *
 * Co se **nesmí** ztratit: že jde o odvozeninu. Výběr sloupců i filtr řádků je
 * redakční rozhodnutí a musí být zapsané v provenienci, jinak by nešlo doložit,
 * co všechno se z původního souboru zahodilo.
 */

export interface TabularDocument {
  text: string;
  /** Kolik řádků má původní soubor. */
  totalRows: number;
  /** Kolik jich prošlo filtrem a je v textu. */
  selectedRows: number;
  columns: string[];
  delimiter: string;
}

/** Prahá otevřená data jedou na středníku, národní katalog na čárce. */
export function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

/**
 * Rozdělení řádku podle CSV pravidel: uvozovky ruší oddělovač, zdvojená
 * uvozovka uvnitř znamená jednu.
 */
export function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];

    if (quoted) {
      if (character === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === delimiter) {
      cells.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  cells.push(current);
  return cells;
}

/**
 * Řádek dokumentu.
 *
 * Číslo řádku je první, aby šlo na konkrétní záznam ukázat i mimo aplikaci
 * („řádek 412 v našem výřezu"). Prázdné buňky se vynechávají — u čtyřiceti
 * sloupců by jinak citace tonula v „: | : | :".
 */
function renderRow(
  rowNumber: number,
  header: string[],
  cells: string[],
  columns: string[],
): string {
  const parts = columns.flatMap((column) => {
    const index = header.indexOf(column);
    const value = (index >= 0 ? (cells[index] ?? "") : "").trim().replace(/\s+/g, " ");
    return value.length > 0 ? [`${column}: ${value}`] : [];
  });

  return `Řádek ${rowNumber} | ${parts.join(" | ")}`;
}

/**
 * Opak `renderRow`: z uloženého řádku zpátky na dvojice sloupec–hodnota.
 *
 * Formát si vyrábíme sami a je ustálený, takže zpětné čtení není hádání.
 * Slouží k tomu, aby se z uložené tabulky dala spočítat metrika — bez toho by
 * se musela znovu stahovat data ze sítě a publikované číslo by se nedalo
 * dohledat k otisku, který máme v databázi.
 */
export function parseRenderedRow(line: string): Record<string, string> | null {
  const parts = line.split(" | ");
  if (parts.length < 2 || !parts[0]?.startsWith("Řádek ")) return null;

  const row: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const separator = part.indexOf(": ");
    if (separator < 0) continue;
    row[part.slice(0, separator).trim()] = part.slice(separator + 2).trim();
  }

  return Object.keys(row).length > 0 ? row : null;
}

export interface RenderOptions {
  /** Sloupce, které se do textu dostanou. Prázdné = všechny. */
  columns?: string[];
  /** Do textu jdou jen řádky, které tomuhle výrazu vyhoví. */
  match?: RegExp;
  /** Pojistka proti tomu, aby se do jednoho dokumentu vysypal celý dataset. */
  maxRows?: number;
}

export class TabularError extends Error {}

export function renderTabularDocument(csv: string, options: RenderOptions = {}): TabularDocument {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/);
  const headerLine = lines[0];
  if (!headerLine?.trim()) throw new TabularError("Soubor nemá hlavičku.");

  const delimiter = detectDelimiter(headerLine);
  const header = splitRow(headerLine, delimiter).map((name) => name.trim());
  const columns = options.columns?.length ? options.columns : header;

  const unknown = columns.filter((column) => !header.includes(column));
  if (unknown.length > 0) {
    throw new TabularError(
      `Soubor nemá sloupce: ${unknown.join(", ")}.\nDostupné: ${header.join(", ")}`,
    );
  }

  const dataLines = lines.slice(1).filter((line) => line.trim().length > 0);
  const rendered: string[] = [];

  for (const [index, line] of dataLines.entries()) {
    if (options.match && !options.match.test(line)) continue;

    // Číslo řádku je z **původního** souboru, ne z výřezu. Jinak by po změně
    // filtru ukazovala stará citace jinam.
    rendered.push(renderRow(index + 1, header, splitRow(line, delimiter), columns));
  }

  const limit = options.maxRows ?? 2_000;
  if (rendered.length > limit) {
    throw new TabularError(
      `Filtru vyhovělo ${rendered.length} řádků, limit je ${limit}. Zužte výběr (--match) nebo zvyšte --limit.`,
    );
  }

  return {
    text: rendered.join("\n"),
    totalRows: dataLines.length,
    selectedRows: rendered.length,
    columns,
    delimiter,
  };
}
