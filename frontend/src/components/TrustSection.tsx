import { Truck, Shield, CreditCard, Clock, Headphones, Award, Sparkles, RefreshCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const trustItems = [
  { icon: Truck, title: "trust.express_delivery", desc: "trust.express_delivery_desc", color: "text-blue-500" },
  { icon: Shield, title: "trust.ssl_secured", desc: "trust.ssl_secured_desc", color: "text-green-500" },
  { icon: RefreshCcw, title: "trust.easy_returns", desc: "trust.easy_returns_desc", color: "text-orange-500" },
  { icon: CreditCard, title: "trust.secure_pay", desc: "trust.secure_pay_desc", color: "text-purple-500" },
  { icon: Headphones, title: "trust.live_support", desc: "trust.live_support_desc", color: "text-primary" },
  { icon: Sparkles, title: "trust.premium_quality", desc: "trust.premium_quality_desc", color: "text-yellow-500" },
];

const TrustSection = () => {
  const { t } = useLanguage();
  return (
    <section className="py-24 bg-[#050510] relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tighter">
          {t("trust.title")}
        </h2>
        <p className="text-gray-500 max-w-2xl mx-auto text-sm md:text-base">
          {t("trust.subtitle")}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {trustItems.map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="group bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 text-center hover:bg-white/[0.04] transition-all hover:-translate-y-2">
            <div className={`w-14 h-14 mx-auto bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-2">{t(title)}</h3>
            <p className="text-[11px] text-gray-500 leading-relaxed font-medium">{t(desc)}</p>
          </div>
        ))}
      </div>
    </div>
    <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </section>
  );
};

export default TrustSection;
