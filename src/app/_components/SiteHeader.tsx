import Link from "next/link";

const NAV_ITEMS = [
  { href: "/promises", label: "Sliby" },
  { href: "/compare", label: "Program vs. koalice" },
  { href: "/methodology", label: "Metodika" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-border bg-surface border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Slib <span aria-hidden="true">→</span>
          <span className="sr-only">na</span> Skutek
        </Link>
        <nav aria-label="Hlavní navigace">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="hover:text-accent underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
