/**
 * Postgres v paměti pro integrační testy.
 *
 * Schéma tohohle projektu stojí z velké části na databázových zárukách —
 * CHECK constrainty, částečné unique indexy a triggery z migrace 0001.
 * Testovat je proti mocku by neověřilo nic; jediné, co má cenu, je pustit
 * skutečné migrace proti skutečnému Postgresu.
 *
 * PGlite je Postgres 17 zkompilovaný do WASM, takže testy nepotřebují Docker
 * ani běžící službu. Produkce jede na node-postgres proti Neonu; rozdíl je
 * v driveru, ne v SQL enginu.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/db/schema";

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

export interface TestDatabaseHandle {
  db: TestDatabase;
  client: PGlite;
  close: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabaseHandle> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  return { db, client, close: () => client.close() };
}
