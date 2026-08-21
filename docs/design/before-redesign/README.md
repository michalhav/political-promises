# Stav před redesignem

Snímky obrazovek pořízené **21. 8. 2026**, těsně před zahájením vizuálního redesignu. Odpovídají commitu, ve kterém byly přidány.

Jsou tu proto, aby šlo po redesignu odpovědět na otázku „zlepšilo se to, nebo je to jen jiné". Bez „před" se srovnává s dojmem, který si každý pamatuje jinak.

## Co je na snímcích

| Soubor | Stránka |
| --- | --- |
| `01-uvod.png` | Úvodní stránka |
| `02-sliby.png` | Přehled slibů |
| `03-sliby-filtr.png` | Přehled s filtrem na dopravu |
| `04-detail-slibu.png` | Detail slibu (2 000 bytů) — nejsložitější veřejná obrazovka |
| `05-detail-nehodnotitelny.png` | Detail nehodnotitelného slibu |
| `06-porovnani.png` | Program vs. koaliční smlouva |
| `07-metodika.png` | Metodika |
| `10-prihlaseni.png` | Přihlášení do redakce |
| `11-prehled.png` | Redakční přehled s frontami |
| `12-zdroje.png` | Zdrojové dokumenty |
| `13-novy-kandidat.png` | Formulář nového kandidáta |
| `14-sliby.png` | Sliby v redakci |
| `15-detail-slibu.png` | Detail slibu v redakci — nejsložitější obrazovka vůbec |
| `20-mobil-*.png` | Úvod, přehled a detail na šířce 390 px |
| `30-tma-*.png`, `31-tma-*.png` | Úvod a detail v tmavém režimu |

## Jak vznikly

```bash
CAPTURE_SCREENSHOTS=1 npm run screens
```

Skript je `e2e/screenshots.e2e.ts`, pracovní výstup jde do `e2e/screenshots/` (mimo Git). Tahle složka je **zmrazená kopie** — nepřepisuj ji, až se vzhled změní. Nový stav patří vedle, do vlastní složky.

## Co na nich stojí za pozornost

Věci, které redesign nesmí ztratit — jsou to produktová rozhodnutí, ne estetika:

- **Stav se nikdy nekóduje jen barvou.** Žádná zelená pro „splněno", žádná červená pro „opuštěno". Odlišuje se jediné: jestli vůbec nějaký závěr máme.
- **Značka `demo`** stojí přímo u jména kandidátky a u názvu dokumentu, ne jen v patičce.
- **Rozhodné datum rešerše** má na detailu vlastní rámeček — bez něj je stav plnění nedatovaný výrok.
- **Rozpad hodnotitelnosti** s vysvětlením, které pravidlo se uplatnilo. Odpověď na „proč to tak je" musí zůstat na jedno kliknutí.
- **Doslovné citace se zdrojem, stranou a datem stažení** u každého tvrzení.
- **Odkaz „Přeskočit na obsah"** jako první cíl tabulátoru.

## Co se na snímcích už promítlo

Snímky vznikly po dvou opravách z posledního kola, takže je na nich vidět stav **po** nich:

- **Redakční konzole má vlastní hlavičku**, ne veřejnou. Layouty jsou rozdělené do skupin `(public)` a `admin`; patička s výzvou „Našli jste chybu?" nad redakční prací nedávala smysl.
- **„Nedávno publikováno" už neukazuje týž slib dvakrát.** Fronta bere jen aktuální verzi hodnocení, ne každou publikovanou.
