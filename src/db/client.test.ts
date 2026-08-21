import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sestavení se nesmí zajímat o databázi.
 *
 * `next build` načítá moduly stránek, aby posbíral jejich konfiguraci. Když se
 * pool vyráběl na úrovni modulu, build vyžadoval `DATABASE_URL` a padal v CI,
 * kde proměnná ještě není — chyba se přitom neprojevila nikde jinde, protože
 * vývojář má `.env` po ruce. Tenhle test je pojistka proti návratu.
 */
describe("import databázového klienta", () => {
  const original = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it("projde i bez DATABASE_URL", async () => {
    const { db } = await import("@/db/client");

    expect(db).toBeDefined();
  });

  it("první dotaz bez konfigurace selže srozumitelně", async () => {
    const { db } = await import("@/db/client");

    // Chyba musí přijít až tady a musí říct, co chybí — ne „cannot read
    // properties of undefined" odněkud z driveru.
    expect(() => db.select()).toThrow(/DATABASE_URL/);
  });
});
