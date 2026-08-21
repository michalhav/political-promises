/**
 * Postgres pro E2E běh.
 *
 * Playwright potřebuje skutečně běžící aplikaci, a ta potřebuje skutečnou
 * databázi na TCP portu. PGlite umí obojí spojit: je to Postgres ve WASM
 * a `pglite-socket` před něj postaví server mluvící wire protokolem, takže
 * `next start` se k němu připojí jako k jakémukoli jinému Postgresu.
 *
 * Držíme tím stejnou strategii jako u ostatních testů — proti skutečnému
 * SQL enginu, bez Dockeru. Kdo má lokální Postgres, může ho použít nastavením
 * `E2E_DATABASE_URL`; tenhle server se pak nespustí.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/db/schema";
import { reseed } from "@/db/seed/applySeed";

export const E2E_PORT = 55_432;
export const E2E_DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${E2E_PORT}/postgres`;

let server: PGLiteSocketServer | undefined;
let client: PGlite | undefined;

export async function startTestDatabase(): Promise<string> {
  client = new PGlite();
  await client.waitReady;

  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  await reseed(db);

  server = new PGLiteSocketServer({ db: client, port: E2E_PORT, host: "127.0.0.1" });
  await server.start();

  return E2E_DATABASE_URL;
}

export async function stopTestDatabase(): Promise<void> {
  await server?.stop();
  await client?.close();
  server = undefined;
  client = undefined;
}
