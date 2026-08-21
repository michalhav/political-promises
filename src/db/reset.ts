import "dotenv/config";

import { Pool } from "pg";

import { assertLocalDatabase } from "@/db/safety";
import { getEnv } from "@/shared/env";

/** Zahodí schéma a postaví ho znovu. Destruktivní — viz pojistky v safety.ts. */
async function main(): Promise<void> {
  const env = getEnv();
  assertLocalDatabase(env.DATABASE_URL, env.NODE_ENV, "db:reset");

  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  try {
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await pool.query("DROP SCHEMA public CASCADE");
    await pool.query("CREATE SCHEMA public");
    console.log("Schéma zahozeno. Spusť `npm run db:migrate`.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Reset selhal:", error);
  process.exitCode = 1;
});
