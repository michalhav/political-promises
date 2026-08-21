/**
 * Založí nový dokument v korpusu z veřejné adresy.
 *
 *   npm run corpus:add -- https://example.org/usneseni.pdf \
 *     --dir corpus/usneseni-rady-2026-03 \
 *     --title "Usnesení Rady hl. m. Prahy z 16. 3. 2026" \
 *     --publisher "Hlavní město Praha" \
 *     --type COUNCIL_RESOLUTION
 *
 * Tohle je vstupní brána pro reálná data. `corpus:fetch` umí jen znovu stáhnout
 * dokument, jehož otisk už známe; sem patří ten první krok, kdy otisk teprve
 * vzniká.
 *
 * Provenience se zapisuje **v okamžiku stažení**: adresa, čas, otisk, velikost,
 * typ obsahu a hlavička `Last-Modified`. Bez ní by se za měsíc nedalo doložit,
 * s čím jsme pracovali — a u dokumentu, který někdo na serveru vymění, je to
 * jediné, co rozdíl odhalí.
 *
 * Skript **nepřepisuje** existující dokument. Přepsat zmrazený soubor by tiše
 * znehodnotilo všechny citace a anotace, které se k němu vážou.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { licenseModeEnum, sourceTypeEnum } from "@/db/enums";

/** Nad tuhle mez už to není dokument k citaci, ale problém. */
const MAX_BYTES = 100 * 1024 * 1024;

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function fileNameFrom(url: URL, contentType: string): string {
  const fromPath = path.basename(url.pathname);
  if (fromPath && path.extname(fromPath)) return fromPath;

  const extension = contentType.includes("pdf") ? ".pdf" : ".bin";
  return `dokument${extension}`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [rawUrl] = args;

  const directory = argValue(args, "--dir");
  const title = argValue(args, "--title");
  const publisher = argValue(args, "--publisher");
  const sourceType = argValue(args, "--type") ?? "OTHER";
  const licenseMode = argValue(args, "--license") ?? "FULL_TEXT_STORED";
  const publishedAt = argValue(args, "--published-at");

  if (!rawUrl || !directory || !title || !publisher) {
    console.error(
      [
        "Použití: npm run corpus:add -- <url> --dir <adresář> --title <název> --publisher <vydavatel>",
        "         [--type <typ>] [--license FULL_TEXT_STORED|QUOTE_ONLY] [--published-at YYYY-MM-DD]",
        "",
        `Typy: ${sourceTypeEnum.enumValues.join(", ")}`,
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  if (!sourceTypeEnum.enumValues.includes(sourceType as never)) {
    console.error(
      `Neznámý typ „${sourceType}". Použij jeden z: ${sourceTypeEnum.enumValues.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  if (!licenseModeEnum.enumValues.includes(licenseMode as never)) {
    console.error(`Neznámé nakládání s textem „${licenseMode}".`);
    process.exitCode = 1;
    return;
  }

  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    console.error("Stahuje se jen přes http(s).");
    process.exitCode = 1;
    return;
  }

  const provenancePath = path.join(directory, "provenance.json");
  if (existsSync(provenancePath)) {
    console.error(
      [
        `${provenancePath} už existuje.`,
        "Zmrazený dokument se nepřepisuje — citace a anotace se vážou k jeho otisku.",
        "Nová verze dokumentu patří do vlastního adresáře.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  const retrievedAt = new Date().toISOString();
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    console.error(`Server odpověděl ${response.status} ${response.statusText}.`);
    process.exitCode = 1;
    return;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    console.error("Server vrátil prázdný soubor.");
    process.exitCode = 1;
    return;
  }
  if (bytes.byteLength > MAX_BYTES) {
    console.error(`Soubor má ${bytes.byteLength} B, limit je ${MAX_BYTES} B.`);
    process.exitCode = 1;
    return;
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const mimeType = contentType.split(";")[0]?.trim() ?? contentType;
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const fileName = fileNameFrom(url, mimeType);

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), bytes);

  const provenance = {
    sourceType,
    title,
    publisher,
    // Adresa po přesměrování — na ní dokument opravdu leží.
    url: response.url || url.toString(),
    ...(response.url && response.url !== url.toString() ? { requestedUrl: url.toString() } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    retrievedAt,
    httpLastModified: response.headers.get("last-modified") ?? undefined,
    contentHash,
    byteSize: bytes.byteLength,
    mimeType,
    licenseMode,
    isDemo: false,
    fileName,
  };

  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");

  console.log(
    [
      "Dokument stažen a provenience zapsána.",
      `  Adresář:  ${directory}`,
      `  Soubor:   ${fileName} (${bytes.byteLength} B, ${mimeType})`,
      `  Otisk:    ${contentHash}`,
      "",
      "Dál:",
      `  npm run corpus:extract -- ${path.join(directory, fileName)}`,
      `  npm run corpus:import  -- ${directory}`,
      "",
      "Skutečné dokumenty do repozitáře nepatří — .gitignore je drží stranou.",
      "Zkontroluj licenci: u chráněného díla patří --license QUOTE_ONLY.",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error("Stažení selhalo:", error);
  process.exitCode = 1;
});
