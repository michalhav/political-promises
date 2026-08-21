import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  // latin-ext je nutný pro české ě/š/č/ř/ž/ů; bez něj se znaky nahradí fallbackem.
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Slib → Skutek",
    template: "%s | Slib → Skutek",
  },
  description:
    "Co politici slíbili a co se skutečně stalo. Sledujeme cestu od volebního programu přes politická rozhodnutí až k výsledku.",
};

/**
 * Kořenový layout drží jen dokument a písmo.
 *
 * Hlavička a patička veřejného webu patří do skupiny `(public)`, ne sem —
 * redakční konzole je jiná aplikace pro jiné publikum a patička s výzvou
 * „našli jste chybu?" tam nedává smysl. URL adresy se skupinou nemění.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
