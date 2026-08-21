# Korpus

Vytěžené dokumenty a jejich ruční anotace. Jeden adresář = jeden dokument.

```text
corpus/nazev-dokumentu/
  program.pdf       zdrojový soubor (skutečné dokumenty se necommitují)
  extracted.json    kanonický text po stránkách + otisk souboru
  golden.json       ruční anotace
  evaluation.json   poslední výsledek měření
```

## Postup

```bash
npm run corpus:add      -- <url> --dir corpus/nazev --title "…" --publisher "…" --type COUNCIL_RESOLUTION
npm run corpus:extract  -- corpus/nazev/program.pdf
npm run corpus:scaffold -- corpus/nazev/extracted.json --annotator "Jméno"
# ruční anotace: golden.draft.json → golden.json
npm run corpus:evaluate -- corpus/nazev
```

## Odkud se berou reálné dokumenty

`corpus:add` stáhne dokument z veřejné adresy a v ten okamžik zapíše
provenienci: adresu (po případném přesměrování), čas stažení, otisk SHA-256,
velikost, typ obsahu a hlavičku `Last-Modified`. Teprve tím dokument vzniká.

`corpus:fetch` je něco jiného — ten už existující otisk jen ověřuje, když
dokument stahuješ znovu. Rozdíl v otisku není chyba nástroje, ale nález.

Existující adresář se **nepřepisuje**. Nová verze téhož dokumentu patří do
vlastního adresáře; přepsat zmrazený soubor by tiše znehodnotilo všechny citace
a anotace, které se k němu vážou.

U chráněného díla (novinový článek) patří `--license QUOTE_ONLY` — plný text se
pak neukládá a pracuje se jen s citacemi.

## Tabulková data (zakázky, rozpočty, faktury)

Otevřená data měst jsou z velké části tabulky, ne próza. `corpus:table` z výřezu
tabulky udělá textový dokument, kde je **jeden řádek tabulky na jednom řádku
textu**:

```bash
npm run corpus:table -- https://storage.golemio.cz/ckan/tendersystems/verejne_zakazky.csv   --dir corpus/zakazky-mosty   --title "Veřejné zakázky MHMP — mosty (výřez)"   --publisher "Hlavní město Praha"   --type PUBLIC_PROCUREMENT   --match "most"   --columns nazev_zakazky,faze_zakazky,nazev_smluvniho_partnera,smluvni_cena_bez_dph_kc,datum_uzavreni_smlouvy
```

Od té chvíle je to pro systém obyčejný zdroj: platí otisk, doslovné ověření
citace i celý redakční postup. Žádná nová entita, žádná migrace.

Číslo řádku je z **původního** souboru, ne z výřezu — po změně filtru tak stará
citace neukazuje jinam.

Výběr řádků a sloupců je redakční rozhodnutí, ne technický detail, takže
`provenance.json` nese blok `derivedFrom`: otisk původního souboru, použitý
filtr, vybrané sloupce a kolik řádků měl originál. Bez toho by šlo výřez vydávat
za celý dataset.

Vytěžovat z tabulky sliby nemá smysl — je to podklad pro **důkazy**.

## Nemusíš anotovat celý dokument

Devadesátistránkový program má přes tisíc úseků a anotovat ho celý je práce na
dny. Vezmi výsek:

```bash
npm run corpus:scaffold -- corpus/nazev/extracted.json --annotator "Jméno" --from 20 --to 35
```

**Měření to respektuje.** Metriky se počítají jen na stránkách, které anotace
pokrývá; kandidáti mimo ně se vypíšou zvlášť jako „mimo anotovaný rozsah" a do
přesnosti se nezapočítají. Bez toho by každá věta mimo výsek byla falešný
poplach a číslo by vypadalo jako měření, aniž by cokoli měřilo.

Stránka se počítá za prošlou, i když na ní žádný slib není — anotátor ji přečetl
a rozhodl. Právě na takových stránkách mají falešné poplachy smysl, takže tam
nech i protipříklady.

Pravidla, co se počítá jako slib: [docs/promise-annotation-guidelines.md](../docs/promise-annotation-guidelines.md).

Anotuj **dřív**, než se podíváš na výstup extraktoru. Jinak se anotace přizpůsobí tomu, co stroj našel, a měření pak vypovídá hlavně o vlastním odhadu.

## Co se commituje

`extracted.json` a `golden.json` ano — jsou to naše data a bez nich nemá měření smysl.

**Skutečné volební programy do repozitáře nepatří.** Jsou to cizí dokumenty; do systému se ukládají přes redakční konzoli, kde mají evidovanou provenienci a nakládání s textem. Adresáře s reálnými dokumenty proto ignoruje `.gitignore` — přidávej výjimku vědomě, ne omylem.

## `demo-program`

Jediný adresář se souborem v repozitáři. PDF je **smyšlené** a generuje ho `npm run corpus:demo`, takže celý řetězec jde spustit hned po naklonování a je vidět, jak má výstup vypadat.

Ukázka je schválně nastavená tak, aby heuristická laťka nevyšla dokonale:

| Věta | Co ukazuje |
| --- | --- |
| „Do konce roku 2025 vznikne v každé městské části nové dětské hřiště." | Závazek bez slovesa v 1. osobě. Heuristika ho **mine** — sráží úplnost. |
| „Rozšíříme obzory našich dětí a jejich možnosti." | Sloveso závazku ve větě, u které nejde určit splnění. Heuristika ji **vezme** — sráží přesnost. |

Aktuální výsledek: přesnost 87,5 %, úplnost 87,5 %, věrnost citací 100 %, citace bez opory 0.

Čísla z ukázky **nevypovídají o kvalitě extraktoru** na skutečných datech. Text i heuristika vznikly společně, takže měří hlavně to, že aparát funguje. Skutečná laťka vznikne až nad prvním pražským programem.
