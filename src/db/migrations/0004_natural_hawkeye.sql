-- Fáze 3: redakční workflow, přihlašování a zpřesnění append-only pravidla.

CREATE TYPE "public"."assessment_workflow_state" AS ENUM('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED');--> statement-breakpoint

CREATE TABLE "app_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "password_hash" varchar(512);--> statement-breakpoint
ALTER TABLE "promise_assessment" ADD COLUMN "workflow_state" "assessment_workflow_state" DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_session" ADD CONSTRAINT "app_session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_session_token_hash_uq" ON "app_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "app_session_user_idx" ON "app_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "app_session_expires_idx" ON "app_session" USING btree ("expires_at");--> statement-breakpoint

-- Backfill. Všechno, co v tabulce dosud je, prošlo revizí a bylo publikováno;
-- výchozí DRAFT by u těchto řádků byl nepravdivý a rozbil by CHECK níž.
--
-- Trigger z migrace 0001 update blokuje, proto ho vypínáme — jen tady, jen na
-- dobu doplnění a uvnitř téže transakce. Platí pravidlo z docs/architecture.md:
-- migrace smí append-only ochranu obejít výhradně kvůli metadatům vyžadovaným
-- schématem, aplikační kód takovou možnost nikdy nedostane.
ALTER TABLE "promise_assessment" DISABLE TRIGGER "promise_assessment_append_only";--> statement-breakpoint
UPDATE "promise_assessment" SET "workflow_state" = 'PUBLISHED';--> statement-breakpoint
ALTER TABLE "promise_assessment" ENABLE TRIGGER "promise_assessment_append_only";--> statement-breakpoint

ALTER TABLE "promise_assessment" ADD CONSTRAINT "promise_assessment_published_is_reviewed" CHECK ("promise_assessment"."workflow_state" <> 'PUBLISHED' OR ("promise_assessment"."reviewed_by_id" IS NOT NULL AND "promise_assessment"."reviewed_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "promise_assessment" ADD CONSTRAINT "promise_assessment_current_is_published" CHECK ("promise_assessment"."is_current" = false OR "promise_assessment"."workflow_state" = 'PUBLISHED');--> statement-breakpoint

-- Zpřesnění append-only pravidla.
--
-- Původní verze mrazila každé hodnocení od okamžiku vzniku. To ale znemožňuje
-- redakční workflow: rozpracované hodnocení, které se po vrácení k přepracování
-- upravuje, by muselo pokaždé zakládat novou verzi a historie by se zaplnila
-- šumem z překlepů. Skutečný invariant je užší:
--
--   publikovaná verze je neměnná navždy;
--   rozpracovaná verze se upravovat smí, protože veřejně zatím nic netvrdí.
--
-- Neměnná zůstává i u rozpracované verze její identita, pořadí a autorství —
-- jinak by šlo podstrčit cizí práci pod svým jménem a obejít pravidlo čtyř očí.
CREATE OR REPLACE FUNCTION enforce_assessment_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'promise_assessment je append-only: mazání verze % není povoleno', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.workflow_state = 'PUBLISHED' THEN
    IF (to_jsonb(OLD) - 'is_current') IS DISTINCT FROM (to_jsonb(NEW) - 'is_current') THEN
      RAISE EXCEPTION 'publikované hodnocení % je neměnné. Vytvoř novou verzi.', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;

    IF OLD.is_current = false AND NEW.is_current = true THEN
      RAISE EXCEPTION 'starší verzi hodnocení nelze znovu zveřejnit jako aktuální (%)', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.promise_id IS DISTINCT FROM OLD.promise_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.created_by_id IS DISTINCT FROM OLD.created_by_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'u hodnocení % nelze měnit identitu, pořadí verze ani autorství', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
