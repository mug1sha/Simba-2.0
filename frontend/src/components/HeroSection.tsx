import { useRef } from "react";
import { ArrowRight, Truck, Shield, Clock, Sparkles, Leaf, ShoppingBag, Store } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

const floatingAccents = [
  {
    title: "Fresh Picks",
    subtitle: "Daily produce",
    icon: Leaf,
    position: "left-[46%] top-8",
    duration: 8.5,
    delay: 0.2,
  },
  {
    title: "MoMo Ready",
    subtitle: "Fast checkout",
    icon: ShoppingBag,
    position: "right-8 top-16",
    duration: 9.5,
    delay: 0.8,
  },
  {
    title: "Kigali Flow",
    subtitle: "Same-day energy",
    icon: Sparkles,
    position: "left-[54%] bottom-10",
    duration: 10.5,
    delay: 1.2,
  },
];

const HeroSection = () => {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const ambientY = useTransform(scrollYProgress, [0, 1], ["-4%", "6%"]);
  const visualY = useTransform(scrollYProgress, [0, 1], ["-2.5%", "4%"]);

  return (
    <section ref={sectionRef} className="relative isolate overflow-hidden transition-colors duration-500">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div style={{ y: backgroundY }} className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,hsl(var(--brand-cream))_0%,hsl(var(--background))_42%,hsl(var(--brand-warm))_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.22),transparent_28%),radial-gradient(circle_at_88%_22%,hsl(var(--brand-support)/0.22),transparent_24%),radial-gradient(circle_at_56%_14%,hsl(var(--brand-highlight)/0.18),transparent_18%),radial-gradient(circle_at_74%_70%,rgba(255,255,255,0.74),transparent_18%)]" />
          <div className="absolute inset-y-0 right-0 hidden w-[58%] bg-gradient-to-l from-white/10 via-white/5 to-transparent lg:block" />
          <motion.img
            src="/Hallo.png"
            alt=""
            aria-hidden="true"
            className="absolute -right-[10%] top-[-6%] hidden h-[118%] w-[60%] rounded-[3.2rem] object-cover opacity-30 saturate-[1.15] lg:block"
            style={{ y: ambientY }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/92 to-background/48 lg:from-background/94 lg:via-background/76 lg:to-transparent" />
        </motion.div>

        <motion.div
          style={{ y: ambientY }}
          className="absolute left-[-6rem] top-12 h-56 w-56 rounded-full bg-primary/18 blur-3xl"
        />
        <motion.div
          style={{ y: backgroundY }}
          className="absolute bottom-[-5rem] right-[12%] h-72 w-72 rounded-full bg-[hsl(var(--brand-support)/0.18)] blur-3xl"
        />
        <motion.div
          style={{ y: visualY }}
          className="absolute left-[26%] top-0 h-40 w-40 rounded-full bg-[hsl(var(--brand-highlight)/0.18)] blur-3xl"
        />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/72 to-transparent" />
      </div>

      {floatingAccents.map(({ title, subtitle, icon: Icon, position, duration, delay }) => (
        <motion.div
          key={title}
          aria-hidden="true"
          className={`pointer-events-none absolute ${position} z-10 hidden items-center gap-3 rounded-2xl border border-white/50 bg-white/58 px-4 py-3 shadow-[0_24px_50px_-34px_rgba(31,41,55,0.42)] backdrop-blur-xl xl:flex`}
          animate={{
            y: [0, -12, 0],
            x: [0, 6, 0],
            rotate: [-2, 1.5, -2],
          }}
          transition={{
            duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-foreground/55">{title}</p>
            <p className="mt-1 text-sm font-semibold text-foreground/85">{subtitle}</p>
          </div>
        </motion.div>
      ))}

      <div className="container relative z-20 mx-auto px-4 section-padding">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {isAuthenticated ? `VIP: ${t("hero.vip_welcome")}, ${user?.first_name}!` : t("hero.badge")}
            </div>
            <h2 className="font-heading text-4xl font-black leading-[0.95] text-foreground text-balance tracking-tighter md:text-5xl lg:text-6xl">
              {isAuthenticated ? (
                <>{t("hero.auth_title_prefix")} <span className="text-primary">{t("hero.auth_title_accent")}</span></>
              ) : (
                <>
                  {t("hero.title").split(t("hero.delivered"))[0]}
                  <span className="text-primary">{t("hero.delivered")}</span>
                  {t("hero.title").split(t("hero.delivered"))[1]}
                </>
              )}
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              {isAuthenticated 
                ? t("hero.auth_subtitle")
                : t("hero.subtitle")
              }
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#products"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t("hero.shop_now")} <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#categories"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition-colors hover:bg-accent"
              >
                {t("hero.browse")}
              </a>
            </div>

            <div className="grid max-w-xl gap-3 pt-2 sm:grid-cols-3">
              {[
                { icon: Truck, text: t("hero.trust_delivery") },
                { icon: Clock, text: t("hero.trust_sameday") },
                { icon: Shield, text: t("hero.trust_quality") },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="rounded-2xl border border-border/80 bg-card/88 p-4 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)] backdrop-blur-md"
                >
                  <Icon className="mb-3 h-4 w-4 text-primary" />
                  <p className="text-sm font-medium leading-snug text-foreground">{text}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="relative hidden lg:block">
            <motion.div style={{ y: visualY }} className="relative mx-auto aspect-[4/3] w-full max-w-xl">
              <div className="absolute inset-0 rounded-[2.5rem] border border-border bg-card/80" />
              <div className="absolute -bottom-4 left-8 right-8 h-24 rounded-full bg-primary/12 blur-3xl" />
              <div className="absolute inset-6 rounded-[2rem] bg-primary/12 blur-2xl" />
              <div className="absolute right-10 top-10 h-24 w-24 rounded-full bg-[hsl(var(--brand-support)/0.22)] blur-2xl" />
              <div className="absolute left-10 top-14 h-20 w-20 rounded-full bg-[hsl(var(--brand-highlight)/0.22)] blur-2xl" />
              <motion.div
                className="relative h-full w-full overflow-hidden rounded-[2.25rem] border border-border bg-card"
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <motion.img
                  src="/Hallo.png"
                  alt="Simba shopping showcase"
                  className="h-full w-full object-cover"
                  animate={{
                    scale: [1, 1.05, 1],
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-black/12 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,hsl(var(--primary)/0.32),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.28),transparent_20%),radial-gradient(circle_at_70%_18%,hsl(var(--brand-highlight)/0.18),transparent_20%),radial-gradient(circle_at_76%_78%,hsl(var(--brand-support)/0.16),transparent_24%)]" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/18 via-transparent to-black/6" />

                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex items-end justify-between rounded-[1.5rem] border border-white/15 bg-black/34 p-4 text-white backdrop-blur-md">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">Simba Supermarket</p>
                      <p className="mt-2 text-lg font-bold">{t("hero.quality_freshness")}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                      <Store className="h-3.5 w-3.5" />
                      Kigali
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
