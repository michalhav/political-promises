# Po redesignu

Kompletní sada snímků současného stavu. Dvojice k `../before-redesign/` sedí
podle názvu souboru — obojí vzniklo stejným skriptem nad stejnými ukázkovými
daty (`CAPTURE_SCREENSHOTS=1 npx playwright test screenshots`).

| soubor | co je na něm | zásah |
| --- | --- | --- |
| `02-sliby.png` | přehled slibů | zjednodušená karta |
| `03-sliby-filtr.png` | přehled se zapnutým filtrem | zapnuté filtry nad výsledky |
| `04-detail-slibu.png` | detail slibu | přestavěná hierarchie, lišta se sekcemi |
| `05-detail-nehodnotitelny.png` | slib, který nelze vyhodnotit | odpověď větou místo tří štítků |
| `21-mobil-sliby.png` | přehled na mobilu | filtry v zásuvce |
| `22-mobil-detail.png` | detail na mobilu | mapa sekcí |
| `31-tma-detail.png` | detail v tmavém režimu | nové významové povrchy |
| `11-prehled.png` | redakční přehled | fronty místo dlaždic s čísly, další akce a stáří u položky |
| `14-sliby.png` | seznam slibů v redakci | řazení podle poslední práce, revident a stáří místo samostatných sloupců |
| `16-kandidatky.png` | evidence kandidátek a stran | nová stránka — bez ní nešel do systému dostat skutečný subjekt |

Ostatní snímky (`01`, `06`, `07`, `10`, `12`, `13`, `15`, `20`, `30`) zachycují
části, kterých se redesign zatím nedotkl: homepage, *Program vs. koalice*,
metodika, přihlášení, zdroje a detail slibu v redakci. Jsou tu proto, aby byl
doložený i stav, který se **nezměnil**.

## Rozměry stránek

Detail slibu po přestavbě narostl z 6 514 na 7 187 px. Oddělit průběh od
výsledku a doplnit u každého zdroje, co z něj naopak neplyne, něco stojí.
Přehled na mobilu se naopak zkrátil z 5 238 na 3 907 px, protože filtry zmizely
do zásuvky.
