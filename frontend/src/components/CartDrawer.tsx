import { X, Minus, Plus, ShoppingBag, Trash2, MapPin, Smartphone, ChevronRight, CheckCircle2, Shield, Clock, Store, Calendar as CalendarIcon, Truck } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/products";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BRANCH_NAMES } from "@/lib/branches";
import { motion, AnimatePresence } from "framer-motion";
import { buildApiUrl, readErrorMessage, readJsonResponse } from "@/lib/api";

type CheckoutStep = "CART" | "BRANCH" | "DEPOSIT" | "SUCCESS";
type PersistedCheckoutStep = Exclude<CheckoutStep, "SUCCESS">;
type FulfillmentType = "pickup" | "delivery";

type CheckoutDraft = {
  step: PersistedCheckoutStep;
  fulfillmentType: FulfillmentType;
  selectedBranch: string;
  pickupDate: string;
  pickupHour: string;
  deliveryLocation: string;
  momoPhone: string;
};

type CreatedOrder = {
  id: number;
  fulfillment_type?: FulfillmentType;
  pickup_branch?: string;
  pickup_time?: string;
  delivery_location?: string;
  deposit_amount?: number;
};

const CHECKOUT_DRAFT_STORAGE_KEY = "simba-checkout-draft";

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatPickupDateTime = (value: Date) => {
  const year = value.getFullYear();
  const month = pad2(value.getMonth() + 1);
  const day = pad2(value.getDate());
  const hours = pad2(value.getHours());
  const minutes = pad2(value.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const formatPickupDate = (value: Date) => {
  const year = value.getFullYear();
  const month = pad2(value.getMonth() + 1);
  const day = pad2(value.getDate());
  return `${year}-${month}-${day}`;
};

const formatPickupTime = (value: Date) => `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;

const combinePickupDateTime = (date: Date, time: string) => {
  const match = time.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";
  const [, hour, minute] = match;
  return `${formatPickupDate(date)} ${hour}:${minute}`;
};

const getTodayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getTomorrowEnd = () => {
  const tomorrow = getTodayStart();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);
  return tomorrow;
};

const getDefaultPickupSelection = () => {
  const nextHour = new Date();
  nextHour.setSeconds(0, 0);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return {
    date: nextHour,
    time: formatPickupTime(nextHour),
  };
};

const getDefaultCheckoutDraft = (): CheckoutDraft => {
  const selection = getDefaultPickupSelection();
  return {
    step: "CART",
    fulfillmentType: "pickup",
    selectedBranch: BRANCH_NAMES[0],
    pickupDate: formatPickupDate(selection.date),
    pickupHour: selection.time,
    deliveryLocation: "",
    momoPhone: "",
  };
};

const readCheckoutDraft = (): CheckoutDraft => {
  if (typeof window === "undefined") return getDefaultCheckoutDraft();

  try {
    const raw = window.localStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    if (!raw) return getDefaultCheckoutDraft();

    const parsed = JSON.parse(raw);
    const fallback = getDefaultCheckoutDraft();
    const pickupDate = typeof parsed?.pickupDate === "string" ? parsed.pickupDate : fallback.pickupDate;

    return {
      step: parsed?.step === "BRANCH" || parsed?.step === "DEPOSIT" ? parsed.step : "CART",
      fulfillmentType: parsed?.fulfillmentType === "delivery" ? "delivery" : "pickup",
      selectedBranch:
        typeof parsed?.selectedBranch === "string" && BRANCH_NAMES.includes(parsed.selectedBranch)
          ? parsed.selectedBranch
          : fallback.selectedBranch,
      pickupDate,
      pickupHour: typeof parsed?.pickupHour === "string" ? parsed.pickupHour : fallback.pickupHour,
      deliveryLocation: typeof parsed?.deliveryLocation === "string" ? parsed.deliveryLocation : "",
      momoPhone: typeof parsed?.momoPhone === "string" ? parsed.momoPhone : "",
    };
  } catch {
    return getDefaultCheckoutDraft();
  }
};

const parseStoredPickupDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime()) || formatPickupDate(parsed) !== value) {
    return undefined;
  }
  return parsed;
};

const validatePickupSelection = (date: Date | undefined, time: string) => {
  if (!date || !time.trim()) {
    return "required";
  }

  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return "time_format";
  }

  const [, hour, minute] = match;
  const pickupDate = new Date(date);
  pickupDate.setHours(Number(hour), Number(minute), 0, 0);

  if (Number.isNaN(pickupDate.getTime()) || combinePickupDateTime(date, trimmed) !== formatPickupDateTime(pickupDate)) {
    return "time_format";
  }

  const now = new Date();
  now.setSeconds(0, 0);
  const tomorrowEnd = getTomorrowEnd();

  if (pickupDate < now) {
    return "past";
  }
  if (pickupDate > tomorrowEnd) {
    return "late";
  }

  return null;
};

const getPickupValidationMessage = (
  validationResult: string | null,
  t: (key: string) => string,
) => {
  if (validationResult === "time_format") return t("pickup.invalid_time_format");
  if (validationResult === "past") return t("pickup.invalid_time_past");
  if (validationResult === "late") return t("pickup.invalid_time_late");
  return t("pickup.select_branch_time");
};

const CartDrawer = () => {
  const { t } = useLanguage();
  const { items, selectedBranch: cartBranch, isCartOpen, setIsCartOpen, updateQuantity, removeItem, clearCart, totalPrice, totalItems } = useCart();
  const { token, isAuthenticated, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const initialDraft = readCheckoutDraft();
  const [step, setStep] = useState<CheckoutStep>(initialDraft.step);
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(initialDraft.fulfillmentType);
  const [selectedBranch, setSelectedBranch] = useState(cartBranch ?? initialDraft.selectedBranch);
  const [pickupDate, setPickupDate] = useState<Date | undefined>(() => {
    const parsedDate = parseStoredPickupDate(initialDraft.pickupDate);
    return parsedDate ?? getDefaultPickupSelection().date;
  });
  const [pickupHour, setPickupHour] = useState(initialDraft.pickupHour);
  const [deliveryLocation, setDeliveryLocation] = useState(initialDraft.deliveryLocation);
  const [momoPhone, setMomoPhone] = useState(initialDraft.momoPhone);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentOrder, setRecentOrder] = useState<CreatedOrder | null>(null);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const { data: branchRatings = [], refetch: refetchBranchRatings } = useQuery({
    queryKey: ["branch-ratings"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/branches/ratings"));
      if (!res.ok) return [];
      return readJsonResponse<any[]>(res, "Branch ratings response was empty.");
    },
  });

  const ratingByBranch = branchRatings.reduce((acc: Record<string, any>, item: any) => {
    acc[item.branch] = item;
    return acc;
  }, {});

  const depositAmount = Math.ceil(totalPrice * 0.1);
  const pickupTime = pickupDate ? combinePickupDateTime(pickupDate, pickupHour) : "";

  useEffect(() => {
    if (step === "SUCCESS") {
      window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
      return;
    }

    const draft: CheckoutDraft = {
      step,
      fulfillmentType,
      selectedBranch,
      pickupDate: pickupDate ? formatPickupDate(pickupDate) : "",
      pickupHour,
      deliveryLocation,
      momoPhone,
    };
    window.localStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [deliveryLocation, fulfillmentType, momoPhone, pickupDate, pickupHour, selectedBranch, step]);

  const resetPickupDraft = () => {
    const fallback = getDefaultCheckoutDraft();
    setStep("CART");
    setFulfillmentType(fallback.fulfillmentType);
    setSelectedBranch(fallback.selectedBranch);
    setPickupDate(parseStoredPickupDate(fallback.pickupDate));
    setPickupHour(fallback.pickupHour);
    setDeliveryLocation(fallback.deliveryLocation);
    setMomoPhone(fallback.momoPhone);
    setRecentOrder(null);
    setShowRatingPrompt(false);
    setRatingValue(5);
    setRatingComment("");
    window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
  };

  const closeDrawer = () => {
    setIsCartOpen(false);
    if (step === "SUCCESS") {
      resetPickupDraft();
    }
  };

  const submitBranchRating = async () => {
    if (!recentOrder?.id || !token) return;

    setIsSubmittingRating(true);
    try {
      const res = await fetch(buildApiUrl(`/api/user/orders/${recentOrder.id}/branch-review`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: ratingValue,
          comment: ratingComment.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();

      await refetchBranchRatings();
      queryClient.invalidateQueries({ queryKey: ["branch-ratings"] });
      toast.success(t("review.thanks"));
      setShowRatingPrompt(false);
    } catch {
      toast.error(t("review.failed"));
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) return toast.info(t("cart.login_checkout"));

    if (step === "CART") {
      setStep("BRANCH");
      return;
    }

    if (step === "BRANCH") {
      if (fulfillmentType === "pickup") {
        if (!selectedBranch || !pickupTime) return toast.error(t("pickup.select_branch_time"));
        const pickupTimeError = validatePickupSelection(pickupDate, pickupHour);
        if (pickupTimeError) return toast.error(getPickupValidationMessage(pickupTimeError, t));
      } else if (!deliveryLocation.trim()) {
        return toast.error(t("checkout.enter_delivery_location"));
      }
      setStep("DEPOSIT");
      return;
    }

    if (step === "DEPOSIT") {
      if (fulfillmentType === "pickup") {
        const pickupTimeError = validatePickupSelection(pickupDate, pickupHour);
        if (pickupTimeError) {
          setStep("BRANCH");
          return toast.error(getPickupValidationMessage(pickupTimeError, t));
        }
      } else if (!deliveryLocation.trim()) {
        setStep("BRANCH");
        return toast.error(t("checkout.enter_delivery_location"));
      }

      if (!momoPhone.trim()) return toast.error(t("pickup.enter_momo"));

      setIsProcessing(true);
      try {
        const res = await fetch(buildApiUrl("/api/user/orders"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            total: totalPrice,
            items: JSON.stringify(items),
            fulfillment_type: fulfillmentType,
            pickup_branch: fulfillmentType === "pickup" ? selectedBranch : undefined,
            pickup_time: fulfillmentType === "pickup" ? pickupTime : undefined,
            delivery_location: fulfillmentType === "delivery" ? deliveryLocation.trim() : undefined,
            deposit_method: `MTN MoMo ${momoPhone.trim()}`,
          }),
        });

        if (!res.ok) {
          const message = await readErrorMessage(res, t("cart.order_failed"));
          throw new Error(message);
        }

        const createdOrder = await readJsonResponse<CreatedOrder>(res, t("cart.order_failed"));

        setStep("SUCCESS");
        setRecentOrder(createdOrder);
        setShowRatingPrompt((createdOrder.fulfillment_type ?? fulfillmentType) === "pickup");
        setRatingValue(5);
        setRatingComment("");
        clearCart();
        await refreshProfile();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("cart.order_failed"));
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

  const pickupDateValue = pickupDate ? formatPickupDate(pickupDate) : "";
  const todayValue = formatPickupDate(getTodayStart());
  const tomorrowValue = formatPickupDate(getTomorrowEnd());
  const now = new Date();
  now.setSeconds(0, 0);
  const todayMinTime = formatPickupTime(now);
  const timeMin = pickupDateValue === todayValue ? todayMinTime : "00:00";
  const timeMax = pickupDateValue === tomorrowValue ? "23:59" : undefined;

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
                {step === "CART" ? t("cart.header_cart") : step === "BRANCH" ? t("checkout.header_fulfillment") : step === "DEPOSIT" ? t("pickup.header_deposit") : t("cart.header_confirmed")}
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
                  <Truck className="w-5 h-5 text-primary" />
                  <h4 className="text-sm font-black text-white">{t("checkout.choose_fulfillment")}</h4>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{t("checkout.fulfillment_desc")}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFulfillmentType("pickup")}
                  className={`rounded-2xl border p-4 text-left transition-all ${fulfillmentType === "pickup" ? "bg-primary/10 border-primary/40 text-white" : "bg-white/[0.03] border-white/5 text-gray-400 hover:border-white/10"}`}
                >
                  <Store className={`mb-3 h-5 w-5 ${fulfillmentType === "pickup" ? "text-primary" : "text-gray-600"}`} />
                  <p className="text-sm font-bold">{t("checkout.fulfillment_pickup")}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{t("checkout.fulfillment_pickup_desc")}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentType("delivery")}
                  className={`rounded-2xl border p-4 text-left transition-all ${fulfillmentType === "delivery" ? "bg-primary/10 border-primary/40 text-white" : "bg-white/[0.03] border-white/5 text-gray-400 hover:border-white/10"}`}
                >
                  <Truck className={`mb-3 h-5 w-5 ${fulfillmentType === "delivery" ? "text-primary" : "text-gray-600"}`} />
                  <p className="text-sm font-bold">{t("checkout.fulfillment_delivery")}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{t("checkout.fulfillment_delivery_desc")}</p>
                </button>
              </div>

              {fulfillmentType === "pickup" ? (
                <>
                  <div className="grid grid-cols-1 gap-2">
                    {BRANCH_NAMES.map((branch) => (
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
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                        <div className="relative">
                          <CalendarIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                          <input
                            type="date"
                            value={pickupDateValue}
                            min={todayValue}
                            max={tomorrowValue}
                            onChange={(e) => setPickupDate(parseStoredPickupDate(e.target.value))}
                            className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-sm font-bold text-white focus:outline-none focus:border-primary/50"
                          />
                        </div>

                        <div className="relative">
                          <Clock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                          <input
                            type="time"
                            value={pickupHour}
                            onChange={(e) => setPickupHour(e.target.value)}
                            min={timeMin}
                            max={timeMax}
                            step={60}
                            className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50"
                          />
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t("pickup.time_format_hint")}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3 pt-2">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t("checkout.delivery_location")}</h4>
                  <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <textarea
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      rows={4}
                      placeholder={t("checkout.delivery_location_placeholder")}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50"
                    />
                    <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t("checkout.delivery_location_desc")}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "DEPOSIT" && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <div className="flex items-start gap-3">
                  {fulfillmentType === "pickup" ? <MapPin className="w-5 h-5 text-primary mt-0.5" /> : <Truck className="w-5 h-5 text-primary mt-0.5" />}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t("checkout.method")}</p>
                    <p className="text-sm font-bold text-white">{fulfillmentType === "pickup" ? t("checkout.fulfillment_pickup") : t("checkout.fulfillment_delivery")}</p>
                  </div>
                </div>
                {fulfillmentType === "pickup" ? (
                  <>
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
                  </>
                ) : (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t("checkout.delivery_location")}</p>
                      <p className="text-sm font-bold text-white whitespace-pre-wrap">{deliveryLocation.trim()}</p>
                    </div>
                  </div>
                )}
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
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{t("checkout.method")}</p>
                <p className="text-sm text-white font-bold mb-2">{fulfillmentType === "pickup" ? t("checkout.fulfillment_pickup") : t("checkout.fulfillment_delivery")}</p>
                {fulfillmentType === "pickup" ? (
                  <>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{t("pickup.branch")}</p>
                    <p className="text-sm text-white font-bold mb-2">{recentOrder?.pickup_branch || selectedBranch}</p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{t("pickup.pickup_time")}</p>
                    <p className="text-sm text-white font-bold">{recentOrder?.pickup_time || pickupTime}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{t("checkout.delivery_location")}</p>
                    <p className="text-sm text-white font-bold whitespace-pre-wrap">{recentOrder?.delivery_location || deliveryLocation.trim()}</p>
                  </>
                )}
              </div>
              {fulfillmentType === "pickup" && (
                <button
                  onClick={() => setShowRatingPrompt(true)}
                  className="mb-4 w-full rounded-2xl border border-primary/30 bg-primary/10 py-4 font-black uppercase tracking-widest text-xs text-primary transition-all hover:bg-primary/20"
                >
                  {t("review.rate_now")}
                </button>
              )}
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
                {isProcessing ? t("cart.processing") : step === "CART" ? t("checkout.choose_fulfillment_cta") : step === "BRANCH" ? t("checkout.continue_deposit") : t("checkout.pay_deposit", { amount: formatPrice(depositAmount) })}
                {!isProcessing && <ChevronRight className="w-4 h-4" />}
              </button>

              {step !== "CART" && (
                <button onClick={goBack} className="w-full py-2 text-[10px] font-black text-gray-600 uppercase tracking-widest hover:text-white transition-colors">
                  {step === "BRANCH" ? t("cart.go_back_cart") : t("checkout.back_fulfillment")}
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-8 py-2 border-t border-white/5 pt-6">
              {[
                { icon: Shield, color: "text-green-500", label: t("trust.ssl_secured") },
                { icon: Smartphone, color: "text-blue-500", label: "MTN MOMO" },
                { icon: fulfillmentType === "pickup" ? Store : Truck, color: "text-orange-500", label: fulfillmentType === "pickup" ? t("pickup.branch_ready") : t("checkout.delivery_ready") },
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

      <AnimatePresence>
        {showRatingPrompt && recentOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm"
              onClick={() => setShowRatingPrompt(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="fixed left-1/2 top-1/2 z-[131] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/10 bg-[#0b1020] p-6 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setShowRatingPrompt(false)}
                className="absolute right-4 top-4 rounded-full border border-white/10 p-2 text-gray-400 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">{t("review.branch_rating")}</p>
              <h3 className="mt-3 text-2xl font-black tracking-tight text-white">{t("review.after_purchase_title")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{t("review.after_purchase_desc")}</p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t("pickup.branch")}</p>
                <p className="mt-1 text-sm font-bold text-white">{recentOrder.pickup_branch || selectedBranch}</p>
              </div>

              <div className="mt-5 flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingValue(star)}
                    className="rounded-2xl border border-white/10 p-2 transition-transform hover:scale-105"
                  >
                    <span className={`text-2xl ${star <= ratingValue ? "text-yellow-400" : "text-gray-600"}`}>★</span>
                  </button>
                ))}
              </div>

              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder={t("review.comment")}
                rows={4}
                className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-primary/50"
              />

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={submitBranchRating}
                  disabled={isSubmittingRating}
                  className="flex-1 rounded-2xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-60"
                >
                  {isSubmittingRating ? t("cart.processing") : t("review.submit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRatingPrompt(false)}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-300 transition-all hover:bg-white/[0.05]"
                >
                  {t("review.maybe_later")}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default CartDrawer;
