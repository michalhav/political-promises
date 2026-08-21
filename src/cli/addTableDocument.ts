/**
 * Udělá z výřezu tabulkových otevřených dat citovatelný dokument.
 *
 *   npm run corpus:table -- https://storage.golemio.cz/ckan/tendersystems/verejne_zakazky.csv \
 *     --dir corpus/zakazky-tramvaje \
 *     --title "Veřejné zakázky MHMP — tramvajové tratě" \
 *     --publisher "Hlavní město Praha" \
 *     --type PUBLIC_PROCUREMENT \
 *     --match "tramvaj" \
 *     --columns nazev_zakazky,faze_zakazky,nazev_smluvniho_partnera,smluvni_cena_bez_dph_kc,datum_uzavreni_smlouvy
 *
 * Vznikne textový dokument, kde je jeden řádek tabulky na jednom řádku textu.
 * Od té chvíle je to pro systém obyčejný zdroj: platí otisk, ověření citace
 * znak po znaku i celý redakční postup.
 *
 * **Je to odvozenina, a musí to být vidět.** Provenience proto nese i otisk
 * původního souboru, použitý filtr, vybrané sloupce a kolik řádků měl originál.
 * Bez toho by nešlo doložit, co se cestou zahodilo — a výběr řádků je redakční
 * rozhodnutí jako každé jiné.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { licenseModeEnum, sourceTypeEnum } from "@/db/enums";
import { renderTabularDocument, TabularError } from "@/modules/ingestion/tabular";

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function loadSource(source: string): Promise<{ bytes: Uint8Array; url: string | null }> {
  if (!/^https?:\/\//i.test(source)) {
    return { bytes: new Uint8Array(await readFile(source)), url: null };
  }

  const response = await fetch(source, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Server odpověděl ${response.status} ${response.statusText}.`);
  }
  return { bytes: new Uint8Array(await response.arrayBuffer()), url: response.url || source };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [source] = args;

  const directory = argValue(args, "--dir");
  const title = argValue(args, "--title");
  const publisher = argValue(args, "--publisher");
  const sourceType = argValue(args, "--type") ?? "OTHER";
  const licenseMode = argValue(args, "--license") ?? "FULL_TEXT_STORED";
  const publishedAt = argValue(args, "--published-at");
  const match = argValue(args, "--match");
  const columns = argValue(args, "--columns")
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const limit = Number(argValue(args, "--limit") ?? 2_000);

  if (!source || !directory || !title || !publisher) {
    console.error(
      [
        "Použití: npm run corpus:table -- <url|soubor.csv> --dir <adresář> --title <název> --publisher <vydavatel>",
        "         [--type <typ>] [--match <regulární výraz>] [--columns a,b,c] [--limit N]",
        "",
        `Typy: ${sourceTypeEnum.enumValues.join(", ")}`,
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  if (!sourceTypeEnum.enumValues.includes(sourceType as never)) {
    console.error(`Neznámý typ „${sourceType}".`);
    process.exitCode = 1;
    return;
  }
  if (!licenseModeEnum.enumValues.includes(licenseMode as never)) {
    console.error(`Neznámé nakládání s textem „${licenseMode}".`);
    process.exitCode = 1;
    return;
  }

  const provenancePath = path.join(directory, "provenance.json");
  if (existsSync(provenancePath)) {
    console.error(
      [
        `${provenancePath} už existuje.`,
        "Odvozený dokument se nepřepisuje — citace se vážou k jeho otisku.",
        "Jiný filtr nebo jiné sloupce patří do vlastního adresáře.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  const retrievedAt = new Date().toISOString();
  const { bytes, url } = await loadSource(source);
  const originalHash = sha256(bytes);

  const csv = new TextDecoder("utf-8").decode(bytes);
  const document = renderTabularDocument(csv, {
    columns,
    match: match ? new RegExp(match, "i") : undefined,
    maxRows: limit,
  });

  if (document.selectedRows === 0) {
    console.error("Filtru nevyhověl žádný řádek. Zkontroluj --match.");
    process.exitCode = 1;
    return;
  }

  const fileName = "tabulka.txt";
  const text = `${document.text}\n`;
  const contentHash = sha256(text);

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), text, "utf8");

  /**
   * Kanonický dokument je v tomhle projektu výměnný formát pro text — čte ho
   * import do databáze i evaluace. Tabulka se do něj vejde jako jedna stránka:
   * adresu záznamu nese číslo řádku uvnitř věty, ne stránkování.
   */
  await writeFile(
    path.join(directory, "extracted.json"),
    `${JSON.stringify(
      {
        contentHash,
        extractorVersion: "tabular-1.0.0",
        pageCount: 1,
        pages: [{ pageNumber: 1, text: document.text }],
        sourceName: fileName,
        extractedAt: retrievedAt,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const provenance = {
    sourceType,
    title,
    publisher,
    ...(url ? { url } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    retrievedAt,
    // Otisk **uloženého textu** — na ten se vážou citace.
    contentHash,
    byteSize: Buffer.byteLength(text, "utf8"),
    mimeType: "text/plain",
    licenseMode,
    isDemo: false,
    fileName,
    /**
     * Čím dokument vznikl. Bez tohohle bloku by šlo výřez vydávat za celý
     * dataset — a výběr řádků je redakční rozhodnutí, ne technický detail.
     */
    derivedFrom: {
      kind: "tabular" as const,
      originalContentHash: originalHash,
      originalByteSize: bytes.byteLength,
      delimiter: document.delimiter,
      totalRows: document.totalRows,
      selectedRows: document.selectedRows,
      match: match ?? null,
      columns: document.columns,
    },
  };

  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");

  console.log(
    [
      "Tabulka převedena na dokument.",
      `  Adresář:   ${directory}`,
      `  Řádků:     ${document.selectedRows} z ${document.totalRows}${match ? ` (filtr „${match}")` : ""}`,
      `  Sloupců:   ${document.columns.length}`,
      `  Otisk:     ${provenance.contentHash}`,
      `  Původní:   ${originalHash}`,
      "",
      "Dál:",
      `  npm run corpus:import -- ${directory}`,
      "",
      "Vytěžovat z tabulky sliby nemá smysl — je to podklad pro důkazy.",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  if (error instanceof TabularError) {
    console.error(error.message);
  } else {
    console.error("Převod selhal:", error);
  }
  process.exitCode = 1;
});
