import { X, Minus, Plus, ShoppingBag, Trash2, MapPin, Smartphone, ChevronRight, CheckCircle2, Shield, Clock, Store } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/products";
import { useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";

type CheckoutStep = "CART" | "BRANCH" | "DEPOSIT" | "SUCCESS";

const PICKUP_BRANCHES = [
  "Simba Supermarket Remera",
  "Simba Supermarket Kimironko",
  "Simba Supermarket Kacyiru",
  "Simba Supermarket Nyamirambo",
  "Simba Supermarket Gikondo",
  "Simba Supermarket Kanombe",
  "Simba Supermarket Kinyinya",
  "Simba Supermarket Kibagabaga",
  "Simba Supermarket Nyanza",
];

const pickupTimes = ["Today 10:00", "Today 12:00", "Today 14:00", "Today 16:00", "Today 18:00", "Tomorrow 10:00", "Tomorrow 14:00", "Tomorrow 18:00"];
const PICKUP_DEPOSIT_AMOUNT = 500;

const CartDrawer = () => {
  const { t } = useLanguage();
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeItem, clearCart, totalPrice, totalItems } = useCart();
  const { token, isAuthenticated, refreshProfile } = useAuth();
  const [step, setStep] = useState<CheckoutStep>("CART");
  const [selectedBranch, setSelectedBranch] = useState(PICKUP_BRANCHES[0]);
  const [pickupTime, setPickupTime] = useState(pickupTimes[2]);
  const [momoPhone, setMomoPhone] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { data: branchRatings = [] } = useQuery({
    queryKey: ["branch-ratings"],
    queryFn: async () => {
      const res = await fetch("/api/branches/ratings");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const ratingByBranch = branchRatings.reduce((acc: Record<string, any>, item: any) => {
    acc[item.branch] = item;
    return acc;
  }, {});

  const depositAmount = PICKUP_DEPOSIT_AMOUNT;

  const closeDrawer = () => {
    setIsCartOpen(false);
    setStep("CART");
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) return toast.info(t("cart.login_checkout"));

    if (step === "CART") {
      setStep("BRANCH");
      return;
    }

    if (step === "BRANCH") {
      if (!selectedBranch || !pickupTime) return toast.error(t("pickup.select_branch_time"));
      setStep("DEPOSIT");
      return;
    }

    if (step === "DEPOSIT") {
      if (!momoPhone.trim()) return toast.error(t("pickup.enter_momo"));

      setIsProcessing(true);
      try {
        const res = await fetch("/api/user/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            total: totalPrice,
            items: JSON.stringify(items),
            fulfillment_type: "pickup",
            pickup_branch: selectedBranch,
            pickup_time: pickupTime,
            deposit_amount: depositAmount,
            deposit_method: `MTN MoMo ${momoPhone.trim()}`,
          }),
        });

        if (!res.ok) throw new Error("Order failed");

        setStep("SUCCESS");
        clearCart();
        refreshProfile();
      } catch (err) {
        toast.error(t("cart.order_failed"));
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const goBack = () => {
    if (step === "BRANCH") setStep("CART");
    else if (step === "DEPOSIT") setStep("BRANCH");
  };

  if (!isCartOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]" onClick={closeDrawer} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#08081a] border-l border-white/10 z-[101] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white tracking-tighter uppercase">
                {step === "CART" ? t("cart.header_cart") : step === "BRANCH" ? t("pickup.header_branch") : step === "DEPOSIT" ? t("pickup.header_deposit") : t("cart.header_confirmed")}
              </h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-0.5">
                {step === "SUCCESS" ? t("pickup.order_success") : `${totalItems} ${t("cart.items_in_bag")}`}
              </p>
            </div>
          </div>
          <button onClick={closeDrawer} className="p-2 text-gray-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {step === "CART" && (
            items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                  <ShoppingBag className="w-10 h-10 text-gray-700" />
                </div>
                <h4 className="text-white font-bold mb-2">{t("cart.empty_title")}</h4>
                <p className="text-gray-500 text-sm max-w-[200px]">{t("cart.empty_desc")}</p>
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
                      <p className="text-xs text-primary font-black mt-1">{formatPrice(item.price)}</p>
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

          {step === "BRANCH" && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Store className="w-5 h-5 text-primary" />
                  <h4 className="text-sm font-black text-white">{t("pickup.choose_branch")}</h4>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{t("pickup.branch_desc")}</p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {PICKUP_BRANCHES.map((branch) => (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => setSelectedBranch(branch)}
                    className={`text-left p-4 rounded-2xl border transition-all ${selectedBranch === branch ? "bg-primary/10 border-primary/40 text-white" : "bg-white/[0.03] border-white/5 text-gray-400 hover:border-white/10"}`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className={`w-4 h-4 ${selectedBranch === branch ? "text-primary" : "text-gray-600"}`} />
                      <div className="flex-1">
                        <span className="text-sm font-bold">{branch}</span>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          ★ {(ratingByBranch[branch]?.average_rating || 4.6).toFixed(1)}
                          {ratingByBranch[branch]?.review_count ? ` (${ratingByBranch[branch].review_count})` : " (new)"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t("pickup.pickup_time")}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {pickupTimes.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setPickupTime(time)}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition-all ${pickupTime === time ? "bg-primary text-white border-primary" : "bg-white/[0.03] border-white/5 text-gray-400 hover:border-white/10"}`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "DEPOSIT" && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t("pickup.branch")}</p>
                    <p className="text-sm font-bold text-white">{selectedBranch}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t("pickup.pickup_time")}</p>
                    <p className="text-sm font-bold text-white">{pickupTime}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Smartphone className="w-5 h-5 text-green-500" />
                  <h4 className="text-sm font-black text-white">{t("pickup.momo_deposit")}</h4>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">{t("pickup.deposit_desc")}</p>
                <div className="flex items-center justify-between mb-4 rounded-2xl bg-black/20 border border-white/5 p-4">
                  <span className="text-xs font-bold text-gray-400">{t("pickup.deposit_due")}</span>
                  <span className="text-lg font-black text-white">{formatPrice(depositAmount)}</span>
                </div>
                <input
                  value={momoPhone}
                  onChange={(e) => setMomoPhone(e.target.value)}
                  placeholder={t("pickup.momo_phone")}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
          )}

          {step === "SUCCESS" && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-8 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.1)]">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3 tracking-tighter uppercase">{t("pickup.order_sent")}</h2>
              <p className="text-gray-500 text-sm max-w-[280px] leading-relaxed mb-6">{t("pickup.order_sent_desc")}</p>
              <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-8 text-left">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{t("pickup.branch")}</p>
                <p className="text-sm text-white font-bold mb-2">{selectedBranch}</p>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{t("pickup.pickup_time")}</p>
                <p className="text-sm text-white font-bold">{pickupTime}</p>
              </div>
              <button onClick={closeDrawer} className="w-full bg-white text-[#08081a] font-black py-4 rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest text-xs">
                {t("cart.back_shopping")}
              </button>
            </div>
          )}
        </div>

        {items.length > 0 && step !== "SUCCESS" && (
          <div className="p-8 border-t border-white/5 bg-white/[0.01] space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black text-gray-600 uppercase tracking-widest">
                <span>{t("cart.subtotal")}</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-black text-gray-600 uppercase tracking-widest">
                <span>{t("pickup.deposit")}</span>
                <span>{formatPrice(depositAmount)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-white font-bold">{t("cart.total")}</span>
                <span className="text-2xl font-black text-white tracking-tighter">{formatPrice(totalPrice)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 border border-primary/30"
              >
                {isProcessing ? t("cart.processing") : step === "CART" ? t("pickup.choose_pickup") : step === "BRANCH" ? t("pickup.continue_deposit") : t("pickup.pay_deposit")}
                {!isProcessing && <ChevronRight className="w-4 h-4" />}
              </button>

              {step !== "CART" && (
                <button onClick={goBack} className="w-full py-2 text-[10px] font-black text-gray-600 uppercase tracking-widest hover:text-white transition-colors">
                  {step === "BRANCH" ? t("cart.go_back_cart") : t("pickup.back_branch")}
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-8 py-2 border-t border-white/5 pt-6">
              {[
                { icon: Shield, color: "text-green-500", label: t("trust.ssl_secured") },
                { icon: Smartphone, color: "text-blue-500", label: "MTN MOMO" },
                { icon: Store, color: "text-orange-500", label: t("pickup.branch_ready") },
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
              <button onClick={() => { clearCart(); toast.info(t("cart.cleared")); }} className="w-full text-[9px] uppercase tracking-[0.2em] font-black text-gray-700 hover:text-red-500 transition-colors">
                {t("cart.clear_full")}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;
