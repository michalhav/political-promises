import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
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

let instance: NodePgDatabase<typeof schema> | null = null;

function getDb(): NodePgDatabase<typeof schema> {
  instance ??= drizzle(getPool(), { schema });
  return instance;
}

/**
 * Databáze se otevírá až prvním dotazem, ne při načtení modulu.
 *
 * `next build` načítá moduly stránek, aby posbíral jejich konfiguraci. Kdyby
 * se pool vyráběl na úrovni modulu, build by vyžadoval `DATABASE_URL` — a to
 * je přesně ten druh závislosti, kvůli které nasazení padá až v CI, kde
 * proměnná ještě není. Sestavení se o databázi zajímat nemá; stránky z ní
 * čtou až při požadavku.
 *
 * Proxy je tu proto, aby zbytek kódu dál psal `db.select(...)` a nemusel volat
 * `getDb()`. Je to jediné místo v projektu, kde se takový trik používá.
 */
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, property) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[property];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Database = NodePgDatabase<typeof schema>;
