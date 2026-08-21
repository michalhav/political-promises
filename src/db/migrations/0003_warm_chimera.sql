-- Rozlišení "nenašli jsme důkaz o realizaci" od "realizace nezačala".
--
-- NOT_STARTED je tvrzení o světě. Systém ale zpravidla ví jen to, že o realizaci
-- nenašel veřejný doklad — projekt může běžet interně dřív, než o něm vznikne
-- usnesení. NO_VERIFIED_PROGRESS mluví o stavu našich zdrojů, ne o stavu města.
ALTER TYPE "public"."execution_status" ADD VALUE 'NO_VERIFIED_PROGRESS' BEFORE 'NOT_STARTED';--> statement-breakpoint

-- Rozhodné datum rešerše. Ke sloupci se dostaneme ve třech krocích, protože
-- NOT NULL bez výchozí hodnoty by na existujících řádcích neprošlo.
ALTER TABLE "promise_assessment" ADD COLUMN "sources_reviewed_up_to" date;--> statement-breakpoint

-- Trigger z migrace 0001 dělá z promise_assessment append-only tabulku, takže
-- blokuje i tenhle backfill. To je správně: jinak by šlo hodnocení přepsat pod
-- záminkou migrace. Vypínáme ho proto vědomě a jen na dobu doplnění, uvnitř téže
-- transakce — mimo ni tedy neexistuje okamžik, kdy by pravidlo neplatilo.
ALTER TABLE "promise_assessment" DISABLE TRIGGER "promise_assessment_append_only";--> statement-breakpoint

-- U existujících záznamů je nejlepší dostupný odhad den vzniku hodnocení.
UPDATE "promise_assessment"
  SET "sources_reviewed_up_to" = ("created_at" AT TIME ZONE 'Europe/Prague')::date
  WHERE "sources_reviewed_up_to" IS NULL;--> statement-breakpoint

ALTER TABLE "promise_assessment" ENABLE TRIGGER "promise_assessment_append_only";--> statement-breakpoint

ALTER TABLE "promise_assessment" ALTER COLUMN "sources_reviewed_up_to" SET NOT NULL;
