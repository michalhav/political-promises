/**
 * Vývojový běh bez Dockeru.
 *
 *   npm run dev:pglite
 *
 * Aplikace potřebuje Postgres na TCP portu. Kdo Docker nemá, neměl doteď jak
 * aplikaci spustit — E2E testy si přitom PGlite (Postgres ve WASM) přes wire
 * protokol pouštějí už teď. Tenhle skript dělá totéž pro `next dev`: nastartuje
 * databázi, aplikuje migrace, naseeduje ukázková data a teprve pak spustí
 * aplikaci.
 *
 * Data jsou **v paměti** a se zastavením procesu mizí. Pro dlouhodobou práci
 * patří Postgres z `docker-compose.yml`, tohle je náhrada, ne náhražka.
 */
import { spawn } from "node:child_process";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/db/schema";
import { reseed } from "@/db/seed/applySeed";
import { appUsers } from "@/modules/accounts/schema";
import { importCorpusDocument } from "@/modules/sources/importCorpus";
import { seedRealPraha } from "@/db/seed/realPraha";

const DB_PORT = Number(process.env.DEV_PGLITE_PORT ?? 55_433);
const APP_PORT = process.env.PORT ?? "3000";

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function main(): Promise<void> {
  const client = new PGlite();
  await client.waitReady;

  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  await reseed(db);

  // Korpus se nahrává ještě před startem aplikace: PGlite obsluhuje jedno
  // spojení, takže souběžný import zvenčí by se s aplikací pral o port.
  const corpus = argValue(process.argv.slice(2), "--corpus");
  if (corpus) {
    const [actor] = await db
      .select({ id: appUsers.id, displayName: appUsers.displayName })
      .from(appUsers)
      .limit(1);
    if (!actor) throw new Error("Seed nevytvořil žádného uživatele.");

    const imported = await importCorpusDocument(db, actor, corpus);
    console.log(`[dev] Korpus ${corpus} nahrán: ${imported.title} (${imported.pageCount} stran).`);
  }

  // Skutečná data volebního období 2022–2026. Program je v repozitáři, doklady
  // ze zakázek jsou volitelné — bez nich zůstanou sliby poctivě nedoložené.
  if (process.argv.includes("--praha")) {
    const result = await seedRealPraha(db, {
      tenderDirectory: argValue(process.argv.slice(2), "--zakazky"),
    });
    console.log(
      `[dev] Praha Sobě: publikováno ${result.published.length} slibů, ` +
        `z toho ${result.withEvidence} s dokladem ze zakázek.` +
        (result.skipped.length > 0 ? ` Přeskočeno: ${result.skipped.join(", ")}.` : ""),
    );
  }

  const server = new PGLiteSocketServer({ db: client, port: DB_PORT, host: "127.0.0.1" });
  await server.start();
  console.log(`[dev] PGlite naslouchá na portu ${DB_PORT}, ukázková data nahraná.`);
  console.log(`[dev] Aplikace poběží na http://localhost:${APP_PORT}`);
  console.log("[dev] Redakce: redaktor1@example.org / redaktor2@example.org, heslo demo-redakce");

  const app = spawn("npx", ["next", "dev", "-p", APP_PORT], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
      AI_PROVIDER: "fixture",
      // PGlite přes wire protokol obsluhuje jedno spojení; větší pool končí
      // na ECONNRESET.
      DATABASE_POOL_MAX: "1",
    },
  });

  const shutdown = async (): Promise<void> => {
    app.kill();
    await server.stop();
    await client.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  app.on("exit", (code) => {
    void server.stop().then(() => client.close());
    process.exit(code ?? 0);
  });
}

main().catch((error: unknown) => {
  console.error("[dev] Spuštění selhalo:", error);
  process.exitCode = 1;
});
