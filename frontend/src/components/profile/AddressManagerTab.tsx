import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Plus, Trash2, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface AddressManagerTabProps {
  addresses: any[];
  onRefresh: () => void;
}

const AddressManagerTab = ({ addresses, onRefresh }: AddressManagerTabProps) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showAddAddress, setShowAddAddress] = useState(false);

  const handleAddAddress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const addressData = {
      label: formData.get("label"),
      full_name: formData.get("full_name"),
      phone: formData.get("phone"),
      street: formData.get("street"),
      apartment: formData.get("apartment") || "",
      city: formData.get("city"),
      district: formData.get("district"),
      is_default: formData.get("is_default") === "on",
    };

    try {
      const res = await fetch("/api/user/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(addressData),
      });
      if (res.ok) {
        onRefresh();
        setShowAddAddress(false);
        toast({ title: t("profile.address_added"), description: t("profile.address_saved") });
      }
    } catch (err) {
      console.error("Failed to add address:", err);
    }
  };

  const deleteAddress = async (id: number) => {
    try {
      const res = await fetch(`/api/user/addresses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onRefresh();
        toast({ title: t("profile.address_deleted") });
      }
    } catch (err) {
      console.error("Failed to delete address:", err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{t("profile.my_addresses")}</h2>
          <p className="text-gray-500 text-sm">{t("profile.addresses_desc")}</p>
        </div>
        <button onClick={() => setShowAddAddress(true)} className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-all border border-primary/20">
          <Plus className="w-4 h-4" /> {t("profile.add_new")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {addresses?.map((addr: any) => (
          <div key={addr.id} className="p-5 bg-white/[0.03] border border-white/5 rounded-3xl flex items-center justify-between group hover:border-white/10 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                <MapPin className="w-6 h-6 text-gray-500 group-hover:text-primary transition-all" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-white">{addr.label}</p>
                  {addr.is_default && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase">{t("common.default")}</span>}
                </div>
                <p className="text-xs text-gray-500">{addr.street}, {addr.apartment && `${addr.apartment},`} {addr.city}</p>
              </div>
            </div>
            <button onClick={() => deleteAddress(addr.id)} className="p-2 text-gray-700 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {showAddAddress && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#08081a] border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6">{t("profile.add_address")}</h3>
            <form onSubmit={handleAddAddress} className="space-y-4">
              <input name="label" placeholder={t("profile.label")} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
              <input name="full_name" placeholder={t("profile.full_name")} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
              <input name="phone" placeholder={t("profile.phone_number")} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
              <input name="street" placeholder={t("profile.street")} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
              <div className="grid grid-cols-2 gap-4">
                <input name="city" placeholder={t("profile.city")} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
                <input name="district" placeholder={t("profile.district")} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-1">
                <input type="checkbox" name="is_default" className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary/20" />
                <span className="text-xs text-gray-400">{t("profile.default_address")}</span>
              </label>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddAddress(false)} className="flex-1 h-12 rounded-xl text-sm font-bold text-gray-400 hover:bg-white/5 transition-all">{t("common.cancel")}</button>
                <button type="submit" className="flex-1 h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">{t("profile.save_address")}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default AddressManagerTab;
