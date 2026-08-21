/**
 * Stažení zdrojového dokumentu podle uložené provenience.
 *
 *   npm run corpus:fetch -- corpus/praha-sobe-2022
 *
 * Otisk v `provenance.json` je **závazný**. Když se stažený soubor liší,
 * skript skončí chybou a soubor nechá být — nesahá na provenienci ani na
 * očekávaný otisk.
 *
 * Je to schválně nepohodlné. Kdyby si nástroj otisk sám přepsal, tichá výměna
 * dokumentu na serveru by prošla bez povšimnutí a všechny citace by najednou
 * ukazovaly do jiného textu, než ze kterého vznikly. Rozdíl v otisku není
 * chyba nástroje, ale nález — a rozhodnout o něm musí člověk.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

interface Provenance {
  url: string;
  contentHash: string;
  byteSize?: number;
  title?: string;
  fileName?: string;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readProvenance(directory: string): Promise<Provenance> {
  const file = path.join(directory, "provenance.json");
  const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
  const provenance = parsed as Provenance;

  if (!provenance.url || !/^[0-9a-f]{64}$/.test(provenance.contentHash ?? "")) {
    throw new Error(`${file} musí obsahovat url a contentHash (64 hex znaků).`);
  }
  return provenance;
}

function targetPath(directory: string, provenance: Provenance): string {
  const fromUrl = path.basename(new URL(provenance.url).pathname);
  return path.join(directory, provenance.fileName ?? fromUrl);
}

function mismatchMessage(expected: string, actual: string, file: string): string {
  return [
    "OTISK NESOUHLASÍ.",
    "",
    `  soubor:     ${file}`,
    `  očekáváno:  ${expected}`,
    `  staženo:    ${actual}`,
    "",
    "Dokument na serveru se od zmrazení změnil, nebo jde o jiný soubor.",
    "Otisk v provenance.json se automaticky nepřepisuje — všechny citace a anotace",
    "se vážou k původnímu textu a tichá výměna by je znehodnotila.",
    "",
    "Co s tím:",
    "  1. Původní verzi si nech (je zmrazená u anotací).",
    "  2. Novou verzi ulož jako samostatný adresář s vlastní proveniencí.",
    "  3. Anotace k nové verzi ověř znovu — posuny nemusí sedět.",
  ].join("\n");
}

async function main(): Promise<void> {
  const [directory] = process.argv.slice(2);
  if (!directory) {
    console.error("Použití: npm run corpus:fetch -- <adresář s provenance.json>");
    process.exitCode = 1;
    return;
  }

  const provenance = await readProvenance(directory);
  const target = targetPath(directory, provenance);

  // Když už soubor máme, jen ho ověříme. Znovu stahovat není důvod.
  const existing = await readFile(target).catch(() => null);
  if (existing) {
    const actual = sha256(existing);
    if (actual !== provenance.contentHash) {
      console.error(mismatchMessage(provenance.contentHash, actual, target));
      process.exitCode = 1;
      return;
    }
    console.log(`Soubor už tu je a otisk souhlasí: ${target}`);
    return;
  }

  console.log(`Stahuji ${provenance.url}`);
  const response = await fetch(provenance.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Server odpověděl ${response.status} ${response.statusText}.`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = sha256(bytes);

  if (actual !== provenance.contentHash) {
    // Neuložíme nic. Poškozený nebo vyměněný soubor nemá v korpusu co dělat.
    console.error(mismatchMessage(provenance.contentHash, actual, target));
    console.error(
      `\n  velikost očekávána: ${provenance.byteSize ?? "?"} B, staženo: ${bytes.length} B`,
    );
    process.exitCode = 1;
    return;
  }

  await writeFile(target, bytes);
  console.log(
    [
      `Uloženo:   ${target}`,
      `Velikost:  ${bytes.length} B`,
      `SHA-256:   ${actual}  (souhlasí s proveniencí)`,
    ].join("\n"),
  );
}

main().catch(async (error: unknown) => {
  console.error("Stažení selhalo:", error);
  // Nedokončený soubor by při dalším běhu prošel jako „už tu je".
  const [directory] = process.argv.slice(2);
  if (directory) {
    await rm(path.join(directory, ".partial"), { force: true }).catch(() => undefined);
  }
  process.exitCode = 1;
});
