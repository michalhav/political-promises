/**
 * Sloučení duplicitních slibů.
 *
 * Brief to vyjmenovává mezi tím, co recenzent musí umět, a schéma na to má
 * sloupec `merged_into_promise_id`. Číst ho uměla řada dotazů — sloučené sliby
 * mizí z veřejných výpisů i z hledání důkazů — jenže **nastavit** ho neuměl
 * nikdo. Duplicity přitom vzniknou hned, jak se z jednoho programu vytěží dvě
 * stě kandidátů a tentýž závazek se objeví na dvou stránkách.
 *
 * Tři pravidla, na kterých to stojí:
 *
 * 1. **Publikovaný slib se sloučit nedá.** Sloučení ho odstraní z veřejných
 *    stránek, a to je tiché stažení už zveřejněného tvrzení. Duplicitu
 *    objevenou po publikaci řeší korekce a nová verze hodnocení, ne mazání.
 * 2. **Řetězce nevznikají.** Cíl sám nesmí být sloučený, takže „kam slib
 *    patří" je vždycky jeden krok, ne procházení grafu.
 * 3. **Nic se nepřesouvá.** Důkazy a hodnocení zůstávají u původního slibu;
 *    záznam se neztrácí, jen přestává být veřejný. Přesouvání by přepisovalo
 *    historii, kterou má produkt naopak chránit.
 */
import { and, eq, isNull, ne } from "drizzle-orm";

import type { AppDatabase } from "@/db/types";
import { electoralLists } from "@/modules/parties/schema";
import { promises } from "@/modules/promises/schema";
import { auditLogs } from "@/modules/review/schema";
import { EditorialError, type Actor } from "@/modules/review/service";

async function loadForMerge(db: AppDatabase, promiseId: string) {
  const [row] = await db
    .select({
      id: promises.id,
      slug: promises.slug,
      title: promises.title,
      published: promises.published,
      mergedIntoPromiseId: promises.mergedIntoPromiseId,
      electoralListId: promises.electoralListId,
    })
    .from(promises)
    .where(eq(promises.id, promiseId))
    .limit(1);

  if (!row) throw new EditorialError("Slib neexistuje.");
  return row;
}

export async function mergePromise(
  db: AppDatabase,
  actor: Actor,
  input: { promiseId: string; targetPromiseId: string },
): Promise<void> {
  if (input.promiseId === input.targetPromiseId) {
    throw new EditorialError("Slib nejde sloučit sám do sebe.");
  }

  const source = await loadForMerge(db, input.promiseId);
  const target = await loadForMerge(db, input.targetPromiseId);

  if (source.published) {
    throw new EditorialError(
      "Publikovaný slib sloučit nejde — zmizel by z veřejných stránek. Duplicitu objevenou po publikaci řeš korekcí a novou verzí hodnocení.",
    );
  }
  if (source.mergedIntoPromiseId) {
    throw new EditorialError("Tenhle slib už je sloučený do jiného.");
  }
  if (target.mergedIntoPromiseId) {
    throw new EditorialError(
      "Cílový slib je sám sloučený do jiného. Sluč rovnou do toho, který zůstává.",
    );
  }
  if (source.electoralListId !== target.electoralListId) {
    // Dva sliby různých kandidátek nejsou duplicita, i když znějí stejně —
    // slíbily je dvě různé strany a každá za svůj odpovídá.
    throw new EditorialError("Sloučit jde jen sliby téže kandidátky.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(promises)
      .set({ mergedIntoPromiseId: target.id })
      .where(eq(promises.id, source.id));

    await tx.insert(auditLogs).values({
      actorId: actor.id,
      action: "promise.merge",
      entityType: "promise",
      entityId: source.id,
      beforeJson: { mergedIntoPromiseId: null },
      afterJson: { mergedIntoPromiseId: target.id, targetSlug: target.slug },
    });
  });
}

/**
 * Zrušení sloučení.
 *
 * Sloučit se dá omylem a bez cesty zpátky by kandidát zmizel z výpisů, aniž by
 * ho šlo vrátit jinak než zásahem do databáze.
 */
export async function unmergePromise(
  db: AppDatabase,
  actor: Actor,
  promiseId: string,
): Promise<void> {
  const source = await loadForMerge(db, promiseId);
  if (!source.mergedIntoPromiseId) {
    throw new EditorialError("Tenhle slib sloučený není.");
  }

  await db.transaction(async (tx) => {
    await tx.update(promises).set({ mergedIntoPromiseId: null }).where(eq(promises.id, source.id));

    await tx.insert(auditLogs).values({
      actorId: actor.id,
      action: "promise.unmerge",
      entityType: "promise",
      entityId: source.id,
      beforeJson: { mergedIntoPromiseId: source.mergedIntoPromiseId },
      afterJson: { mergedIntoPromiseId: null },
    });
  });
}

export interface MergeTarget {
  id: string;
  slug: string;
  title: string;
  published: boolean;
}

/**
 * Sliby, do kterých jde tenhle sloučit.
 *
 * Jen táž kandidátka a jen ty, které samy sloučené nejsou — nabízet cíl, který
 * by vzápětí skončil chybou, je zbytečné trápení.
 */
export async function listMergeTargets(db: AppDatabase, promiseId: string): Promise<MergeTarget[]> {
  const source = await loadForMerge(db, promiseId);

  return db
    .select({
      id: promises.id,
      slug: promises.slug,
      title: promises.title,
      published: promises.published,
    })
    .from(promises)
    .innerJoin(electoralLists, eq(promises.electoralListId, electoralLists.id))
    .where(
      and(
        eq(promises.electoralListId, source.electoralListId),
        ne(promises.id, source.id),
        isNull(promises.mergedIntoPromiseId),
      ),
    )
    .orderBy(promises.title);
}
