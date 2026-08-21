# Slib → Skutek
## Consolidated Senior UX / Product Design Redesign Brief
### Definitivní design direction pro implementaci

---

# 0. Účel tohoto dokumentu

Tento dokument je konsolidovaný redesign brief vzniklý ze dvou nezávislých seniorních UX auditů současné aplikace **Slib → Skutek** a jejich následného sjednocení z pohledu dalšího Senior Product Design / UX Lead review.

Není to mechanické spojení dvou auditů.

Tam, kde se audity shodovaly, je doporučení považováno za silný signál a je přijato jako výchozí rozhodnutí.

Tam, kde se lišily, tento dokument volí jednu doporučenou variantu s ohledem na:

- důvěryhodnost,
- porozumění,
- informační hierarchii,
- neutralitu,
- použitelnost,
- mobilní UX,
- realizovatelnost v současném stacku,
- rozsah MVP,
- dlouhodobou odlišitelnost produktu.

Tento dokument má být použit jako **praktické zadání pro redesign existující aplikace**, nikoliv jako inspirace k novému produktu.

---

# 1. Role a způsob uvažování při implementaci

Při implementaci vystupuj jako kombinace:

- Senior Product Designer,
- UX Lead,
- Design Systems Architect,
- senior frontend engineer.

Produkt je data-heavy civic-tech / public-interest aplikace. Nejde o marketingový web ani politický scorecard.

Při každém rozhodnutí preferuj v tomto pořadí:

1. porozumění,
2. důvěryhodnost,
3. správnou informační hierarchii,
4. použitelnost,
5. přístupnost,
6. konzistenci,
7. vizuální kvalitu,
8. polish.

Nedělej redesign proto, že jiný komponent působí moderněji.

Každá změna musí řešit konkrétní problém.

---

# 2. Product context

Produkt se jmenuje:

# Slib → Skutek

Jde o český civic-tech / political accountability produkt.

Jeho účelem není říkat uživatelům, koho mají volit, ani hodnotit „dobré“ a „špatné“ politiky.

Produkt sleduje životní cyklus konkrétního politického slibu:

Volební slib  
→ Koaliční dohoda  
→ Politické rozhodnutí  
→ Rozpočet / financování  
→ Realizace  
→ Výsledek

Hlavní produktový princip:

> **Co bylo slíbeno, co se následně stalo a na základě jakých veřejných zdrojů to víme.**

To musí být patrné nejen z textu, ale ze samotné struktury UI.

---

# 3. Trust model — nejdůležitější designový princip

Slib → Skutek musí zřetelně oddělovat tři epistemické vrstvy:

## SOURCE FACT

Co explicitně stojí ve veřejném zdroji.

## INTERPRETATION

Co z daného zdroje lze a nelze vyvodit ve vztahu ke slibu.

## ASSESSMENT

Redakční závěr vzniklý z ověřených důkazů.

Toto rozdělení nesmí existovat pouze v datovém modelu a metodice.

Musí mít vlastní konzistentní vizuální gramatiku napříč celým produktem.

Uživatel musí při rychlém skenování poznat:

> Tohle napsal politik nebo instituce.

> Tohle je fakt doložený dokumentem.

> Tohle z něj vyvozuje redakce.

> Tohle je výsledné hodnocení.

To je hlavní budoucí designový diferenciátor Slib → Skutek.

Ne logo.

Ne gradient.

Ne animace.

Ne party barvy.

**Evidence grammar.**

---

# 4. Epistemická opatrnost je součást brandu

Nesmí se vizuálně komunikovat větší jistota, než jakou umožňují důkazy.

Zvlášť důležité:

## Bez doloženého postupu / NO_VERIFIED_PROGRESS

Znamená:

> K rozhodnému datu jsme ve zkontrolovaných veřejných zdrojích nenašli ověřitelný důkaz o realizaci.

Neznamená:

> Nic se nestalo.

Tento rozdíl musí být zachován.

Pokud se stav **Bez doloženého postupu** zobrazí bez širšího kontextu, musí být uživateli dostupné vysvětlení významu a research cutoff.

## Nezahájeno / NOT_STARTED

Je jiný stav.

Vyžaduje pozitivní důkaz, že realizace nezačala.

Tyto dva stavy nesmějí vizuálně ani jazykově splývat.

---

# 5. Celkový seniorní verdikt současného produktu

Produktová a datová logika je výrazně silnější než současná informační a vizuální prezentace.

Současný produkt:

- není amatérský,
- působí seriózně,
- má velmi dobrý trust foundation,
- má zdravý domain model,
- nepoužívá manipulativní scorecards,
- správně odděluje průběh a výsledek,
- správně pracuje s provenance, cutoff, verzemi a opravami.

Současně ale veřejná část stále místy působí jako:

- dobře postavený výzkumný prototyp,
- dokumentační web,
- kvalitně nakonfigurovaná shadcn aplikace,

spíše než jako plně sebevědomý, zapamatovatelný civic-tech produkt.

Největší problém není nedostatek barev, efektů ani komponent.

Je to:

> **slabá informační hierarchie v místech, kde má uživatel dostat jasnou odpověď.**

---

# 6. Co se NESMÍ redesignem rozbít

Následující principy jsou správné a mají být zachovány.

## 6.1 Politická neutralita

Nezavádět:

- party leaderboard,
- „úspěšnost politika“,
- aggregate trust score,
- truth meter,
- procenta splněných slibů jako hlavní verdict,
- zelená = dobrý politik,
- červená = špatný politik,
- gamifikaci.

## 6.2 Oddělení execution a outcome

Zachovat dvě odlišné osy:

- průběh realizace,
- skutečný výsledek.

Neslučovat je do jednoho skóre.

## 6.3 Source provenance

Zachovat a posílit:

- název zdroje,
- publisher,
- datum,
- stránku / kapitolu / bod,
- exact excerpt,
- URL,
- research cutoff.

## 6.4 Corrections a assessment history

Historie změn hodnocení je trust feature.

Neskrývat ji do neviditelného footeru.

## 6.5 Public/admin separation

Veřejná část má být editorial product.

Admin může být informačně hustší a utilitárnější.

Nesnažit se vizuálně sjednotit public a admin za každou cenu.

## 6.6 Střízlivý vizuální tón

Zachovat:

- neutrální základ,
- navy / deep blue interaction accent,
- minimum shadows,
- klidný profesionální vzhled.

Nepřidávat „AI SaaS aesthetics“.

---

# 7. Hlavní redesignový princip

## Slib → Skutek má působit jako:

# editorial case file

s:

- článkovou čitelností,
- auditovatelností case file,
- timeline jako hlavní chronologickou páteří,
- důkazními bloky jako podpisovým komponentem produktu.

Nemá působit jako:

- dashboard,
- databázový record,
- news article,
- government portal,
- BI report,
- politický scorecard.

Klíčová logika veřejné stránky má být:

> **Toto je odpověď. A tady si ji můžeš ověřit.**

Ne:

> Tady jsou všechna data, najdi si odpověď sám.

---

# 8. P0 — nejdůležitější změna: Promise Detail

Promise Detail je flagship page produktu.

Pokud funguje, uživatel pochopí celý Slib → Skutek.

Jeho redesign je nejvyšší priorita.

---

# 9. Definitivní informační architektura Promise Detail

Doporučené pořadí:

1. Breadcrumb
2. Promise identity
3. Original promise
4. Current assessment
5. Evidence summary / Proč to říkáme
6. Timeline / Co se od voleb stalo
7. Full evidence archive
8. Program → coalition relationship
9. How the assessment was made
10. Corrections / versions / history
11. Short trust footer

Toto pořadí je záměrné.

Odpovídá přirozeným otázkám uživatele:

> Co bylo slíbeno?

> Kdo to slíbil?

> Jaký je současný stav?

> Proč to říkáte?

> Co se od voleb skutečně stalo?

> Jaké jsou důkazy?

> Co se stalo se slibem v koaliční smlouvě?

> Jak přesně vzniklo hodnocení?

> Změnilo se hodnocení v čase?

---

# 10. Promise Detail — sekce po sekci

## 10.1 Breadcrumb

Subtilní.

Příklad:

Sliby / Demo A / Bydlení

Nemá soutěžit s titulkem.

---

## 10.2 Promise identity

Hlavní title.

Například:

# 2 000 nových městských nájemních bytů

Pod ním pouze klidná metadata:

Demo A · Bydlení · slib zveřejněn 15. 8. 2022

Nevytvářet pro každé metadata vlastní chip.

---

## 10.3 Original promise

Sekce:

### Co bylo slíbeno

Původní wording musí být výrazně rozeznatelný jako **politický originál**, nikoliv text aplikace.

Například:

> „Do konce volebního období postavíme 2 000 nových městských nájemních bytů a udržíme je v majetku města.“

Pod citací:

Volební program Demo A · strana 4 · 15. 8. 2022 · Otevřít zdroj ↗

Doporučený treatment:

- semantic blockquote,
- jemná 2px left rule,
- žádný velký barevný card,
- metadata oddělená od quotation,
- skutečný source link.

Uživatel musí intuitivně poznat:

> Toto řekl politik / toto je původní dokument.

---

## 10.4 Current assessment

Toto je nejdůležitější blok celé stránky po samotném slibu.

Heading:

# Aktuální stav

nebo:

# Stav k 31. 1. 2026

Obsah:

### Průběh realizace
Částečně splněno

### Výsledek
Částečně dosažen

### Co to znamená

Krátké 1–2větné lidské shrnutí.

Například:

> Město založilo program, vyčlenilo finance a část bytů dokončilo. K rozhodnému datu bylo doloženo 910 z plánovaných 2 000 bytových jednotek.

Pod tím:

Ověřeno k 31. 1. 2026  
7 ověřených zdrojů  
Hodnocení v2  
Jak vzniklo hodnocení

A velmi subtilně:

> Novější dokumenty nemusí být v hodnocení zahrnuty.

Tento blok má odpovědět během několika sekund na:

> Tak jak to tedy je?

Status nesmí být pouze pill.

Pill je vhodný jako kompaktní reprezentace hodnoty, ale ne jako celý informační pattern.

---

# 11. Status system — definitivní doporučení

Status model stavět kolem dvou explicitně odlišných os.

## 11.1 Průběh realizace

Preferovaná uživatelská terminologie:

- Bez doloženého postupu
- Nezahájeno
- Naplánováno
- Probíhá
- Částečně splněno
- Dokončeno
- Opuštěno / zastaveno
- Nehodnotitelné

Pokud interní enum používá jinou terminologii, není nutné měnit backend enum.

UI label může být uživatelsky přesnější.

## 11.2 Výsledek

Preferovaná terminologie:

- Zatím neměřitelný
- Dosažen
- Částečně dosažen
- Nedosažen
- Nezjištěn
- Neuplatňuje se

Důležitý princip:

**Dokončeno** používat pro execution.

**Dosažen** používat pro outcome.

Jazyk sám pomůže uživateli pochopit rozdíl.

---

# 12. Status visual treatment

Barva je sekundární.

Význam musí nést:

- text,
- případně ikona,
- kontext.

Příklad compact reprezentace:

◐ Probíhá

✓ Dokončeno

Nikdy pouze barevný dot.

Vyhnout se prominentní zelené / červené.

Možná neutrální paleta:

- active / in progress → muted blue/navy tint,
- no verified progress / N/A → neutral gray,
- uncertainty / blocked / stopped → muted amber,
- completed → dark navy / charcoal treatment,
- non-assessable → neutral outlined / dashed treatment.

Status čipy nepoužívat jako univerzální řešení celého domain modelu.

---

# 13. NO_VERIFIED_PROGRESS — povinný trust safeguard

Pokud se stav **Bez doloženého postupu** objeví na cardu, detailu nebo jinde bez vysvětlujícího kontextu, zajistit dostupné vysvětlení:

> Ve zkontrolovaných veřejných zdrojích jsme do tohoto data nenašli ověřitelný důkaz o realizaci.

A zobrazit / zpřístupnit research cutoff.

Nesmí vzniknout interpretace:

> Nic se nestalo.

---

# 14. Evidence summary — „Proč to říkáme“

Po Current Assessment vložit stručnou evidence summary.

Heading:

# Jak to víme

nebo:

# Proč to říkáme

Nezobrazovat okamžitě celý archiv všech dokumentů.

Nejprve udělat kompaktní přehled.

Například:

**7 ověřených zdrojů**

- 1 potvrzuje převzetí závazku
- 2 dokládají financování
- 3 dokládají realizaci
- 1 dokládá výsledek

Následně zobrazit pouze 2–3 nejvýznamnější důkazy.

Tato sekce má vytvořit bridge mezi:

**assessment**

a

**auditovatelným evidence repository**.

---

# 15. Signature component: Evidence Block

Evidence Block je klíčový designový komponent.

Má být jedním z hlavních rozpoznávacích prvků Slib → Skutek.

Doporučená struktura:

### Dokládá výsledek

**Zpráva o stavu městského bytového fondu za rok 2025**

> „K 31. 12. 2025 bylo ... zkolaudováno 910 bytových jednotek.“

Magistrát hl. m. Prahy · 2026 · s. 12

Otevřít zdroj ↗

### Co tento zdroj dokládá

Dokument potvrzuje dokončení 910 bytových jednotek.

### Co z něj nelze vyvodit

Sám o sobě nepotvrzuje dosažení původního cíle 2 000 jednotek.

Ne každý evidence record musí mít obě poslední formulace, pokud to nedává smysl.

Ale systém musí jasně rozlišovat:

- source identity,
- exact excerpt / fact,
- editorial interpretation.

---

# 16. Evidence role taxonomy

Evidence má být skenovatelné podle role.

Preferované user-facing role:

- Potvrzuje původní závazek
- Potvrzuje převzetí do koaliční dohody
- Dokládá politické rozhodnutí
- Dokládá financování
- Dokládá realizaci
- Dokládá výsledek

Tyto role využít:

- ve veřejném Evidence Block,
- v admin evidence listu,
- případně v evidence summary.

Pokud existující data model používá jiné interní labels, není nutné měnit backend, pokud lze mapovat presentation layer.

---

# 17. Timeline — hlavní narativní páteř

Timeline odpovídá na:

# Co se skutečně stalo?

Nemá být druhým evidence repository.

Je to příběh vývoje slibu.

Příklad:

**15. 8. 2022**  
Slib zveřejněn

**4. 11. 2022**  
Závazek převzat do koaliční smlouvy  
Zobrazit zdroj

**6/2023**  
Schválen investiční program

**12/2023**  
Vyčleněno 600 mil. Kč

**7/2024**  
Podepsána smlouva na prvních 340 bytů

**1/2026**  
Doloženo 910 dokončených jednotek

Každá významná položka může odkazovat na související evidence record.

Ale timeline nezobrazuje full provenance a dlouhé quotation cards.

Princip:

> Timeline = příběh.

> Evidence archive = důkazní základ.

Nevytvářet duplicitně plný obsah důkazů v obou sekcích.

---

# 18. Timeline visual design

Použít:

- jednu jemnou vertikální linku,
- datum,
- event title,
- případně krátkou interpretaci,
- source link / evidence count.

Nepoužívat:

- alternating left/right layout,
- výrazné success/failure barvy,
- progress percentage,
- „70 % completed“,
- velké milestone circles.

Typ události může mít subtilní icon:

- document,
- agreement,
- vote,
- budget,
- construction / implementation,
- outcome.

Ikona nesmí být jediný nositel významu.

---

# 19. Full Evidence Archive

Po timeline může přijít kompletní důkazní archiv.

Heading například:

# Důkazy a zdroje

Každý record:

1. Evidence role
2. Source title
3. Exact excerpt / source fact
4. Publisher
5. Date
6. Page / chapter / section
7. Open source
8. Editorial relevance / interpretation

Tady patří plná provenance.

Ne do každé timeline položky.

---

# 20. Source citation treatment

Inline citations by měly působit jako provenance, ne jen jako běžný hyperlink.

Příklad:

**Rozpočet města 2024 · kap. 08 · s. 14 ↗**

Link zůstává skutečným linkem a má běžné accessibility states.

Source metadata má být pochopitelné i bez hoveru.

---

# 21. Program → Coalition relationship na detailu

Sekce:

# Co se se slibem stalo v koaliční smlouvě

Zobrazit klasifikaci:

- Převzato
- Změněno
- Sloučeno
- Nezahrnuto
- Nejasné

Až potom comparison.

Nejdůležitější je vysvětlení konkrétního významu.

Například:

### Změněno

**Co se změnilo**

Z koaliční dohody zmizel počet 300 bytů a požadavek na transparentní pořadník.

Potom:

VOLEBNÍ PROGRAM  
vs.  
KOALIČNÍ SMLOUVA

U modified lze použít lightweight semantic diff.

Nikdy red/green diff.

Použít raději:

- neutrální highlight,
- underline,
- subtle background tint.

---

# 22. NOT_INCLUDED safeguard

U kategorie **Nezahrnuto** vždy zajistit jasné vysvětlení:

> Odpovídající závazek jsme v koaliční smlouvě nenašli. Nejde o hodnocení jeho pozdějšího splnění.

Nebo:

> Nezahrnutí do koaliční smlouvy neznamená, že slib nebyl nebo nebude realizován.

Tato kategorie nesmí působit jako politický fail state.

---

# 23. How the assessment was made

Metodický scoring nemá být před timeline.

To je sekundární deep-dive.

Sekce:

# Jak vzniklo hodnocení

Nahoře stačí například:

**Hodnotitelnost: Dobrá**

Pod tím collapsed detail:

- Konkrétnost 5/5
- Měřitelnost 5/5
- Termín 4/5
- Pravomoc 5/5
- Definice výsledku 4/5

+ Podrobně o metodice.

Běžný uživatel se sem nemusí dostat.

Novinář / researcher má možnost hodnocení auditovat.

---

# 24. Non-assessable Promise Detail

Nehodnotitelný slib potřebuje odlišnou prioritu informací.

Nezobrazovat současně tři téměř synonymní pills:

- PLNĚNÍ Nehodnotitelné
- VÝSLEDEK Neuplatňuje se
- HODNOTITELNOST Nehodnotitelný

jako hlavní top-level output.

Preferované pořadí:

1. Original promise
2. Dominantní vysvětlení
3. Proč jej nelze objektivně vyhodnotit
4. Research cutoff
5. Coalition context
6. Evidence availability
7. Detailed methodology

Hlavní callout:

# Tento slib nelze objektivně vyhodnotit

> Není uvedeno, co konkrétně má nastat a/nebo jak by bylo možné určit splnění.

Potom sekundárně:

Průběh realizace: Nehodnotitelné  
Výsledek: Neuplatňuje se

Numeric assessability score neprezentovat jako KPI.

Pokud se zachová:

**Hodnotitelnost podle metodiky: 1,15 / 5**

má být de-emphasized a až v metodické části.

---

# 25. Promise Detail desktop composition

Nepoužívat jen jeden úzký sloupec pro vše.

Doporučený shell:

- celková content width cca 1100–1200 px,
- hlavní narrative column cca 720–760 px,
- volitelný contextual rail cca 280–320 px.

Contextual rail pouze desktop.

Má být velmi střídmý.

Může obsahovat:

- current status,
- research cutoff,
- evidence count,
- methodology link,
- correction indicator.

Nesmí se změnit na dashboard s deseti metrikami.

Sticky behavior je možné použít, pokud nepůsobí rušivě.

Na mobilu se rail rozpustí do běžného flow pod Original Promise / Current Assessment.

---

# 26. Desktop section navigation

Protože Promise Detail zůstane dlouhou stránkou, lze na desktopu přidat subtilní sticky section navigation:

Shrnutí  
Vývoj  
Důkazy  
Hodnocení  
Historie

Pouze pokud:

- není vizuálně dominantní,
- scroll state funguje spolehlivě,
- nezhorší mobile.

Není to nutné pro první redesign, ale je to hodnotné P1.

---

# 27. Promise Detail mobile — P0

Mobilní redesign není pouze „responsive CSS“.

Současný problém je hlavně **cognitive overflow**.

Na mobile používat sequential disclosure.

První viewport má dát:

- title,
- original promise,
- current assessment,
- cutoff,
- krátké proč.

Následně:

1. evidence summary,
2. timeline,
3. coalition relation,
4. full evidence,
5. how assessment was made,
6. corrections/history.

Konkrétní pravidla:

- mobile gutter 16–20 px,
- body minimálně 16 px,
- metadata cca 14 px minimum,
- touch target minimálně 44 × 44 px,
- desktop navigation nahradit mobile menu,
- status pair stackovat vertikálně,
- timeline rail maximálně cca 20–24 px vlevo,
- žádná hluboká nested indentation,
- source metadata stackovat,
- dlouhé quotations 3–5 řádků + Zobrazit více, pokud je excerpt opravdu dlouhý,
- metodické tabulky převést na stacked definition rows,
- history převést na cards/list,
- progressive disclosure pro detailní metodiku.

---

# 28. Promise Explorer — hlavní princip

Explorer má odpovídat na otázku:

> Je toto slib, jehož detail chci otevřít?

Nemá se snažit zobrazit celý domain model v každé kartě.

---

# 29. Promise Explorer — cards

Preferovaný obsah card:

**Demo A · Bydlení**

### 2 000 nových městských nájemních bytů

Krátký originální excerpt — max cca 3 řádky.

**Průběh:** Částečně splněno  
**Výsledek:** Částečně dosažen

Aktualizováno 31. 1. 2026 · 7 zdrojů

Assessability nezobrazovat prominentně u každé card.

Zobrazit především abnormal state:

**Nehodnotitelný slib**

„Dobře hodnotitelný“ není pro scanning běžné card příliš hodnotná informace.

---

# 30. Explorer grid

Současný třísloupcový grid může být příliš úzký.

Pro card s:

- title,
- quote,
- dual status,
- metadata

preferovat na desktopu **2-column grid**, pokud test současné šířky potvrzuje lepší scanning.

Homepage může mít tři featured cards vedle sebe, protože tam je počet malý a účel jiný.

Explorer je vyhledávací a scanning prostředí.

---

# 31. Explorer filters

## P0

Na mobilu:

- tlačítko Filtrovat,
- otevře drawer / sheet,
- active filters zůstávají viditelné nad výsledky,
- reset je přímo vedle active filters.

Active state nekomunikovat pouze barvou.

Například:

✓ Doprava

## P1

Na desktopu přejít z permanentního query-builder feelingu na progressive disclosure.

Defaultně ukázat:

- Search
- Kandidát
- Téma

Pod tím:

**Další filtry**

Kde mohou být:

- stav plnění,
- outcome,
- hodnotitelnost,
- další pokročilé podmínky.

Po výběru zobrazit:

2 výsledky  
Doprava ×  
Demo A ×  
Zrušit filtry

Filtrace nemá zabírat téměř celý první viewport.

---

# 32. Homepage

Co zachovat:

- brand Slib → Skutek,
- headline „Co politici slíbili. Co se skutečně stalo.“,
- dvě jasná CTA,
- sekci „Co tady nenajdete“,
- evidence-based positioning,
- demo disclaimer, pokud je stále relevantní.

Homepage nepotřebuje kompletní redesign.

Potřebuje lépe ukázat produktový princip.

Preferované pořadí:

1. Hero
2. Jedna trust věta
3. Lifecycle
4. Jeden výrazný featured case
5. Další sledované sliby
6. Jak zajišťujeme důvěryhodnost
7. Co tady nenajdete / limitations

Trust věta například:

> Každý závěr lze dohledat až k veřejnému zdroji.

---

# 33. Homepage lifecycle

Současnou sérii pills nahradit jednoduchou connected path / stepper:

Slib  
→ Dohoda  
→ Rozhodnutí  
→ Peníze  
→ Realizace  
→ Výsledek

Může mít jemné sekundární popisky.

Nejít do komplexní infografiky.

Lifecycle má být:

- velmi rychle pochopitelný,
- jedním z charakteristických patternů homepage.

---

# 34. Homepage featured case

Místo další generické kolekce podobných cards je vhodné ukázat jeden skutečný case jako mini-demonstraci produktu:

Slib  
→ 4 klíčové události  
→ 7 zdrojů  
→ současný stav

To uživateli vysvětlí produkt lépe než další marketingový odstavec.

Pokud implementace tohoto featured case znamená příliš velký scope, lze jej ponechat P1.

---

# 35. Compare page

Compare je jedna z produktově silných oblastí.

Zachovat side-by-side desktop pattern.

Nahoře přidat stručnou legendu:

### Převzato
Obsah závazku zůstal zachován.

### Změněno
Závazek zůstal, ale změnil se rozsah, číslo nebo termín.

### Sloučeno
Samostatný slib se stal součástí širšího závazku.

### Nezahrnuto
Odpovídající závazek jsme v dohodě nenašli. Není to hodnocení splnění.

### Nejasné
Vztah nelze z dostupného textu spolehlivě určit.

U jednotlivého recordu pořadí:

1. classification,
2. „Co se změnilo“ / význam vztahu,
3. program text,
4. coalition text,
5. rationale.

---

# 36. Compare mobile

Desktop:

VOLEBNÍ PROGRAM | KOALIČNÍ SMLOUVA

Mobile:

PŮVODNĚ  
↓  
V KOALIČNÍ SMLOUVĚ

Nechat uživatele jasně chápat směr transformace.

Ve veřejné části se vyhnout horizontálně scrollované comparison table, pokud lze obsah srozumitelně stackovat.

---

# 37. Methodology

Obsah metodiky je silný.

Není potřeba ji zjednodušovat obsahově.

Je potřeba zlepšit entry experience.

Začátek:

# Metodika v kostce

nebo:

# Jak číst Slib → Skutek za 60 sekund

Pět základních principů:

1. Každý slib má dohledatelný původní zdroj.
2. Hodnotíme pouze dostatečně ověřitelná tvrzení.
3. Průběh realizace není totéž jako výsledek.
4. Neexistence nalezeného důkazu není důkazem, že se nic nestalo.
5. AI může pomáhat při práci se zdroji; finální hodnocení prochází lidskou revizí.

Pak TOC.

Doporučené sekce:

- Co je slib
- Hodnotitelnost
- Průběh vs. výsledek
- Jaké zdroje používáme
- Evidence rules
- Role AI
- Lidská revize
- Opravy
- Limity

Desktop:

- text column cca 680–740 px,
- sticky TOC,
- body 16–17 px,
- line-height cca 1.6–1.7.

Long-form line length cca 65–75 znaků.

Důležité koncepty lze převést do velmi jednoduchých diagramů.

Například:

> Ve zdroji jsme nic nenašli  
> ≠  
> Víme, že se nic nestalo

---

# 38. Admin design principle

Admin není veřejný produkt.

Nemá být „krásný dashboard“.

Má být efektivní editorial workflow tool.

Primární otázka adminu:

> Co mám udělat teď?

Sekundární:

> V jakém stavu je tento case?

Až terciární:

> Jaké jsou souhrnné statistiky?

---

# 39. Admin Overview

Současné rovnocenné KPI cards nahradit workflow queue.

První sekce:

# Vyžaduje pozornost

Například:

- 2 čekají na revizi
- 1 zdroj čeká na zpracování
- 2 kandidátní sliby čekají na akci

Ideálně zobrazit konkrétní items:

- title,
- workflow state,
- owner / reviewer,
- stáří / last updated.

Empty state:

> Nic nečeká na revizi.

je lepší než další card s číslem 0.

Až níže:

- intake / backlog,
- recently published,
- případně system counts.

Žádné donut charts.

---

# 40. Login

Login není redesign priority.

Může zůstat jednoduchý.

Doporučení:

- odstranit veřejnou navigaci, pokud má admin působit jako oddělená aplikace,
- přidat „Redakce“,
- případně mikrocopy „Přístup pouze pro redakci“,
- subtilní „← Zpět na Slib → Skutek“.

Card cca 400–440 px je v pořádku.

Žádná ilustrace není potřeba.

P2.

---

# 41. Admin Sources

Default screen nemá být permanentně otevřený „Nový zdroj“ form.

Primární screen:

# Zdroje

Search / Type / Status

source table

+ Přidat zdroj

Form otevřít:

- jako separate page,
- drawer,
- nebo modal/dedicated workspace podle existující architektury.

Form rozdělit logicky:

1. Metadata
2. Obsah
3. Provenience

Stavy zpracování:

- Čeká na zpracování
- Zpracováno
- Chyba

„Použití 0×“ není tak důležitá primary scanning informace jako processing state.

Demo-only fields musí být v produkci environment-dependent.

---

# 42. New Candidate Promise

Současný domain model je dobrý.

Hlavní UX upgrade:

# source context

Na desktopu preferovat split view:

**levá strana**
form

**pravá strana**
source preview / surrounding text

Redaktor má vidět zdroj, ze kterého vytváří promise.

Doporučené pořadí:

1. Candidate / topic / title
2. Source
3. Exact citation / page
4. Original wording
5. Formulace použitá pro hodnocení
6. Termín

Slug generovat automaticky.

Manuální override pouze v Advanced.

Pokud to datový model umožňuje, zobrazit validation affordance:

✓ Citace byla ve zdroji nalezena doslova.

Toto je high-value workflow improvement.

---

# 43. Admin Promise List

Tabulka je správná.

Nepřevádět na cards.

Přidat:

- search,
- candidate filter,
- topic filter,
- workflow state,
- public/draft,
- reviewer,
- updated date,
- sorting.

Celá row může být clickable.

Workflow state má být silnější než pouhé:

Veřejné: Ano / Ne.

Preferované stavy:

- Čeká na hodnocení
- Rozpracováno
- Čeká na review
- Vráceno
- Připraveno k publikaci
- Publikováno

Version a publication status mohou být vizuálně oddělené.

---

# 44. Admin Promise Detail

Toto je dobrý základ editorial case managementu.

Neměnit domain model.

Přidat výraznější case header:

# 2 000 nových městských nájemních bytů

Publikováno · v2

Current assessment: Částečně splněno  
Cutoff: 15. 6. 2026  
Reviewer: Demo redaktor 2  
Next action: žádná

Potom:

1. Evidence
2. Current assessment
3. Review / versions
4. Corrections
5. Audit

Na desktopu lze použít sticky right rail s case metadata.

Hlavní zlepšení:

> Uživatel musí vždy vědět, v jakém workflow stavu case je a co je další správná akce.

Context-aware primary action má mít vyšší prioritu než vedlejší actions.

---

# 45. Admin evidence scanning

Evidence rows mají explicitně ukazovat role:

- Potvrzuje závazek
- Dokládá rozhodnutí
- Dokládá financování
- Dokládá realizaci
- Dokládá výsledek

Raw audit events zachovat, ale user-facing label dát první.

Například:

**Vytvořena nová verze hodnocení**  
assessment.create

Ne obráceně.

---

# 46. Visual hierarchy — globální redesign

Současný problém:

> everything is equally quiet

Karty, border boxy, pills, tabulky a metadata často mají příliš podobnou vizuální váhu.

Redesign nemá přidat víc vizuálních efektů.

Má vytvořit méně typů surface, ale jasnějších.

Používat primárně:

## A. Primary assessment surface

Pro:

- Current Assessment,
- non-assessable explanation,
- opravdu důležitý verdict.

## B. Evidence/source surface

Pro:

- source excerpts,
- provenance,
- evidence role,
- interpretation.

## C. Normal content section

Bez cardu.

Použít:

- heading,
- whitespace,
- typography,
- simple separators.

## D. Uncertainty / limitation note

Pro:

- research cutoff caveats,
- epistemic nuance,
- methodology warnings.

Neobalovat každý semantic group rounded rectangle.

---

# 47. Typography

Nevymýšlet nový font stack jen kvůli redesignu.

Současný kvalitní sans-serif je vhodný.

Doporučená hierarchie:

- Homepage Display: 44–52 px desktop
- Page H1: 32–40 px
- Section H2: 22–28 px
- Card heading: 18–20 px
- Body: 16–17 px
- Metadata: 14 px
- Chip: 13–14 px

Významný obsah nikdy nedávat do 11–12 px textu.

Long-form:

- line-height cca 1.55–1.7 podle kontextu,
- 65–75 characters per line.

Italic používat primárně na skutečné quotation, ne jako obecný secondary style.

Editorial serif pouze pro quotations je možné P2 experimentovat, ale není nutný.

---

# 48. Widths

Orientační systém:

## Public shell
1100–1200 px

## Promise Detail
1100–1200 px shell

main narrative:
720–760 px

contextual rail:
280–320 px

## Methodology
680–740 px text + TOC

## Admin
1200–1280 px

## Mobile gutter
16–20 px

Tyto hodnoty nejsou absolutní design token contract.

Mají vést k čitelné a konzistentní kompozici.

---

# 49. Spacing

Jednoduchá škála:

4 / 8 / 12 / 16 / 24 / 32 / 48 / 64

Public section gap typicky:

48–64 px.

Admin:

24–32 px.

Důležité:

současný problém není „málo whitespace“.

Je to špatné rozložení whitespace mezi semantic groups.

Používat whitespace místo dalšího cardu.

---

# 50. Radius philosophy

Controls/cards:

cca 8–10 px.

Významné summary surface:

cca 10–12 px.

Pills:

full radius.

Vyhnout se:

- 16–24 px friendly SaaS rounding,
- rounded rectangle kolem každé sekce.

---

# 51. Borders and shadows

1px neutral border jako baseline.

Silnější border pouze tam, kde má význam.

Například:

- source quote left rule,
- selected / active control,
- important uncertainty note.

Shadows téměř vůbec.

Používat pro:

- dropdown,
- popover,
- sheet,
- modal,
- sticky overlay.

Ne na běžný card grid.

---

# 52. Color system

Základ:

- off-white / white surface,
- charcoal primary text,
- slate secondary text,
- deep navy interaction accent.

Party color:

- nikdy jako status,
- nikdy jako velká plocha cardu,
- pouze malý identity accent, marker nebo logo.

Status color:

- sekundární,
- desaturovaná,
- nikdy sama nenese význam.

---

# 53. Party identification

Strana / kandidát je identita.

Není to mood ani outcome signal.

Použít například:

Demo A

s případným:

- malým 2px markerem,
- malým logem,
- subtilním party accent.

Nikdy party barvou nebarvit current assessment.

---

# 54. Accessibility — P0 baseline

Před veřejným release zkontrolovat minimálně:

- WCAG-oriented text contrast,
- muted foreground contrast,
- body >= 16 px,
- metadata cca >= 14 px,
- touch target >= 44 × 44 px,
- focus ring viditelný,
- keyboard navigation,
- semantic heading hierarchy H1 → H2 → H3,
- semantic blockquotes pro source excerpts,
- timeline jako semantic list,
- status text + icon / text, ne pouze barva,
- selected filters mají visible non-color state,
- Compare dává smysl screen readerem i bez dvou sloupců,
- veřejné tabulky na mobilu převést na stacked presentation, pokud to jde.

Aktivní filtr:

✓ Doprava

ne pouze navy background.

---

# 55. Dark mode

Z původních screenshotů není možné dark mode plně posoudit.

Před release udělat samostatný QA pass.

Kontrolovat:

- muted text contrast,
- evidence block borders,
- source quote differentiation,
- assessment vs evidence separation,
- status tint dominance,
- focus states,
- visited/unvisited links,
- selected filters.

Dark mode má působit jako:

**dark editorial**

ne:

**developer dashboard**.

Preferovat:

- charcoal,
- ink,
- deep neutral surfaces,

spíše než absolutní black + neon blue.

Party a status barvy v dark mode desaturovat.

---

# 56. Data visualization — co používat

Ano:

- timeline,
- structured Program → Coalition diff,
- lifecycle stepper,
- evidence counts / role summary,
- simple diagrams v metodice.

Ne:

- gauge,
- radial progress,
- completion percentage,
- party score,
- „7/10 splněno“,
- radar chart hodnotitelnosti,
- donut chart adminu.

Vizualizace se smí přidat jen pokud odpovídá na reálnou uživatelskou otázku.

---

# 57. Responsive cross-cutting rules

## Explorer
Filters → sheet/drawer.

Active filters → visible nad results.

Cards → single column mobile.

## Compare
Desktop side-by-side.

Mobile sequential PŮVODNĚ → V KOALIČNÍ SMLOUVĚ.

## Evidence
Metadata stackovat.

Excerpt nedrtit do příliš úzkého sloupce.

## Tables
Public mobile → raději stacked rows.

Admin → horizontal scroll může být legitimní.

## Timeline
Minimální horizontal indentation.

## Long sections
Progressive disclosure tam, kde detail není potřeba pro základní pochopení.

---

# 58. Priority plan

---

# P0 — Must fix before public MVP

## Promise Detail
- redesign top half,
- Original Promise musí být jednoznačně source identity,
- vytvořit dominantní Current Assessment,
- zobrazit execution + outcome jako dvě odlišné osy,
- přidat short human explanation,
- zobrazit research cutoff,
- přidat evidence count.

## Trust grammar
- implementovat jasné SOURCE FACT / INTERPRETATION / ASSESSMENT patterny,
- vytvořit reusable Evidence Block,
- zajistit NO_VERIFIED_PROGRESS explanation.

## Status system
- odstranit chip-first presentation na detailu,
- status musí být skutečná informace, ne metadata tag,
- přidat non-color semantics.

## Mobile Promise Detail
- mobile navigation,
- správný gutter,
- vertical statuses,
- readable text,
- flatter timeline,
- progressive disclosure.

## Explorer
- zjednodušit cards,
- zobrazovat informace potřebné pro rozhodnutí o otevření detailu,
- mobile filters do draweru / sheetu.

## Accessibility
- text sizes,
- contrast,
- focus,
- touch targets,
- semantic hierarchy,
- non-color state.

---

# P1 — High-value improvements

## Promise Detail
- evidence summary,
- timeline redesign,
- odstranit duplicitu timeline vs evidence archive,
- contextual right rail desktop,
- optional sticky section nav,
- progressive disclosure assessability.

## Explorer
- progressive disclosure desktop filters,
- active filter summary,
- případně 2-column grid.

## Homepage
- connected lifecycle,
- trust statement,
- featured case.

## Compare
- category legend,
- „Co se změnilo“,
- NOT_INCLUDED explanation,
- neutral semantic diff.

## Methodology
- „v kostce / 60 seconds“,
- TOC,
- simple epistemic diagrams.

## Admin
- Overview → editorial inbox,
- Sources → list-first,
- source processing states,
- Candidate Promise → source preview,
- Admin Promise Detail → workflow state + next action,
- stronger evidence role scanning.

## Dark mode
- semantic QA + token refinement.

---

# P2 — Polish

- refined spacing,
- subtle iconography,
- loading / skeleton states,
- empty states,
- assessment version diff,
- hover/focus microinteractions,
- quotation typography refinement,
- subtle branding,
- transitions,
- login polish.

P2 nesmí blokovat release, pokud P0 funguje.

---

# 59. Doporučené pořadí implementace

Nedělat globální redesign najednou.

Začít třemi základními komponenty:

## 1. Promise Detail Header / Current Assessment

Definuje:

- hierarchy,
- dual status,
- cutoff,
- summary tone.

## 2. Evidence Block

Definuje:

- trust language,
- provenance,
- source fact,
- interpretation.

## 3. Status Component

Definuje:

- execution/outcome semantics,
- icons,
- tint,
- compact vs full presentation.

Tyto tři komponenty vytvoří nový vizuální jazyk produktu.

Potom tento jazyk propagovat do:

4. Promise Detail timeline / evidence archive  
5. Explorer  
6. Compare  
7. Homepage  
8. Methodology  
9. Admin workflow screens

---

# 60. Implementation constraints

Současný stack:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

Backend, domain model a editorial workflow již existují.

## Neprovádět:

- architecture rewrite,
- změnu backendu jen kvůli vzhledu,
- změnu URL struktury bez důvodu,
- kompletní nový design system framework,
- nahrazení shadcn z principu,
- zavádění velké nové dependency jen pro polish.

## Preferovat:

- refactor presentation layer,
- reusable components,
- semantic design tokens,
- responsive variants,
- composition stávajících primitives,
- progressive disclosure,
- lepší IA před novými efekty.

Pokud doporučený UI label neodpovídá internímu enum, může být vytvořena presentation mapping layer.

Není nutné kvůli tomu měnit domain enum.

---

# 61. Design implementation principles pro coding agent

Před každým refactorem:

1. identifikuj existující component,
2. zkontroluj, kde se používá,
3. zachovej business logic,
4. zachovej data fetching,
5. změň layout / hierarchy / presentation,
6. otestuj desktop + mobile,
7. otestuj long content,
8. otestuj empty / missing states,
9. otestuj dark mode,
10. otestuj accessibility basics.

Nevytvářet několik paralelních komponent, pokud lze vytvořit jeden reusable semantic pattern.

---

# 62. Acceptance criteria — Promise Detail

Redesign je úspěšný, pokud nový uživatel během prvních 10–15 sekund dokáže odpovědět:

- Co bylo slíbeno?
- Kdo to slíbil?
- Jaký je současný průběh?
- Jaký je současný výsledek?
- K jakému datu je hodnocení platné?
- Proč aplikace k tomuto závěru došla?
- Jak si mohu důkaz ověřit?

A současně:

- source text není zaměnitelný s editorial textem,
- interpretation není zaměnitelná s source fact,
- assessment nepůsobí jako absolutní politický verdict,
- research cutoff je viditelný,
- corrections jsou dohledatelné.

---

# 63. Acceptance criteria — Explorer

Uživatel musí:

- rychle najít relevantní slib,
- pochopit active filters,
- card skenovat za několik sekund,
- vědět hlavní stav,
- vědět zda je promise non-assessable,
- otevřít detail bez zbytečné kognitivní zátěže.

Na mobilu filtry nesmějí dominovat nad výsledky.

---

# 64. Acceptance criteria — Evidence

Uživatel musí u evidence recordu bezpečně rozeznat:

- odkud informace pochází,
- co přesně zdroj říká,
- kdy byl vydán,
- kde v dokumentu se informace nachází,
- co tento zdroj podporuje,
- co z něj redakce vyvozuje,
- že source fact a interpretation nejsou tatáž věc.

---

# 65. Acceptance criteria — Compare

Uživatel musí bez čtení celé metodiky pochopit:

- rozdíl mezi programem a koaliční smlouvou,
- co znamená Převzato / Změněno / Sloučeno / Nezahrnuto / Nejasné,
- že Nezahrnuto není verdict o splnění,
- co konkrétně se u Modified změnilo.

---

# 66. Acceptance criteria — Methodology

Musí fungovat pro dva typy uživatelů:

## Casual user
během cca 60 sekund pochopí základ.

## Journalist / researcher
dokáže najít kompletní pravidla a auditovat metodiku.

---

# 67. Acceptance criteria — Admin

Editor musí po otevření adminu rychle poznat:

- co vyžaduje jeho pozornost,
- jaké case čekají na akci,
- jaký je workflow state,
- kdo je owner/reviewer,
- co má udělat jako další krok.

Admin nemá optimalizovat estetický dojem.

Má optimalizovat rozhodování a rychlost editorial workflow.

---

# 68. Co nedělat během redesignu

Nezavádět:

- velké gradienty,
- glow,
- glassmorphism,
- neumorphism,
- generické AI sparkle icons,
- marketingové ilustrace bez funkce,
- velké success green cards,
- failure red cards,
- progress percentage,
- score rings,
- decorative charting,
- party-color backgrounds,
- excessive animation,
- card-within-card-within-card,
- 20px+ rounding na běžných surface,
- microcopy, které zní aktivisticky,
- dramatické verdict wording.

Slib → Skutek musí působit:

**klidně, přesně, sebevědomě a auditovatelně.**

---

# 69. Finální produktová designová věta

Celý redesign lze shrnout takto:

> **Z dlouhé stránky plné správných informací udělat čitelný editorial case file, který nejprve dá odpověď a poté transparentně ukáže cestu od původního slibu přes důkazy až k hodnocení.**

A celý vizuální systém stavět na:

> **slib → důkaz → interpretace → hodnocení → historie**

nikoliv na dekorativním brandingu.

---

# 70. Nejdůležitější tři výsledky redesignu

Pokud má první redesignová iterace splnit pouze tři věci, musí to být tyto:

## 1. Uživatel okamžitě pochopí současný stav slibu.

Bez lovení odpovědi v dlouhé stránce.

## 2. Uživatel okamžitě rozpozná, co je zdroj a co je redakční interpretace.

To je základ důvěry.

## 3. Produkt dostane vlastní rozpoznatelný vizuální jazyk založený na evidenci.

Ne na efektech.

To je cesta, jak z dobrého výzkumného MVP udělat důvěryhodný a diferencovaný veřejný civic-tech produkt.

---

# 71. Instrukce pro první redesign pass

V první implementační iteraci postupuj takto:

1. Nejprve projdi aktuální codebase a identifikuj komponenty Promise Detail, Status, Evidence, Explorer Card a responsive navigation.
2. Zachovej business logic, routing, data model a editorial semantics.
3. Implementuj nový Promise Detail top hierarchy.
4. Implementuj reusable Status component s compact/full variantou.
5. Implementuj reusable Evidence Block.
6. Implementuj evidence summary.
7. Uprav timeline tak, aby byla narativní a neduplikovala full evidence.
8. Proveď mobile Promise Detail pass.
9. Zjednoduš Explorer cards.
10. Přesuň mobile filters do drawer/sheet.
11. Proveď accessibility baseline.
12. Teprve potom pokračuj do P1.

Pokud v existující codebase narazíš na rozdíl mezi tímto briefem a skutečným domain modelem, **neměň význam dat, aby UI odpovídalo briefu**.

Nejprve zachovej domain truth.

UI se má přizpůsobit datům, ne obráceně.

---

# 72. Definition of done pro první veřejně prezentovatelnou verzi

První redesign pass je připraven k veřejnému použití, pokud:

- Promise Detail je answer-first,
- evidence a interpretation jsou jasně odlišitelné,
- dual status model je srozumitelný,
- NO_VERIFIED_PROGRESS nelze snadno dezinterpretovat,
- mobile Promise Detail je čitelný a vrstvený,
- Explorer cards jsou skenovatelné,
- mobile filtering neblokuje obsah,
- text sizes a touch targets splňují baseline,
- status není komunikován jen barvou,
- dark mode neztrácí semantic hierarchy,
- public UI nepůsobí jako BI dashboard ani shadcn starter,
- admin zůstává funkční a není redesignem rozbit,
- žádná změna nepřepisuje business logiku nebo editorial trust model.

---

# Konečné doporučení

Nevytvářej „nový vizuální styl“ odděleně od informační architektury.

Nový styl má vzniknout jako důsledek tří věcí:

1. silnější hierarchy,
2. evidence grammar,
3. disciplinovanější status system.

Nejdříve udělej **Promise Detail + Evidence Block + Status** opravdu dobře.

Pokud budou tyto tři věci správně, zbytek produktu se na jejich základě sjednotí přirozeně.

Pokud se naopak začne globálními barvami, spacingem a novými cards, produkt bude jen hezčí verze stejného problému.

**Cílem není prettier UI.**

Cílem je:

> **Slib → Skutek má během několika sekund dát pochopitelnou odpověď a během několika dalších minut umožnit tuto odpověď kompletně auditovat.**
