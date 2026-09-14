"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSession } from "next-auth/react";

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  variant?: string;
  serviceId?: string;
  serviceName?: string;
  servicePrice?: number;
  quoteId?: string;
  quoteShipping?: number;
  maxStock: number;
};

type CartContextValue = {
  items: CartLine[];
  addItem: (line: Omit<CartLine, "quantity"> & { quantity?: number }) => void;
  removeItem: (productId: string, variant?: string) => void;
  setQuantity: (productId: string, quantity: number, variant?: string) => void;
  clear: () => void;
  totalQty: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const GUEST_STORAGE_KEY = "irb-cart";

function lineKey(productId: string, variant?: string) {
  return `${productId}::${variant || ""}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const storageKey = session?.user?.role === "customer" && session.user.id ? `irb-cart:customer:${session.user.id}` : GUEST_STORAGE_KEY;
  return <PersonalCartProvider key={status === "loading" ? "loading" : storageKey} storageKey={status === "loading" ? null : storageKey}>{children}</PersonalCartProvider>;
}

function PersonalCartProvider({ children, storageKey }: { children: React.ReactNode; storageKey: string | null }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      const saved: CartLine[] = raw ? JSON.parse(raw) : [];
      // Claim the guest cart once at sign-in; it is never left for the next customer.
      const guestRaw = storageKey !== GUEST_STORAGE_KEY ? localStorage.getItem(GUEST_STORAGE_KEY) : null;
      const guest: CartLine[] = guestRaw ? JSON.parse(guestRaw) : [];
      const merged = [...saved, ...guest.filter(line => !saved.some(existing => lineKey(existing.productId, existing.variant) === lineKey(line.productId, line.variant)))];
      setItems(merged);
      if (guestRaw) {
        localStorage.setItem(storageKey, JSON.stringify(merged));
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch { /* Storage may be disabled. */ }
  }, [items, hydrated, storageKey]);

  const addItem = useCallback(
    (line: Omit<CartLine, "quantity"> & { quantity?: number }) => {
      const qty = Math.max(1, line.quantity ?? 1);
      const capped = Math.min(qty, line.maxStock);
      setItems((prev) => {
        const key = lineKey(line.productId, line.variant);
        const idx = prev.findIndex(
          (p) => lineKey(p.productId, p.variant) === key
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...line, serviceId: line.serviceId, serviceName: line.serviceName, servicePrice: line.servicePrice, quoteId: line.quoteId, quoteShipping: line.quoteShipping, quantity: capped };
          return next;
        }
        return [...prev, { ...line, serviceId: line.serviceId, serviceName: line.serviceName, servicePrice: line.servicePrice, quoteId: line.quoteId, quoteShipping: line.quoteShipping, quantity: capped }];
      });
    },
    []
  );

  const removeItem = useCallback((productId: string, variant?: string) => {
    const key = lineKey(productId, variant);
    setItems((prev) =>
      prev.filter((p) => lineKey(p.productId, p.variant) !== key)
    );
  }, []);

  const setQuantity = useCallback(
    (productId: string, quantity: number, variant?: string) => {
      const key = lineKey(productId, variant);
      setItems((prev) =>
        prev
          .map((p) => {
            if (lineKey(p.productId, p.variant) !== key) return p;
            const q = Math.max(0, Math.min(quantity, p.maxStock));
            return { ...p, quantity: q };
          })
          .filter((p) => p.quantity > 0)
      );
    },
    []
  );

  const clear = useCallback(() => setItems([]), []);

  const totalQty = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items]
  );
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (i.price + (i.serviceId ? i.servicePrice || 0 : 0)) * i.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      setQuantity,
      clear,
      totalQty,
      subtotal,
    }),
    [items, addItem, removeItem, setQuantity, clear, totalQty, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
