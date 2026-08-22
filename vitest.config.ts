import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    /**
     * Testovací klíč pro otisky IP. Aplikace ho vyžaduje a schválně nemá
     * výchozí hodnotu — kdyby ji měla, byla by veřejná a ochrana by nefungovala.
     * Tenhle je jen pro testy a nic jím není chráněno.
     */
    env: { IP_HASH_SECRET: "test-only-ip-hash-secret-nikdy-v-provozu" },
    /**
     * Výchozích 5 s / 10 s je kalibrovaných na jednotkové testy. Tady každý
     * integrační soubor pouští skutečné migrace proti Postgresu ve WASM a
     * hesla se otiskují scryptem — nejpomalejší testy trvají přes 2,5 s a do
     * limitu nezbývá ani dvojnásobek. Při souběhu víc pracantů na vytíženém
     * stroji z toho vzniká chyba, která po opakování zmizí.
     *
     * Timeout má chytat zaseknutí, ne pomalý, ale funkční test.
     */
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
