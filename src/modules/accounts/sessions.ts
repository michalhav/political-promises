/**
 * Přihlašovací sessions.
 *
 * Databázové operace bez znalosti Next.js — cookie řeší vrstva nad tím
 * (`src/modules/accounts/auth.ts`). Díky tomu jde přihlášení testovat proti
 * skutečné databázi bez HTTP.
 *
 * V databázi je jen otisk tokenu. Kdo získá přístup ke `app_session`, nesmí
 * z něj umět odvodit platnou cookie.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";

import type { AppDatabase } from "@/db/types";
import { appSessions, appUsers } from "@/modules/accounts/schema";
import { verifyPassword } from "@/modules/accounts/password";

/** Dva týdny. Redakční práce je nárazová, kratší session by otravovala. */
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface EditorialUser {
  id: string;
  email: string;
  displayName: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SignInResult {
  token: string;
  expiresAt: Date;
  user: EditorialUser;
}

/**
 * Ověří heslo a založí session.
 *
 * Při neúspěchu vrací `null` bez rozlišení, jestli účet neexistuje, nebo
 * nesedí heslo — jinak by šlo přes přihlašovací formulář zjišťovat, kdo
 * v redakci pracuje. Heslo se ověřuje i u neexistujícího účtu, aby se rozdíl
 * neprozradil dobou odpovědi; drží to `verifyPassword` ověřením proti atrapě.
 */
export async function signIn(
  db: AppDatabase,
  email: string,
  password: string,
): Promise<SignInResult | null> {
  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.email, email.trim().toLowerCase()))
    .limit(1);

  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? null);

  if (!user || !user.isActive || !passwordMatches) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(appSessions).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return {
    token,
    expiresAt,
    user: { id: user.id, email: user.email, displayName: user.displayName },
  };
}

export async function resolveSession(
  db: AppDatabase,
  token: string | undefined,
): Promise<EditorialUser | null> {
  if (!token) return null;

  const [row] = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      displayName: appUsers.displayName,
      isActive: appUsers.isActive,
      tokenHash: appSessions.tokenHash,
    })
    .from(appSessions)
    .innerJoin(appUsers, eq(appSessions.userId, appUsers.id))
    .where(and(eq(appSessions.tokenHash, hashToken(token)), gt(appSessions.expiresAt, new Date())))
    .limit(1);

  if (!row || !row.isActive) return null;

  // Vyhledání proběhlo přes index nad otiskem; porovnání v konstantním čase je
  // pojistka pro případ, že by se dotaz někdy změnil na méně striktní.
  const provided = Buffer.from(hashToken(token));
  const stored = Buffer.from(row.tokenHash);
  if (provided.length !== stored.length || !timingSafeEqual(provided, stored)) return null;

  return { id: row.id, email: row.email, displayName: row.displayName };
}

export async function signOut(db: AppDatabase, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(appSessions).where(eq(appSessions.tokenHash, hashToken(token)));
}

/** Úklid prošlých sessions. Volá se při přihlášení, není na to potřeba cron. */
export async function purgeExpiredSessions(db: AppDatabase): Promise<void> {
  await db.delete(appSessions).where(lt(appSessions.expiresAt, new Date()));
}
