import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Plus, Trash2, Shield, Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

interface PaymentsTabProps {
  paymentMethods: any[];
  onRefresh: () => void;
}

export const PaymentsTab = ({ paymentMethods, onRefresh }: PaymentsTabProps) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [showAddPayment, setShowAddPayment] = useState(false);

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const paymentData = {
      provider: formData.get("provider"),
      last_four: formData.get("last_four"),
      expiry_date: formData.get("expiry_date"),
      is_default: formData.get("is_default") === "on",
    };

    try {
      const res = await fetch("/api/user/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(paymentData),
      });
      if (res.ok) {
        onRefresh();
        setShowAddPayment(false);
        toast({ title: "Payment Method Added" });
      }
    } catch (err) {}
  };

  const deletePayment = async (id: number) => {
    try {
      const res = await fetch(`/api/user/payments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onRefresh();
        toast({ title: "Payment Method Removed" });
      }
    } catch (err) {}
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Payment Methods</h2>
          <p className="text-gray-500 text-sm">Securely manage your billing info.</p>
        </div>
        <button onClick={() => setShowAddPayment(true)} className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-all border border-primary/20">
          <Plus className="w-4 h-4" /> Add Method
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {paymentMethods?.map((pm: any) => (
          <div key={pm.id} className="p-5 bg-white/[0.03] border border-white/5 rounded-3xl flex items-center justify-between group hover:border-white/10 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                <CreditCard className="w-6 h-6 text-gray-500 group-hover:text-primary transition-all" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-white">{pm.provider} Card</p>
                  {pm.is_default && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase">Default</span>}
                </div>
                <p className="text-xs text-gray-500 font-mono">**** **** **** {pm.last_four} • Exp: {pm.expiry_date}</p>
              </div>
            </div>
            <button onClick={() => deletePayment(pm.id)} className="p-2 text-gray-700 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {showAddPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#08081a] border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6">Add Payment Method</h3>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <select name="provider" className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50">
                <option value="Visa">Visa</option>
                <option value="MasterCard">MasterCard</option>
                <option value="MTN MoMo">MTN MoMo</option>
                <option value="Airtel Money">Airtel Money</option>
              </select>
              <input name="last_four" maxLength={4} placeholder="Last 4 Digits" required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
              <input name="expiry_date" placeholder="MM/YY" required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
              <label className="flex items-center gap-3 cursor-pointer p-1">
                <input type="checkbox" name="is_default" className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary/20" />
                <span className="text-xs text-gray-400">Set as default payment method</span>
              </label>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddPayment(false)} className="flex-1 h-12 rounded-xl text-sm font-bold text-gray-400 hover:bg-white/5 transition-all">Cancel</button>
                <button type="submit" className="flex-1 h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Save Method</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export const SecurityTab = () => {
  const [showPass, setShowPass] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Security Settings</h2>
        <p className="text-gray-500 text-sm">Protect your account and data.</p>
      </div>

      <div className="space-y-4">
        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Change Password</p>
              <p className="text-xs text-gray-500">Update your account password regularly.</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <input type="password" placeholder="Current Password" className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
            <div className="relative">
              <input type={showPass ? "text" : "password"} placeholder="New Password" className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
              <button 
                type="button" 
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button className="w-full h-12 bg-white/5 text-white text-xs font-bold rounded-xl border border-white/10 hover:bg-white/10 transition-all">
              Update Password
            </button>
          </div>
        </div>

        <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl">
          <h3 className="text-sm font-bold text-red-500 mb-2 uppercase tracking-widest">Danger Zone</h3>
          <p className="text-xs text-gray-500 mb-4">Deleting your account is permanent and cannot be undone.</p>
          <button className="px-6 py-3 bg-red-500/10 text-red-500 text-xs font-bold rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all">
            Delete Account
          </button>
        </div>
      </div>
    </motion.div>
  );
};
