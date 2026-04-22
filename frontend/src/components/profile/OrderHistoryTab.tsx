import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import OrderCard from "./OrderCard";
import { useLanguage } from "@/contexts/LanguageContext";

interface OrderHistoryTabProps {
  orders: any[];
  onRefresh: () => void;
}

const OrderHistoryTab = ({ orders, onRefresh }: OrderHistoryTabProps) => {
  const { t } = useLanguage();
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t("profile.orders_title")}</h2>
        <p className="text-gray-500 text-sm">{t("profile.orders_desc")}</p>
      </div>

      <div className="space-y-4">
        {orders?.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
            <ShoppingBag className="w-10 h-10 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">{t("profile.no_orders")}</p>
          </div>
        ) : (
          orders?.sort((a: any, b: any) => b.id - a.id).map((order: any) => (
            <OrderCard key={order.id} order={order} onCancel={onRefresh} />
          ))
        )}
      </div>
    </motion.div>
  );
};

export default OrderHistoryTab;
