/**
 * Vloží vytěžený dokument z korpusu do databáze jako zdrojový dokument.
 *
 *   npm run corpus:import -- corpus/praha-sobe-2022
 *   npm run corpus:import -- corpus/praha-sobe-2022 --actor redaktor1@example.org
 *
 * Import je redakční úkon, ne systémová operace — proto se zapisuje pod
 * konkrétním člověkem a objeví se v auditním logu jako každý jiný vklad zdroje.
 */
import "dotenv/config";

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { appUsers } from "@/modules/accounts/schema";
import { EditorialError } from "@/modules/review/service";
import { importCorpusDocument } from "@/modules/sources/importCorpus";
import { getEnv } from "@/shared/env";

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [directory] = args;

  if (!directory) {
    console.error("Použití: npm run corpus:import -- <adresář> [--actor <e-mail>]");
    process.exitCode = 1;
    return;
  }

  const env = getEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

  try {
    const db = drizzle(pool, { schema });
    const email = argValue(args, "--actor");

    const query = db
      .select({ id: appUsers.id, displayName: appUsers.displayName })
      .from(appUsers)
      .$dynamic();
    const [actor] = await (email ? query.where(eq(appUsers.email, email)) : query).limit(1);

    if (!actor) {
      console.error(
        email
          ? `Uživatel ${email} v databázi není.`
          : "V databázi není žádný uživatel. Spusť nejdřív npm run db:seed.",
      );
      process.exitCode = 1;
      return;
    }

    const result = await importCorpusDocument(db, actor, directory);

    console.log(
      [
        "Vloženo jako zdrojový dokument.",
        `  Název:   ${result.title}`,
        `  Stran:   ${result.pageCount}`,
        `  Znaků:   ${result.characters > 0 ? result.characters : "text se neukládá"}`,
        `  Licence: ${result.licenseMode}`,
        `  Vložil:  ${actor.displayName}`,
        `  Detail:  /admin/sources/${result.sourceDocumentId}`,
        "",
        "Dokument čeká ve stavu „Ke zpracování“ — kandidáty z něj zakládá redakce.",
      ].join("\n"),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof EditorialError) {
    console.error(`Import odmítnut: ${error.message}`);
  } else {
    console.error("Import selhal:", error);
  }
  process.exitCode = 1;
});
