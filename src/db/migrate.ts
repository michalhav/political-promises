import "dotenv/config";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { getEnv } from "@/shared/env";

async function main(): Promise<void> {
  const env = getEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

  try {
    await migrate(drizzle(pool), { migrationsFolder: "src/db/migrations" });
    console.log("Migrace hotové.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Migrace selhaly:", error);
  process.exitCode = 1;
});
