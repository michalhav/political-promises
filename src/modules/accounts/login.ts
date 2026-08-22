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
import { createHmac } from "node:crypto";
import { and, count, eq, gte, lt, sql } from "drizzle-orm";

import type { AppDatabase } from "@/db/types";
import { loginAttempts } from "@/modules/accounts/schema";
import { purgeExpiredSessions, signIn, type SignInResult } from "@/modules/accounts/sessions";
import { getIpHashSecret } from "@/shared/env";

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

/**
 * Otisk IP adresy pro počítadla.
 *
 * HMAC, ne prostý hash. Prostý SHA-256 nad IP adresou není pseudonymizace:
 * adres je konečný počet, takže se dají projít všechny a otisky porovnat —
 * naměřeno 592 tisíc otisků za sekundu na jednom jádru v Node, tedy celý
 * prostor IPv4 za dvě hodiny. Na grafické kartě sekundy.
 *
 * S tajným klíčem to nejde: kdo nemá klíč, nemá co porovnávat.
 */
export function hashClientIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHmac("sha256", getIpHashSecret()).update(ip).digest("hex");
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

  /**
   * Pokus se započítá **dopředu**, v jedné transakci se spočítáním.
   *
   * Dřív se nejdřív počítalo, pak ověřovalo heslo a teprve při neúspěchu
   * zapisovalo. Souběžné požadavky tak všechny viděly stejný počet a všechny
   * limitem prošly. Zámek nejde držet přes ověření hesla — scrypt trvá
   * desítky milisekund a spojení by se blokovalo na celou tu dobu.
   *
   * Zápis předem to řeší: pokus je započítaný dřív, než se cokoli ověřuje,
   * a při úspěšném přihlášení se okno stejně maže celé.
   */
  const limited = await db.transaction(async (tx) => {
    // Zámek na e-mail. Limit na adresu je druhotný a dá se podvrhnout, takže
    // se serializuje podle toho, co je hlavní ochranou.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${emailKey})::bigint)`);

    const [emailAttempts, ipAttempts] = await Promise.all([
      countAttempts(tx, "emailKey", emailKey),
      ipHash ? countAttempts(tx, "ipHash", ipHash) : Promise.resolve(0),
    ]);

    if (emailAttempts >= MAX_ATTEMPTS_PER_EMAIL || ipAttempts >= MAX_ATTEMPTS_PER_IP) return true;

    await tx.insert(loginAttempts).values({ emailKey, ipHash });
    return false;
  });

  if (limited) {
    // Heslo se vědomě neověřuje. Scrypt je drahý schválně a bez tohohle
    // zkratu by byl přihlašovací formulář sám o sobě nástroj na vytížení CPU.
    return { status: "RATE_LIMITED", retryAfterMinutes: Math.ceil(ATTEMPT_WINDOW_MS / 60_000) };
  }

  const session = await signIn(db, emailKey, request.password);

  if (!session) return { status: "INVALID_CREDENTIALS" };

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
