import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/admin/login/actions";
import { AdminForm } from "@/app/admin/_components/AdminForm";
import { Field, TextInput } from "@/app/admin/_components/fields";
import { getCurrentUser } from "@/modules/accounts/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Přihlášení do redakce",
  // Přihlašovací stránka nemá co dělat ve vyhledávačích.
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/admin");

  return (
    <main className="mx-auto max-w-sm space-y-6 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Přihlášení do redakce</h1>

      <AdminForm action={loginAction} submitLabel="Přihlásit se" variant="primary">
        <Field label="E-mail" required>
          <TextInput type="email" name="email" autoComplete="username" required />
        </Field>
        <Field label="Heslo" required>
          <TextInput type="password" name="password" autoComplete="current-password" required />
        </Field>
      </AdminForm>

      <p className="text-muted text-sm">
        Redakční konzole není veřejná. Publikované obsahy najdete na{" "}
        <Link href="/promises" className="underline underline-offset-4">
          přehledu slibů
        </Link>
        .
      </p>
    </main>
  );
}
