"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getWishlist, setWishlist } from "@/lib/customer-actions";

export type CartLine = { productId: string; qty: number };

type CartApi = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  wished: (productId: string) => boolean;
  toggleWish: (productId: string) => void;
};

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wish, setWish] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("koundiata-cart");
      const savedWish = localStorage.getItem("koundiata-wish");
      if (stored) setLines(JSON.parse(stored) as CartLine[]);
      if (savedWish) setWish(JSON.parse(savedWish) as string[]);
    } catch {
      /* ignore broken local storage */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("koundiata-cart", JSON.stringify(lines));
  }, [lines, ready]);

  // Favoris liés au compte client : fusion au chargement, puis synchronisation à chaque changement.
  const accountWish = useRef<"unknown" | "guest" | "account">("unknown");
  useEffect(() => {
    if (!ready) return;
    getWishlist()
      .then((server) => {
        if (server === null) {
          accountWish.current = "guest";
          return;
        }
        accountWish.current = "account";
        setWish((local) => [...new Set([...server, ...local])]);
      })
      .catch(() => {
        accountWish.current = "guest";
      });
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("koundiata-wish", JSON.stringify(wish));
    if (accountWish.current === "account") setWishlist(wish).catch(() => {});
  }, [wish, ready]);

  const api = useMemo<CartApi>(
    () => ({
      lines,
      ready,
      count: lines.reduce((sum, line) => sum + line.qty, 0),
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      add: (productId, qty = 1) => {
        setDrawerOpen(true);
        setLines((current) => {
          const found = current.find((line) => line.productId === productId);
          if (!found) return [...current, { productId, qty }];
          return current.map((line) =>
            line.productId === productId ? { ...line, qty: Math.min(8, line.qty + qty) } : line,
          );
        });
      },
      setQty: (productId, qty) => {
        setLines((current) =>
          qty <= 0
            ? current.filter((line) => line.productId !== productId)
            : current.map((line) => (line.productId === productId ? { ...line, qty: Math.min(8, qty) } : line)),
        );
      },
      remove: (productId) => setLines((current) => current.filter((line) => line.productId !== productId)),
      clear: () => setLines([]),
      wished: (productId) => wish.includes(productId),
      toggleWish: (productId) =>
        setWish((current) => (current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId])),
    }),
    [lines, ready, wish, drawerOpen],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("Panier indisponible");
  return value;
}
