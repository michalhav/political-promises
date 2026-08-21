import { SiteFooter } from "@/app/_components/SiteFooter";
import { SiteHeader } from "@/app/_components/SiteHeader";

/** Veřejný web. Adresy zůstávají bez prefixu — skupina se v URL neprojeví. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#obsah"
        className="bg-accent text-accent-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Přeskočit na obsah
      </a>
      <SiteHeader />
      <main id="obsah" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
