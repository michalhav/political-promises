# Anotační pokyny: co je slib

**Verze 1.0.0.** Je to úmyslně krátká první verze. Skutečná pravidla se ukážou teprve na reálných programech — až narazíš na případ, který se sem nevejde, **rozhodni, zapiš ho do sekce Sporné případy a zvyš verzi**. Pokyny, které se tváří hotově dřív, než je kdo použil, si vymýšlejí problémy a přehlížejí ty pravé.

Verze pokynů se zapisuje do každého datasetu (`guidelinesVersion`). Když se pravidla změní, je vidět, které anotace vznikly podle kterých.

---

## Základní otázka

> Zavazuje se tu někdo k něčemu, u čeho by šlo po volebním období říct, jestli se to stalo?

Ne „je to důležité", ne „souhlasím s tím". Jen tohle.

---

## Co je slib (PROMISE)

Věta, která splňuje **obojí**:

1. **Je to závazek**, ne popis, přání ani hodnocení. V češtině typicky první osoba množného čísla budoucího času: *postavíme, zavedeme, rozšíříme, zrušíme, nezvýšíme*.
2. **Aspoň v principu se dá zjistit, jestli nastal.** Nemusí být měřitelný číslem — musí být představitelný doklad, který by ukázal splnění nebo nesplnění.

Příklady:

| Věta | Proč slib |
| --- | --- |
| „Postavíme 2 000 nových městských bytů do roku 2026." | Závazek, číslo, termín. |
| „Zavedeme jednotné přihlášení do digitálních služeb města." | Závazek. Bez čísla, ale doložitelný — služba buď jednotné přihlášení má, nebo nemá. |
| „Nezvýšíme daň z nemovitosti." | Závazek k nekonání. Doložitelný z vyhlášky. |
| „Zrušíme poplatek za svoz odpadu pro seniory." | Závazek, doložitelný z usnesení. |

Slibem zůstává i tehdy, když je **mimo pravomoc** toho, kdo ho dává (*„Prosadíme snížení DPH"*). Anotuj ho jako `PROMISE` — že se nedá hodnotit, řeší až hodnotitelnost v aplikaci, ne anotace. Míchat to sem by znamenalo, že extraktor se učí přeskakovat věty, které v produktu chceme mít.

---

## Co slib není (NOT_PROMISE)

| Typ | Příklad | Proč ne |
| --- | --- | --- |
| Nadpis, heslo | „BYDLENÍ", „Praha pro lidi" | Nic netvrdí. |
| Popis stavu | „Bydlení je v našem městě dlouhodobě drahé." | Konstatování, ne závazek. |
| Hodnota, postoj | „Věříme v otevřenou radnici." | Nedá se ověřit. |
| Přání bez závazku | „Chceme, aby doprava byla plynulejší." | *Chceme* není *uděláme*. Pokud věta pokračuje konkrétním opatřením, anotuj tu část. |
| Cizí závazek | „Stát slíbil dostavbu okruhu." | Slibuje někdo jiný. |
| Popis minulosti | „Za naší vlády jsme postavili 500 bytů." | Minulý čas, není co sledovat. |
| Procesní vata | „Budeme se tématu věnovat." | Není z čeho poznat splnění. |

**Protipříklady jsou stejně cenné jako pozitivní.** Dataset s nimi měří, jestli extraktor umí říct „tohle ne" — bez nich vypadá dobře i extraktor, který označí půl dokumentu.

Neanotuj všechno, co slib není. Vyber ty, které **svádějí** — jsou na hranici a vysvětlují, kde ta hranice leží.

---

## Kde má citace začínat a končit

- **Jedna věta = jeden příklad.** Ne odstavec.
- **Citace musí doslova odpovídat** textu dokumentu. Neopravuj překlepy, mezery ani dělení slov — kontrola při načtení to odmítne a je to tak správně.
- Koncová interpunkce **patří dovnitř**.
- Nadpis nad větou dovnitř **nepatří**, i když k ní významem patří.
- Když jsou v jednom souvětí dva samostatné závazky, anotuj je jako **dva** příklady s vlastními rozsahy. Když se rozdělit nedají, vezmi celé souvětí a napiš to do `notes`.

Rozsahy jsou znakové posuny **uvnitř stránky** kanonického textu. Kostra z `npm run corpus:scaffold` je vyplní za tebe; ručně je počítat nemusíš.

---

## Nepovinná pole

- **`normalizedStatement`** — přepis do ověřitelné podoby, když je původní věta nejasná. Nenahrazuje ji, jen upřesňuje, co by znamenalo splnění. Vyplňuj hlavně u vět, kde jsi váhal.
- **`topic`** — téma podle číselníku aplikace. Když věta patří do dvou, vyber hlavní.
- **`notes`** — **u každého sporného případu povinné v praxi.** Napiš, proč jsi rozhodl takhle. Tyhle poznámky jsou hlavní surovina pro verzi 2 těchhle pokynů.

---

## Postup

```bash
npm run corpus:extract  -- corpus/nazev/program.pdf
npm run corpus:scaffold -- corpus/nazev/extracted.json --annotator "Jméno"
# ruční práce v golden.draft.json → přejmenovat na golden.json
npm run corpus:evaluate -- corpus/nazev
```

Anotuj **dřív**, než se podíváš na výstup extraktoru. Když anotace vzniká podle toho, co stroj našel, měří se pak hlavně shoda s vlastním odhadem.

---

## Sporné případy

Sem patří rozhodnutí, která pokyny výše nepokrývaly. Formát: věta, rozhodnutí, důvod, datum.

_(Zatím prázdné — vyplní se při anotaci prvního skutečného programu.)_
