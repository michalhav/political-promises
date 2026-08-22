/**
 * Srovná korpus na disku proti manifestu `corpus/sources.json`.
 *
 *   npm run corpus:sync            vypíše stav
 *   npm run corpus:sync -- --check skončí chybou, když se něco rozešlo (CI)
 *
 * Sám nic nestahuje. Stažení je nevratný zápis do korpusu, u kterého se
 * rozhoduje licence — to má zůstat vědomý krok člověka. Skript proto u každého
 * chybějícího zdroje vypíše přesný příkaz, kterým se pořídí.
 *
 * Proč to existuje: `corpus:fetch` a týdenní workflow ověřují otisky toho, co
 * v repozitáři **je**. Dokument, který nikdy nikdo nestáhl, nemá provenienci,
 * a tím pádem ani žádnou stopu — přesně tak zmizel `corpus/zakazky-mosty`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  acquisitionCommand,
  parseManifest,
  reconcile,
  type ManifestEntry,
} from "@/modules/sources/manifest";

const CORPUS_ROOT = "corpus";
const MANIFEST_PATH = path.join(CORPUS_ROOT, "sources.json");

/**
 * Adresáře, které opravdu nesou stažený dokument.
 *
 * Rozhoduje přítomnost `provenance.json`: adresář bez ní není zdroj, ale
 * rozdělaná práce, a do smíření nepatří.
 */
function presentDirectories(): string[] {
  if (!existsSync(CORPUS_ROOT)) return [];

  return readdirSync(CORPUS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${CORPUS_ROOT}/${entry.name}`)
    .filter((dir) => existsSync(path.join(dir, "provenance.json")))
    .sort();
}

function describe(entry: ManifestEntry): string {
  return `${entry.dir}  [${entry.chainLink}]`;
}

function main(): void {
  const check = process.argv.slice(2).includes("--check");

  if (!existsSync(MANIFEST_PATH)) {
    console.error(`Manifest ${MANIFEST_PATH} neexistuje.`);
    process.exit(1);
  }

  const manifest = parseManifest(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")));
  const report = reconcile(manifest, presentDirectories());

  console.log(`Manifest: ${manifest.sources.length} zdrojů\n`);

  if (report.frozen.length) {
    console.log(`Staženo (${report.frozen.length}):`);
    for (const entry of report.frozen) console.log(`  ✓ ${describe(entry)}`);
    console.log();
  }

  if (report.blocked.length) {
    console.log(`Zablokováno (${report.blocked.length}) — chybí, ale víme proč:`);
    for (const entry of report.blocked) {
      console.log(`  ⏸ ${describe(entry)}`);
      console.log(`      ${entry.blockedBy}`);
    }
    console.log();
  }

  if (report.missing.length) {
    console.log(`CHYBÍ (${report.missing.length}) — deklarované, ale nestažené:`);
    for (const entry of report.missing) {
      console.log(`  ✗ ${describe(entry)}`);
      console.log(`      ${entry.why}`);
      console.log(
        acquisitionCommand(entry)
          .split("\n")
          .map((line) => `      ${line}`)
          .join("\n"),
      );
      console.log();
    }
  }

  if (report.undeclared.length) {
    console.log(
      `NEDEKLAROVÁNO (${report.undeclared.length}) — v korpusu leží, ale nikdo je nechtěl:`,
    );
    for (const dir of report.undeclared) console.log(`  ? ${dir}`);
    console.log("\n  Doplň je do corpus/sources.json, nebo vysvětli, odkud se vzaly.\n");
  }

  const drift = report.missing.length + report.undeclared.length;

  if (!drift) {
    console.log("Korpus odpovídá manifestu.");
    return;
  }

  if (check) {
    console.error(`Korpus se rozešel s manifestem: ${drift} rozdílů.`);
    process.exit(1);
  }
}

main();
