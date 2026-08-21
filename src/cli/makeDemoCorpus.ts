/**
 * Vyrobí ukázkový program v PDF pro `corpus/demo-program/`.
 *
 * Skutečný pražský volební program v repozitáři není — je to cizí dokument
 * a přibalovat ho sem nemá smysl. Ukázka proto slouží k tomu, aby šlo celý
 * řetězec (PDF → text → anotace → měření) spustit hned po naklonování a vidět,
 * jak má výstup vypadat.
 *
 * Text je smyšlený a odpovídá demo datům ve zbytku projektu.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { makePdf } from "@/modules/ingestion/testing/makePdf";

const PAGES = [
  {
    lines: [
      "VOLEBNÍ PROGRAM DEMO STRANY A",
      "Komunální volby 2022",
      "",
      "BYDLENÍ",
      "Bydlení je v našem městě dlouhodobě drahé a mladé rodiny odcházejí.",
      "Postavíme 2 000 nových městských nájemních bytů do konce volebního období.",
      "Byty udržíme v majetku města a nebudeme je rozprodávat.",
      "Chceme, aby bydlení bylo dostupné pro každého.",
      "",
      "ŠKOLSTVÍ",
      "Navýšíme kapacitu mateřských škol o 1 200 míst do roku 2026.",
      "Do konce roku 2025 vznikne v každé městské části nové dětské hřiště.",
      "Rozšíříme obzory našich dětí a jejich možnosti.",
      "Věříme v kvalitní veřejné vzdělávání.",
    ],
  },
  {
    lines: [
      "DOPRAVA",
      "Zahájíme stavbu tramvajové trati do Demo čtvrti nejpozději v roce 2025.",
      "Rozšíříme síť chráněných cyklotras v centru města.",
      "Stát slíbil dostavbu městského okruhu do roku 2030.",
      "Budeme se tématu parkování soustavně věnovat.",
      "",
      "VEŘEJNÉ FINANCE",
      "Nezvýšíme daň z nemovitosti po celé volební období.",
      "Prosadíme snížení daně z přidané hodnoty na stavební práce.",
      "Za našeho vedení jsme snížili zadlužení města o 3 miliardy korun.",
    ],
  },
];

async function main(): Promise<void> {
  const directory = path.join("corpus", "demo-program");
  await mkdir(directory, { recursive: true });

  const target = path.join(directory, "program.pdf");
  await writeFile(target, makePdf(PAGES));

  console.log(`Ukázkový program: ${target}`);
  console.log("Dál: npm run corpus:extract -- corpus/demo-program/program.pdf");
}

main().catch((error: unknown) => {
  console.error("Vytvoření ukázky selhalo:", error);
  process.exitCode = 1;
});
