import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const SupportTab = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const faqs = [
    { q: t("support.faq.delivery_q"), a: t("support.faq.delivery_a") },
    { q: t("support.faq.hours_q"), a: t("support.faq.hours_a") },
    { q: t("support.faq.pay_q"), a: t("support.faq.pay_a") }
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const ticket = {
      subject: formData.get("subject") as string,
      message: formData.get("message") as string
    };
    try {
      const res = await fetch("/api/user/support", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(ticket)
      });
      if (!res.ok) throw new Error();
      toast({ title: t("support.sent"), description: t("support.sent_desc") });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast({ variant: "destructive", title: t("common.error"), description: t("support.failed") });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t("support.title")}</h2>
        <p className="text-gray-500 text-sm">{t("support.desc")}</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-primary uppercase tracking-widest">{t("support.faq")}</h3>
        <div className="space-y-2">
          {faqs.map((item, i) => (
            <details key={i} className="group bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
              <summary className="p-4 cursor-pointer font-bold text-sm text-white flex items-center justify-between list-none">
                {item.q}
                <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-xs text-gray-400 leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-white/5">
        <h3 className="text-sm font-bold text-primary uppercase tracking-widest">{t("support.send_message")}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input name="subject" placeholder={t("support.subject")} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50" />
          <textarea name="message" placeholder={t("support.message_placeholder")} rows={4} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 resize-none" />
          <button type="submit" className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all">
            {t("support.submit")}
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default SupportTab;
