# Architektura

Modulární monolit na Next.js. Žádné služby, žádná fronta, žádný cache layer — nic z toho zatím produkt nepotřebuje a všechno by přidalo místo, kde se dá schovat chyba.

## Členění

```text
src/
  app/            Next.js App Router — stránky a komponenty
    _components/  sdílené prezentační prvky
  modules/        doména, rozdělená podle oblasti
    accounts/     redakční účty
    ai/           běhy a návrhy modelu (fáze 4)
    assessments/  hodnotitelnost, statusy, pravidla konzistence
    coalition/    porovnání programu s koaliční smlouvou
    evidence/     důkazy a jejich vazby
    extraction/   vytěžování kandidátů na slib, zlatý dataset, metriky
    ingestion/    extrakce PDF, kanonický text, normalizace
    jurisdictions/ města a volby
    parties/      strany, kandidátky, osoby
    promises/     sliby, metriky, události
    review/       redakční rozhodnutí, audit, opravy
    sources/      zdrojové dokumenty
  cli/            nástroje pouštěné z příkazové řádky
  db/             klient, schéma, migrace, seed, testovací harness
  shared/         validace prostředí, formátování
```

Každý modul drží pohromadě to, co spolu opravdu souvisí:

| Soubor v modulu             | Co obsahuje                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| `schema.ts`                 | Drizzle tabulky a jejich constrainty.                             |
| `queries.ts`                | Čtecí dotazy vracející doménové tvary, ne řádky z databáze.       |
| `labels.ts`                 | České popisky hodnot enumů.                                       |
| ostatní (`assessability.ts`) | Doménová logika bez závislosti na databázi.                       |

## Směr závislostí

```text
app/  →  modules/  →  db/
                   →  shared/
```

- **Komponenta nikdy nesahá do databáze.** Dotaz volá stránka a komponentě předá hotový doménový tvar.
- **Doménová logika nezná Drizzle.** `assessability.ts` a `statusRules.ts` jsou čisté funkce nad hodnotami; proto jdou testovat bez databáze a proto je používá jak aplikace, tak seed.
- **Moduly na sobě smí viset jen jedním směrem.** `promises` zná `sources`, ne naopak.
- **Enumy žijí v `db/enums.ts`**, ne v modulech. Postgres enum musí vzniknout právě jednou; kdyby ho deklaroval každý modul, generátor migrací by ho vyráběl opakovaně a moduly by na sobě visely cyklicky.

## Databáze jako poslední pojistka

Integritní pravidla briefu nedrží aplikační kód, ale databáze — constrainty a triggery v migraci `0001`. Aplikační vrstva se dá obejít migračním skriptem nebo ruční SQL opravou; trigger ne.

Konkrétně databáze vynucuje:

- doslovné znění publikovaného slibu je neměnné
- hodnocení je append-only, měnit lze jedině příznak „toto je aktuální verze"
- audit a redakční rozhodnutí nejdou přepsat ani smazat
- hodnocení nesmí schválit jeho vlastní autor
- plný text se neuloží u dokumentu bez licence
- klasifikace „převzato" nevznikne bez místa v koaliční smlouvě

Podrobně v [data-model.md](./data-model.md).

## Bezpečnostní úvaha: migrace vs. append-only

Migrace `0003` musela append-only trigger nad `promise_assessment` dočasně vypnout, aby doplnila nový povinný sloupec do existujících řádků. Platí k tomu explicitní pravidlo:

> **Schema migration may temporarily bypass append-only enforcement solely to backfill schema-required metadata; editorial application code never receives such a capability.**
>
> Migrace smí append-only ochranu dočasně obejít výhradně kvůli doplnění metadat vyžadovaných schématem. Aplikační redakční kód takovou možnost nikdy nedostane.

Podmínky, za kterých je to přípustné:

- jen v migračním skriptu, nikdy v aplikačním kódu
- jen pro doplnění sloupce, který si vyžádala změna schématu — nikdy pro změnu redakčního obsahu (skóre, statusy, shrnutí, autorství)
- vypnutí a zapnutí musí být v **téže transakci**, aby mimo ni neexistoval okamžik bez ochrany
- v migraci musí být zdůvodněno komentářem

To, že migrace na vlastní ochranu narazila, je dobré znamení: invariant není deklarovaný jen v TypeScriptu, ale drží ho databáze.

**Do budoucna (mimo MVP):** oddělit migrační a runtime databázové role. Runtime role aplikace by neměla mít `ALTER TABLE` ani právo trigger vypnout — dnes obojí může, protože obojí jede pod stejným `DATABASE_URL`. Až budou role oddělené, patří k tomu i test, že runtime role trigger vypnout nedokáže. Pro MVP se role management nestaví; je to vědomě přijaté riziko, ne opomenutí.

## Redakční konzole

`/admin` má tři vrstvy a každá dělá právě jednu věc:

```text
stránka (server component)   → čte přes adminQueries, vykresluje
server action                → ověří přihlášení, zavolá službu
modules/review/service.ts    → validace + workflow + čtyři oči + audit, vše v transakci
```

Pravidla, která z toho plynou:

- **Komponenta nikdy nezapisuje.** Všechny mutace jdou přes `service.ts`, protože jen tam je pohromadě to, co musí platit současně. Rozsypat to po stránkách znamená, že někde jedna kontrola vypadne.
- **Autorizaci si ověřuje každá server action zvlášť.** Guard v layoutu chrání jen vykreslení stránky; akci lze zavolat i bez toho, aby si prohlížeč tu stránku kdy načetl.
- **Identita pochází výhradně ze session.** Z formuláře se nebere ani tehdy, když v něm nějaké ID přijde. `auth.ts` je označený `server-only`, takže import do klientské komponenty shodí build.
- **Čtení pro admin je oddělené od veřejného čtení.** Veřejná vrstva vidí jen publikované a ověřené záznamy, admin i rozpracované. Kdyby to sdílelo jeden dotaz s příznakem, stačilo by ho jednou prohodit.

CSRF řeší Next tím, že u server actions porovnává hlavičku Origin s Host; session cookie je `httpOnly`, `SameSite=Lax` a v produkci `Secure`. Vlastní token by k tomu nic nepřidal.

Hesla se ukládají jako scrypt otisk s náhodnou solí (`node:crypto`, bez další závislosti). V `app_session` je jen otisk tokenu — kdo získá přístup k databázi, nesmí z ní umět odvodit platnou cookie.

**Role se nezavádějí.** Jediné dělení, které produkt potřebuje, je pravidlo čtyř očí, a to nezní „reviewer smí schvalovat", ale „nikdo nesmí schválit vlastní práci". To je vlastnost dvojice (autor, schvalovatel), ne uživatele — drží ji CHECK constraint na hodnocení. Matice oprávnění by k tomu nic nepřidala.

## Testování

Testy stojí na tom, že schéma je z velké části tvořené databázovými zárukami. Testovat je proti mocku by neověřilo nic, proto integrační testy pouštějí **skutečné migrace proti skutečnému Postgresu** — jen zkompilovanému do WASM (PGlite), aby nepotřebovaly Docker.

```text
*.test.ts              čisté funkce (hodnotitelnost, pravidla statusů, filtry)
*.integration.test.ts  migrace, seed, čtecí vrstva proti Postgresu
*.integration.test.tsx vykreslení komponent nad daty ze seedu
```

Produkce jede na `node-postgres`, testy na PGlite. Doménový kód o driveru neví — bere `AppDatabase` z `db/types.ts`, což je společný typ obou.

## Vykreslování

Stránky, které čtou z databáze, mají `dynamic = "force-dynamic"`. Důvod je provozní: build by jinak vyžadoval dostupnou databázi a publikovaný slib by se objevil až po dalším nasazení. Obsah se ale mění redakční prací, ne nasazením kódu.

`/methodology` databázi nepotřebuje a generuje se staticky.

Filtry v přehledu slibů jsou odkazy, ne klientský stav — jsou sdílitelné, fungují bez JavaScriptu a nevyžadují do prohlížeče posílat interaktivní komponentu.

## Text dokumentů

Řetězec doložitelnosti končí u konkrétního místa v konkrétním dokumentu, takže text musí být adresovatelný a neměnný:

```text
PDF → kanonický text (stránky, znakové posuny) → normalizovaná vrstva (odvozená)
```

- **Kanonický text se nikdy nemění.** Citace se cituje odsud.
- **Normalizace nikdy nevkládá znaky**, jen nahrazuje 1:1 nebo maže. Díky tomu si každý znak pamatuje svůj původ a nález jde převést zpět na rozsah v originále. Kdyby vkládala, mapování zpět by přestalo být jednoznačné.
- **Posuny jsou lokální ke stránce.** Globální by se posunuly při každé změně stránkování.
- **Extrakce je deterministická a bez modelu.** Jazykový model v tomhle kroku by smazal rozdíl mezi tím, co v dokumentu stojí, a tím, co dopsal.

Verzuje se obojí odděleně: `extractorVersion` a `NORMALIZATION_VERSION`. Po jejich změně je potřeba ověřit anotace znovu, protože posuny nemusí sedět.

## Co tu vědomě není

- Repository pattern nad Drizzle. Drizzle už je ta abstrakce; další vrstva by jen přidala překlad.
- Generický service layer. Dokud má funkce jednoho volajícího, je to funkce.
- Cache. Dotazy jsou indexované a datová sada je malá. Až přestane platit, bude vidět kde.
- Veřejné API. Doménové funkce jsou psané tak, aby ho šlo doplnit, ale MVP ho nepotřebuje.
