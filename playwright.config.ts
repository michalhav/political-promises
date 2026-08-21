import { defineConfig, devices } from "@playwright/test";

/**
 * E2E testy běží proti sestavené aplikaci a skutečné databázi.
 *
 * Databázi si spouští `e2e/serve.ts` (PGlite přes wire protokol), takže testy
 * nepotřebují Docker — stejně jako zbytek testovací sady. Data jsou po startu
 * naseedovaná, takže veřejný scénář má na čem běžet a redakční má do čeho
 * přidávat.
 *
 * Testy se pouštějí sériově. Sdílejí jednu databázi a redakční scénář v ní
 * mění stav; paralelní běh by je rozhodil.
 */
const PORT = process.env.E2E_APP_PORT ?? "3100";
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    locale: "cs-CZ",
    timezoneId: "Europe/Prague",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm run build && npx tsx e2e/serve.ts",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // Build a start PGlite chvíli trvají.
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
