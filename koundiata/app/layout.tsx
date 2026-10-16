import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant, Montserrat } from "next/font/google";
import { CartProvider } from "@/components/store/cart";
import "./globals.css";

const display = Cormorant({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

// Titre et description réels : définis par la vitrine à partir des réglages du studio.
export const metadata: Metadata = {
  title: { default: "Boutique", template: "%s" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
