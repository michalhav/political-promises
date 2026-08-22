# Co zbývá k funkčnímu produktu

Stav k 22. 8. 2026. Seznam je řazený podle toho, co blokuje spuštění — ne podle
toho, co je zajímavé dělat.

Hotové věci tu nejsou. Co funguje, je v [README](../README.md); proč to tak je,
v [briefu](../MASTER_IMPLEMENTATION_BRIEF.md) v sekci DECISIONS LOG.

---

## 1. Blokuje spuštění

Bez těchhle tří se nedá zveřejnit nic, a **dvě z nich nejsou programátorská
práce**.

### 1.1 Právní vrstva — osobní údaje (B4)

Chybí záznam o zpracování a informace pro subjekty údajů. Zpracováváme:

- jména a funkce veřejných činitelů (výjimka pro veřejné činitele existuje, ale
  právní základ se stejně musí pojmenovat),
- otisky IP adres odesílatelů podnětů,
- e-maily podatelů.

Stránku i mechanismus postavím za půl dne. **Text musí napsat právník** —
publikovat vymyšlené poučení o zpracování je horší než žádné.

### 1.2 Právní vrstva — publikace cizích dokumentů

`corpus/praha-sobe-2022/provenance.json` si sám drží poznámku, že se dokument do
produkční databáze nevkládá, dokud se nevyřeší sekce B briefu. Dokud to platí,
je celý reálný dataset jen lokální ukázka.

### 1.3 První nasazení

Postup v README je ověřený z čistého klonu včetně migrací na prázdné databázi.
Nezkoušený je proti skutečnému Vercelu a Neonu — **potřebuje vaše credentials**.

Součástí musí být:

- proměnné projektu (`DATABASE_URL` se `sslmode=require`),
- migrace při každém nasazení, které přidává migraci (nespustí se samy),
- zálohy databáze a ověřená obnova. Dnes není ani jedno.

---

## 2. Bez tohohle to redakce neunese

Produkt technicky funguje, ale jeden slib stojí hodinu lidské práce. Sto slibů
je několik týdnů. Tyhle položky ten čas zkracují.

### 2.1 Předvyplněné hodnocení modelem — největší páka

Dnes redaktor píše od nuly pět skóre, dva stavy, shrnutí a poznámku o mezích
důkazu. Model to má připravit a člověk opravit a podepsat.

Odhad: hodina na slib → deset minut. Běží na lokálním modelu, tedy zdarma.

**Čára, která se nepřekračuje:** publikovat smí jen člověk. Není to nedůvěra
k modelu, je to jediná věc, kterou produkt prodává — a brief to má mezi
povinnými principy (č. 5) i v `OUT OF SCOPE`.

### 2.2 Detekce duplicit

Slučování je hotové, ale najít duplicity musí člověk. Přitom je to učebnicová
úloha na porovnání textů a s dvěma sty kandidáty z jednoho programu vznikne
duplicit hodně.

### 2.3 Formulář na metriky v konzoli

Metriky a jejich výpočet z otevřených dat fungují, ale založit je umí jen skript.
Bez formuláře je analytik nepoužije.

### 2.4 Hromadné vygenerování profilů hledání

Profily umí vyrobit model (13 slibů za 89 s, zdarma). Chybí je vygenerovat pro
všechny sliby najednou a nechat analytika projít, co model minul — u metra
chybí jména stanic, u bytů jsou synonyma příliš obecná.

---

## 3. Obsah

### 3.1 Vytěžit celý program a odbavit sliby

Dnes je v systému **13 slibů z 218** a tři doklady. Vytěžení programu lokálním
modelem odhaduju na ~20 minut strojového času; redakční odbavení je práce na dny
a je to skutečné riziko projektu, ne technologie.

### 3.2 Doklady o dokončení staveb

Kategorie „stavba" nemá strojové orákulum. Ověřeno: zakázky dokládají zadání, ne
dokončení — u Dvoreckého mostu je uhrazeno 17 z 1 075 mil., a most přitom stojí.
Doklad leží v tiskových zprávách města, které nejsou v otevřených datech.

Cesta: `corpus:add` na konkrétní tiskovou zprávu → událost `COMPLETED` na časové
ose → stav „částečně splněno". Ruční, ale ukáže celý cyklus až do konce.

### 3.3 Kategorie slibů a jejich orákula

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

### 4.2 Občas padající test

Dvakrát 22. 8. vyhodil `npm run check` jednu chybu, tři následné běhy byly
zelené a jméno testu se nepodařilo zachytit. Není to vyřešené — až se objeví
v CI, je potřeba ho chytit a opravit, ne přebíhat.

### 4.3 Zbytky ze sekce B

- **B1:** dotčená strana se o hodnocení dnes musí dozvědět sama. Chybí
  upozornění.
- **B3:** porušení prohlášení o střetu zájmů nikdo nekontroluje.

---

## 5. Provoz

Nic z toho zatím neexistuje:

- zálohy databáze a **ověřená** obnova,
- sledování chyb za běhu (dnes se chyba pozná jen z logu Vercelu),
- `robots.txt` a sitemap pro veřejnou část,
- co dělat, když někdo pošle výzvu k odstranění obsahu.

---

## Co bych dělal v tomhle pořadí

1. **Předvyplněné hodnocení** (2.1) — bez něj se obsah nenaplní.
2. **Nasazení naostro** (1.3) — dokud to neběží, nic z toho není produkt.
3. **Právní vrstva** (1.1, 1.2) — paralelně, protože nečeká na kód.

Zbytek má smysl až potom.
