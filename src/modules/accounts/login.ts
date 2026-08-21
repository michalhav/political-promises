/**
 * Přihlášení včetně omezení počtu pokusů.
 *
 * Je to jediný vstupní bod: `signIn` samo o sobě limity neřeší, takže kdyby ho
 * někdo volal přímo, ochrana by tiše vypadla. Proto ji nedáváme vedle, ale
 * dovnitř — bezpečnostní kontrola, na kterou se dá zapomenout, není kontrola.
 *
 * Limity jsou dva a chrání proti různým věcem:
 *  - na e-mail  — cílené hádání hesla jednoho účtu,
 *  - na adresu  — rozstřel přes mnoho účtů z jednoho místa.
 *
 * Čítač musí být v databázi. Na Vercelu obsluhuje požadavky víc instancí,
 * takže čítač v paměti procesu by po prvním cold startu nechránil nic.
 */
import { createHash } from "node:crypto";
import { and, count, eq, gte, lt } from "drizzle-orm";

import type { AppDatabase } from "@/db/types";
import { loginAttempts } from "@/modules/accounts/schema";
import { purgeExpiredSessions, signIn, type SignInResult } from "@/modules/accounts/sessions";

/** Okno, ve kterém se pokusy počítají. */
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS_PER_EMAIL = 5;
export const MAX_ATTEMPTS_PER_IP = 20;

export type LoginOutcome =
  | { status: "OK"; session: SignInResult }
  | { status: "INVALID_CREDENTIALS" }
  | { status: "RATE_LIMITED"; retryAfterMinutes: number };

export interface LoginRequest {
  email: string;
  password: string;
  /** Z hlavičky `x-forwarded-for`. Dá se podvrhnout, proto je limit na e-mail ten hlavní. */
  clientIp?: string | null;
}

export function hashClientIp(ip: string | null | undefined): string | null {
  return ip ? createHash("sha256").update(ip).digest("hex") : null;
}

function windowStart(): Date {
  return new Date(Date.now() - ATTEMPT_WINDOW_MS);
}

async function countAttempts(
  db: AppDatabase,
  column: "emailKey" | "ipHash",
  value: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(column === "emailKey" ? loginAttempts.emailKey : loginAttempts.ipHash, value),
        gte(loginAttempts.attemptedAt, windowStart()),
      ),
    );

  return row?.value ?? 0;
}

export async function attemptLogin(db: AppDatabase, request: LoginRequest): Promise<LoginOutcome> {
  const emailKey = request.email.trim().toLowerCase();
  const ipHash = hashClientIp(request.clientIp);

  const [emailAttempts, ipAttempts] = await Promise.all([
    countAttempts(db, "emailKey", emailKey),
    ipHash ? countAttempts(db, "ipHash", ipHash) : Promise.resolve(0),
  ]);

  if (emailAttempts >= MAX_ATTEMPTS_PER_EMAIL || ipAttempts >= MAX_ATTEMPTS_PER_IP) {
    // Heslo se vědomě neověřuje. Scrypt je drahý schválně a bez tohohle
    // zkratu by byl přihlašovací formulář sám o sobě nástroj na vytížení CPU.
    return { status: "RATE_LIMITED", retryAfterMinutes: Math.ceil(ATTEMPT_WINDOW_MS / 60_000) };
  }

  const session = await signIn(db, emailKey, request.password);

  if (!session) {
    await db.insert(loginAttempts).values({ emailKey, ipHash });
    return { status: "INVALID_CREDENTIALS" };
  }

  // Úspěch okno vynuluje, aby překlepy nezablokovaly toho, kdo heslo zná.
  await db.delete(loginAttempts).where(eq(loginAttempts.emailKey, emailKey));
  await purgeOldLoginAttempts(db);
  await purgeExpiredSessions(db);

  return { status: "OK", session };
}

/** Starší záznamy už nic nechrání a není důvod je držet (B4). */
export async function purgeOldLoginAttempts(db: AppDatabase): Promise<void> {
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, windowStart()));
}
