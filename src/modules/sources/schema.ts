/**
 * Zdrojový dokument = jediný nosič provenience. Bez něj nesmí vzniknout
 * žádné publikované tvrzení (integritní pravidlo č. 1 a 2).
 */
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "@/db/columns";
import { licenseModeEnum, processingStateEnum, sourceTypeEnum } from "@/db/enums";

export const sourceDocuments = pgTable(
  "source_document",
  {
    id: pk(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    publisher: varchar("publisher", { length: 200 }).notNull(),
    url: text("url"),
    publishedAt: date("published_at", { mode: "string" }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    /** SHA-256 hex. Zabraňuje duplicitnímu ingestu téhož dokumentu. */
    contentHash: char("content_hash", { length: 64 }).notNull(),
    /**
     * B2 — plný text držíme jen u dokumentů, kde to jde právně obhájit
     * (volební program, koaliční smlouva, usnesení). U chráněných děl zůstává NULL
     * a pracuje se jen s krátkým citátem v Evidence. Vynuceno CHECK constraintem níž.
     */
    licenseMode: licenseModeEnum("license_mode").notNull(),
    rawText: text("raw_text"),
    mimeType: varchar("mime_type", { length: 120 }),
    byteSize: bigint("byte_size", { mode: "number" }),
    pageCount: integer("page_count"),
    /** Smyšlený dokument z ukázkového datasetu — nikdy nesmí být zaměnitelný se skutečným záznamem. */
    isDemo: boolean("is_demo").notNull().default(false),
    /**
     * Původ u dokumentu staženého z webového archivu.
     *
     * Archivní kopie není totéž co dokument od vydavatele: za shodu
     * s originálem ručí třetí strana a snímek je z konkrétního dne. Čtenář to
     * musí u citace vidět, proto to jsou sloupce, ne položka v metadatech.
     *
     * `url` zůstává tím, odkud jsme skutečně stahovali (adresa snímku);
     * `archiveOriginalUrl` je adresa, na které dokument vydal vydavatel.
     */
    archiveService: varchar("archive_service", { length: 120 }),
    archiveOriginalUrl: text("archive_original_url"),
    archiveSnapshotAt: timestamp("archive_snapshot_at", { withTimezone: true }),
    processingState: processingStateEnum("processing_state").notNull().default("PENDING"),
    processingError: text("processing_error"),
    metadataJson: jsonb("metadata_json"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("source_document_content_hash_uq").on(t.contentHash),
    index("source_document_type_idx").on(t.sourceType),
    index("source_document_state_idx").on(t.processingState),
    check(
      "source_document_quote_only_has_no_raw_text",
      sql`${t.licenseMode} = 'FULL_TEXT_STORED' OR ${t.rawText} IS NULL`,
    ),
    // Archivní původ platí celý, nebo vůbec. Půlka údaje je horší než žádný:
    // dokument by tvrdil, že je z archivu, ale neřekl by z jakého a odkdy.
    check(
      "source_document_archive_origin_complete",
      sql`(${t.archiveService} IS NULL AND ${t.archiveOriginalUrl} IS NULL AND ${t.archiveSnapshotAt} IS NULL)
          OR (${t.archiveService} IS NOT NULL AND ${t.archiveOriginalUrl} IS NOT NULL AND ${t.archiveSnapshotAt} IS NOT NULL)`,
    ),
  ],
);

export const sourceDocumentRelations = relations(sourceDocuments, () => ({}));
