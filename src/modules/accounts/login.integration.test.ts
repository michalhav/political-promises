/**
 * Omezení počtu pokusů o přihlášení.
 *
 * Přihlašovací formulář je jediná veřejně dostupná mutace v celé aplikaci.
 * Bez limitu je to jak nástroj na hádání hesel, tak nástroj na vytížení CPU —
 * scrypt je drahý schválně.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import {
  attemptLogin,
  hashClientIp,
  MAX_ATTEMPTS_PER_EMAIL,
  MAX_ATTEMPTS_PER_IP,
  purgeOldLoginAttempts,
} from "@/modules/accounts/login";
import { loginAttempts } from "@/modules/accounts/schema";

let handle: TestDatabaseHandle;

const EMAIL = "redaktor1@example.org";
const PASSWORD = "demo-redakce";
const IP = "203.0.113.10";

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

beforeEach(async () => {
  await handle.db.delete(loginAttempts);
});

afterAll(async () => {
  await handle?.close();
});

async function failOnce(email = EMAIL, clientIp: string | null = IP) {
  return attemptLogin(handle.db, { email, password: "špatné-heslo", clientIp });
}

describe("běžné přihlášení", () => {
  it("se správným heslem projde", async () => {
    const outcome = await attemptLogin(handle.db, {
      email: EMAIL,
      password: PASSWORD,
      clientIp: IP,
    });
    expect(outcome.status).toBe("OK");
  });

  it("se špatným heslem neprojde a zaznamená pokus", async () => {
    const outcome = await failOnce();

    expect(outcome.status).toBe("INVALID_CREDENTIALS");
    const rows = await handle.db.select().from(loginAttempts);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.emailKey).toBe(EMAIL);
  });

  it("ukládá otisk adresy, ne adresu samotnou", async () => {
    await failOnce();

    const [row] = await handle.db.select().from(loginAttempts);
    expect(row?.ipHash).not.toBe(IP);
    expect(row?.ipHash).toBe(hashClientIp(IP));
  });
});

describe("limit na e-mail", () => {
  it("po vyčerpání pokusů zablokuje i správné heslo", async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) {
      expect((await failOnce()).status).toBe("INVALID_CREDENTIALS");
    }

    const blocked = await attemptLogin(handle.db, {
      email: EMAIL,
      password: PASSWORD,
      clientIp: IP,
    });

    expect(blocked.status).toBe("RATE_LIMITED");
  });

  it("blokuje i e-mail, který v systému není", async () => {
    // Jinak by šlo z chování formuláře poznat, které účty existují.
    const unknown = "nikdo@example.org";
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) {
      await failOnce(unknown);
    }

    const outcome = await attemptLogin(handle.db, {
      email: unknown,
      password: "cokoli",
      clientIp: IP,
    });
    expect(outcome.status).toBe("RATE_LIMITED");
  });

  it("nezablokuje jiný účet ze stejné adresy", async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) {
      await failOnce();
    }

    const other = await attemptLogin(handle.db, {
      email: "redaktor2@example.org",
      password: PASSWORD,
      clientIp: IP,
    });
    expect(other.status).toBe("OK");
  });

  it("úspěšné přihlášení okno vynuluje", async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL - 1; i += 1) {
      await failOnce();
    }

    expect(
      (await attemptLogin(handle.db, { email: EMAIL, password: PASSWORD, clientIp: IP })).status,
    ).toBe("OK");

    // Po úspěchu se počítá znovu od nuly — překlepy nesmí zablokovat toho,
    // kdo heslo nakonec zadal správně.
    expect((await failOnce()).status).toBe("INVALID_CREDENTIALS");
  });

  it("staré pokusy už neblokují", async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) {
      await failOnce();
    }

    await handle.client.query("update login_attempt set attempted_at = now() - interval '1 hour'");

    const outcome = await attemptLogin(handle.db, {
      email: EMAIL,
      password: PASSWORD,
      clientIp: IP,
    });
    expect(outcome.status).toBe("OK");
  });
});

describe("limit na adresu", () => {
  it("zastaví rozstřel přes mnoho účtů z jednoho místa", async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_IP; i += 1) {
      await failOnce(`ucet-${i}@example.org`);
    }

    const outcome = await attemptLogin(handle.db, {
      email: "dalsi@example.org",
      password: "cokoli",
      clientIp: IP,
    });
    expect(outcome.status).toBe("RATE_LIMITED");
  });

  it("bez známé adresy se limit na adresu neuplatní", async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_IP; i += 1) {
      await failOnce(`lokalni-${i}@example.org`, null);
    }

    const outcome = await attemptLogin(handle.db, {
      email: EMAIL,
      password: PASSWORD,
      clientIp: null,
    });
    expect(outcome.status).toBe("OK");
  });
});

describe("úklid", () => {
  it("smaže záznamy starší než okno", async () => {
    await failOnce();
    await handle.client.query("update login_attempt set attempted_at = now() - interval '1 hour'");

    await purgeOldLoginAttempts(handle.db);

    const rows = await handle.db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.emailKey, EMAIL));
    expect(rows).toEqual([]);
  });
});
