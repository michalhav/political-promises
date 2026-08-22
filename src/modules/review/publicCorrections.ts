/**
 * Podnět nebo reakce od veřejnosti.
 *
 * Sekce B1 briefu: produkt dělá veřejná tvrzení o jmenovaných politicích, takže
 * musí existovat cesta, jak se ozvat. Metodika to čtenáři slibuje — do teď to
 * ale uměl založit jedině přihlášený redaktor, takže se „ozvat" dalo leda
 * e-mailem někomu, kdo to opíše.
 *
 * Tři věci, na kterých to stojí:
 *
 * 1. **Podání není publikace.** Vzniká ve stavu OPEN a v tom stavu se veřejně
 *    nezobrazuje. Kdyby se zobrazovalo, byl by to nástroj, jak komukoli vystavit
 *    libovolný text na stránce o jmenovaném člověku. Zveřejní ho až redakce tím,
 *    že ho vezme na vědomí.
 * 2. **Omezený počet.** Bez limitu je veřejný zápis do databáze pozvánka pro
 *    roboty. Počítá se podle otisku adresy, stejně jako u přihlašování.
 * 3. **Žádný autor v systému.** `handledById` zůstává prázdné, dokud se podnětu
 *    někdo neujme. Podání není redakční úkon a nesmí se tvářit jako redakční.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import type { AppDatabase } from "@/db/types";
import { promises } from "@/modules/promises/schema";
import { auditLogs, corrections } from "@/modules/review/schema";
import { EditorialError } from "@/modules/review/service";

/** Okno a strop pro podání z jedné adresy. Drží se u sebe, ať jdou ladit spolu. */
export const SUBMISSION_WINDOW_MS = 60 * 60 * 1000;
export const MAX_SUBMISSIONS_PER_IP = 5;

export const publicCorrectionSchema = z.object({
  promiseSlug: z.string().trim().min(1).max(120),
  /** Veřejnost smí podat jen tyhle dva druhy; INTERNAL_REVISION je redakční. */
  kind: z.enum(["PUBLIC_CORRECTION", "PARTY_RESPONSE"]),
  submitterName: z.string().trim().max(200).optional(),
  submitterOrganization: z.string().trim().max(200).optional(),
  submitterEmail: z.union([z.email().max(320), z.literal("")]).optional(),
  body: z.string().trim().min(20, "Napiš aspoň větu, ať je z podnětu co posoudit.").max(8000),
});

export type PublicCorrectionInput = z.input<typeof publicCorrectionSchema>;

export async function submitPublicCorrection(
  db: AppDatabase,
  input: PublicCorrectionInput,
  ipHash: string | null,
): Promise<string> {
  const parsed = publicCorrectionSchema.safeParse(input);
  if (!parsed.success) {
    throw new EditorialError(
      "Formulář obsahuje chyby.",
      parsed.error.issues.map((issue) => issue.message),
    );
  }
  const data = parsed.data;

  // Podnět jde poslat jen k tomu, co je opravdu venku. Jinak by šlo přes
  // formulář zjišťovat, které nepublikované sliby v systému existují.
  const [promise] = await db
    .select({ id: promises.id })
    .from(promises)
    .where(and(eq(promises.slug, data.promiseSlug), eq(promises.published, true)))
    .limit(1);

  if (!promise) throw new EditorialError("Takový zveřejněný slib neexistuje.");

  if (ipHash) {
    const since = new Date(Date.now() - SUBMISSION_WINDOW_MS);
    const [recent] = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(corrections)
      .where(and(eq(corrections.submitterIpHash, ipHash), gte(corrections.createdAt, since)));

    if ((recent?.value ?? 0) >= MAX_SUBMISSIONS_PER_IP) {
      throw new EditorialError(
        "Z tohoto místa přišlo za poslední hodinu příliš mnoho podnětů. Zkus to později.",
      );
    }
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(corrections)
      .values({
        promiseId: promise.id,
        kind: data.kind,
        status: "OPEN",
        submitterName: data.submitterName?.trim() || null,
        submitterOrganization: data.submitterOrganization?.trim() || null,
        submitterEmail: data.submitterEmail?.trim() || null,
        submitterIpHash: ipHash,
        body: data.body,
        handledById: null,
      })
      .returning({ id: corrections.id });

    if (!created) throw new EditorialError("Podnět se nepodařilo uložit.");

    // Aktér je prázdný schválně: podání přišlo zvenčí, ne od redakce.
    await tx.insert(auditLogs).values({
      actorId: null,
      action: "correction.submit",
      entityType: "correction",
      entityId: created.id,
      afterJson: { promiseSlug: data.promiseSlug, kind: data.kind },
    });

    return created.id;
  });
}
