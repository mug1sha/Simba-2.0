import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import DealsSection from "@/components/DealsSection";
import TrustSection from "@/components/TrustSection";
import ProductsGrid from "@/components/ProductsGrid";
import { ProductsGridSkeleton } from "@/components/ProductSkeleton";
import RecommendationsSection from "@/components/RecommendationsSection";
import CartDrawer from "@/components/CartDrawer";
import ChatWidget from "@/components/ChatWidget";
import { fetchProducts } from "@/lib/products";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products", selectedCategory, searchQuery],
    queryFn: () => fetchProducts(selectedCategory || undefined, searchQuery || undefined),
  });

  const filteredProducts = products;

  return (
    <div className="min-h-screen bg-background transition-colors duration-500">
      <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      
      <main>
        <HeroSection />
        
        <CategorySection 
          onSelectCategory={setSelectedCategory} 
          selectedCategory={selectedCategory} 
        />
        
        <DealsSection />
        <TrustSection />

        {isAuthenticated && (
          <div className="container mx-auto my-14 px-4">
            <RecommendationsSection />
          </div>
        )}

        <section id="products" className="container mx-auto scroll-mt-24 px-4 py-16">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
                {selectedCategory ? t(`cat.${selectedCategory}`) : t("catalog.collection")}
              </h2>
              <div className="mt-3 h-px w-16 bg-border" />
            </div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-muted-foreground">
              {filteredProducts.length} {t("catalog.results")}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {productsLoading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ProductsGridSkeleton />
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <ProductsGrid products={filteredProducts} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <CartDrawer />
      <ChatWidget />
      
      <footer className="border-t border-border bg-[linear-gradient(180deg,hsl(var(--card)/0.6),hsl(var(--secondary)/0.72),hsl(var(--card)/0.86))] py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <span className="text-white font-black text-xl italic">S</span>
              </div>
              <h2 className="font-black text-2xl tracking-tighter text-foreground">SIMBA</h2>
            </div>
            <p className="mb-10 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("footer.description")}
            </p>
            <div className="mb-10 h-px w-full max-w-lg bg-border/70" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              © {new Date().getFullYear()} Simba Supermarket. {t("footer.rights")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
