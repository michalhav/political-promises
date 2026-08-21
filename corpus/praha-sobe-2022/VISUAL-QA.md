# Ruční kontrola sazby: Plán pro Prahu (Praha Sobě, 2022)

Kontrola deseti stránek vybraných diagnostikou. Dokument: SHA‑256 `ae5ff08a…5cda3`, extraktor `pdfjs-1.0.0`, 92 stran.

## Jak kontrola probíhala

Na PDF se nedívám očima — místo toho porovnávám dvě nezávislé rekonstrukce téže stránky:

1. **kanonický text** v pořadí, v jakém ho vrátí extrakce (pořadí kreslení v PDF),
2. **rekonstrukci z poloh** všech kusů textu: sloupce zleva doprava, uvnitř shora dolů.

Shodují‑li se v obsahu slov, čte extrakce stránku tak, jak by ji četl člověk. Kde se rozejdou, je to doložený rozdíl, ne dojem.

**Nástroj jsem musel opravit dřív než dokument.** První verze řadila kusy textu jen podle svislé polohy přes celou šířku stránky, čímž u dvousloupcové sazby proložila oba sloupce dohromady a označila **všech deset stránek** za vadné. Kontrola kontroly ukázala, že chyba je v nástroji: kanonický text čte souvisle, jen po sloupcích. Po opravě na sloupcově orientované řazení vychází shoda 99–100 % na devíti z deseti stránek. Podklady jsou v `qa/page-*.txt`.

Extraktor ani normalizace se v průběhu kontroly **neměnily**.

## Souhrn

| s. | znaků | řádků | sloupců | shoda slov | dělení | záhlaví | číslo str. | fragmentace |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 51 | 4 | 1 | 100,0 % | 0 | – | – | – |
| 5 | 11 | 2 | 1 | 100,0 % | 0 | – | ano | – |
| 9 | 2 957 | 26 | 4 | 100,0 % | 16 | – | ano | – |
| 14 | 579 | 24 | 1 | **71,0 %** | 0 | ano | – | **5,2×** |
| 17 | 1 867 | 37 | 4 | 100,0 % | 9 | – | ano | – |
| 25 | 3 951 | 46 | 3 | 99,7 % | 25 | – | ano | – |
| 26 | 4 809 | 48 | 2 | 99,3 % | 25 | ano | – | – |
| 33 | 3 970 | 45 | 3 | 99,7 % | 24 | – | ano | – |
| 58 | 4 609 | 46 | 2 | 99,3 % | 27 | ano | – | – |
| 92 | 237 | 8 | 1 | 100,0 % | 0 | – | – | 2,31× |

## Po stránkách

Legenda hodnocení: **OK** · **drobnost** (nevadí pro vytěžování) · **vada** (je potřeba řešit).

### s. 1 — obálka

| Kritérium | Nález |
| --- | --- |
| Úplnost | OK — všechna čtyři slova obálky jsou v textu. |
| Pořadí čtení | **Drobnost.** Vytěženo `NAŠE VIZE A KONKRÉTNÍCH / 218 ZLEPŠENÍ / PLÁN / PRO PRAHU`; vizuálně je hlavní titul „PLÁN PRO PRAHU“ nahoře. Pořadí je podle kreslení, ne podle čtení. |
| Pořadí odstavců | Neuplatňuje se. |
| Odrážky | Žádné. |
| Čísla | „218“ v pořádku. |
| Dělení slov | Žádné. |
| Běžící záhlaví | Není. |
| Číslo stránky | Není. |
| Sazba | Grafická obálka, jeden blok. |
| **Vhodnost k vytěžování** | **Nepoužitelná** — a je to v pořádku. Obálka žádný slib neobsahuje. |

### s. 5 — oddělovač kapitoly

| Kritérium | Nález |
| --- | --- |
| Úplnost | OK (11 znaků: `5` + `NAŠI LIDÉ`). |
| Pořadí čtení | OK. |
| Odrážky / čísla / dělení | Neuplatňuje se. |
| Běžící záhlaví | Není. |
| Číslo stránky | **Ano, jako první řádek** — holé `5`. |
| Sazba | Titulní stránka oddílu. |
| **Vhodnost** | Nepoužitelná (bez obsahu). Číslo stránky je jediný šum. |

### s. 9 — medailonky, čtyři sloupce

| Kritérium | Nález |
| --- | --- |
| Úplnost | OK, 2 957 znaků. |
| Pořadí čtení | **OK, shoda 100 %** i při čtyřech sloupcích. |
| Pořadí odstavců | OK — medailonky se neprolínají. |
| Odrážky | Žádné. |
| Čísla | Bez dělených čísel. |
| Dělení slov | 16 případů, standardní. |
| Běžící záhlaví | Není. |
| Číslo stránky | Ano, první řádek. |
| Sazba | 4 sloupce, zvládnuto. |
| **Vhodnost** | Podmíněně — jsou to životopisy kandidátů, ne sliby. Pro anotaci jako zdroj protipříkladů. |

### s. 14 — obsah

| Kritérium | Nález |
| --- | --- |
| Úplnost | OK — všechny názvy kapitol i čísla stran jsou v textu. |
| Pořadí čtení | **Vada.** Shoda jen 71 %. Čísla stran (`20/`, `34/`, …) vypadla jako samostatný blok na konci, místo aby stála u svých kapitol. Vizuálně: `Doprava / 20/tým Adama Scheinherra`. Kanonicky: všechny názvy, pak všechna čísla. |
| Pořadí odstavců | Vada jako výše. |
| Odrážky | Žádné. |
| Čísla | Přítomna, ale odtržená od kontextu. |
| Dělení slov | Žádné. |
| Běžící záhlaví | **Ano**, první řádek: `PRAHA SOBĚ I Naše vize a konkrétních 218 zlepšení14`. |
| Číslo stránky | Nalepené na záhlaví bez oddělovače. |
| Sazba | Tabulkový obsah — nejroztříštěnější stránka dokumentu (5,2× nad medián). |
| **Vhodnost** | **Nepoužitelná** — je to obsah, žádný slib. **Vada se netýká stránky nesoucí sliby**, takže nezakládá důvod k rekonstrukci rozvržení. |

### s. 17 — čtyři sloupce

| Kritérium | Nález |
| --- | --- |
| Úplnost | OK, 1 867 znaků. |
| Pořadí čtení / odstavců | **OK, shoda 100 %.** |
| Odrážky | Žádné textové. |
| Čísla | OK. |
| Dělení slov | 9 případů. |
| Běžící záhlaví | Není. |
| Číslo stránky | Ano, první řádek. |
| Sazba | 4 sloupce, zvládnuto. |
| **Vhodnost** | Dobrá. |

### s. 25, 33 — programové kapitoly, tři sloupce

| Kritérium | Nález |
| --- | --- |
| Úplnost | OK (3 951 a 3 970 znaků). |
| Pořadí čtení / odstavců | **OK, shoda 99,7 %.** Zbytek do 100 % jsou spojovníky na koncích řádků, které rekonstrukce a extrakce dělí jinak — ne ztracený text. |
| Odrážky | Bez textových odrážek; položky výčtů jsou samostatné odstavce a každá je celou větou. |
| Čísla | OK, bez dělení. |
| Dělení slov | 25 a 24 případů. |
| Běžící záhlaví | Není. |
| Číslo stránky | Ano, první řádek. |
| Sazba | 3 sloupce, zvládnuto. |
| **Vhodnost** | **Dobrá.** Přesně ten typ stránky, ze kterého se budou vytěžovat sliby. |

### s. 26, 58 — programové kapitoly, dva sloupce

| Kritérium | Nález |
| --- | --- |
| Úplnost | OK (4 809 a 4 609 znaků — nejdelší stránky dokumentu). |
| Pořadí čtení | **OK, shoda 99,3 %.** Ověřeno i přečtením: text s. 26 o okružní lince metra čte souvisle přes celou stránku. |
| Pořadí odstavců | OK. |
| Odrážky | Na s. 26 jedna textová odrážka; zbytek výčtu jsou odstavce. Integrita zachována — položky se neslévají. |
| Čísla | OK: „218“, „2026 až 2030“, „150 tisíc“, „S49“ — nic se nerozpadlo. |
| Dělení slov | 25 a 27 případů, nejvíc v dokumentu. Normalizace je spojuje správně (`prá-\ce` → `práce`). |
| Běžící záhlaví | **Ano**, první řádek s nalepeným číslem stránky. |
| Číslo stránky | Součást záhlaví. |
| Sazba | 2 sloupce, zvládnuto. |
| **Vhodnost** | **Dobrá.** |

### s. 92 — kontakty a petice

| Kritérium | Nález |
| --- | --- |
| Úplnost | OK, 237 znaků. |
| Pořadí čtení | OK, shoda 100 %. |
| Odrážky | Žádné. |
| Čísla | „100 tisíc“ v pořádku. |
| Dělení slov | Žádné. |
| Běžící záhlaví | Není. |
| Číslo stránky | Není. |
| Sazba | Krátké bloky, formálně „fragmentovaná“ (2,31×) — ale je to výzva k podpisu petice, ne vada. |
| **Vhodnost** | Nepoužitelná (není to program). |

## Závěr kontroly

**Extrakce je pro účel produktu přijatelná.** Na šesti obsahových stránkách (9, 17, 25, 26, 33, 58) je shoda pořadí čtení 99,3–100 % včetně dvou, tří a čtyř sloupců. Nic se neztratilo, čísla se nerozpadla, dělení slov normalizace řeší.

**Rozvržení rekonstruovat nebudeme.** Jediná stránka s vadným pořadím čtení je **obsah (s. 14)** a částečně **obálka (s. 1)** — ani jedna nenese slib. Podmínka „meaningful errors on actual promise-bearing content pages“ splněna není.

**Doložená kontaminace: stránková výbava.** Na **78 z 92 stran** je prvním řádkem kanonického textu buď běžící patička `PRAHA SOBĚ I Naše vize a konkrétních 218 zlepšení<číslo>` (45 stran), nebo holé číslo stránky (33 stran).

Konkrétní dopad, změřený a ne odhadnutý:

- Patička je vlastní řádek, takže **nekazí citace uvnitř vět** — do žádné skutečné věty se nevmísí.
- Rozpadem na úseky ale vzniká **45 falešných kandidátů** (jeden na stránku), které projdou i filtrem délky a nejsou rozpoznány jako nadpis, protože nejsou psané verzálkami.
- Anotátor by je musel 45× ručně odmítnout a budoucí extraktor by se je musel naučit ignorovat.

To je dost na strukturální vyloučení — ale **jen ze zpracovací reprezentace, kanonický text zůstává beze změny**.

## Nález objevený až po kontrole: dělení na věty

Po vyloučení stránkové výbavy jsem připravil kostru anotací a hned se ukázalo, že je nepoužitelná. Dělení úseků probíhalo na hranicích **typografických řádků**, ne vět:

```
3 302 úseků  ·  medián délky 52 znaků  ·  jen 29 % končí tečkou
'Proto jsme přišli s plánem prověřit vznik nové linky O: páté, okružní'
'Metro O by mělo v první fázi propojit místa'
'nového developmentu a místa, mezi nimiž lidé dojíždějí do prá-'
```

Poslední řádek je přeťatý uprostřed slova. Anotovat se to nedá a vytěžovat taky ne — je to konkrétní selhání na obsahových stránkách, tedy přesně ta podmínka, po které je zásah na místě.

**Oprava:** dělit nad zpracovací reprezentací, kde jsou řádky slepené a dělená slova spojená, a nález převádět zpět na rozsah v kanonickém textu. Citace tak zůstává doslovná včetně zalomení.

```
1 509 úseků  ·  medián délky 114 znaků  ·  98 % končí tečkou
'Metro O by mělo v první fázi propojit místa
nového developmentu a místa, mezi nimiž lidé dojíždějí do prá-
ce.'
```

Původní dělení po řádcích zůstává beze změny jako samostatná funkce, aby heuristická laťka měřila dál totéž.

## Co z toho plyne pro další práci

1. **Vyloučit stránkovou výbavu strukturálně** (patička a číslo stránky) z odvozené reprezentace. Kanonický text, otisk ani posuny uvnitř stránky se nemění.
2. **Nerekonstruovat rozvržení.** Obsah a obálka za to nestojí a riziko rozbití funkčních stránek je vyšší než užitek.
3. **Anotovat na obsahových stránkách**, tedy v rozsahu zhruba s. 20–90. Stránky 1–19 jsou obálka, medailonky a obsah.
