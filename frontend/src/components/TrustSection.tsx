import { Truck, Shield, CreditCard, Headphones, Sparkles, RefreshCcw } from "lucide-react";
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
    <section className="section-padding">
    <div className="container mx-auto px-4">
      <div className="mb-12 text-center">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.32em] text-primary">Confidence first</p>
        <h2 className="mb-4 text-3xl font-black tracking-tighter text-foreground md:text-5xl">TRUSTED BY FAMILIES IN KIGALI</h2>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
          {t("trust.subtitle")}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {trustItems.map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="group rounded-[1.75rem] border border-border bg-card p-6 text-left transition-all hover:-translate-y-1">
            <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted ${color}`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-foreground">{t(title)}</h3>
            <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">{t(desc)}</p>
          </div>
        ))}
      </div>
    </div>
    </section>
  );
};

export default TrustSection;
