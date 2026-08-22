"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { hashClientIp } from "@/modules/accounts/login";
import { submitPublicCorrection } from "@/modules/review/publicCorrections";
import { EditorialError } from "@/modules/review/service";

/**
 * Jediný zápis, který smí vyvolat kdokoli zvenčí.
 *
 * Nic tu nesmí záviset na tom, co přijde ve formuláři, kromě obsahu podnětu:
 * stav, autor i viditelnost určuje server. Adresa se ukládá jen jako otisk a
 * slouží k omezení počtu podání, ne k identifikaci člověka.
 */
export interface CorrectionFormResult {
  ok: boolean;
  errors?: string[];
}

/**
 * Adresa klienta za reverzní proxy.
 *
 * Na Vercelu je pravdivá jen ta, kterou nastaví jejich infrastruktura;
 * `x-forwarded-for` může klient poslat sám, proto se bere až první položka
 * a jen jako podklad pro otisk — nikdy jako důkaz o tom, kdo píše.
 */
async function clientIp(): Promise<string | null> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? store.get("x-real-ip") ?? null;
}

export async function submitCorrectionAction(formData: FormData): Promise<CorrectionFormResult> {
  const value = (key: string): string => {
    const raw = formData.get(key);
    return typeof raw === "string" ? raw : "";
  };

  const promiseSlug = value("promiseSlug");

  try {
    await submitPublicCorrection(
      db,
      {
        promiseSlug,
        kind: value("kind") === "PARTY_RESPONSE" ? "PARTY_RESPONSE" : "PUBLIC_CORRECTION",
        submitterName: value("submitterName") || undefined,
        submitterOrganization: value("submitterOrganization") || undefined,
        submitterEmail: value("submitterEmail") || undefined,
        body: value("body"),
      },
      hashClientIp(await clientIp()),
    );
  } catch (error) {
    if (error instanceof EditorialError) return { ok: false, errors: error.issues };
    throw error;
  }

  // Podnět se zveřejní až po revizi, ale redakční fronta se má obnovit hned.
  revalidatePath("/admin");
  return { ok: true };
}
