-- Integritní pravidla, která aplikace nesmí obejít.
-- Zdroj: MASTER_IMPLEMENTATION_BRIEF.md -> POLITICAL DATA INTEGRITY RULES (č. 3 a 5)
-- a OPEN QUESTIONS A4. Aplikační vrstva se dá obejít migračním skriptem nebo
-- ruční SQL opravou; trigger ne.

--> statement-breakpoint
-- Pravidlo č. 3: doslovné znění slibu je po publikaci neměnné.
-- published_at slouží jako značka "bylo publikováno" a nesmí se mazat;
-- viditelnost řídí sloupec published.
CREATE OR REPLACE FUNCTION enforce_promise_original_text_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND NEW.published_at IS NULL THEN
    RAISE EXCEPTION 'published_at nelze vymazat: slib % byl publikován %',
      OLD.id, OLD.published_at
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.published_at IS NOT NULL AND NEW.original_text IS DISTINCT FROM OLD.original_text THEN
    RAISE EXCEPTION 'original_text je po publikaci neměnný (slib %). Použij normalized_statement nebo novou verzi hodnocení.',
      OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
CREATE TRIGGER promise_original_text_immutable
  BEFORE UPDATE ON "promise"
  FOR EACH ROW EXECUTE FUNCTION enforce_promise_original_text_immutable();

--> statement-breakpoint
-- A4: hodnocení je append-only. Jediná povolená změna je zhasnutí is_current,
-- když nad slibem vznikne novější verze.
CREATE OR REPLACE FUNCTION enforce_assessment_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'promise_assessment je append-only: mazání verze % není povoleno', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF (to_jsonb(OLD) - 'is_current') IS DISTINCT FROM (to_jsonb(NEW) - 'is_current') THEN
    RAISE EXCEPTION 'promise_assessment je append-only: měnit lze jen is_current. Vytvoř novou verzi hodnocení (%).', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.is_current = false AND NEW.is_current = true THEN
    RAISE EXCEPTION 'starší verzi hodnocení nelze znovu zveřejnit jako aktuální (%)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
CREATE TRIGGER promise_assessment_append_only
  BEFORE UPDATE OR DELETE ON "promise_assessment"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_append_only();

--> statement-breakpoint
-- Audit a review rozhodnutí musí být neměnné, jinak nejsou k ničemu.
CREATE OR REPLACE FUNCTION enforce_append_only_row()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% je append-only: % není povolen', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only_row();

--> statement-breakpoint
CREATE TRIGGER review_decision_append_only
  BEFORE UPDATE OR DELETE ON "review_decision"
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only_row();
