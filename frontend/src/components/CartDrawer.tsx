import { X, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/products";
import { toast } from "sonner";

const CartDrawer = () => {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeItem, clearCart, totalPrice, totalItems } = useCart();

  if (!isCartOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50" onClick={() => setIsCartOpen(false)} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card z-50 shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-bold text-lg text-foreground">Your Cart</h3>
            <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">{totalItems}</span>
          </div>
          <button onClick={() => setIsCartOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-5xl">🛒</span>
              <p className="text-muted-foreground mt-4">Your cart is empty</p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="mt-4 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-3 bg-muted/30 rounded-xl p-3">
                <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover bg-muted" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-sm font-bold text-primary mt-1">{formatPrice(item.price)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center text-foreground">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => { removeItem(item.id); toast.info("Item removed"); }} className="ml-auto p-1 text-destructive hover:text-destructive/80">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 border-t border-border space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-bold text-foreground">{formatPrice(totalPrice)}</span>
            </div>
            <button className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-base hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
              Checkout — {formatPrice(totalPrice)}
            </button>
            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
              <span>💳 Visa/MC</span>
              <span>📱 MTN MoMo</span>
              <span>🏦 Bank Transfer</span>
            </div>
            <button onClick={() => { clearCart(); toast.info("Cart cleared"); }} className="w-full text-sm text-muted-foreground hover:text-destructive transition-colors">
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;