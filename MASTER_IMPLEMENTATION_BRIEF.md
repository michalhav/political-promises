# MASTER IMPLEMENTATION BRIEF — Slib → Skutek

> **Tento dokument definuje CO stavíme** — produkt, doménu, datový model, scope.
> **JAK se pracuje** je v [CLAUDE.md](./CLAUDE.md) — role, inženýrské standardy, definition of done.
> Nepřepisuj jedno do druhého. Při konfliktu vyhrává tento soubor v otázkách produktu a domény, CLAUDE.md v otázkách procesu a kvality kódu.
>
> Otevřené otázky a známé mezery jsou na konci souboru v sekci **OPEN QUESTIONS**. Přečti ji dřív, než začneš stavět.

---

# PRODUCT

Working name:

**Slib → Skutek**

The product tracks political promises and connects them to verifiable evidence showing what happened after the election.

Initial scope:

**Prague municipal politics — election cycle 2022–2026.**

The fundamental product concept is:

```text
ELECTION PROMISE
      ↓
COALITION AGREEMENT
      ↓
POLITICAL DECISION
      ↓
BUDGET / FUNDING
      ↓
CONTRACT / IMPLEMENTATION
      ↓
REAL-WORLD RESULT
```

Every factual conclusion displayed to the public must be traceable to evidence.

The application must NEVER behave like an AI political judge.

AI may assist with extraction, classification and evidence matching, but publication of assessments must be deterministic and human-reviewable.

---

# PRODUCT PRINCIPLES

These principles are mandatory.

## 1. Evidence first

Every published status or factual assertion must link to one or more source documents.

Never generate unsupported political facts.

## 2. Separate promise execution from outcome

A policy can be implemented while the promised outcome is not achieved.

Therefore distinguish:

```text
Execution status
```

from:

```text
Outcome status
```

Do not collapse them into one misleading metric.

## 3. Neutrality

The UI, data model and algorithms must treat parties consistently.

No political persuasion.

No ranking of parties by ideological desirability.

No "trustworthiness score".

No emotional or judgmental wording.

## 4. Source preservation

When ingesting a source, preserve:

- original URL
- title
- publisher
- publication date if known
- retrieval timestamp
- original text where permitted
- document hash
- source type

The product should eventually behave like a political "Git history".

## 5. Human review

AI-generated candidate promises and evidence associations must remain unpublished until reviewed.

## 6. Explainability

A user must be able to answer:

> Why does the application say this promise has this status?

within one click.

---

# PRIMARY USER EXPERIENCE

The MVP needs four product areas.

---

# 1. PROMISE EXPLORER

Route example:

```text
/promises
```

Users can browse political promises.

Filters:

- party
- topic
- promise status
- assessability
- source
- search

Initial topic taxonomy:

```text
Housing
Transport
Education
Environment
Digitalization
Public Finance
Security
Social Policy
Urban Development
Other
```

Each card should show:

- short promise title
- party
- original promise excerpt
- topic
- execution status
- outcome status if available
- assessability
- latest meaningful event
- evidence count

Do not overload cards with information.

---

# 2. PROMISE DETAIL

Route:

```text
/promises/[slug]
```

This is the core screen.

Display:

## Promise

Original wording.

Party.

Election.

Original source.

Exact quote.

Page number if available.

## Assessability

Show independently:

- specificity
- measurability
- deadline clarity
- jurisdiction / competence
- outcome definition

Each dimension should use a 0–5 score.

Also derive:

```text
HIGH
MEDIUM
LOW
NOT ASSESSABLE
```

Do not pretend that vague promises can be objectively evaluated.

## Timeline

Example:

```text
09/2022
Election promise published

02/2023
Included in coalition agreement

06/2023
City council approved project

12/2023
CZK 600M allocated in budget

03/2024
Public procurement launched

08/2025
Construction started
```

Every event must contain source evidence.

## Status

ExecutionStatus enum:

```text
NO_VERIFIED_PROGRESS
NOT_STARTED
PLANNED
IN_PROGRESS
PARTIALLY_COMPLETED
COMPLETED
ABANDONED
BLOCKED
NOT_ASSESSABLE
UNKNOWN
```

`UNKNOWN` u stavu plnění znamená „slib jsme zatím neprošli". To je stav rozpracovanosti, ne závěr, a proto se **nesmí publikovat** — nepřítomnost hodnocení se pozná podle toho, že žádné publikované hodnocení neexistuje. Hodnota v enumu zůstává (odstraňovat hodnotu z Postgres enumu je zbytečně riziková migrace), publikaci ale blokuje `validateReadyForPublication`. Úklid patří do pozdější fáze.

U stavu **výsledku** `UNKNOWN` smysl dává: liší se od `NOT_MEASURABLE_YET` tím, že měřit by šlo, ale hodnotu nemáme.

`NO_VERIFIED_PROGRESS` a `NOT_STARTED` nejsou totéž a nesmí se zaměňovat.

```text
NO_VERIFIED_PROGRESS  = k rozhodnému datu jsme nenašli veřejný doklad o realizaci
NOT_STARTED           = zdroj výslovně uvádí, že realizace zahájena nebyla
```

První je výrok o stavu našich zdrojů, druhý o stavu města. Projekt může běžet uvnitř úřadu dřív, než o něm vznikne usnesení — vydávat absenci dokumentu za nečinnost proto znamená tvrdit něco, co ze zdrojů neplyne.

`NOT_STARTED` bez doloženého zdroje neprojde pravidly konzistence. Každé hodnocení navíc nese **rozhodné datum** (`sourcesReviewedUpTo`): den, ke kterému rešerše sahá. Bez něj by byl výrok o stavu nedatovaný.

OutcomeStatus enum:

```text
NOT_MEASURABLE_YET
ACHIEVED
PARTIALLY_ACHIEVED
NOT_ACHIEVED
UNKNOWN
NOT_APPLICABLE
```

## Evidence

Show all supporting sources.

For each evidence item show:

- source title
- source organization
- date
- relevant excerpt
- URL
- relation to promise

---

# 3. PROGRAM → COALITION DIFF

Route:

```text
/compare
```

The user selects a political party.

Display what happened to promises after coalition formation.

Categories:

```text
RETAINED
MODIFIED
MERGED
NOT_INCLUDED
UNCLEAR
```

Example:

```text
Original promise

"Build 5,000 municipal apartments."

Coalition agreement

"Accelerate construction of affordable municipal housing."

Classification:

MODIFIED

Reason:
Numeric commitment was removed.
```

The reason must be evidence-based.

If AI generated the proposed match, clearly distinguish:

```text
AI suggested match
```

from:

```text
Human verified match
```

---

# 4. INTERNAL REVIEW CONSOLE

Route:

```text
/admin
```

This does not need sophisticated UX.

It does need to make the research workflow efficient.

Sections:

```text
Sources awaiting processing
Candidate promises
Candidate evidence matches
Promise assessments awaiting review
Published promises
```

Reviewer must be able to:

- accept
- reject
- edit
- merge duplicate promises
- attach evidence
- change classification
- publish

Every review action must create an audit event.

---

# MVP DATA MODEL

Use PostgreSQL.

Create a clean relational schema.

Minimum entities:

```text
Jurisdiction
Election
Party
SourceDocument
Promise
PromiseSource
PromiseAssessment
PromiseEvent
Evidence
CoalitionPromiseMapping
ReviewDecision
AuditLog
```

Recommended important fields:

## Jurisdiction

```text
id
name
type
countryCode
```

Example:

```text
Praha
MUNICIPALITY
CZ
```

---

## Election

```text
id
jurisdictionId
name
electionDate
termStart
termEnd
```

---

## Party

```text
id
name
shortName
slug
```

---

## SourceDocument

```text
id
sourceType
title
publisher
url
publishedAt
retrievedAt
contentHash
rawText
metadataJson
```

SourceType enum:

```text
ELECTION_PROGRAM
COALITION_AGREEMENT
COUNCIL_RESOLUTION
COUNCIL_VOTE
BUDGET
CONTRACT
PUBLIC_PROCUREMENT
OFFICIAL_REPORT
OTHER
```

---

## Promise

```text
id
partyId
electionId
slug
title
originalText
normalizedStatement
topic
deadline
published
createdAt
updatedAt
```

Do not overwrite originalText after publication.

---

## PromiseAssessment

```text
promiseId

specificityScore
measurabilityScore
deadlineScore
jurisdictionScore
outcomeDefinitionScore

assessability

sourcesReviewedUpTo

executionStatus
outcomeStatus

assessmentSummary

reviewedBy
reviewedAt
```

---

## PromiseEvent

Represents the promise timeline.

```text
id
promiseId
eventType
eventDate
title
description
evidenceId
createdAt
```

EventType examples:

```text
PROMISE_CREATED
COALITION_INCLUDED
COALITION_MODIFIED
COUNCIL_DECISION
BUDGET_ALLOCATED
PROCUREMENT_STARTED
CONTRACT_SIGNED
IMPLEMENTATION_STARTED
MILESTONE_REACHED
COMPLETED
BLOCKED
ABANDONED
```

---

## Evidence

```text
id
sourceDocumentId
promiseId
excerpt
pageNumber
relationType
confidence
humanVerified
createdAt
```

RelationType:

```text
SUPPORTS
CONTRADICTS
PROGRESS
IMPLEMENTATION
FUNDING
OUTCOME
CONTEXT
```

---

# AI PIPELINE

Implement AI behind a provider-neutral interface.

Example:

```text
AIProvider
```

with implementations such as:

```text
OpenAIProvider
AnthropicProvider
```

The application must not depend directly on one vendor throughout the codebase.

All AI responses must use structured JSON validated with Zod.

Never trust raw model output.

---

# PROMISE EXTRACTION

Input:

Election program text.

Output schema:

```json
{
  "candidatePromises": [
    {
      "originalText": "...",
      "normalizedStatement": "...",
      "suggestedTitle": "...",
      "topic": "...",
      "deadline": null,
      "specificityScore": 0,
      "measurabilityScore": 0,
      "deadlineScore": 0,
      "jurisdictionScore": 0,
      "outcomeDefinitionScore": 0,
      "reasoningSummary": "...",
      "sourceExcerpt": "..."
    }
  ]
}
```

AI output must create:

```text
UNREVIEWED candidate
```

not a published promise.

---

# EVIDENCE MATCHING

Given:

```text
Promise
+
new SourceDocument
```

AI may suggest that a source relates to the promise.

Output:

```json
{
  "matches": [
    {
      "promiseId": "...",
      "relationType": "...",
      "excerpt": "...",
      "confidence": 0.0,
      "explanation": "..."
    }
  ]
}
```

Again:

AI suggestions are not automatically public.

---

# DOCUMENT INGESTION

Create a simple ingestion abstraction:

```text
SourceIngestionService
```

MVP inputs:

```text
URL
plain text
PDF upload
```

Pipeline:

```text
Source
 ↓
Download / Upload
 ↓
Extract text
 ↓
Normalize
 ↓
SHA-256 hash
 ↓
Store SourceDocument
 ↓
AI processing
 ↓
Review queue
```

Do not build dozens of custom scrapers for MVP.

The architecture should allow future source adapters such as:

```text
Praha.eu
Hlídač státu
Registr smluv
Monitor státní pokladny
PSP
```

but these do not all need implementation now.

---

# DEMO DATA

Create deterministic seed data sufficient to demonstrate the complete product.

IMPORTANT:

Do not invent fake factual claims about real political parties and present them as true.

If verified real data is unavailable during development, use clearly labeled demo entities such as:

```text
Demo Party A
Demo Party B
```

and mark all demo records visibly as:

```text
DEMO DATA
```

The schema must nevertheless support real Prague data without modification.

---

# TECH STACK

Optimize for development speed without creating a disposable codebase.

Preferred architecture:

```text
Next.js
TypeScript
PostgreSQL
Drizzle ORM or Prisma
Tailwind CSS
shadcn/ui
Zod
```

Choose either Drizzle or Prisma and explain the choice briefly.

Use:

```text
current stable supported versions
```

and pin dependency versions.

Preferred deployment:

```text
Vercel
+
managed PostgreSQL
```

The app should remain deployable elsewhere.

Avoid hard vendor coupling.

---

# ARCHITECTURE

Use a modular monolith.

Suggested boundaries:

```text
src/
  app/

  modules/
    promises/
    parties/
    elections/
    sources/
    evidence/
    assessments/
    review/
    ai/

  db/

  shared/
    validation/
    errors/
    logging/
    utils/
```

Keep domain logic outside React components.

UI components must not directly contain database logic.

AI-provider code must not contain business-domain decisions.

Database access should be encapsulated.

Prefer boring code over clever abstractions.

---

# AUTHENTICATION

Public pages require no authentication.

Admin pages require authentication.

For MVP, implement a simple secure admin authentication mechanism using the chosen platform.

Do not implement:

```text
social login
organizations
teams
RBAC matrix
```

unless required by the chosen authentication provider.

One ADMIN role is enough.

---

# API DESIGN

Use typed server-side interfaces.

Avoid unnecessary REST endpoints for internal application functionality.

Use route handlers where public API semantics are useful.

Design domain services so that a future public API can reuse them.

Example future endpoint:

```text
GET /api/v1/promises
GET /api/v1/promises/:id
```

Do not build a large public API in MVP.

---

# POLITICAL DATA INTEGRITY RULES

These rules are non-negotiable.

1. AI must never automatically publish an assessment.

2. Every published factual assertion needs evidence.

3. Original source wording must remain immutable.

4. Edited normalized text must never replace original wording.

5. Every manual status change must be recorded.

6. Every AI-generated suggestion must retain:

```text
provider
model
prompt version
timestamp
```

7. Clearly distinguish:

```text
SOURCE FACT
AI SUGGESTION
EDITORIAL ASSESSMENT
```

8. Never infer political intent.

9. Never label a politician or party as lying based solely on unmet promises.

10. Avoid aggregate party "truth scores" in MVP.

---

# SECURITY

> Obecné bezpečnostní standardy jsou v [CLAUDE.md](./CLAUDE.md) → SECURITY. Zde jen to, co je specifické pro tuto doménu.

**Ingestované dokumenty jsou nedůvěryhodná data.**

Volební programy, koaliční smlouvy a novinové články jdou do AI pipeline. Text uvnitř zdrojového dokumentu nesmí nikdy přepsat instrukce aplikace — prompt injection přes nahraný PDF je tady reálný vektor, ne teoretický.

Dále:

- rate limiting na drahé AI endpointy
- upload size limit a MIME validace na ingestion
- autentizace na všech `/admin` routách

---

# ERROR HANDLING

> Obecné zásady (konzistentní chyby, žádné stack trace uživateli, strukturované logování) jsou v [CLAUDE.md](./CLAUDE.md).

Selhané AI volání nesmí poškodit ingestion workflow.

Processing state musí podporovat:

```text
PENDING
PROCESSING
REVIEW_REQUIRED
FAILED
PUBLISHED
```

A failed job should be retryable.

---

# TESTING

> Obecná filozofie testování (testuj podle rizika, žádné pokrytí pro pokrytí) je v [CLAUDE.md](./CLAUDE.md) → TESTING. Zde je konkrétní seznam, co v tomto projektu testovat.

## Unit tests

For:

- assessability calculation
- status transitions
- coalition diff classification helpers
- evidence validation
- data normalization

## Integration tests

For:

- repositories
- ingestion pipeline
- publication workflow
- AI structured output validation

## E2E

Use Playwright.

Minimum smoke scenarios:

```text
User opens Promise Explorer
User filters promises
User opens Promise Detail
User opens Compare
Admin logs in
Admin reviews candidate promise
Admin publishes candidate promise
```

---

# CODE QUALITY

> Kompletně v [CLAUDE.md](./CLAUDE.md) → CODE QUALITY a ABSTRACTION RULE.

Pro tento projekt navíc platí povinně: **TypeScript strict mode, ESLint, Prettier**, žádná business logika uvnitř JSX.

---

# DATABASE

Use migrations.

Never mutate production schema manually.

Provide:

```text
migration command
seed command
reset development DB command
```

Add appropriate:

- indexes
- foreign keys
- unique constraints

Example indexes:

```text
Promise.partyId
Promise.electionId
Promise.topic
Promise.published
PromiseEvent.promiseId
Evidence.promiseId
SourceDocument.contentHash
```

Prevent duplicate source ingestion through content hash where appropriate.

---

# UI / UX

Visual style:

```text
clean
credible
institutional
modern
neutral
data-driven
```

Avoid partisan colors dominating the interface.

Do not make the application look like:

```text
activist campaign website
crypto dashboard
AI demo
```

Use progressive disclosure.

Evidence and methodology should always be easy to reach.

Desktop first, but responsive on mobile.

Accessibility:

- semantic HTML
- keyboard usable
- sufficient contrast
- proper labels
- accessible status indicators
- never encode status through color alone

---

# HOMEPAGE

Create a minimal homepage communicating the product immediately.

Suggested hierarchy:

```text
Slib → Skutek

Co politici slíbili.
Co se skutečně stalo.

Sledujeme cestu od volebního programu
přes politická rozhodnutí až k výsledku.

[Prozkoumat sliby]
```

Then show a small number of example promise cards.

Include a clear methodology link.

---

# METHODOLOGY PAGE

Route:

```text
/methodology
```

Explain:

- what counts as a promise
- how assessability works
- execution vs outcome
- evidence requirements
- role of AI
- role of human review
- corrections process
- limitations

This page is mandatory.

Trust is a core feature of the product.

---

# CORRECTIONS

Design the schema for corrections.

At minimum include:

```text
correction status
correction note
updatedAt
```

Public promise detail should eventually support showing:

```text
Assessment updated on DATE
Reason: ...
```

Full public correction workflows can remain outside MVP.

---

# PERFORMANCE

Do not prematurely optimize.

Still follow basic good practices:

- server-render initial public pages where beneficial
- paginate promise lists
- avoid N+1 DB queries
- cache static taxonomy/reference data
- lazy-load expensive UI
- optimize images
- avoid shipping unnecessary JavaScript

---

# OBSERVABILITY

Implement basic production observability.

At minimum:

```text
structured logs
request errors
AI processing failures
ingestion failures
```

Design so that OpenTelemetry can be added later.

Do not build a custom monitoring system.

---

# DOCUMENTATION

Create:

```text
README.md
```

with:

- project purpose
- architecture
- prerequisites
- local setup
- environment variables
- database setup
- migrations
- seed process
- tests
- deployment
- AI provider configuration

Also create:

```text
docs/architecture.md
docs/data-model.md
docs/methodology.md
```

Keep documentation concise and useful.

---

# OUT OF SCOPE FOR MVP

Do NOT implement unless absolutely required:

```text
all Czech municipalities
mobile apps
social network
comments
user voting
party trust scores
political recommendation engine
personalized ideology matching
real-time scraping of every source
graph database
microservices
Kafka
Kubernetes
complex RBAC
custom CMS
full-text political chatbot
native mobile apps
predictive political analytics
automated publication without review
```

---

# MVP SUCCESS CRITERIA

The MVP is successful when:

1. A public user can browse promises.

2. A user can open a promise and see:

```text
what was promised
who promised it
where it came from
what subsequently happened
what evidence supports the assessment
```

3. A user can visually compare election promises with a coalition agreement.

4. An admin can ingest a document.

5. AI can extract candidate promises using structured output.

6. An admin can review and publish a candidate.

7. Every published promise assessment has evidence.

8. Source documents have immutable provenance metadata.

9. The application can be deployed from a clean checkout using documented steps.

10. Tests pass.

---

# IMPLEMENTATION STRATEGY

Work in vertical slices.

Recommended sequence:

## Phase 1 — Foundation

Create:

- project
- DB
- schema
- migrations
- seed
- layout
- quality tooling

## Phase 2 — Public product

Implement:

```text
/promises
/promises/[slug]
/compare
/methodology
```

using deterministic seed data.

Make the complete user journey work before adding AI.

## Phase 3 — Admin workflow

Implement:

```text
/admin
source ingestion
candidate promise review
publication
```

## Phase 4 — AI

Add:

```text
provider abstraction
promise extraction
structured validation
evidence suggestion
```

## Phase 5 — Hardening

Add:

```text
tests
error handling
logging
security checks
README
deployment configuration
```

---

# HOW TO WORK

> Kompletně v [CLAUDE.md](./CLAUDE.md) → CORE BEHAVIOR, BEFORE WRITING CODE, DEFINITION OF DONE, FINAL RESPONSE.

Pro start tohoto projektu navíc: shrň navrhovanou architekturu max. na ~20 řádků, vypiš klíčové předpoklady, ukaž zamýšlenou strukturu adresářů — **a pak rovnou začni implementovat.** Neptej se na triviální technická rozhodnutí.

Ptej se jen tehdy, když rozhodnutí mění scope produktu, vyžaduje placenou infrastrukturu, má právní dopady, potřebuje credentials, které nemáš, nebo se nedá rozumně odvodit.

---

# FINAL ARCHITECTURAL PRINCIPLE

Build the smallest system that can credibly demonstrate this idea:

> A political promise is not merely text in an election program.
> It is a trackable object with provenance, subsequent decisions, evidence, execution and outcome.

The MVP should prove that this model works.

Do not build infrastructure that is not necessary to prove it.

---

---

# OPEN QUESTIONS

_Zapsáno 2026-08-21 po analýze briefu. Přečti dřív, než začneš stavět._

## A. Mezery v datovém modelu

Osm věcí, které schéma výše zatím neřeší. Nejsou to detaily — každá z nich se projeví, jakmile do systému přijdou reálná pražská data.

**A1 — Chybí entita pro osobu / kandidátku.**
Schéma zná jen `partyId`. Pražská realita 2022–2026 jsou ale koalice (SPOLU, PirStan), sliby dává kandidátka, ne strana, a zastupitelé mezi stranami přebíhají. Potřebuje `Person`, model koaličních kandidátek, a řešení pro přejmenování a fúze stran.

**A2 — `OutcomeStatus` nemá o co se opřít.**
Existuje `outcomeDefinitionScore`, ale nikde v schématu není `metric`, `baseline`, `targetValue`, `measuredValue`. Bez nich je „ACHIEVED" jen názor redaktora — přesně to, čemu se produkt snaží vyhnout.

**A3 — Odvození HIGH/MEDIUM/LOW/NOT_ASSESSABLE z pěti skóre není definované.**
Je to nejcitlivější editorský algoritmus v produktu. Musí být specifikovaný a **verzovaný** zde v briefu, a doslovně vypsaný na `/methodology`. Nesmí si ho vymyslet implementace.

**A4 — `PromiseAssessment` je mutable řádek bez `id`.**
Ale pravidlo integrity č. 5 říká „každá manuální změna statusu musí být zaznamenána" a sekce CORRECTIONS chce ukazovat „aktualizováno DATE, důvod". To vyžaduje append-only verzovaná hodnocení, ne jeden přepisovaný řádek.

**A5 — `Evidence.promiseId` a `PromiseEvent.evidenceId` jsou 1:1, realita je M:N.**
Jedna rozpočtová položka financuje pět slibů; jedna událost má tři zdroje. Potřebuje spojovací tabulky.

**A6 — AI provenance nemá kam ukládat.**
Pravidlo integrity č. 6 vyžaduje uchovat `provider`, `model`, `prompt version`, `timestamp` u každého AI návrhu. Žádná entita v schématu na to nemá místo. Chybí `AiSuggestion` / `AiRun`.

**A7 — `/compare` implicitně vytváří skóre.**
Počty `NOT_INCLUDED` na stranu jsou de facto žebříček, což je v rozporu s pravidlem integrity č. 10 („žádná agregovaná truth scores"). Potřebuje vědomé rozhodnutí, jestli se ta čísla vůbec zobrazí a jak.

**A8 — Chybí `Correction` entita a workflow.**
Brief korekce odsouvá mimo MVP. To je pravděpodobně chyba: u produktu, kde je důvěra hlavní feature, je opravný mechanismus součástí MVP, ne fáze 6.

## B. Právní a governance vrstva — nejvyšší reálné riziko

Produkt dělá veřejná tvrzení o jmenovaných politicích a stranách. Brief tuhle vrstvu neřeší vůbec. Kritici zaútočí sem, ne na kód.

**B1 — Právo na odpověď.** Jak se strana nebo politik dozví, že o nich publikujeme hodnocení, a jak se ozvou?

**B2 — Autorská práva ke zdrojům.** Brief říká „original text where permitted". Volební program a koaliční smlouva jsou politické dokumenty. Článek z Deníku N není. Potřebuje pravidlo, co se ukládá celé a co jen jako odkaz + krátký citát.

**B3 — Editorial governance.** Kdo je „reviewer"? Platí pravidlo čtyř očí na změnu statusu? Jak se řeší střet zájmů recenzenta? Celý argument důvěryhodnosti stojí na lidské revizi, ale ta revize nemá definovaná pravidla.

**B4 — Osobní údaje.** Veřejní činitelé mají výjimku, ale zpracování pořád potřebuje právní základ a záznam o zpracování.

## C. Rozhodnutí čekající na zadavatele

| #   | Otázka                                         | Výchozí varianta, pokud neřekneš jinak              |
| --- | ---------------------------------------------- | --------------------------------------------------- |
| C1  | Reálná pražská data, nebo demo entity?         | `Demo Party A/B` — reálná data nelze offline ověřit |
| C2  | Mezery A1–A8 opravit samostatně, nebo probrat? | **Vyřešeno v schématu 2026-08-21** — viz DECISIONS LOG |
| C3  | Postgres — Docker, nebo hostovaná instance?    | Docker lokálně, Neon pro deploy                     |
| C4  | Drizzle, nebo Prisma?                          | Drizzle                                             |

## D. Ekonomika projektu — ověřeno 2026-08-21

Závěr: **náklady nejsou riziko tohoto projektu.**

- **Infrastruktura:** Vercel Hobby + Neon/Supabase free tier = **0 Kč/měsíc** pro MVP.
  Pozor: Vercel Hobby zakazuje komerční užití. Jakmile přibudou dary nebo transparentní účet, je potřeba Pro ($20/měsíc).
- **AI:** běží výhradně dávkově v adminu, nikdy v request path veřejné aplikace. Náklad tedy neškáluje s návštěvností, ale s počtem zpracovaných dokumentů.
  Jeden volební program ≈ 50–70k tokenů vstupu, ~40k výstupu. Přes Batch API (−50 %): Haiku 4.5 ~$0,13/dokument, Sonnet 5 ~$0,35, Opus 5 ~$0,65.
  **Celý pražský korpus (~10 dokumentů) vyjde pod $10 i na nejdražším modelu.**
- **Evidence matching** je opakovaný náklad, ale s prompt cachingem (seznam slibů jako cachovaný prefix) vychází nový zdroj na jednotky centů.

### Vývoj bez pálení tokenů

`AIProvider` interface má tři implementace:

| Provider            | Použití                                                                                | Cena             |
| ------------------- | -------------------------------------------------------------------------------------- | ---------------- |
| `FixtureAIProvider` | Předpřipravené JSON odpovědi z `fixtures/`. **Default ve všech testech a v dev módu.** | 0                |
| `LocalAIProvider`   | OpenAI-kompatibilní endpoint (Ollama). Ověření, že pipeline funguje s reálným modelem. | 0                |
| `AnthropicProvider` | Skutečná extrakce, když jde o kvalitu publikovatelného výstupu.                        | ~$10 jednorázově |

Fixture provider pokryje ~95 % vývoje. Není to workaround — je to standardní praxe u čehokoli s placenou externí závislostí.

**Lokální model** (hardware zadavatele: RTX 3060 Laptop, 6 GB VRAM, 15 GB RAM): použitelný, ale těsný. Vejde se Qwen3 8B nebo Llama 3.1 8B v Q4_K_M (~4,9 GB), nikoli 14B. Omezením není velikost modelu, ale kontext — program se musí chunkovat na ~2000tokenové kusy, což je stejně potřeba kvůli přesným `sourceExcerpt` a číslům stránek. Kvalita bude průměrná, ale všechno stejně prochází lidskou revizí. **Je to nice-to-have, ne nutnost.**

## E. Skutečná rizika projektu

1. **Editorská práce, ne technologie.** Postavit aplikaci je definovaný úkol. Naplnit ji ověřenými sliby s doloženým řetězcem důkazů je ruční rešerše — reálně hodiny na jeden slib. Sto slibů je několik týdnů.
2. **Extrakce textu z PDF.** Pražské volební programy jsou PDF různé kvality. Získat z nich čistý text s čísly stránek je skrytý žrout času, který v briefu není nikde vidět.
3. **Právní expozice** — sekce B výše.

---

# DECISIONS LOG

| Datum      | Rozhodnutí                                                                                                                  | Důvod                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 2026-08-21 | Role prompt oddělen do `CLAUDE.md`, brief zúžen na produkt a doménu                                                         | Dva zdroje pravdy se rozejdou; CLAUDE.md se navíc načítá automaticky |
| 2026-08-21 | Inženýrské sekce (CODE QUALITY, SECURITY, TESTING, HOW TO WORK, DEFINITION OF DONE) z briefu odstraněny a nahrazeny odkazem | Duplikovaly CLAUDE.md; doménově specifické části ponechány           |
| 2026-08-21 | Mezery A1–A8 vyřešeny v schématu, ne odloženy                                                                                | Každá z nich by se projevila při prvním reálném dokumentu; oprava schématu po naplnění daty je dražší |
| 2026-08-21 | A3: váhy 25/30/20/15/10, prahy 4,0 / 2,5 / 1,2, dvě vstupní brány a tři stropy; metodika verze 1.0.0                        | Průměr sám lže — slib s nulovou měřitelností by vyšel jako dobře hodnotitelný. Stropy smí jen snižovat |
| 2026-08-21 | A7: `/compare` nezobrazuje žádné souhrnné počty klasifikací ani dvě kandidátky vedle sebe                                    | „NOT_INCLUDED: 7" je fakticky žebříček důvěryhodnosti, což zakazuje integritní pravidlo č. 10       |
| 2026-08-21 | A8: `correction` je součástí MVP, ne fáze 6                                                                                  | U produktu, kde je důvěra hlavní feature, je opravný mechanismus feature, ne dodatek                |
| 2026-08-21 | Sloupec `is_demo` na `party` a `source_document`                                                                             | Požadavek „mark all demo records visibly". Je to provenience, ne vývojářský příznak                 |
| 2026-08-21 | Sloupec `ai_suggestion_id` na `promise`                                                                                      | Integritní pravidlo č. 7 — kandidát vytěžený AI neměl kam uložit původ                              |
| 2026-08-21 | Pravidlo konzistence: stav plnění tvrdící aktivitu vyžaduje ověřený důkaz; nezahájený slib ne                               | Integritní pravidlo č. 2. Nepřítomnost kroku zdrojem doložit nejde a vyžadovat to by nutilo důkaz vymyslet |
| 2026-08-21 | Integrační testy proti PGlite místo Dockeru                                                                                  | Schéma stojí na triggerech a constraintech; mock by neověřil nic, Docker není v prostředí dostupný  |
| 2026-08-21 | Veřejné stránky čtoucí z DB se vykreslují dynamicky (`force-dynamic`)                                                        | Build nesmí vyžadovat dostupnou databázi a publikovaný slib nemá čekat na další nasazení           |
| 2026-08-21 | Metodika žije jako stránka `/methodology`, ne jako `docs/methodology.md`                                                     | Váhy a prahy se importují z kódu. Druhý zdroj pravdy by se po první změně vah rozešel               |
| 2026-08-21 | Přidán stav `NO_VERIFIED_PROGRESS`; `NOT_STARTED` nově vyžaduje doložený zdroj, hodnocení nese rozhodné datum | „Nezahájeno" tvrdí něco o městě, ale systém ví jen to, že nenašel doklad. Projekt může běžet interně dřív, než o něm vznikne usnesení |
| 2026-08-21 | Fáze 3: explicitní `workflow_state` na hodnocení místo odvozování z prázdných polí                                            | „reviewed_by_id je NULL" neodliší čekání na revizi od přepisování po vrácení                        |
| 2026-08-21 | Append-only zpřesněno: publikovaná verze neměnná navždy, rozpracovaná měnitelná (identita a autorství ne)                  | Původní pravidlo znemožňovalo workflow — každý překlep by zakládal novou verzi a zaplnil historii   |
| 2026-08-21 | Bez rolí. Pravidlo čtyř očí drží CHECK constraint nad dvojicí autor–schvalovatel                                            | „Nikdo neschvaluje vlastní práci" je vlastnost dvojice, ne uživatele; matice oprávnění by nic nepřidala |
| 2026-08-21 | Vlastní minimální autentizace (scrypt + session tabulka) místo auth knihovny                                                | Potřeba je přihlášení, odhlášení a session. Auth.js by přinesl konfiguraci a adaptér navíc bez užitku |
| 2026-08-21 | `UNKNOWN` u stavu plnění zůstává v enumu, ale nelze ho publikovat                                                            | Je to stav rozpracovanosti, ne závěr. Odstranění hodnoty z Postgres enumu je riziková migrace bez přínosu |
| 2026-08-21 | Migrace smí dočasně vypnout append-only trigger jen kvůli backfillu metadat vyžadovaných schématem                          | Aplikační redakční kód takovou možnost nikdy nedostane; podmínky v docs/architecture.md            |
| 2026-08-21 | Rate limiting přihlášení v databázi (5/e-mail, 20/IP za 15 min), ukládá se otisk adresy                                     | Na Vercelu je čítač v paměti po cold startu k ničemu; scrypt je drahý schválně, takže formulář je bez limitu i DoS vektor |
| 2026-08-21 | E2E testy proti PGlite vystavenému přes wire protokol, ne proti Dockeru                                                     | Stejná strategie jako u zbytku testů; `npm run test:e2e` funguje na čistém stroji bez služeb |
| 2026-08-21 | Snímky obrazovek jako nástroj, ne jako snapshot testy                                                                       | Porovnávání pixelů u stránky, která se mění s obsahem, generuje hlavně falešné poplachy |
| 2026-08-21 | Veřejné stránky přesunuty do route group `(public)`, URL beze změny                                                          | Redakční konzole je jiná aplikace pro jiné publikum; veřejná patička nad ní nedávala smysl |
| 2026-08-21 | Extrakce PDF deterministicky přes pdf.js, nikdy modelem                                                                     | Model v tomhle kroku smaže rozdíl mezi tím, co v dokumentu stojí, a tím, co dopsal |
| 2026-08-21 | Kanonický text se stránkami a lokálními posuny; normalizace jen jako odvozená vrstva bez vkládání znaků                     | Citace musí ukazovat na konkrétní místo konkrétní verze; vkládání by rozbilo mapování zpět |
| 2026-08-21 | OCR se nepřidává, dokud reálný dokument nedoloží, že je potřeba. Extrakce hlásí stránky bez textové vrstvy                  | Velká závislost naslepo. Hlášení dá doložený důvod místo domněnky |
| 2026-08-21 | Zlatý dataset obsahuje i protipříklady (`NOT_PROMISE`) a měří se věrnost citací a podíl citací bez opory                    | Bez protipříkladů vypadá dobře i extraktor, který označí půl dokumentu; upravená citace je horší než chybějící kandidát |
| 2026-08-21 | Heuristická laťka výčtem sloves, ne koncovkou                                                                              | Pravidlo „končí na -íme" chytá i „myslíme" a „nesouhlasíme", což jsou postoje, ne závazky |
