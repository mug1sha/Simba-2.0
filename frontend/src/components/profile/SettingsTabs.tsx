import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Plus, Trash2, Shield, Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface PaymentsTabProps {
  paymentMethods: any[];
  onRefresh: () => void;
}

export const PaymentsTab = ({ paymentMethods, onRefresh }: PaymentsTabProps) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
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
        toast({ title: t("profile.payment_added") });
      }
    } catch (err) {
      console.error("Failed to add payment method:", err);
    }
  };

  const deletePayment = async (id: number) => {
    try {
      const res = await fetch(`/api/user/payments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onRefresh();
        toast({ title: t("profile.payment_removed") });
      }
    } catch (err) {
      console.error("Failed to delete payment method:", err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{t("profile.payments_title")}</h2>
          <p className="text-gray-500 text-sm">{t("profile.payments_desc")}</p>
        </div>
        <button onClick={() => setShowAddPayment(true)} className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-all border border-primary/20">
          <Plus className="w-4 h-4" /> {t("profile.add_method")}
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
                  <p className="text-sm font-bold text-white">{pm.provider} {t("common.card")}</p>
                  {pm.is_default && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase">{t("common.default")}</span>}
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
            <h3 className="text-xl font-bold text-white mb-6">{t("profile.add_payment")}</h3>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <select name="provider" className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50">
                <option value="Visa">Visa</option>
                <option value="MasterCard">MasterCard</option>
                <option value="MTN MoMo">MTN MoMo</option>
                <option value="Airtel Money">Airtel Money</option>
              </select>
              <input name="last_four" maxLength={4} placeholder={t("profile.last_four")} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
              <input name="expiry_date" placeholder={t("profile.expiry")} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
              <label className="flex items-center gap-3 cursor-pointer p-1">
                <input type="checkbox" name="is_default" className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary/20" />
                <span className="text-xs text-gray-400">{t("profile.default_payment")}</span>
              </label>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddPayment(false)} className="flex-1 h-12 rounded-xl text-sm font-bold text-gray-400 hover:bg-white/5 transition-all">{t("common.cancel")}</button>
                <button type="submit" className="flex-1 h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">{t("profile.save_method")}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export const SecurityTab = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [showPass, setShowPass] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { t } = useLanguage();

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: t("profile.password_change_failed"),
        description: t("profile.password_required"),
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t("profile.password_change_failed"),
        description: t("profile.passwords_do_not_match"),
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || t("profile.password_change_failed"));
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: t("profile.password_changed"),
        description: t("profile.password_changed_desc"),
      });
    } catch (err) {
      toast({
        title: t("profile.password_change_failed"),
        description: err instanceof Error ? err.message : t("profile.password_change_failed"),
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t("profile.security_title")}</h2>
        <p className="text-gray-500 text-sm">{t("profile.security_desc")}</p>
      </div>

      <div className="space-y-4">
        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{t("profile.change_password")}</p>
              <p className="text-xs text-gray-500">{t("profile.change_password_desc")}</p>
            </div>
          </div>
          
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="relative">
              <input
                type={showCurrentPass ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("profile.current_password")}
                autoComplete="current-password"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                aria-label={showCurrentPass ? "Hide current password" : "Show current password"}
              >
                {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("profile.new_password")}
                autoComplete="new-password"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:outline-none focus:border-primary/50"
              />
              <button 
                type="button" 
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                aria-label={showPass ? "Hide new password" : "Show new password"}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showConfirmPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("profile.confirm_password")}
                autoComplete="new-password"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                aria-label={showConfirmPass ? "Hide password confirmation" : "Show password confirmation"}
              >
                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button disabled={isChangingPassword} className="w-full h-12 bg-white/5 text-white text-xs font-bold rounded-xl border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isChangingPassword ? t("common.loading") : t("profile.update_password")}
            </button>
          </form>
        </div>

        <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl">
          <h3 className="text-sm font-bold text-red-500 mb-2 uppercase tracking-widest">{t("profile.danger_zone")}</h3>
          <p className="text-xs text-gray-500 mb-4">{t("profile.delete_warning")}</p>
          <button className="px-6 py-3 bg-red-500/10 text-red-500 text-xs font-bold rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all">
            {t("profile.delete_account")}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
