import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { BRANCH_NAMES } from "@/lib/branches";

export interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  unit: string;
}

interface CartContextType {
  items: CartItem[];
  selectedBranch: string | null;
  addItem: (product: Omit<CartItem, "quantity">) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
  setSelectedBranch: (branch: string | null) => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = "simba-cart";
const CART_BRANCH_STORAGE_KEY = "simba-cart-branch";

const readStoredCart = (): CartItem[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is CartItem =>
        item &&
        typeof item.id === "number" &&
        typeof item.name === "string" &&
        typeof item.price === "number" &&
        typeof item.image === "string" &&
        typeof item.quantity === "number" &&
        typeof item.unit === "string",
    );
  } catch {
    return [];
  }
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(readStoredCart);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const storedBranch = window.localStorage.getItem(CART_BRANCH_STORAGE_KEY);
    return storedBranch && BRANCH_NAMES.includes(storedBranch) ? storedBranch : null;
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (selectedBranch) {
      window.localStorage.setItem(CART_BRANCH_STORAGE_KEY, selectedBranch);
    } else {
      window.localStorage.removeItem(CART_BRANCH_STORAGE_KEY);
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (items.length === 0 && selectedBranch) {
      setSelectedBranch(null);
    }
  }, [items.length, selectedBranch]);

  const addItem = useCallback((product: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity } : i));
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setSelectedBranch(null);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, selectedBranch, addItem, removeItem, updateQuantity, clearCart, setSelectedBranch, totalItems, totalPrice, isCartOpen, setIsCartOpen }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
