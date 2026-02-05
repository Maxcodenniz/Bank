import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  eventId: string;
  eventTitle: string;
  eventImage?: string;
  price: number;
  artistName?: string;
  eventDate?: string;
}

interface CartStore {
  items: CartItem[];
  guestEmail: string | null;
  guestPhone: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (eventId: string) => void;
  clearCart: () => void;
  setGuestEmail: (email: string | null) => void;
  setGuestPhone: (phone: string | null) => void;
  getTotalPrice: () => number;
  getItemCount: () => number;
  isInCart: (eventId: string) => boolean;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      guestEmail: null,
      guestPhone: null,
      addItem: (item) => {
        const currentItems = get().items;
        // Check if item already exists
        if (currentItems.some(i => i.eventId === item.eventId)) {
          return; // Don't add duplicates
        }
        set({ items: [...currentItems, item] });
      },
      removeItem: (eventId) => {
        set({ items: get().items.filter(item => item.eventId !== eventId) });
      },
      clearCart: () => {
        set({ items: [], guestEmail: null, guestPhone: null });
      },
      setGuestEmail: (email) => {
        set({ guestEmail: email });
      },
      setGuestPhone: (phone) => {
        set({ guestPhone: phone });
      },
      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + item.price, 0);
      },
      getItemCount: () => {
        return get().items.length;
      },
      isInCart: (eventId) => {
        return get().items.some(item => item.eventId === eventId);
      },
    }),
    {
      name: 'dreemystar-cart', // localStorage key
    }
  )
);


