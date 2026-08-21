import "dotenv/config";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { assertLocalDatabase } from "@/db/safety";
import * as schema from "@/db/schema";
import { reseed } from "@/db/seed/applySeed";
import { getEnv } from "@/shared/env";

/**
 * Naplní databázi ukázkovými daty. Nejdřív ji vyprázdní, takže je to
 * destruktivní operace — proto stejná pojistka jako u `db:reset`.
 */
async function main(): Promise<void> {
  const env = getEnv();
  assertLocalDatabase(env.DATABASE_URL, env.NODE_ENV, "db:seed");

  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  try {
    const result = await reseed(drizzle(pool, { schema }));
    console.log(
      [
        "Ukázková data nahrána.",
        `  zdrojové dokumenty: ${result.sourceDocuments}`,
        `  sliby: ${result.promises} (z toho publikovaných ${result.publishedPromises})`,
        `  důkazy: ${result.evidence}`,
      ].join("\n"),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Seed selhal:", error);
  process.exitCode = 1;
});
