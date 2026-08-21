import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import {
  resolveSession,
  signOut as signOutSession,
  SESSION_TTL_MS,
  type EditorialUser,
} from "@/modules/accounts/sessions";
import { getEnv } from "@/shared/env";

/**
 * Napojení session na požadavek.
 *
 * `server-only` je tu schválně: kdyby tenhle modul někdo importoval do klientské
 * komponenty, build spadne. Identita se nikdy nesmí brát z něčeho, co poslal
 * prohlížeč — jen ze session dohledané na serveru.
 *
 * CSRF: mutace jdou přes Server Actions, které Next ověřuje porovnáním hlavičky
 * Origin s Host, a cookie je SameSite=Lax. Vlastní token by k tomu nic nepřidal.
 */
const SESSION_COOKIE = "slib_session";

export async function getCurrentUser(): Promise<EditorialUser | null> {
  const store = await cookies();
  return resolveSession(db, store.get(SESSION_COOKIE)?.value);
}

/**
 * Jediná vstupní brána do adminu. Každá stránka i každá server action ji volá
 * jako první příkaz — autorizace nesmí záviset na tom, že se v UI nevykreslí
 * odkaz.
 */
export async function requireEditorialUser(): Promise<EditorialUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  await signOutSession(db, token);
  store.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE, SESSION_TTL_MS };
