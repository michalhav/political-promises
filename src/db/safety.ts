/**
 * Pojistky pro destruktivní vývojářské příkazy (reset, seed).
 *
 * Obě operace zahazují data. Jediné, co brání tomu, aby někdo omylem smazal
 * produkční databázi překlepem v DATABASE_URL, je tahle kontrola.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db", "host.docker.internal"]);

export function assertLocalDatabase(
  databaseUrl: string,
  nodeEnv: string,
  commandName: string,
): void {
  if (nodeEnv === "production") {
    throw new Error(`${commandName} je v produkčním prostředí zakázaný.`);
  }

  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host) && process.env.DB_ALLOW_REMOTE !== "1") {
    throw new Error(
      `DATABASE_URL míří na vzdálený host "${host}". Pokud to je opravdu záměr, spusť s DB_ALLOW_REMOTE=1.`,
    );
  }
}
