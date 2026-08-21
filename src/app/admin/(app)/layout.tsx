import Link from "next/link";

import { logoutAction } from "@/app/admin/login/actions";
import { AdminForm } from "@/app/admin/_components/AdminForm";
import { requireEditorialUser } from "@/modules/accounts/auth";

/**
 * Shell redakční konzole.
 *
 * Guard tady chrání vykreslení stránek uvnitř skupiny. Nechrání ale server
 * actions — ty se dají zavolat nezávisle na tom, jestli si prohlížeč stránku
 * načetl, a proto si přihlášení ověřuje každá akce zvlášť.
 *
 * Přihlašovací stránka leží mimo tuhle skupinu, jinak by se do ní nedalo dostat.
 */
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Přehled" },
  { href: "/admin/promises", label: "Sliby" },
  { href: "/admin/sources", label: "Zdroje" },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireEditorialUser();

  return (
    <div className="min-h-full">
      <div className="border-border bg-surface border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex flex-wrap items-center gap-6">
            <span className="text-sm font-semibold">Redakce</span>
            <nav aria-label="Redakční navigace">
              <ul className="flex flex-wrap gap-4 text-sm">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="underline-offset-4 hover:underline">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted">{user.displayName}</span>
            <AdminForm action={logoutAction} submitLabel="Odhlásit" variant="danger" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
