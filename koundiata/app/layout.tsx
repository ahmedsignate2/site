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

export const metadata: Metadata = {
  title: {
    default: "KOUNDIATA — La beauté, avec intention.",
    template: "%s — KOUNDIATA",
  },
  description:
    "Soins, parfums et maquillage KOUNDIATA. Une maison de beauté à personnaliser depuis le studio.",
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
