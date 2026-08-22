# Co zbývá k funkčnímu produktu

Stav k 22. 8. 2026. Seznam je řazený podle toho, co blokuje spuštění — ne podle
toho, co je zajímavé dělat.

Hotové věci tu nejsou. Co funguje, je v [README](../README.md); proč to tak je,
v [briefu](../MASTER_IMPLEMENTATION_BRIEF.md) v sekci DECISIONS LOG.

---

## 1. Blokuje spuštění

Bez těchhle se nedá zveřejnit nic, a **dvě z nich nejsou programátorská práce**.

### 1.1 Právní vrstva — osobní údaje (B4)

Chybí záznam o zpracování a informace pro subjekty údajů. Zpracováváme:

- jména a funkce veřejných činitelů (výjimka pro veřejné činitele existuje, ale
  právní základ se stejně musí pojmenovat),
- otisky IP adres odesílatelů podnětů,
- e-maily podatelů.

Stránku i mechanismus postavím za půl dne. **Text musí napsat právník** —
publikovat vymyšlené poučení o zpracování je horší než žádné.

**Napřed je ale potřeba opravit, co ten text bude popisovat.** `hashClientIp`
v `src/modules/accounts/login.ts` je nesolený SHA-256 nad IP adresou. Celý
prostor IPv4 má 4,3 mld. hodnot a projde se hrubou silou během sekund, takže
dnes fakticky ukládáme adresu, ne otisk — a README i kód tvrdí opak. Oprava je
HMAC se serverovým pepperem. Musí padnout dřív, než právník začne psát; jinak
popíše stav, který neplatí.

### 1.2 Právní vrstva — publikace cizích dokumentů

`corpus/praha-sobe-2022/provenance.json` si sám drží poznámku, že se dokument do
produkční databáze nevkládá, dokud se nevyřeší sekce B briefu. Dokud to platí,
je celý reálný dataset jen lokální ukázka.

Od té doby v korpusu přibyly čtyři další cizí dokumenty (koaliční smlouva,
výřez zakázek, dvě zprávy o Dvoreckém mostě). Rozhodnutí je tedy potřeba pro
celou skupinu, ne pro jeden soubor.

### 1.3 První nasazení

Postup v README je ověřený z čistého klonu včetně migrací na prázdné databázi.
Nezkoušený je proti skutečnému Vercelu a Neonu — **potřebuje vaše credentials**.

Součástí musí být:

- proměnné projektu (`DATABASE_URL` se `sslmode=require`),
- migrace při každém nasazení, které přidává migraci (nespustí se samy),
- zálohy databáze a ověřená obnova. Dnes není ani jedno.

---

## 2. Bez tohohle to redakce neunese

Produkt technicky funguje, ale jeden slib stojí hodinu lidské práce. Tisíc slibů
napříč kandidátkami je několik měsíců. Tyhle položky ten čas zkracují.

### 2.1 Předvyplněné hodnocení modelem — největší páka

Dnes redaktor píše od nuly pět skóre, dva stavy, shrnutí a poznámku o mezích
důkazu. Model to má připravit a člověk opravit a podepsat.

Odhad: hodina na slib → deset minut. Běží na lokálním modelu, tedy zdarma.

**Čára, která se nepřekračuje:** publikovat smí jen člověk. Není to nedůvěra
k modelu, je to jediná věc, kterou produkt prodává — a brief to má mezi
povinnými principy (č. 5) i v `OUT OF SCOPE`.

### 2.2 Triáž podle hodnotitelnosti

Ani deset minut na slib nestačí, když je slibů řádově tisíc. Předpoklad, že
každý slib dostane stejnou péči, je to, co neškáluje.

Aparát na to existuje — `assessability.ts` počítá hodnotitelnost z konkrétnosti,
měřitelnosti, termínu a kompetence. Chybí ho použít jako **frontu**: slib, který
je neměřitelný, má správný výstup „nelze hodnotit" a stojí skoro nic. Ručně
drahé jsou jen sliby konkrétní, ale bez strojového orákula.

### 2.3 Detekce duplicit

Slučování je hotové, ale najít duplicity musí člověk. Přitom je to učebnicová
úloha na porovnání textů a s dvěma sty kandidáty z jednoho programu vznikne
duplicit hodně.

### 2.4 Formulář na metriky v konzoli

Metriky a jejich výpočet z otevřených dat fungují, ale založit je umí jen skript.
Bez formuláře je analytik nepoužije.

### 2.5 Hromadné vygenerování profilů hledání

Profily umí vyrobit model (13 slibů za 89 s, zdarma). Chybí je vygenerovat pro
všechny sliby najednou a nechat analytika projít, co model minul — u metra
chybí jména stanic, u bytů jsou synonyma příliš obecná.

---

## 3. Obsah

### 3.1 Programy kandidátek — zachráněno pět ze šesti

Stav k 22. 8. 2026 po záchranné akci:

| Kandidátka | Mandáty | Program |
| --- | ---: | --- |
| SPOLU pro Prahu | 19 | ✅ 10 kapitol z archivu, ~49 tis. znaků |
| ANO 2011 | 14 | ✅ 1 článek z archivu, 20 tis. znaků |
| Piráti | 13 | ⚠️ jen volební stránka, položkový program se nedochoval |
| Praha Sobě | 11 | ✅ PDF, 218 slibů |
| STAN | 5 | ✅ 3 kapitoly z archivu, ~30 tis. znaků |
| SPD a spol. | 3 | ❌ nedohledáno |

Čtyři z šesti mají použitelný program a poprvé jsou mezi nimi **všechny tři
strany vládnoucí koalice**. Do teď šlo hodnotit jen opozici.

Co zbývá:

- **SPD** — index Internet Archive pro `spd.cz` za rok 2022 obsahuje jen
  zpravodajství, `praha.spd.cz` nemá záznam. Zbývají tištěné materiály nebo
  archivy médií.
- **Piráti** — program se načítal JavaScriptem a archiv uložil, co poslal
  server, ne co viděl člověk. Ze snímku jde vytěžit jen úvodní text kampaně.

Poučení, které platí dál: **archiv zachytí jen to, co server odeslal.** U SPA
webů je snímek prázdná skořápka. Kampaňové weby přitom SPA bývají.

### 3.2 Vytěžit celý program a odbavit sliby

Dnes je v systému **13 slibů z 218** a čtyři doklady. Vytěžení programu lokálním
modelem odhaduju na ~20 minut strojového času; redakční odbavení je práce na dny
a je to skutečné riziko projektu, ne technologie.

### 3.3 Doklady o dokončení staveb

Kategorie „stavba" nemá strojové orákulum. Ověřeno: zakázky dokládají zadání, ne
dokončení — u Dvoreckého mostu je uhrazeno 17 z 1 075 mil., a most přitom stojí.

Cesta `corpus:add` na tiskovou zprávu → událost `COMPLETED` → stav „částečně
splněno" je **projitá a funguje**; slib o mostech má doložený řetěz od programu
2022 po otevření mostu 17. 4. 2026. Zbývá ji projít u ostatních staveb, a je to
ruční práce u každé z nich.

Pozor na past, na kterou jsme narazili: stránka města o Dvoreckém mostě mluví
budoucím časem („otevření se uskuteční"), takže dokládá ohlášený termín, ne
dokončení. Doklad musí být psaný **po** události.

### 3.4 Kategorie slibů a jejich orákula

| kategorie | dokončení pozná | strojově? |
| --- | --- | --- |
| peníze | čerpání rozpočtu | ✅ hotovo |
| bydlení | ČSÚ, dokončené byty | ⚠️ existuje, nenapojeno |
| stavba | kolaudace, tisková zpráva | ❌ ručně |
| doprava | zahájení provozu (DPP, TSK) | ❌ jiný zadavatel |
| služba | výroční zpráva | ❌ ručně |

---

## 4. Kvalita a důvěryhodnost

### 4.1 Změřit extrakci proti zlatému datasetu

`golden.draft.json` má 1 509 úseků a všechny jsou `NOT_PROMISE` — neanotované.
Bez čísla je zapnutí modelu víra, ne rozhodnutí. Měřit jde i na výseku
(`--from 20 --to 35`), metriky to respektují.

**Musí anotovat člověk**, a to dřív, než uvidí výstup extraktoru.

### 4.2 Zásluha se dnes nerozlišuje

Dvorecký most se postavil, ale ne proto, že to slíbila Praha Sobě — stavbu vedla
koalice, ve které tahle kandidátka není. Dnes to nese jen text v poznámce
u jedné vazby.

Doklad leží v korpusu od 22. 8.: koaliční smlouva z 15. 2. 2023 jmenuje Prahu
Sobě 8× a slovo „opozic" 11×. Zapojený ale není. Bez toho stránka zásluhu
podsouvá, což je přesně to, čemu se produkt snaží vyhnout.

Souvisí s tím i modul `coalition`: u opozičního programu má vracet doložené
„nepřevzato", ne prázdno. Prázdno vypadá jako chybějící rešerše.

### 4.3 Bezpečnostní nálezy z revize

- **Nesolený otisk IP** — viz 1.1, blokuje právní vrstvu.
- **User enumeration přes časování.** Komentář u `signIn` slibuje, že se heslo
  ověřuje i u neexistujícího účtu, aby se rozdíl neprozradil dobou odpovědi.
  `verifyPassword` ale u neexistujícího účtu skončí hned a scrypt neproběhne;
  rozdíl je řádový. Zmírňuje to limit na e-mail, deklarovaná ochrana ale chybí.
- **`verifyPassword` čte zpět jen `cost`**, `r` a `p` bere z konstant. Slib, že
  parametry jde zvýšit bez znehodnocení účtů, u nich neplatí.
- **Limity počtu podání jsou check-then-insert mimo transakci** (podněty
  i přihlášení). Souběžné požadavky projdou přes strop.

### 4.4 Občas padající test

Během práce 22. 8. spadl jeden test a při opakování prošel. Jméno se zachytit
nepodařilo, takže **příčina není potvrzená**. Rezerva do limitu byla ale
prokazatelně tenká — nejpomalejší testy přes 2,5 s proti výchozím 5 s — a limity
jsou teď 20 s / 30 s. Jestli se to objeví znovu, je to potřeba chytit, ne
přebíhat.

### 4.5 Zbytky ze sekce B

- **B1:** dotčená strana se o hodnocení dnes musí dozvědět sama. Chybí
  upozornění.
- **B3:** porušení prohlášení o střetu zájmů nikdo nekontroluje.

---

## 5. Nástroje korpusu

Drobnosti, ale každá dnes něco blokuje.

- **Provenience neumí archivní kopii.** Dokument z Internet Archive není totéž
  co dokument od vydavatele a `provenance.json` to nerozliší. Blokuje program
  Pirátů, tedy jediný zachranitelný ze čtyř chybějících.
- **`corpus:table` nečte ZIP.** ČSÚ publikuje výsledky voleb jen jako ZIP
  a adresa navíc nese datum vydání, takže není stabilní. Kvůli tomu jsou čísla
  mandátů dnes natvrdo v seedu — a přesně tam vznikla chyba, kdy Praha Sobě
  měla číslo 25 a 13 mandátů místo 4 a 11.
- **`corpus:sync` bere za stažené to, co má `provenance.json`.** Adresář bez
  `extracted.json` projde jako hotový, i když z něj nejde citovat.
- **Extrakce z HTML nese navigaci webu.** Je to důsledek rozhodnutí nevyhazovat
  `<nav>` a patičku — určit, co je „hlavní obsah", je redakční úsudek. Citace
  sedí, text je ale šumnější než u PDF.

---

## 6. Provoz

Nic z toho zatím neexistuje:

- zálohy databáze a **ověřená** obnova,
- sledování chyb za běhu (dnes se chyba pozná jen z logu Vercelu),
- `robots.txt` a sitemap pro veřejnou část,
- co dělat, když někdo pošle výzvu k odstranění obsahu.

---

## Co bych dělal v tomhle pořadí

1. **Zarchivovat programy zbylých kandidátek** (3.1) — jediná nevratná položka.
   Každý týden odkladu ubírá, co ještě jde zachránit.
2. **Předvyplněné hodnocení** (2.1) — bez něj se obsah nenaplní.
3. **Nasazení naostro** (1.3) — dokud to neběží, nic z toho není produkt.
4. **Právní vrstva** (1.1, 1.2) — paralelně, protože nečeká na kód. Předchází jí
   oprava otisku IP.

Zbytek má smysl až potom.
