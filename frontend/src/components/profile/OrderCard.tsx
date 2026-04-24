import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ChevronRight, CheckCircle2, Globe, MapPin, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface OrderCardProps {
  order: any;
  onCancel: () => void;
}

const OrderCard = ({ order, onCancel }: OrderCardProps) => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const items = JSON.parse(order.items || "[]");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ready for Pick-up":
      case "Picked Up":
      case "Delivered": return "text-green-500 bg-green-500/10";
      case "Cancelled": return "text-red-500 bg-red-500/10";
      case "Shipped": return "text-blue-500 bg-blue-500/10";
      case "Assigned": return "text-blue-500 bg-blue-500/10";
      case "Preparing":
      case "Processing": return "text-orange-500 bg-orange-500/10";
      default: return "text-gray-400 bg-white/5";
    }
  };

  const pickupStatuses = ["Pending", "Assigned", "Preparing", "Ready for Pick-up", "Picked Up"];
  const deliveryStatuses = ["Pending", "Processing", "Shipped", "Delivered"];
  const timelineStatuses = order.fulfillment_type === "pickup" ? pickupStatuses : deliveryStatuses;
  const timelineLabels = order.fulfillment_type === "pickup"
    ? ["order.ordered", "order.assigned", "order.preparing", "order.ready_pickup", "order.picked_up"]
    : ["order.ordered", "order.processing", "order.shipped", "order.delivered"];
  const statusIndex = timelineStatuses.indexOf(order.status);
  const isCancellable = ["Pending", "Processing"].includes(order.status);
  const isReturnable = order.status === "Delivered";
  const canReviewBranch = order.fulfillment_type === "pickup" && order.status === "Picked Up" && !reviewed;

  useEffect(() => {
    let cancelled = false;

    const loadExistingReview = async () => {
      if (!token || order.fulfillment_type !== "pickup") return;

      try {
        const res = await fetch(`/api/user/orders/${order.id}/branch-review`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data) {
          setReviewed(true);
          if (typeof data.rating === "number") setReviewRating(data.rating);
          if (typeof data.comment === "string") setReviewComment(data.comment);
        }
      } catch {
        // Ignore read failures and keep the inline form available.
      }
    };

    loadExistingReview();
    return () => {
      cancelled = true;
    };
  }, [order.fulfillment_type, order.id, token]);

  const handleCancel = async () => {
    if (!confirm(t("order.confirm_cancel"))) return;
    try {
      const res = await fetch(`/api/user/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      onCancel();
      toast.success(t("order.cancel_success"));
    } catch (err) {
      toast.error(t("order.cancel_failed"));
    }
  };

  const handleReturn = async () => {
    try {
      const res = await fetch(`/api/user/orders/${order.id}/return`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      onCancel();
      toast.success(t("order.return_success"));
    } catch (err) {
      toast.error(t("order.return_failed"));
    }
  };

  const submitBranchReview = async () => {
    try {
      const res = await fetch(`/api/user/orders/${order.id}/branch-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      if (!res.ok) throw new Error();
      setReviewed(true);
      toast.success(t("review.thanks"));
    } catch (err) {
      toast.error(t("review.failed"));
    }
  };

  return (
    <div className={`rounded-2xl border transition-all ${isExpanded ? "bg-white/[0.04] border-white/20 shadow-2xl" : "bg-white/[0.02] border-white/5 hover:border-white/10"}`}>
      <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
            <ShoppingBag className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-white">{t("order.order")} #{order.id}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${getStatusColor(order.status)}`}>
                {order.status}
              </span>
            </div>
            <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()} • {items.length} {t("order.items")}</p>
          </div>
        </div>
        <div className="text-right flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-tighter font-bold">{t("order.total")}</p>
            <p className="text-sm font-bold text-white">RWF {order.total.toLocaleString()}</p>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-6 pt-2 border-t border-white/5 space-y-8">
              {/* Items */}
              <div className="space-y-3">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <img src={item.image} className="w-8 h-8 rounded-md bg-white/5 object-cover" />
                    <p className="text-xs text-gray-300 flex-1">{item.name} <span className="text-gray-600 ml-1">x{item.quantity}</span></p>
                    <p className="text-xs font-medium text-white">RWF {(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Tracking Timeline */}
              {order.status !== "Cancelled" && order.status !== "Returned" && (
                <div className="relative pt-6 pb-2 px-2">
                  <div className="absolute top-[38px] left-8 right-8 h-0.5 bg-white/5">
                    <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${Math.max(0, statusIndex) * 33.33}%` }} />
                  </div>
                  <div className="flex justify-between relative">
                    {timelineLabels.map((label, idx) => {
                      const isActive = statusIndex >= idx;
                      const Icon = [CheckCircle2, ShoppingBag, Globe, MapPin, CheckCircle2][idx];
                      return (
                        <div key={label} className="flex flex-col items-center gap-2 group">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 z-10 ${
                            isActive ? "bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/30" : "bg-card border-white/10 text-gray-600"
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-tighter ${isActive ? "text-white" : "text-gray-600"}`}>{t(label)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {order.fulfillment_type === "pickup" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black mb-1">{t("order.pickup_branch")}</p>
                    <p className="text-xs font-bold text-white">{order.pickup_branch}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black mb-1">{t("order.pickup_time")}</p>
                    <p className="text-xs font-bold text-white">{order.pickup_time}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black mb-1">{t("order.deposit_paid")}</p>
                    <p className="text-xs font-bold text-white">RWF {(order.deposit_amount || 0).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {canReviewBranch && (
                <div className="rounded-3xl bg-primary/5 border border-primary/20 p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-white">{t("review.title")}</h3>
                    <p className="text-xs text-gray-500 mt-1">{order.pickup_branch}</p>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setReviewRating(star)} className="p-1">
                        <Star className={`w-6 h-6 ${star <= reviewRating ? "fill-yellow-400 text-yellow-400" : "text-gray-600"}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={t("review.comment")}
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white outline-none placeholder:text-gray-600 focus:border-primary/50"
                  />
                  <button onClick={submitBranchReview} className="rounded-xl bg-primary px-5 py-3 text-xs font-black text-white hover:brightness-110 transition-all">
                    {t("review.submit")}
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="text-xs text-gray-500">
                  {order.tracking_number && (
                    <p>{t("order.tracking")}: <span className="text-white font-mono">{order.tracking_number}</span></p>
                  )}
                </div>
                <div className="flex gap-2">
                  {isCancellable && (
                    <button onClick={handleCancel} className="px-4 py-2 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20">
                      {t("order.cancel")}
                    </button>
                  )}
                  {isReturnable && (
                    <button onClick={handleReturn} className="px-4 py-2 rounded-lg text-[11px] font-bold bg-white/5 text-white hover:bg-white/10 transition-all border border-white/10">
                      {t("order.return")}
                    </button>
                  )}
                  <button className="px-4 py-2 rounded-lg text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20">
                    {t("order.invoice")}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderCard;
