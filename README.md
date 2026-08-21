# Slib → Skutek

Sledování politických slibů a jejich napojení na ověřitelné důkazy o tom, co se po volbách skutečně stalo.

Výchozí rozsah: **komunální politika Prahy, volební období 2022–2026.**

```
VOLEBNÍ SLIB → KOALIČNÍ SMLOUVA → POLITICKÉ ROZHODNUTÍ
   → ROZPOČET → ZAKÁZKA / REALIZACE → SKUTEČNÝ VÝSLEDEK
```

**Stav: fáze 1–3 hotové, fáze 4 rozpracovaná.** Veřejná část běží nad ukázkovými daty, redakce zvládne celý ruční postup od zdroje po publikaci a existuje měřicí aparát pro budoucí vytěžování slibů (PDF → kanonický text → ruční anotace → metriky). Jazykový model zatím napojený není.

---

## Dokumenty

| Soubor                                                             | Co obsahuje                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [CLAUDE.md](./CLAUDE.md)                                           | **Jak se pracuje** — role, inženýrské priority, bezpečnost, testování, definition of done.      |
| [MASTER_IMPLEMENTATION_BRIEF.md](./MASTER_IMPLEMENTATION_BRIEF.md) | **Co stavíme** — produkt, principy integrity, datový model, scope, fáze, otevřené otázky.       |
| [docs/architecture.md](./docs/architecture.md)                     | Členění kódu, směr závislostí, kde končí doména a začíná UI.                                    |
| [docs/data-model.md](./docs/data-model.md)                         | Entity, jejich vztahy a databázové záruky, které aplikace nesmí obejít.                         |
| [docs/promise-annotation-guidelines.md](./docs/promise-annotation-guidelines.md) | Co se počítá jako slib a co ne. Pravidla pro ruční anotaci.                  |
| [corpus/README.md](./corpus/README.md)                             | Vytěžené dokumenty, anotace a jak s nimi pracovat.                                              |
| `/methodology` v aplikaci                                          | Metodika hodnocení. Žije jako stránka, ne jako Markdown — čte váhy a prahy přímo z kódu.        |

Při konfliktu: CLAUDE.md vyhrává v otázkách procesu a kvality kódu, brief v otázkách produktu a domény.

---

## Předpoklady

- Node.js **20.11+** (vyvíjeno na 24)
- PostgreSQL **17** — lokálně nejjednodušeji přes Docker (`docker-compose.yml` v repozitáři)

Testy Postgres nepotřebují: běží proti [PGlite](https://pglite.dev), tedy Postgresu zkompilovanému do WASM. `npm test` funguje bez Dockeru i bez běžící služby.

---

## Lokální spuštění

```bash
cp .env.example .env      # výchozí hodnoty odpovídají docker-compose.yml
docker compose up -d      # Postgres na localhost:5432
npm install
npm run db:migrate        # vytvoří schéma
npm run db:seed           # naplní ukázková data
npm run dev               # http://localhost:3000
```

Bez Dockeru stačí jakýkoli Postgres 17 — jen uprav `DATABASE_URL`.

Kdo Docker ani Postgres nemá, spustí aplikaci proti PGlite:

```bash
npm run dev:pglite                                  # http://localhost:3000
npm run dev:pglite -- --corpus corpus/nazev-dokumentu  # navíc nahraje dokument z korpusu
```

Databáze je v paměti a se zastavením procesu mizí. Je to náhrada pro rychlý
pohled na aplikaci, ne pro průběžnou práci.

---

## Proměnné prostředí

Validují se při startu v `src/shared/env.ts`. Chybějící hodnota shodí aplikaci hned, ne až uprostřed požadavku.

| Proměnná            | Povinná | Výchozí     | K čemu                                                                    |
| ------------------- | ------- | ----------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`      | ano     | —           | Připojení k Postgresu.                                                    |
| `AI_PROVIDER`       | ne      | `fixture`   | `fixture` \| `local` \| `anthropic`. Ve vývoji a testech vždy `fixture`.  |
| `ANTHROPIC_API_KEY` | ne      | —           | Jen když `AI_PROVIDER=anthropic`.                                         |
| `DB_ALLOW_REMOTE`   | ne      | —           | `1` povolí `db:reset` a `db:seed` proti nelokálnímu hostu. Bez toho odmítnou běžet. |
| `DATABASE_POOL_MAX` | ne      | `10`        | Velikost poolu. E2E běh proti PGlite ji snižuje na 1.                     |
| `SEED_EDITOR_PASSWORD` | ne   | `demo-redakce` | Heslo demo redakčních účtů. Jen pro lokální vývoj.                     |

`.env` je v `.gitignore` a nikdy se necommituje.

---

## Databáze

| Příkaz                | Co dělá                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `npm run db:generate` | Vygeneruje migraci z rozdílu mezi schématem a posledním snapshotem.     |
| `npm run db:migrate`  | Aplikuje migrace.                                                      |
| `npm run db:seed`     | **Vyprázdní** databázi a naplní ji ukázkovými daty.                    |
| `npm run db:reset`    | Zahodí schéma. Potom je potřeba `db:migrate`.                          |
| `npm run db:studio`   | Drizzle Studio.                                                        |

`db:seed` i `db:reset` jsou destruktivní. Obojí odmítne běžet v produkčním `NODE_ENV` a proti nelokálnímu hostu (viz `src/db/safety.ts`).

Migrace **0001** není vygenerovaná — obsahuje triggery, které drží integritní pravidla (neměnnost publikovaného znění, append-only hodnocení a audit). Při ruční úpravě migrací ji nepřepisuj.

### Ukázková data

Kandidátky, dokumenty i sliby v seedu jsou **smyšlené** a v databázi i v UI označené příznakem `is_demo`. Schéma je ale stejné, jaké unese reálná pražská data.

Seed je deterministický — identifikátory se odvozují z klíčů (`src/db/seed/ids.ts`), takže po `db:reset && db:migrate && db:seed` mají záznamy stejná ID jako předtím.

---

## Redakční konzole

`/admin` je neveřejná a vyžaduje přihlášení. Po `db:seed` existují dva účty se stejným heslem (`demo-redakce`, nebo podle `SEED_EDITOR_PASSWORD`):

```text
redaktor1@example.org
redaktor2@example.org
```

Dva účty jsou potřeba schválně: **hodnocení nesmí schválit jeho vlastní autor.** Pravidlo drží CHECK constraint v databázi, ne jen zašedlé tlačítko.

Redakční postup:

```text
kandidátka → zdroj → kandidát na slib → důkazy → hodnocení
           → předat k revizi → schválit / vrátit → publikovat
           → nová verze nebo korekce
```

Kandidátky a strany se zakládají na `/admin/lists`. Slib patří **kandidátce**, ne straně — kandidátka totiž šla do voleb s programem; koalice vznikne výběrem víc stran do jedné kandidátky.

Hodnocení prochází stavy `DRAFT → IN_REVIEW → CHANGES_REQUESTED → APPROVED → PUBLISHED`. Přechody se vynucují na serveru; neplatný přechod skončí chybou, ne jen chybějícím tlačítkem. Publikovaná verze je neměnná — změna se dělá novou verzí s uvedeným důvodem.

Role se nezavádějí. Jediné dělení, které produkt potřebuje, je „nikdo neschvaluje vlastní práci", a to je vlastnost dvojice autor–schvalovatel, ne uživatele.

Přihlášení je omezené počtem pokusů: 5 na e-mail a 20 na IP adresu za 15 minut. Čítač je v databázi (`login_attempt`), protože na Vercelu obsluhuje požadavky víc instancí a čítač v paměti by po prvním cold startu nechránil nic. Ukládá se otisk adresy, ne adresa, a záznamy se po vypršení okna mažou.

---

## Testy a kontroly

```bash
npm run check        # format:check + lint + typecheck + test
npm test             # jen testy
npm run test:watch
```

Integrační testy (`*.integration.test.ts`) pouštějí skutečné migrace proti PGlite a ověřují mimo jiné:

- že triggery a CHECK constrainty opravdu drží (nelze přepsat publikované znění, smazat verzi hodnocení ani audit)
- že každý citát doslova stojí ve zdroji, ze kterého je odvozený
- že uložený stupeň hodnotitelnosti odpovídá tomu, co vrací algoritmus
- že se nepotvrzený návrh AI ani rozpracovaná verze hodnocení nedostanou do výstupu čtecí vrstvy ani do vyrenderovaného HTML
- že celý redakční postup funguje od zdroje po publikaci, včetně pravidla čtyř očí a zákazu publikace nedoložených tvrzení

### E2E testy

```bash
npm run test:e2e          # sestaví aplikaci, spustí ji a proklikne
npm run test:e2e:ui       # totéž s Playwright UI
```

Databázi si testy spouštějí samy: PGlite se přes `pglite-socket` vystaví jako běžný Postgres na portu 55432, takže **Docker není potřeba** ani tady. Kdo má vlastní instanci, nastaví `E2E_DATABASE_URL` a PGlite se nespustí.

Dva scénáře:

- **redakční** — nepřihlášený je odmítnut, editor založí zdroj, kandidáta, důkaz a hodnocení, předá k revizi, vlastní práci schválit nemůže, druhý účet schválí a publikuje, slib se objeví veřejně. Je to definition of done fáze 3 procvičená přes HTTP.
- **veřejný** — pojistka proti regresi v tom, co vidí čtenář.

Snímky obrazovek pro vizuální kontrolu:

```bash
CAPTURE_SCREENSHOTS=1 npm run screens   # uloží do e2e/screenshots/
```

Nejsou to snapshot testy. Porovnávat pixely u stránky, která se mění s obsahem, by znamenalo hlavně udržovat falešné poplachy.

---

## Korpus a měření extrakce

Než se napojí jazykový model, musí být na čem měřit, jestli něco přidává.

```bash
npm run corpus:add -- <url> --dir corpus/nazev --title "…" --publisher "…"   # reálný dokument z webu
npm run corpus:table -- <url|csv> --dir corpus/nazev --match "most" --columns a,b # výřez tabulky jako dokument
npm run corpus:demo                                        # vyrobí ukázkové PDF
npm run corpus:extract  -- corpus/demo-program/program.pdf # PDF → kanonický text
npm run corpus:scaffold -- corpus/demo-program/extracted.json --annotator "Jméno"
npm run corpus:evaluate -- corpus/demo-program             # metriky proti anotacím
npm run corpus:import   -- corpus/demo-program             # vloží dokument do databáze
```

`corpus:import` čte `provenance.json` a `extracted.json` a zakládá zdrojový dokument
stejnou cestou jako redakční konzole — se stejnou kontrolou otisku i licenčního režimu.
Bez `provenance.json` import neproběhne: uložit cizí text bez evidence původu je přesně
to, čemu má provenience bránit.

**Extrakce textu z PDF nikdy nepoužívá model.** Kdyby text z dokumentu vytahoval jazykový model, přestala by být citace citací — nešlo by odlišit, co v dokumentu stojí, od toho, co model doplnil.

Kanonický text zachovává hranice stran a znakové posuny uvnitř stránky, takže citace ukazuje na konkrétní místo konkrétní verze dokumentu. Normalizace (slepení dělených slov, sjednocení uvozovek, scvrknutí mezer) je **odvozená** vrstva a každý znak si pamatuje, odkud v originále pochází — nález v ní jde převést zpátky na rozsah v originálu.

OCR v projektu vědomě není. Extrakce pozná stránku bez textové vrstvy a nahlásí ji; teprve reálný dokument, který na tom selže, je doložený důvod OCR přidat.

Měří se přesnost, úplnost, F1, **věrnost citací** a **podíl citací bez opory ve zdroji**. Poslední dvě jsou pro tenhle produkt důležitější než F1: extraktor, který si citace upravuje, je horší než extraktor, který najde půlku.

Laťkou je deterministická heuristika (`baseline-heuristic`), aby budoucí model měl co překonávat.

---

## Nasazení

Cíl je Vercel + hostovaný Postgres (Neon).

**Sestavení nepotřebuje databázi ani jedinou proměnnou prostředí.** Databáze se otevírá až prvním dotazem; stránky, které z ní čtou, se vykreslují při požadavku. Ověřeno sestavením z čistého klonu bez `.env`.

Postup z čistého checkoutu:

```bash
npm ci
npm run build                                  # bez proměnných, bez databáze
DATABASE_URL="postgres://…" npm run db:migrate # schéma z nuly na prázdné databázi
DATABASE_URL="postgres://…" npm run start
```

Na Vercelu:

1. Nastav `DATABASE_URL` (Neon, s `sslmode=require`) v proměnných projektu. Buildu ji netřeba, běhu ano.
2. **Migrace nejsou součástí buildu a nikdo je nespustí za tebe.** Pusť `npm run db:migrate` proti produkční databázi při každém nasazení, které přidává migraci — z lokálu nebo z deploy hooku. Bez toho aplikace nasadí, ale první dotaz spadne na chybějící tabulku.
3. `AI_PROVIDER` nech nenastavené (výchozí `fixture`), dokud vědomě nechceš platit za model.

Prázdná databáze je funkční stav: veřejné stránky se vykreslí s prázdnými seznamy, neexistující slib vrací 404. Ověřeno proti čerstvě zmigrované databázi bez jediného záznamu.

`db:seed` a `db:reset` proti produkci **nespouštěj** — obojí data maže. Pojistka v `src/db/safety.ts` je proti nelokálnímu hostu i proti `NODE_ENV=production` odmítne, ale spoléhat se na ni jako na jedinou obranu není dobrý nápad.

> Vercel Hobby zakazuje komerční užití. Jakmile přibudou dary nebo transparentní účet, je potřeba Pro.

---

## AI

Vytěžování kandidátů na slib se spouští z detailu zdrojového dokumentu tlačítkem **Vytěžit kandidáty**. Platí:

- běží **dávkově v adminu**, nikdy v request path veřejné aplikace
- výstup se validuje Zodem (`messages.parse` + `zodOutputFormat`), surové odpovědi se nedůvěřuje
- **citace musí doslova stát ve zdroji**, jinak se návrh zahodí ještě před uložením; důvody zahození zůstávají u běhu
- žádný návrh se nezveřejní bez lidské revize — přijetí zakládá *nepublikovaného kandidáta* toutéž cestou jako ruční zápis
- u každého běhu se ukládá poskytovatel, model, verze promptu, otisk vstupu, tokeny a cena (`ai_run`, `ai_suggestion`)
- stejný dokument se stejnou verzí promptu neproběhne dvakrát — otisk vstupu to zachytí

Druhá úloha, **hledání důkazů**, běží tlačítkem *Hledat důkazy k slibům* na témž místě. Model dostane očíslovaný seznam slibů a vrací číslo, ne identifikátor — číslo mimo seznam se zahodí, takže nemá jak navěsit důkaz na slib, který mu nikdo nedal. Přijetí návrhu zakládá vazbu **ověřenou člověkem**, pod jménem toho, kdo ji vzal; nepotvrzené vazby v datech nevznikají. Roli důkazu (dokládá průběh / výsledek / je v rozporu…) navrhuje model, ale přepsat ji může redaktor — na téhle rozvaze stojí hodnocení.

Text dokumentu je pro model **data, ne instrukce**. Systémový prompt to říká, ale skutečnou pojistkou proti prompt injection je ověření citace: věta „ignoruj předchozí pokyny" v nahraném PDF může model zmást, do systému se ale nedostane, protože se v dokumentu nenajde jako doložitelná citace.

| `AI_PROVIDER` | Co běží | Cena |
| --- | --- | --- |
| `fixture` (výchozí) | Deterministická heuristika `HeuristicPromiseExtractor` — laťka, kterou má model překonávat. Umí jen vytěžování kandidátů; u hledání důkazů to řekne a skončí | 0 |
| `anthropic` | Claude přes oficiální SDK; vyžaduje `ANTHROPIC_API_KEY` | podle ceníku, ukládá se u běhu |
| `local` | Zatím nenapojeno, skončí srozumitelnou chybou | — |

Výchozí je heuristika schválně: běh, který stojí peníze, se musí zapnout vědomě.

---

## Odhad nákladů

Infrastruktura pro MVP **0 Kč/měsíc** (Vercel Hobby + Neon free tier). Celá extrakce pražského korpusu vyjde **pod $10**. Detaily v briefu, sekce `OPEN QUESTIONS → D`.

Skutečné riziko projektu není cena, ale **objem editorské práce** a **právní expozice**. Viz sekce `E`.
