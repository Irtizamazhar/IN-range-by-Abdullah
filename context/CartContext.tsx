"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  variant?: string;
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

const STORAGE_KEY = "irb-cart";

function lineKey(productId: string, variant?: string) {
  return `${productId}::${variant || ""}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

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
          next[idx] = { ...next[idx], ...line, quantity: capped };
          return next;
        }
        return [...prev, { ...line, quantity: capped }];
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
    () => items.reduce((s, i) => s + i.price * i.quantity, 0),
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
