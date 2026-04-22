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
          <div className="container mx-auto px-4 my-16">
            <RecommendationsSection />
          </div>
        )}

        <section id="products" className="container mx-auto px-4 py-20 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase">
                {selectedCategory ? t(`cat.${selectedCategory}`) : t("catalog.collection")}
              </h2>
              <div className="h-1.5 w-20 bg-primary mt-2 rounded-full" />
            </div>
            <p className="text-muted-foreground font-bold text-sm uppercase tracking-widest">
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
      
      <footer className="bg-muted/30 dark:bg-[#08081a] border-t border-border/50 dark:border-white/5 py-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-xl shadow-primary/20 transform -rotate-6">
                <span className="text-white font-black text-xl italic">S</span>
              </div>
              <h2 className="font-black text-2xl tracking-tighter text-foreground">SIMBA</h2>
            </div>
            <p className="text-muted-foreground text-sm font-medium max-w-sm mb-12 leading-relaxed">
              {t("footer.description")}
            </p>
            <div className="h-px w-full max-w-lg bg-gradient-to-r from-transparent via-border to-transparent mb-12" />
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              © {new Date().getFullYear()} Simba Supermarket. {t("footer.rights")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
