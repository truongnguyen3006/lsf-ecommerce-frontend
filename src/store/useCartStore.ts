import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  addToCart: (item: CartItem, quantity: number) => void;
  updateQuantity: (skuCode: string, quantity: number) => void;
  removeFromCart: (skuCode: string) => void;
  clearCart: () => void;
  totalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addToCart: (newItem: CartItem, quantity: number) => {
        const currentItems = get().items;
        const existingItem = currentItems.find((item) => item.skuCode === newItem.skuCode);

        if (existingItem) {
          const newItems = currentItems.map((item) =>
            item.skuCode === newItem.skuCode
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          );
          set({ items: newItems });
          return;
        }

        set({ items: [...currentItems, { ...newItem, quantity }] });
      },

      updateQuantity: (skuCode, quantity) => {
        const nextQuantity = Math.max(1, quantity);
        set({
          items: get().items.map((item) =>
            item.skuCode === skuCode ? { ...item, quantity: nextQuantity } : item,
          ),
        });
      },

      removeFromCart: (skuCode) => {
        set({ items: get().items.filter((item) => item.skuCode !== skuCode) });
      },

      clearCart: () => set({ items: [] }),

      totalPrice: () => get().items.reduce((total, item) => total + item.price * item.quantity, 0),
    }),
    {
      name: 'flash-sale-cart',
    },
  ),
);
