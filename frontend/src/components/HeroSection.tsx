import { ArrowRight, Truck, Shield, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FallingProductsBackground } from "./FallingProductsBackground";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-brand-warm">
      <FallingProductsBackground />
      <div className="relative z-10 container mx-auto px-4 section-padding">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              {t("hero.badge")}
            </div>
            <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-[1.1] text-balance">
              {t("hero.title").split(t("hero.delivered"))[0]}
              <span className="text-primary">{t("hero.delivered")}</span>
              {t("hero.title").split(t("hero.delivered"))[1]}
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#products"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 rounded-xl font-semibold text-base hover:opacity-90 transition-all shadow-lg shadow-primary/25"
              >
                {t("hero.shop_now")} <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#categories"
                className="inline-flex items-center gap-2 bg-card text-foreground px-7 py-3.5 rounded-xl font-semibold text-base border border-border hover:border-primary/30 transition-all"
              >
                {t("hero.browse")}
              </a>
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap gap-6 pt-4">
              {[
                { icon: Truck, text: t("hero.trust_delivery") },
                { icon: Clock, text: t("hero.trust_sameday") },
                { icon: Shield, text: t("hero.trust_quality") },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="w-4 h-4 text-primary" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative hidden lg:block">
            <div className="relative w-full aspect-[4/3] max-w-lg mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-[3rem] rotate-3" />
              <div className="absolute inset-4 bg-gradient-to-tr from-primary/10 to-transparent rounded-[2.5rem] -rotate-2" />
              <div className="relative h-full w-full bg-card rounded-[2rem] overflow-hidden shadow-2xl shadow-primary/10 border border-border/50">
                <img 
                  src="/Grocery-Store4.jpg" 
                  alt="Grocery Store" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <p className="text-xs font-medium opacity-80">Simba Supermarket</p>
                      <p className="text-lg font-bold">Quality & Freshness</p>
                    </div>
                    <span className="text-3xl">✨</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
