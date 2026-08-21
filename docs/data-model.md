# Datový model

Postgres 17, Drizzle ORM. Schéma žije v `src/modules/*/schema.ts`, barrel pro generátor migrací je `src/db/schema.ts`.

## Kdo dal slib

```text
jurisdiction ──< election ──< electoral_list ──< electoral_list_party >── party
                                    │                                      │
                                    └──< promise                    party_lineage
```

Slib patří **kandidátce** (`electoral_list`), ne straně. V komunálních volbách kandidují koalice, takže „strana, která to slíbila" často neexistuje jako jeden subjekt. Strany za kandidátkou se dohledají přes `electoral_list_party`.

`party_lineage` zaznamenává přejmenování, fúze a štěpení stran. Bez toho by slib z roku 2022 po přejmenování strany přestal patřit tomu, kdo ho vyslovil.

`person` a `person_role` drží osoby a jejich funkce ve volebním období. Přeběh mezi kluby je ukončená role a nová role, nikdy přepsaný řádek — jinak zmizí historie. Datum narození se vědomě neukládá, na rozlišení jmenovců stačí rok.

## Co bylo slíbeno a čím je to doložené

```text
source_document ──< promise_source >── promise
        │                                 │
        ├──< evidence ──< promise_evidence >┤
        │        │                          │
        │        └──< promise_event_evidence >── promise_event
        │
        └──< metric_measurement >── promise_metric >── promise
```

| Tabulka                  | K čemu                                                                       |
| ------------------------ | ---------------------------------------------------------------------------- |
| `source_document`        | Jediný nosič provenience. Bez něj nesmí vzniknout žádné publikované tvrzení. |
| `promise_source`         | Kde přesně slib ve zdroji stojí. Právě jeden primární zdroj na slib.         |
| `evidence`               | Konkrétní místo ve zdroji, o které se opírá tvrzení.                        |
| `promise_evidence`       | Vazba důkaz ↔ slib. **M:N** — jedna rozpočtová položka financuje víc slibů. |
| `promise_event`          | Časová osa slibu.                                                            |
| `promise_event_evidence` | Vazba důkaz ↔ událost. Také M:N — jedna událost stojí na víc zdrojích.      |
| `promise_metric`         | Závazek přepsaný do měřitelné podoby: co, odkud kam, do kdy.                 |
| `metric_measurement`     | Naměřená hodnota. Zdroj je **povinný** — jinak by šlo číslo vymyslet.        |

Bez metriky a naměřené hodnoty je „dosaženo" jen názor redaktora. Proto pravidla konzistence v `modules/assessments/statusRules.ts` výrok o výsledku bez měření nepustí.

## Hodnocení

`promise_assessment` je **append-only verzovaná** tabulka, ne přepisovaný řádek. Změna hodnocení vytvoří novou verzi s uvedeným důvodem; starší verze zůstává čitelná a veřejně dostupná.

Pět skóre (0–5) zadává člověk. Výsledný stupeň hodnotitelnosti se z nich odvozuje **deterministicky** funkcí `deriveAssessability`; ukládá se spolu s verzí metodiky, která ho vyrobila.

`sources_reviewed_up_to` je rozhodné datum rešerše — ke kterému dni jsme zdroje procházeli. Není to totéž co `created_at`: hodnocení může vzniknout později, než kam sahá rešerše. Bez rozhodného data by byl stav plnění nedatovaný výrok a zítřejší usnesení by ho tiše popřelo.

Stav `NO_VERIFIED_PROGRESS` mluví o stavu našich zdrojů („nenašli jsme doklad o realizaci"), `NOT_STARTED` o stavu města („realizace nezačala"). Druhý bez doloženého zdroje neprojde pravidly v `statusRules.ts`.

`workflow_state` je explicitní redakční stav (`DRAFT → IN_REVIEW → CHANGES_REQUESTED → APPROVED → PUBLISHED`). Odvozovat ho z prázdných sloupců nejde: „`reviewed_by_id` je NULL" neumí odlišit hodnocení čekající na revizi od hodnocení, které se po vrácení právě přepisuje.

## Redakční vrstva

| Tabulka           | K čemu                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| `app_user`        | Redakční účet a otisk hesla. Role vědomě nejsou — viz architecture.md.     |
| `app_session`     | Přihlašovací session. V databázi jen otisk tokenu, nikdy token sám.        |
| `review_decision` | Co kdo rozhodl. Append-only.                                               |
| `audit_log`       | Záměrně polymorfní (`entity_type` + `entity_id` bez cizího klíče) — jinak by při smazání entity zmizel právě ten záznam, kvůli kterému audit existuje. |
| `correction`      | Opravy zvenčí, reakce dotčených kandidátek i interní revize.               |

## AI

`ai_run` je jedno volání modelu (co šlo dovnitř, co stálo, jak dopadlo), `ai_suggestion` jeden konkrétní návrh z toho běhu. Odkaz na návrh nese `promise.ai_suggestion_id`, `promise_evidence.ai_suggestion_id`, `promise_assessment.ai_suggestion_id` a `coalition_promise_mapping.ai_suggestion_id` — u každého záznamu tak zůstává dohledatelné, jestli ho navrhl stroj nebo napsal člověk.

## Záruky vynucené databází

Aplikační vrstva se dá obejít. Následující pravidla drží schéma samo:

| Záruka                                                | Jak                                                     |
| ----------------------------------------------------- | ------------------------------------------------------- |
| Publikované znění slibu je neměnné                    | trigger `promise_original_text_immutable`                |
| `published_at` nelze vymazat                          | tentýž trigger                                          |
| **Publikovanou** verzi nelze přepsat ani smazat       | trigger `promise_assessment_append_only`                |
| U rozpracované verze nelze změnit identitu ani autora | tentýž trigger                                          |
| Starší verzi nelze oživit jako aktuální               | tentýž trigger                                          |
| Právě jedna aktuální verze na slib                    | částečný unique index `promise_assessment_current_uq`   |
| Aktuální verze musí být publikovaná                   | CHECK `promise_assessment_current_is_published`         |
| Publikovaná verze musí mít schvalovatele              | CHECK `promise_assessment_published_is_reviewed`        |
| Od verze 2 je povinný důvod změny                     | CHECK `promise_assessment_change_reason_from_v2`        |
| Hodnocení neschválí jeho autor (pravidlo čtyř očí)    | CHECK `promise_assessment_four_eyes`                    |
| Audit a rozhodnutí nejdou měnit                       | triggery `audit_log_append_only`, `review_decision_append_only` |
| Ověřená vazba musí uvádět, kdo ji ověřil              | CHECK `promise_evidence_verified_has_reviewer`          |
| U dokumentu bez licence se neuloží plný text          | CHECK `source_document_quote_only_has_no_raw_text`      |
| Tentýž dokument nejde nahrát dvakrát                  | unique index nad `content_hash`                         |
| „Převzato" nevznikne bez místa v koaliční smlouvě     | CHECK `coalition_mapping_needs_evidence_unless_absent`  |
| Slib nemůže být sloučený sám do sebe                  | CHECK `promise_not_merged_into_self`                    |

Všechny jsou pokryté testy v `src/db/schema.integration.test.ts`.

### Proč je rozpracovaná verze měnitelná

Původně mrazil trigger každé hodnocení od okamžiku vzniku. To ale znemožňuje redakční workflow: hodnocení vrácené k přepracování by muselo pokaždé zakládat novou verzi a historie by se zaplnila šumem z překlepů. Skutečný invariant je užší a od migrace `0004` platí takto:

- **publikovaná verze je neměnná navždy** (jediná povolená změna je zhasnutí `is_current`, když ji nahradí novější),
- **rozpracovaná verze se upravovat smí**, protože veřejně zatím nic netvrdí — ale ani u ní nejde změnit identita, pořadí verze ani autorství, jinak by šlo podstrčit cizí práci pod svým jménem a obejít pravidlo čtyř očí.

## Ukázková data

`party.is_demo` a `source_document.is_demo` označují smyšlené záznamy. Není to vývojářský příznak, ale součást provenience: uživatel musí poznat, že jméno neoznačuje skutečnou politickou stranu a dokument není skutečný veřejný záznam. UI to zobrazuje u každého výskytu.
