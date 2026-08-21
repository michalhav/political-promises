/**
 * Spouštěč aplikace pro E2E testy.
 *
 * Databáze a aplikace musí vzniknout ve správném pořadí a zaniknout společně,
 * proto je to jeden proces a ne dva kroky v konfiguraci. Playwright tenhle
 * skript spustí jako `webServer` a po testech mu pošle signál.
 */
import { spawn } from "node:child_process";

import { E2E_PORT, startTestDatabase, stopTestDatabase } from "./testServer";

const APP_PORT = process.env.E2E_APP_PORT ?? "3100";

async function main(): Promise<void> {
  // Kdo má vlastní Postgres, dá jeho adresu do E2E_DATABASE_URL a PGlite se
  // vůbec nespustí.
  const external = process.env.E2E_DATABASE_URL;
  const databaseUrl = external ?? (await startTestDatabase());

  if (!external) {
    console.log(`[e2e] PGlite naslouchá na portu ${E2E_PORT}`);
  }

  const app = spawn("npx", ["next", "start", "-p", APP_PORT], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NODE_ENV: "production",
      AI_PROVIDER: "fixture",
      // PGlite přes wire protokol obsluhuje jedno spojení; větší pool by
      // vedl k ECONNRESET. Dotazy se tím serializují, což testům nevadí.
      DATABASE_POOL_MAX: external ? "10" : "1",
    },
  });

  const shutdown = async (): Promise<void> => {
    app.kill();
    if (!external) await stopTestDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  app.on("exit", (code) => {
    if (!external) void stopTestDatabase();
    process.exit(code ?? 0);
  });
}

main().catch((error: unknown) => {
  console.error("[e2e] Spuštění selhalo:", error);
  process.exitCode = 1;
});
