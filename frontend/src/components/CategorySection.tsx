import { getCategoryIcon, type Product } from "@/lib/products";
import { useLanguage } from "@/contexts/LanguageContext";

interface CategorySectionProps {
  onSelectCategory: (category: string) => void;
  selectedCategory: string;
  products: Product[];
  categories: string[];
}

const cardAccents = [
  {
    glow: "from-emerald-500/16 via-transparent to-transparent",
    orb: "bg-emerald-500/18",
    chip: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200",
  },
  {
    glow: "from-sky-500/16 via-transparent to-transparent",
    orb: "bg-sky-500/18",
    chip: "bg-sky-500/12 text-sky-800 dark:text-sky-200",
  },
  {
    glow: "from-violet-500/16 via-transparent to-transparent",
    orb: "bg-violet-500/18",
    chip: "bg-violet-500/12 text-violet-800 dark:text-violet-200",
  },
  {
    glow: "from-rose-500/16 via-transparent to-transparent",
    orb: "bg-rose-500/18",
    chip: "bg-rose-500/12 text-rose-800 dark:text-rose-200",
  },
  {
    glow: "from-amber-500/18 via-transparent to-transparent",
    orb: "bg-amber-500/20",
    chip: "bg-amber-500/14 text-amber-800 dark:text-amber-200",
  },
];

const CategorySection = ({ onSelectCategory, selectedCategory, products, categories }: CategorySectionProps) => {
  const { t } = useLanguage();
  const allProducts = products;

  return (
    <section id="categories" className="section-padding">
      <div className="container mx-auto px-4">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary">Browse the aisles</p>
            <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Shop by Category</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Pick a department first, then narrow the catalog with price, availability, unit, and search filters below.
            </p>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">
            {allProducts.length} {t("categories.items")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          <button
            onClick={() => onSelectCategory("")}
            className={`group relative overflow-hidden rounded-[1.35rem] border p-4 text-left transition-all hover-lift ${
              selectedCategory === ""
                ? "border-primary bg-primary text-primary-foreground shadow-[0_24px_50px_-30px_hsl(var(--primary)/0.6)]"
                : "border-border bg-card/90 text-foreground shadow-[0_18px_36px_-28px_rgba(15,23,42,0.35)] hover:border-primary/30"
            }`}
          >
            <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),transparent_50%)] opacity-80 transition-opacity group-hover:opacity-100" />
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex min-h-[8.9rem] flex-col">
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-white/16 text-[1.35rem] shadow-inner shadow-white/10">🛒</span>
                <span className="rounded-full bg-white/14 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-current/75">
                  {allProducts.length}
                </span>
              </div>
              <span className="mt-4 min-h-[2.6rem] text-sm font-semibold leading-tight line-clamp-2">
                {t("categories.all")}
              </span>
              <span className="mt-auto inline-flex rounded-full bg-white/14 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-current/75">
                {t("categories.items")}
              </span>
            </div>
          </button>
          {categories.map((cat) => {
            const count = allProducts.filter(p => p.category === cat).length;
            const isActive = selectedCategory === cat;
            const accent = cardAccents[categories.indexOf(cat) % cardAccents.length];
            return (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`group relative overflow-hidden rounded-[1.35rem] border p-4 text-left transition-all hover-lift ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_24px_50px_-30px_hsl(var(--primary)/0.6)]"
                    : "border-border bg-card/90 text-foreground shadow-[0_18px_36px_-28px_rgba(15,23,42,0.35)] hover:border-primary/30"
                }`}
              >
                {!isActive && (
                  <>
                    <div className={`absolute inset-0 bg-gradient-to-br ${accent.glow} opacity-90 transition-opacity group-hover:opacity-100`} />
                    <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full ${accent.orb} blur-2xl`} />
                  </>
                )}
                <div className="relative flex min-h-[8.9rem] flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-[1rem] text-[1.35rem] shadow-inner ${isActive ? "bg-white/16 shadow-white/10" : "bg-background/80"}`}>
                      {getCategoryIcon(cat)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] ${
                        isActive ? "bg-white/14 text-current/75" : accent.chip
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <span className="mt-4 min-h-[2.6rem] text-sm font-semibold leading-tight line-clamp-2">
                    {t(`cat.${cat}`)}
                  </span>
                  <div className="mt-auto flex items-center justify-between">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] ${isActive ? "bg-white/14 text-current/75" : "bg-foreground/[0.06] text-muted-foreground"}`}>
                      {t("categories.items")}
                    </span>
                    <span className={`h-2.5 w-2.5 rounded-full transition-transform duration-300 group-hover:scale-125 ${isActive ? "bg-white/80" : accent.orb}`} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;
