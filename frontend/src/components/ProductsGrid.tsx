import ProductCard from "./ProductCard";
import { type Product } from "@/lib/products";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProductsGridProps {
  products: Product[];
}

const ITEMS_PER_PAGE = 20;

const ProductsGrid = ({ products }: ProductsGridProps) => {
  const { t } = useLanguage();
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [products]);

  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  return (
    <div className="space-y-10">
      {products.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-[2.5rem] border border-dashed border-border/50">
          <span className="text-5xl">🔍</span>
          <p className="text-lg text-foreground font-black mt-4 uppercase tracking-tight">{t("products.no_found")}</p>
          <p className="text-sm text-muted-foreground font-medium">{t("products.try_adjustment")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {visibleProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          
          {hasMore && (
            <div className="text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                className="inline-flex items-center gap-3 bg-card text-foreground px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-border hover:border-primary/30 hover:bg-accent transition-all shadow-xl shadow-black/5"
              >
                {t("products.load_more")}
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-lg text-[10px]">
                  {products.length - visibleCount}
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductsGrid;
