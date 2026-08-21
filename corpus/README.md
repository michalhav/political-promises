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
npm run corpus:extract  -- corpus/nazev/program.pdf
npm run corpus:scaffold -- corpus/nazev/extracted.json --annotator "Jméno"
# ruční anotace: golden.draft.json → golden.json
npm run corpus:evaluate -- corpus/nazev
```

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
