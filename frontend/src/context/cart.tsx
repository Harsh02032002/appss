import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";

export type CartItem = {
  id: string;
  name: string;
  price: number; // paise
  qty: number;
  image: string;
  veg: boolean;
  notes?: string;
};

type CartState = {
  restaurantId: string | null;
  restaurantName: string | null;
  items: CartItem[];
};

const EMPTY: CartState = { restaurantId: null, restaurantName: null, items: [] };
const CART_KEY = "dashbite_cart";

type AddResult = "added" | "replaced";

type CartContextType = CartState & {
  count: number;
  subtotal: number;
  addItem: (
    item: Omit<CartItem, "qty">,
    restaurant: { id: string; name: string },
    qty?: number,
  ) => AddResult;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  getQty: (id: string) => number;
  replaceCart: (items: CartItem[], restaurant: { id: string; name: string }) => void;
  clear: () => void;
  hydrated: boolean;
};

const CartContext = createContext<CartContextType>(null!);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<CartState | null>(CART_KEY, null);
      if (saved && Array.isArray(saved.items)) setState(saved);
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (hydrated) storage.setItem(CART_KEY, state);
  }, [state, hydrated]);

  const addItem: CartContextType["addItem"] = (item, restaurant, qty = 1) => {
    let result: AddResult = "added";
    setState((prev) => {
      if (prev.restaurantId && prev.restaurantId !== restaurant.id) {
        result = "replaced";
        return {
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          items: [{ ...item, qty }],
        };
      }
      const existing = prev.items.find((i) => i.id === item.id);
      const items = existing
        ? prev.items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + qty } : i))
        : [...prev.items, { ...item, qty }];
      return { restaurantId: restaurant.id, restaurantName: restaurant.name, items };
    });
    return result;
  };

  const increment = (id: string) =>
    setState((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)),
    }));

  const decrement = (id: string) =>
    setState((prev) => {
      const items = prev.items
        .map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0);
      return items.length ? { ...prev, items } : EMPTY;
    });

  const replaceCart: CartContextType["replaceCart"] = (items, restaurant) =>
    setState({ restaurantId: restaurant.id, restaurantName: restaurant.name, items });

  const clear = () => setState(EMPTY);

  const getQty = (id: string) => state.items.find((i) => i.id === id)?.qty ?? 0;

  const { count, subtotal } = useMemo(() => {
    return {
      count: state.items.reduce((a, i) => a + i.qty, 0),
      subtotal: state.items.reduce((a, i) => a + i.price * i.qty, 0),
    };
  }, [state.items]);

  return (
    <CartContext.Provider
      value={{ ...state, count, subtotal, addItem, increment, decrement, getQty, replaceCart, clear, hydrated }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
