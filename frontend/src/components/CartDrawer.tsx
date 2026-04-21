import { X, Minus, Plus, ShoppingBag, Trash2, MapPin, CreditCard, ChevronRight, CheckCircle2, Shield, Sparkles } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/products";
import { useState } from "react";
import { toast } from "sonner";

type CheckoutStep = "CART" | "ADDRESS" | "PAYMENT" | "SUCCESS";

const CartDrawer = () => {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeItem, clearCart, totalPrice, totalItems } = useCart();
  const { user, token, isAuthenticated, refreshProfile } = useAuth();
  const [step, setStep] = useState<CheckoutStep>("CART");
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = async () => {
    if (!isAuthenticated) return toast.info("Please login to checkout");
    
    if (step === "CART") {
      if (!user?.addresses || user.addresses.length === 0) {
        return toast.error("Please add a delivery address in your profile first");
      }
      setStep("ADDRESS");
      const defaultAddr = user.addresses.find((a: any) => a.is_default) || user.addresses[0];
      setSelectedAddress(defaultAddr.id);
    } else if (step === "ADDRESS") {
      if (!user?.payment_methods || user.payment_methods.length === 0) {
        return toast.error("Please add a payment method in your profile first");
      }
      setStep("PAYMENT");
      const defaultPay = user.payment_methods.find((p: any) => p.is_default) || user.payment_methods[0];
      setSelectedPayment(defaultPay.id);
    } else if (step === "PAYMENT") {
      if (!selectedAddress || !selectedPayment) return toast.error("Please select address and payment method");
      
      setIsProcessing(true);
      try {
        const res = await fetch("/api/user/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            total: totalPrice,
            items: JSON.stringify(items),
            address_id: selectedAddress,
            payment_method_id: selectedPayment
          })
        });
        
        if (!res.ok) throw new Error("Order failed");
        
        setStep("SUCCESS");
        clearCart();
        refreshProfile();
      } catch (err) {
        toast.error("Failed to place order. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const goBack = () => {
    if (step === "ADDRESS") setStep("CART");
    else if (step === "PAYMENT") setStep("ADDRESS");
  };

  if (!isCartOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]" onClick={() => setIsCartOpen(false)} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#08081a] border-l border-white/10 z-[101] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white tracking-tighter uppercase">
                {step === "CART" ? "Your Cart" : step === "ADDRESS" ? "Delivery" : step === "PAYMENT" ? "Payment" : "Confirmed"}
              </h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-0.5">
                {step === "SUCCESS" ? "Order Success" : `${totalItems} items in bag`}
              </p>
            </div>
          </div>
          <button onClick={() => { setIsCartOpen(false); setStep("CART"); }} className="p-2 text-gray-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {step === "CART" && (
            items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                  <ShoppingBag className="w-10 h-10 text-gray-700" />
                </div>
                <h4 className="text-white font-bold mb-2">Cart is empty</h4>
                <p className="text-gray-500 text-sm max-w-[200px]">Add some fresh groceries to get started!</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex gap-4 bg-white/[0.03] border border-white/5 rounded-2xl p-4 group hover:border-white/10 transition-all">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <p className="text-sm font-bold text-white truncate">{item.name}</p>
                      <p className="text-xs text-primary font-black mt-1">RWF {item.price.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 bg-white/5 rounded-lg p-1 px-2 border border-white/10">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 text-gray-400 hover:text-white transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-white w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 text-gray-400 hover:text-white transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="p-1.5 text-gray-600 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          )}

          {step === "ADDRESS" && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Delivery Address</h4>
              {user?.addresses?.map((addr: any) => (
                <div 
                  key={addr.id} 
                  onClick={() => setSelectedAddress(addr.id)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${selectedAddress === addr.id ? "bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(var(--primary),0.1)]" : "bg-white/[0.03] border-white/5 hover:border-white/10"}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${selectedAddress === addr.id ? "bg-primary/20 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-gray-500"}`}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${selectedAddress === addr.id ? "text-white" : "text-gray-400"}`}>{addr.label}</p>
                      <p className="text-xs text-gray-600 truncate">{addr.street}, {addr.city}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "PAYMENT" && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Payment Method</h4>
              {user?.payment_methods?.map((pm: any) => (
                <div 
                  key={pm.id} 
                  onClick={() => setSelectedPayment(pm.id)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${selectedPayment === pm.id ? "bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(var(--primary),0.1)]" : "bg-white/[0.03] border-white/5 hover:border-white/10"}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${selectedPayment === pm.id ? "bg-primary/20 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-gray-500"}`}>
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${selectedPayment === pm.id ? "text-white" : "text-gray-400"}`}>{pm.provider} Card</p>
                      <p className="text-xs text-gray-600 font-mono tracking-tighter">**** {pm.last_four}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "SUCCESS" && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-8 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.1)]">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3 tracking-tighter uppercase">ORDER PLACED!</h2>
              <p className="text-gray-500 text-sm max-w-[240px] leading-relaxed mb-10">Success! Your fresh groceries are being packed and will be shipped soon.</p>
              <button 
                onClick={() => { setIsCartOpen(false); setStep("CART"); }}
                className="w-full bg-white text-[#08081a] font-black py-4 rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest text-xs"
              >
                Back to Shopping
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && step !== "SUCCESS" && (
          <div className="p-8 border-t border-white/5 bg-white/[0.01] space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black text-gray-600 uppercase tracking-widest">
                <span>Subtotal</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-white font-bold">TOTAL</span>
                <span className="text-2xl font-black text-white tracking-tighter">{formatPrice(totalPrice)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 border border-primary/30"
              >
                {isProcessing ? "SECURELY PROCESSING..." : step === "CART" ? "CHECKOUT NOW" : step === "ADDRESS" ? "CONFIRM ADDRESS" : "PLACE ORDER"}
                {!isProcessing && <ChevronRight className="w-4 h-4" />}
              </button>

              {step !== "CART" && (
                <button onClick={goBack} className="w-full py-2 text-[10px] font-black text-gray-600 uppercase tracking-widest hover:text-white transition-colors">
                  Go Back to {step === "ADDRESS" ? "Cart" : "Address Selection"}
                </button>
              )}
            </div>

            {/* Trust Badges - Always visible in footer when items exist */}
            <div className="flex items-center justify-center gap-8 py-2 border-t border-white/5 pt-6">
              {[
                { icon: Shield, color: "text-green-500", label: "SSL SECURE" },
                { icon: CreditCard, color: "text-blue-500", label: "SECURE PAY" },
                { icon: Sparkles, color: "text-orange-500", label: "TRUST SIMBA" }
              ].map((badge, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <badge.icon className={`w-4 h-4 ${badge.color}`} />
                  </div>
                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter">{badge.label}</span>
                </div>
              ))}
            </div>
            
            {step === "CART" && (
              <button onClick={() => { clearCart(); toast.info("Cart cleared"); }} className="w-full text-[9px] uppercase tracking-[0.2em] font-black text-gray-700 hover:text-red-500 transition-colors">
                CLEAR SHOPPING CART
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;