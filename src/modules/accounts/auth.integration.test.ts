/**
 * Přihlašování.
 *
 * Route guard v `auth.ts` je jen tenký obal nad `resolveSession` — skutečné
 * rozhodnutí „je tenhle požadavek přihlášený?" padá tady, a proto se testuje
 * tady, proti databázi, a ne přes HTTP.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { reseed } from "@/db/seed/applySeed";
import { seedId } from "@/db/seed/ids";
import { createTestDatabase, type TestDatabaseHandle } from "@/db/testing/testDatabase";
import { hashPassword, verifyPassword } from "@/modules/accounts/password";
import { appSessions, appUsers } from "@/modules/accounts/schema";
import { hashToken, resolveSession, signIn, signOut } from "@/modules/accounts/sessions";

let handle: TestDatabaseHandle;

const EMAIL = "redaktor1@example.org";
const PASSWORD = "demo-redakce";

beforeAll(async () => {
  handle = await createTestDatabase();
  await reseed(handle.db);
}, 120_000);

afterAll(async () => {
  await handle?.close();
});

describe("heslo", () => {
  it("otisk neobsahuje heslo a dá se ověřit", async () => {
    const hash = await hashPassword("tajné-heslo");

    expect(hash).not.toContain("tajné-heslo");
    await expect(verifyPassword("tajné-heslo", hash)).resolves.toBe(true);
    await expect(verifyPassword("jiné-heslo", hash)).resolves.toBe(false);
  });

  it("dvě volání dají různý otisk téhož hesla", async () => {
    const [first, second] = await Promise.all([hashPassword("stejné"), hashPassword("stejné")]);

    // Náhodná sůl. Bez ní by shodná hesla šla poznat porovnáním otisků.
    expect(first).not.toBe(second);
  });

  it("účet bez nastaveného hesla se přihlásit nedá", async () => {
    await expect(verifyPassword("cokoli", null)).resolves.toBe(false);
  });
});

describe("přihlášení", () => {
  it("se správným heslem založí session", async () => {
    const result = await signIn(handle.db, EMAIL, PASSWORD);

    expect(result).not.toBeNull();
    expect(result?.user.email).toBe(EMAIL);
    expect(result?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("nerozlišuje špatné heslo od neexistujícího účtu", async () => {
    await expect(signIn(handle.db, EMAIL, "špatné")).resolves.toBeNull();
    await expect(signIn(handle.db, "nikdo@example.org", PASSWORD)).resolves.toBeNull();
  });

  it("deaktivovaný účet se nepřihlásí", async () => {
    const email = "redaktor2@example.org";
    await handle.db.update(appUsers).set({ isActive: false }).where(eq(appUsers.email, email));

    await expect(signIn(handle.db, email, PASSWORD)).resolves.toBeNull();

    await handle.db.update(appUsers).set({ isActive: true }).where(eq(appUsers.email, email));
  });

  it("v databázi je jen otisk tokenu, ne token sám", async () => {
    const result = await signIn(handle.db, EMAIL, PASSWORD);
    if (!result) throw new Error("Přihlášení selhalo.");

    const rows = await handle.db
      .select({ tokenHash: appSessions.tokenHash })
      .from(appSessions)
      .where(eq(appSessions.tokenHash, hashToken(result.token)));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).not.toBe(result.token);
  });
});

describe("session", () => {
  it("bez cookie není nikdo přihlášený", async () => {
    await expect(resolveSession(handle.db, undefined)).resolves.toBeNull();
  });

  it("vymyšlený token neprojde", async () => {
    await expect(resolveSession(handle.db, "podvrzeny-token")).resolves.toBeNull();
  });

  it("platný token vrátí redaktora", async () => {
    const result = await signIn(handle.db, EMAIL, PASSWORD);
    if (!result) throw new Error("Přihlášení selhalo.");

    const user = await resolveSession(handle.db, result.token);
    expect(user?.id).toBe(seedId("user:redaktor-1"));
  });

  it("prošlá session neplatí", async () => {
    const result = await signIn(handle.db, EMAIL, PASSWORD);
    if (!result) throw new Error("Přihlášení selhalo.");

    await handle.db
      .update(appSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(appSessions.tokenHash, hashToken(result.token)));

    await expect(resolveSession(handle.db, result.token)).resolves.toBeNull();
  });

  it("odhlášení session zruší", async () => {
    const result = await signIn(handle.db, EMAIL, PASSWORD);
    if (!result) throw new Error("Přihlášení selhalo.");

    await signOut(handle.db, result.token);
    await expect(resolveSession(handle.db, result.token)).resolves.toBeNull();
  });

  it("smazání účtu vezme s sebou i jeho sessions", async () => {
    const email = "docasny@example.org";
    const [created] = await handle.db
      .insert(appUsers)
      .values({
        email,
        displayName: "Dočasný redaktor",
        passwordHash: await hashPassword(PASSWORD),
      })
      .returning({ id: appUsers.id });

    const result = await signIn(handle.db, email, PASSWORD);
    expect(result).not.toBeNull();

    await handle.db.delete(appUsers).where(eq(appUsers.id, created?.id ?? ""));

    await expect(resolveSession(handle.db, result?.token)).resolves.toBeNull();
  });
});
