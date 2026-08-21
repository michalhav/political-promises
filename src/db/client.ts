import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { getEnv } from "@/shared/env";

/**
 * V dev módu Next.js přenačítá moduly při každé změně. Bez cache na globalThis
 * by po pár uloženích běželo deset poolů a databáze by vyčerpala spojení.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

function getPool(): Pool {
  if (!globalForDb.pool) {
    const env = getEnv();
    globalForDb.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
    });
  }
  return globalForDb.pool;
}

export const db = drizzle(getPool(), { schema });

export type Database = typeof db;
