# Diagnostika extrakce: Plán pro Prahu (Praha Sobě, 2022)

První skutečný dokument v korpusu. Extrakce proběhla **beze změny extraktoru i normalizace** — smyslem bylo zjistit, jak si stávající pravidla vedou na reálné sazbě, ne dolaďovat je do lepšího čísla.

## Provenience

| Údaj | Hodnota |
| --- | --- |
| Název | Plán pro Prahu — Naše vize a 218 konkrétních zlepšení |
| Vydavatel | Praha Sobě |
| Zdroj | `https://prahasobe.cz/wp-content/uploads/2022/04/Plan-pro-Prahu-2022-web.pdf` |
| Stránka s odkazem | `https://prahasobe.cz/plan-pro-prahu-2022/` |
| Zveřejněno | 2022-04-13 (soubor na serveru 2022-04-17) |
| Staženo | 2026-08-21T10:44:00Z |
| Velikost | 2 427 797 B |
| **SHA-256** | `ae5ff08a7a294e013c460e88eed1c488484f39515dc2d4a0e3d1d62f23b5cda3` |
| Verze PDF | 1.6 |
| Nakládání s textem | plný text (politický dokument, pravidlo B2) |

Dokument je **zmrazený**. Do aplikační databáze zatím nevstupuje — publikace hodnocení o jmenovaném subjektu čeká na vyřešení sekce B briefu.

## Souhrn

| Metrika | Hodnota |
| --- | --- |
| Stránek | 92 |
| Znaků (kanonicky) | 220 288 |
| Znaků (po normalizaci) | 217 994 |
| Stránek bez textu | **0** |
| Varování pdf.js | **0** |
| Podezřelé řídicí znaky | **0 druhů** |
| Dělení slov na konci řádku | 1 147 jistých, 0 nejednoznačných |
| Roztříštěné stránky | 3 |

**Textová vrstva je v pořádku.** Žádný sken, žádné chybějící glyfy, žádný náhradní znak `U+FFFD`. Česká diakritika vyšla správně včetně `ě ř š ž č ů ď ť ň`. **OCR není potřeba** a nic nedoložilo důvod ho přidávat.

## Řídicí a neviditelné znaky

Detektor našel **nula** podezřelých znaků. Ověřeno rozborem:

- `Cc` = 3 985 výskytů, **výhradně `U+000A`** (konec řádku) — legitimní.
- Mezery = 29 463 výskytů, **výhradně `U+0020`**. Ani jedna nezlomitelná mezera.
- Žádný měkký spojovník, ZWSP, BOM ani `U+FFFD`.

Nepřítomnost `U+00A0` stojí za pozornost: česká sazba ji po jednopísmenných předložkách běžně používá. Buď ji nepoužil sazeč, nebo ji pdf.js při převodu kódů glyfů mapuje na obyčejnou mezeru. Pro nás je to dobrá zpráva — o jeden zdroj tichého rozporu mezi citací a zobrazeným textem méně.

## Dělení slov

**1 147 jistých případů** (spojovník, konec řádku, malé písmeno), rozprostřených prakticky po celém dokumentu — 20–27 na hustě vysázenou stránku. Nejvíc: s. 58 (27), s. 25, 26, 62 (25).

Ukázky:

```
í spory, jednat s majiteli nemo-\nvitostí o řešení reklamy v
bjektu a šlapat na paty všem vy-\nchytralcům, kteří vymýšlejí
akčním vedením stojí lampa, ved-\nle lampy sloupek s dopravní
```

Nejednoznačných případů (za spojovníkem velké písmeno nebo číslice) je **0**, takže pravidlo pro spojování v normalizaci nemá jak uškodit.

**Dopad na citace:** normalizace slova správně spojí (`nemo-\nvitostí` → `nemovitostí`), ale **kanonická citace zůstane rozdělená** — a to je záměr. Citace musí odpovídat tomu, co v dokumentu doslova stojí. V praxi to znamená, že u zhruba každé druhé věty bude doslovná citace obsahovat spojovník a zalomení. **Tohle je zdaleka nejdůležitější zjištění pro anotaci a pro budoucí redakční práci.**

## Roztříštěné stránky

Medián délky textového kusu: **44,31 znaku** — na dokument tohoto typu vysoká hodnota, tedy souvislé odstavce.

| Stránka | Kusů | Znaků | Průměr | Faktor |
| --- | --- | --- | --- | --- |
| 14 | 64 | 545 | 8,52 | 5,2× |
| 92 | 12 | 230 | 19,17 | 2,3× |
| 91 | 34 | 659 | 19,38 | 2,3× |

Jen tři stránky a jen jedna výrazně (s. 14). Stránky 91–92 jsou konec dokumentu (tiráž, kontakty), kde je krátký text očekávatelný. **Bez vizuální kontroly nelze rozhodnout, jestli jde o vadu, nebo o legitimně jinou sazbu.**

## Nález mimo zadané metriky: pořadí čtení a běžící záhlaví

Při kontrole vzorků textu vyšly najevo dvě věci, které žádná ze zadaných metrik nezachytí:

**1. Obálka má rozházené pořadí čtení.** Stránka 1 se vytěžila jako:

```
NAŠE VIZE A KONKRÉTNÍCH
218 ZLEPŠENÍ
PLÁN
PRO PRAHU
```

Správně je to „PLÁN PRO PRAHU — Naše vize a 218 konkrétních zlepšení". Text je celý, ale v pořadí kreslení, ne čtení. U obálky to nevadí (nic se z ní nebude citovat), ale je to varovný signál pro grafické stránky uvnitř.

**2. Běžící záhlaví a čísla stran jsou vmíchané do textu.**

- **45 z 92 stránek** má v prvních 120 znacích řetězec `PRAHA SOBĚ I Naše vize a konkrétních 218 zlepšení`.
- **33 z 92 stránek** začíná holým číslem stránky.

Příklad (s. 12): `PRAHA SOBĚ I Naše vize a konkrétních 218 zlepšení12` — číslo stránky je nalepené na záhlaví bez oddělovače.

**Dopad:** dělení na věty vezme záhlaví jako součást prvního odstavce, takže první kandidát na každé takové stránce bude mít v citaci navíc kus záhlaví. **Je to nejpravděpodobnější zdroj vadných citací při anotaci i při vytěžování.**

Extraktor jsem podle instrukce **neměnil**. Zaznamenávám to jako kandidáta na opravu, až to potvrdí ruční kontrola.

## Doporučených 10 stránek k vizuální kontrole

Vybráno podle rozdílných vzorů sazby, ne náhodně:

| Stránka | Proč |
| --- | --- |
| 1 | Obálka — jiná sazba, potvrzené rozházené pořadí čtení. |
| 26 | Nejvíc textu (4 809 znaků) — hustá sazba, největší šance na chybu v pořadí. |
| 5 | Nejméně textu, a přesto neprázdná (11 znaků) — grafika nebo popisek. |
| 14 | Nejroztříštěnější text (5,2× nad medián). |
| 58 | Nejvíc dělených slov (27). |
| 92 | Poslední stránka — tiráž a kontakty. |
| 9, 17, 25, 33 | Rovnoměrný vzorek napříč dokumentem. |

Výběr podle podílu číslic a podílu verzálek se neuplatnil — obě kritéria ukázala na stránky, které už v seznamu byly (typicky obálku). Doplnily je proto rovnoměrné vzorky.

**Co při kontrole hledat:**

1. Odpovídá pořadí odstavců tomu, co je v PDF vidět?
2. Je záhlaví oddělené od textu, nebo slepené s prvním odstavcem?
3. Neztratily se odrážky a nespojily se položky seznamu do jedné věty?
4. Je stránka 14 vadná, nebo jen jinak vysázená?
5. Sedí čísla a jednotky (nerozpadlo se „2 000" na „2" a „000")?

## Závěr

Extrakce si na reálném dokumentu vede **lépe, než jsem čekal**: čistá textová vrstva, správná diakritika, žádné ztracené glyfy, žádná prázdná stránka. Riziko z briefu (sekce E2, „extrakce z PDF je skrytý žrout času") se u tohoto dokumentu nepotvrdilo.

Dva konkrétní problémy k ověření vizuální kontrolou:

1. **Běžící záhlaví slepené s textem** na polovině stránek — nejpravděpodobnější zdroj vadných citací.
2. **Rozházené pořadí čtení** na grafických stránkách — potvrzeno na obálce, netušíme, jak často uvnitř.

Dělení slov je četné (1 147), ale **není to vada** — normalizace ho řeší a kanonická citace ho má obsahovat.

**Extraktor jsem nezměnil.** Až ruční kontrola potvrdí konkrétní selhání, bude z čeho vycházet.
