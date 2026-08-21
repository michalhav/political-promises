"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/app/admin/actions";
import { db } from "@/db/client";
import { clearSession, setSessionCookie } from "@/modules/accounts/auth";
import { attemptLogin } from "@/modules/accounts/login";

/**
 * Přihlášení a odhlášení.
 *
 * Chybová hláška při neúspěchu je vždy stejná, ať už účet neexistuje, je
 * deaktivovaný, nebo jen nesedí heslo. Rozlišovat by znamenalo dát komukoli
 * nástroj, jak přes formulář zjistit, kdo v redakci pracuje.
 *
 * Zablokování po opakovaných pokusech se naopak přizná. Legitimní uživatel,
 * který si vzpomněl na heslo až na šestý pokus, potřebuje vědět, proč to
 * najednou nejde — a útočníkovi to nic neprozradí, protože se blokuje i e-mail,
 * který v systému vůbec není.
 */
async function clientIp(): Promise<string | null> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  // První položka je původní klient, zbytek jsou proxy.
  return forwarded?.split(",")[0]?.trim() ?? store.get("x-real-ip");
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { ok: false, errors: ["Vyplň e-mail i heslo."] };
  }

  const outcome = await attemptLogin(db, { email, password, clientIp: await clientIp() });

  if (outcome.status === "RATE_LIMITED") {
    return {
      ok: false,
      errors: [
        `Příliš mnoho neúspěšných pokusů. Zkus to znovu za ${outcome.retryAfterMinutes} minut.`,
      ],
    };
  }

  if (outcome.status === "INVALID_CREDENTIALS") {
    return { ok: false, errors: ["Přihlášení se nezdařilo. Zkontroluj e-mail a heslo."] };
  }

  await setSessionCookie(outcome.session.token, outcome.session.expiresAt);
  redirect("/admin");
}

export async function logoutAction(): Promise<ActionResult> {
  await clearSession();
  redirect("/admin/login");
}
