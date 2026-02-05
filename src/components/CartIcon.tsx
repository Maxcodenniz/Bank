import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';

const CartIcon: React.FC = () => {
  const itemCount = useCartStore((state) => state.getItemCount());

  return (
    <Link
      to="/cart"
      className="relative inline-flex items-center justify-center p-2 text-white hover:text-purple-400 transition-colors"
      aria-label="Shopping cart"
    >
      <ShoppingCart className="h-6 w-6" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      )}
    </Link>
  );
};

export default CartIcon;










