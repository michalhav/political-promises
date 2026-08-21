/**
 * Databázové záruky.
 *
 * Integritní pravidla briefu (č. 3 a 5) říkají, že doslovné znění slibu je po
 * publikaci neměnné a že každá změna hodnocení musí zůstat dohledatelná.
 * Aplikační vrstva se dá obejít migračním skriptem nebo ruční SQL opravou —
 * jediné, co ta pravidla drží, jsou constrainty a triggery. Tenhle soubor
 * ověřuje, že drží doopravdy.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";

let handle: TestDatabaseHandle;

const publishedPromiseId = seedId("promise:byty");
const currentAssessmentId = seedId("assessment:byty:v2");
const previousAssessmentId = seedId("assessment:byty:v1");

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("migrace", () => {
  it("vytvoří tabulky i triggery", async () => {
    const tables = await handle.client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    expect(tables.rows.map((row) => row.table_name)).toContain("promise");

    const triggers = await handle.client.query<{ tgname: string }>(
      "select tgname from pg_trigger where not tgisinternal",
    );
    expect(triggers.rows.map((row) => row.tgname)).toEqual(
      expect.arrayContaining([
        "promise_original_text_immutable",
        "promise_assessment_append_only",
        "audit_log_append_only",
        "review_decision_append_only",
      ]),
    );
  });
});

describe("neměnnost publikovaného slibu (pravidlo č. 3)", () => {
  it("nedovolí přepsat doslovné znění", async () => {
    await expect(
      handle.client.query("update promise set original_text = $1 where id = $2", [
        "Přepsané znění.",
        publishedPromiseId,
      ]),
    ).rejects.toThrow(/original_text je po publikaci neměnný/);
  });

  it("nedovolí zamlčet, že slib byl publikovaný", async () => {
    await expect(
      handle.client.query("update promise set published_at = null where id = $1", [
        publishedPromiseId,
      ]),
    ).rejects.toThrow(/published_at nelze vymazat/);
  });

  it("redakční přeformulování měnit lze", async () => {
    await expect(
      handle.client.query("update promise set normalized_statement = $1 where id = $2", [
        "Upřesněná formulace.",
        publishedPromiseId,
      ]),
    ).resolves.toBeDefined();
  });
});

describe("append-only hodnocení (pravidlo č. 5, A4)", () => {
  it("nedovolí přepsat skóre publikované verze", async () => {
    await expect(
      handle.client.query("update promise_assessment set specificity_score = 1 where id = $1", [
        currentAssessmentId,
      ]),
    ).rejects.toThrow(/publikované hodnocení .* je neměnné/);
  });

  it("rozpracovanou verzi upravit lze — veřejně zatím nic netvrdí", async () => {
    const draftId = seedId("test:draft-assessment");
    await handle.client.query(
      `insert into promise_assessment
         (id, promise_id, version, specificity_score, measurability_score, deadline_score,
          jurisdiction_score, outcome_definition_score, assessability, methodology_version,
          workflow_state, sources_reviewed_up_to, execution_status, outcome_status,
          change_reason, created_by_id, is_current)
       values ($1, $2, 50, 3, 3, 3, 3, 3, 'MEDIUM', '1.0.0', 'DRAFT', '2026-08-21',
               'IN_PROGRESS', 'UNKNOWN', 'test', $3, false)`,
      [draftId, publishedPromiseId, seedId("user:redaktor-1")],
    );

    await expect(
      handle.client.query("update promise_assessment set specificity_score = 4 where id = $1", [
        draftId,
      ]),
    ).resolves.toBeDefined();
  });

  it("ani u rozpracované verze nejde přepsat autorství", async () => {
    await expect(
      handle.client.query("update promise_assessment set created_by_id = $1 where id = $2", [
        seedId("user:redaktor-2"),
        seedId("test:draft-assessment"),
      ]),
    ).rejects.toThrow(/autorství/);
  });

  it("nedovolí verzi smazat", async () => {
    await expect(
      handle.client.query("delete from promise_assessment where id = $1", [currentAssessmentId]),
    ).rejects.toThrow(/append-only/);
  });

  it("nedovolí oživit starší verzi jako aktuální", async () => {
    await expect(
      handle.client.query("update promise_assessment set is_current = true where id = $1", [
        previousAssessmentId,
      ]),
    ).rejects.toThrow(/nelze znovu zveřejnit/);
  });

  it("nepustí dvě aktuální hodnocení téhož slibu", async () => {
    await expect(
      handle.client.query(
        `insert into promise_assessment
           (promise_id, version, specificity_score, measurability_score, deadline_score,
            jurisdiction_score, outcome_definition_score, assessability, methodology_version,
            sources_reviewed_up_to, execution_status, outcome_status, change_reason,
            created_by_id, reviewed_by_id, reviewed_at, workflow_state, is_current)
         values ($1, 99, 3, 3, 3, 3, 3, 'MEDIUM', '1.0.0', '2026-08-21', 'IN_PROGRESS',
                 'UNKNOWN', 'test', $2, $3, now(), 'PUBLISHED', true)`,
        [publishedPromiseId, seedId("user:redaktor-1"), seedId("user:redaktor-2")],
      ),
    ).rejects.toThrow(/promise_assessment_current_uq/);
  });

  it("nepustí rozpracované hodnocení jako aktuální", async () => {
    // Aktuální verze je ta, kterou vidí veřejnost. Rozpracovaná se tam nesmí
    // dostat ani omylem.
    await expect(
      handle.client.query(
        `insert into promise_assessment
           (promise_id, version, specificity_score, measurability_score, deadline_score,
            jurisdiction_score, outcome_definition_score, assessability, methodology_version,
            sources_reviewed_up_to, execution_status, outcome_status, change_reason,
            created_by_id, workflow_state, is_current)
         values ($1, 96, 3, 3, 3, 3, 3, 'MEDIUM', '1.0.0', '2026-08-21', 'IN_PROGRESS',
                 'UNKNOWN', 'test', $2, 'DRAFT', true)`,
        [publishedPromiseId, seedId("user:redaktor-1")],
      ),
    ).rejects.toThrow(/current_is_published/);
  });

  it("publikovaná verze musí mít schvalovatele", async () => {
    await expect(
      handle.client.query(
        `insert into promise_assessment
           (promise_id, version, specificity_score, measurability_score, deadline_score,
            jurisdiction_score, outcome_definition_score, assessability, methodology_version,
            sources_reviewed_up_to, execution_status, outcome_status, change_reason,
            created_by_id, workflow_state, is_current)
         values ($1, 95, 3, 3, 3, 3, 3, 'MEDIUM', '1.0.0', '2026-08-21', 'IN_PROGRESS',
                 'UNKNOWN', 'test', $2, 'PUBLISHED', false)`,
        [publishedPromiseId, seedId("user:redaktor-1")],
      ),
    ).rejects.toThrow(/published_is_reviewed/);
  });

  it("vyžaduje důvod změny od druhé verze výš", async () => {
    await expect(
      handle.client.query(
        `insert into promise_assessment
           (promise_id, version, specificity_score, measurability_score, deadline_score,
            jurisdiction_score, outcome_definition_score, assessability, methodology_version,
            sources_reviewed_up_to, execution_status, outcome_status, created_by_id, is_current)
         values ($1, 98, 3, 3, 3, 3, 3, 'MEDIUM', '1.0.0', '2026-08-21', 'IN_PROGRESS',
                 'UNKNOWN', $2, false)`,
        [publishedPromiseId, seedId("user:redaktor-1")],
      ),
    ).rejects.toThrow(/change_reason/);
  });

  it("nedovolí, aby hodnocení schválil jeho vlastní autor (B3)", async () => {
    const editor = seedId("user:redaktor-1");
    await expect(
      handle.client.query(
        `insert into promise_assessment
           (promise_id, version, specificity_score, measurability_score, deadline_score,
            jurisdiction_score, outcome_definition_score, assessability, methodology_version,
            sources_reviewed_up_to, execution_status, outcome_status, change_reason,
            created_by_id, reviewed_by_id, reviewed_at, is_current)
         values ($1, 97, 3, 3, 3, 3, 3, 'MEDIUM', '1.0.0', '2026-08-21', 'IN_PROGRESS',
                 'UNKNOWN', 'test', $2, $2, now(), false)`,
        [publishedPromiseId, editor],
      ),
    ).rejects.toThrow(/four_eyes/);
  });
});

describe("audit", () => {
  it("nedovolí smazat záznam auditu", async () => {
    await expect(handle.client.query("delete from audit_log")).rejects.toThrow(/append-only/);
  });

  it("nedovolí přepsat review rozhodnutí", async () => {
    await expect(handle.client.query("update review_decision set note = 'jinak'")).rejects.toThrow(
      /append-only/,
    );
  });
});

describe("doložitelnost", () => {
  it("nedovolí označit vazbu za ověřenou bez uvedení, kdo ji ověřil", async () => {
    await expect(
      handle.client.query(
        `insert into promise_evidence (promise_id, evidence_id, relation_type, human_verified)
         values ($1, $2, 'CONTEXT', true)`,
        [publishedPromiseId, seedId("evidence:zprava-byty")],
      ),
    ).rejects.toThrow(/verified_has_reviewer/);
  });

  it("nedovolí uložit plný text u dokumentu bez licence (B2)", async () => {
    await expect(
      handle.client.query(
        `insert into source_document
           (source_type, title, publisher, retrieved_at, content_hash, license_mode, raw_text)
         values ('MEDIA_REPORT', 'Test', 'Test', now(), repeat('a', 64), 'QUOTE_ONLY', 'text')`,
      ),
    ).rejects.toThrow(/quote_only_has_no_raw_text/);
  });

  it("nedovolí dva primární zdroje jednoho slibu", async () => {
    await expect(
      handle.client.query(
        `insert into promise_source (promise_id, source_document_id, excerpt, is_primary)
         values ($1, $2, 'citát', true)`,
        [publishedPromiseId, seedId("source:rozpocet-2024")],
      ),
    ).rejects.toThrow(/promise_source_primary_uq/);
  });

  it("nedovolí zaznamenat stejný dokument dvakrát (kontrola podle hashe)", async () => {
    await expect(
      handle.client.query(
        `insert into source_document
           (source_type, title, publisher, retrieved_at, content_hash, license_mode)
         select 'OTHER', 'Duplicita', 'Test', now(), content_hash, 'QUOTE_ONLY'
         from source_document limit 1`,
      ),
    ).rejects.toThrow(/content_hash_uq/);
  });
});

describe("klasifikace vůči koaliční smlouvě", () => {
  it("nedovolí tvrdit převzetí slibu bez místa v koaliční smlouvě", async () => {
    await expect(
      handle.client.query(
        `insert into coalition_promise_mapping
           (promise_id, coalition_source_document_id, classification, reason)
         values ($1, $2, 'RETAINED', 'bez důkazu')`,
        [seedId("promise:kamery"), seedId("source:koalicni-smlouva-2022")],
      ),
    ).rejects.toThrow(/needs_evidence_unless_absent/);
  });

  it("u nezahrnutého slibu důkaz nevyžaduje", async () => {
    await expect(
      handle.client.query(
        `insert into coalition_promise_mapping
           (promise_id, coalition_source_document_id, classification, reason)
         values ($1, $2, 'NOT_INCLUDED', 'Koaliční smlouva se k tomu nevyjadřuje.')`,
        [seedId("promise:kamery"), seedId("source:koalicni-smlouva-2022")],
      ),
    ).resolves.toBeDefined();
  });
});
