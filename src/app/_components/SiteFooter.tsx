import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-border bg-surface mt-16 border-t">
      <div className="text-muted mx-auto max-w-5xl space-y-3 px-4 py-8 text-sm">
        <p>
          Každé publikované tvrzení na tomto webu odkazuje na zdrojový dokument. Hodnocení vytvářejí
          lidé, ne algoritmus.{" "}
          <Link href="/methodology" className="hover:text-accent underline underline-offset-4">
            Jak hodnotíme
          </Link>
          .
        </p>
        <p>Našli jste chybu? Opravy a reakce dotčených stran zveřejňujeme u konkrétního slibu.</p>
      </div>
    </footer>
  );
}
