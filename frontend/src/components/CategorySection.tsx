import { useQuery } from "@tanstack/react-query";
import { fetchCategories, getCategoryIcon, fetchProducts } from "@/lib/products";
import { useLanguage } from "@/contexts/LanguageContext";

interface CategorySectionProps {
  onSelectCategory: (category: string) => void;
  selectedCategory: string;
}

const CategorySection = ({ onSelectCategory, selectedCategory }: CategorySectionProps) => {
  const { t } = useLanguage();
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["all-products-for-count"],
    queryFn: () => fetchProducts(),
  });

  return (
    <section id="categories" className="section-padding bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">{t("categories.title")}</h2>
          <p className="text-muted-foreground mt-2">{t("categories.subtitle")}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <button
            onClick={() => onSelectCategory("")}
            className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all hover-lift ${
              selectedCategory === "" ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-card border-border/50 text-foreground hover:border-primary/30"
            }`}
          >
            <span className="text-3xl">🛒</span>
            <span className="text-sm font-medium">{t("categories.all")}</span>
            <span className="text-[10px] opacity-70">{allProducts.length} {t("categories.items")}</span>
          </button>
          {categories.map((cat) => {
            const count = allProducts.filter(p => p.category === cat).length;
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all hover-lift ${
                  isActive ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-card border-border/50 text-foreground hover:border-primary/30"
                }`}
              >
                <span className="text-3xl">{getCategoryIcon(cat)}</span>
                <span className="text-sm font-medium text-center leading-tight">{cat}</span>
                <span className="text-[10px] opacity-70">{count} {t("categories.items")}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;
