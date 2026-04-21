import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, MapPin, CreditCard, Shield, Globe, 
  ChevronRight, Plus, Trash2, Check, ArrowLeft,
  ShoppingBag, CheckCircle2, Heart, Headphones, LogOut
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// Tabs
import OrderHistoryTab from "./profile/OrderHistoryTab";
import WishlistTab from "./profile/WishlistTab";
import AddressManagerTab from "./profile/AddressManagerTab";
import SupportTab from "./profile/SupportTab";
import { PaymentsTab, SecurityTab } from "./profile/SettingsTabs";

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProfileTab = "PERSONAL" | "ADDRESSES" | "PAYMENTS" | "SECURITY" | "WISHLIST" | "ORDERS" | "SUPPORT";

export const ProfileDialog: React.FC<ProfileDialogProps> = ({ isOpen, onClose }) => {
  const { user, refreshProfile, logout } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ProfileTab>("PERSONAL");

  const tabs = [
    { id: "PERSONAL", label: "Personal Info", icon: User },
    { id: "ORDERS", label: "My Orders", icon: ShoppingBag },
    { id: "WISHLIST", label: "Wishlist", icon: Heart },
    { id: "ADDRESSES", label: "My Addresses", icon: MapPin },
    { id: "SUPPORT", label: "Help & Support", icon: Headphones },
    { id: "PAYMENTS", label: "Payments", icon: CreditCard },
    { id: "SECURITY", label: "Security", icon: Shield },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl p-0 h-[85vh] bg-[#08081a]/95 backdrop-blur-3xl border-white/10 flex overflow-hidden rounded-[2.5rem] shadow-[0_32px_120px_rgba(0,0,0,0.5)]">
        {/* Sidebar */}
        <div className="w-72 border-r border-white/5 bg-white/[0.02] flex flex-col pt-8">
          <div className="px-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white truncate">{user?.first_name} {user?.last_name}</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Premium Member</p>
              </div>
            </div>
            <div className="space-y-1 text-left">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ProfileTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    activeTab === tab.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-gray-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-auto p-8 border-t border-white/5">
            <button onClick={() => { logout(); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-500/5 rounded-xl transition-all">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar relative bg-card/10">
          <AnimatePresence mode="wait">
            {activeTab === "PERSONAL" && (
              <motion.div key="personal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                <div>
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase text-left">PERSONAL INFO</h2>
                  <p className="text-gray-500 text-sm text-left">Update your identity and contact details.</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { label: "First Name", value: user?.first_name },
                    { label: "Last Name", value: user?.last_name },
                    { label: "Email Address", value: user?.email },
                    { label: "Phone Number", value: user?.phone || "Not set" },
                  ].map((field) => (
                    <div key={field.label} className="space-y-2 p-5 bg-white/[0.03] border border-white/5 rounded-3xl group hover:border-white/10 transition-all text-left">
                      <p className="text-[10px] uppercase font-bold text-primary tracking-widest">{field.label}</p>
                      <p className="text-sm font-bold text-white/90">{field.value}</p>
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <button className="px-8 py-3 bg-white/5 text-white text-xs font-bold rounded-xl border border-white/10 hover:bg-white/10 transition-all">
                    Edit Profile Details
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "ORDERS" && (
              <OrderHistoryTab orders={user?.orders || []} onRefresh={refreshProfile} />
            )}

            {activeTab === "WISHLIST" && (
              <WishlistTab favorites={user?.favorites || []} />
            )}

            {activeTab === "ADDRESSES" && (
              <AddressManagerTab addresses={user?.addresses || []} onRefresh={refreshProfile} />
            )}

            {activeTab === "SUPPORT" && (
              <SupportTab />
            )}

            {activeTab === "PAYMENTS" && (
              <PaymentsTab paymentMethods={user?.payment_methods || []} onRefresh={refreshProfile} />
            )}

            {activeTab === "SECURITY" && (
              <SecurityTab />
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};
