import { lazy, Suspense, useDeferredValue, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, PackageCheck, Search, SlidersHorizontal, Sparkles, Tag } from "lucide-react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import DealsSection from "@/components/DealsSection";
import TrustSection from "@/components/TrustSection";
import ProductsGrid from "@/components/ProductsGrid";
import { ProductsGridSkeleton } from "@/components/ProductSkeleton";
import CartDrawer from "@/components/CartDrawer";
import { fetchProducts } from "@/lib/products";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const RecommendationsSection = lazy(() => import("@/components/RecommendationsSection"));
const ChatWidget = lazy(() => import("@/components/ChatWidget"));

type StockFilter = "all" | "in-stock" | "out-of-stock";
type SortOption = "featured" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts(),
  });

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))).sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const units = useMemo(
    () => Array.from(new Set(products.map((product) => product.unit))).sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const catalogMinPrice = useMemo(
    () => (products.length ? Math.min(...products.map((product) => product.price)) : 0),
    [products],
  );
  const catalogMaxPrice = useMemo(
    () => (products.length ? Math.max(...products.map((product) => product.price)) : 0),
    [products],
  );
  const parsedMinPrice = Number(minPrice);
  const parsedMaxPrice = Number(maxPrice);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();

    const matches = products.filter((product) => {
      if (selectedCategory && product.category !== selectedCategory) return false;
      if (stockFilter === "in-stock" && !product.inStock) return false;
      if (stockFilter === "out-of-stock" && product.inStock) return false;
      if (selectedUnit !== "all" && product.unit !== selectedUnit) return false;
      if (minPrice && (!Number.isFinite(parsedMinPrice) || product.price < parsedMinPrice)) return false;
      if (maxPrice && (!Number.isFinite(parsedMaxPrice) || product.price > parsedMaxPrice)) return false;
      if (!normalizedSearch) return true;

      return [product.name, product.category, product.unit, String(product.price)]
        .some((field) => field.toLowerCase().includes(normalizedSearch));
    });

    switch (sortBy) {
      case "price-asc":
        return [...matches].sort((a, b) => a.price - b.price);
      case "price-desc":
        return [...matches].sort((a, b) => b.price - a.price);
      case "name-asc":
        return [...matches].sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return [...matches].sort((a, b) => b.name.localeCompare(a.name));
      case "featured":
      default:
        return [...matches].sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.name.localeCompare(b.name));
    }
  }, [
    deferredSearchQuery,
    maxPrice,
    minPrice,
    parsedMaxPrice,
    parsedMinPrice,
    products,
    selectedCategory,
    selectedUnit,
    sortBy,
    stockFilter,
  ]);

  const clearFilters = () => {
    setSelectedCategory("");
    setStockFilter("all");
    setSelectedUnit("all");
    setSortBy("featured");
    setMinPrice("");
    setMaxPrice("");
    setSearchQuery("");
  };

  const activeFilters = [
    selectedCategory ? `Category: ${selectedCategory}` : null,
    stockFilter !== "all" ? `Availability: ${stockFilter === "in-stock" ? "In stock" : "Out of stock"}` : null,
    selectedUnit !== "all" ? `Unit: ${selectedUnit}` : null,
    minPrice ? `Min: RWF ${Number(minPrice).toLocaleString("en-RW")}` : null,
    maxPrice ? `Max: RWF ${Number(maxPrice).toLocaleString("en-RW")}` : null,
    deferredSearchQuery ? `Search: ${deferredSearchQuery}` : null,
  ].filter(Boolean);

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-500">
      <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      
      <main>
        <HeroSection />
        <TrustSection />
        <DealsSection />
        
        <CategorySection
          onSelectCategory={handleSelectCategory}
          selectedCategory={selectedCategory}
          products={products}
          categories={categories}
        />

        <section id="products" className="container mx-auto scroll-mt-24 px-4 py-16">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
                Our Collection
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Explore every aisle with category, availability, unit, price, and search filters tuned for faster product discovery.
              </p>
            </div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-muted-foreground">
              {filteredProducts.length} {t("catalog.results")}
            </p>
          </div>

          <div className="mb-8 overflow-hidden rounded-[2rem] border border-border bg-card/80 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)]">
            <div className="border-b border-border bg-[linear-gradient(120deg,hsl(var(--card)),hsl(var(--secondary)/0.8),hsl(var(--card)))] px-5 py-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-primary">Smart filters</p>
                    <h3 className="text-lg font-black text-foreground">Refine the catalog your way</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-accent"
                >
                  Reset all filters
                </button>
              </div>
            </div>

            <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  <Search className="h-3.5 w-3.5 text-primary" />
                  Search collection
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by product name, unit, or price"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Category
                </span>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  <ArrowDownUp className="h-3.5 w-3.5 text-primary" />
                  Sort by
                </span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="name-desc">Name: Z to A</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  <PackageCheck className="h-3.5 w-3.5 text-primary" />
                  Availability
                </span>
                <select
                  value={stockFilter}
                  onChange={(event) => setStockFilter(event.target.value as StockFilter)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                >
                  <option value="all">All items</option>
                  <option value="in-stock">In stock only</option>
                  <option value="out-of-stock">Out of stock only</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Unit
                </span>
                <select
                  value={selectedUnit}
                  onChange={(event) => setSelectedUnit(event.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                >
                  <option value="all">All units</option>
                  {units.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Price range
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min={catalogMinPrice}
                    value={minPrice}
                    onChange={(event) => setMinPrice(event.target.value)}
                    placeholder={`Min ${catalogMinPrice.toLocaleString("en-RW")}`}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  />
                  <input
                    type="number"
                    min={catalogMinPrice}
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    placeholder={`Max ${catalogMaxPrice.toLocaleString("en-RW")}`}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {activeFilters.length > 0 ? (
                    activeFilters.map((filter) => (
                      <span
                        key={filter}
                        className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary"
                      >
                        {filter}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-black text-muted-foreground">
                      No filters applied. You are viewing the full catalog.
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-muted-foreground">
                  Showing {filteredProducts.length} of {products.length} products
                </p>
              </div>
            </div>
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

        {isAuthenticated && (
          <div className="container mx-auto my-14 px-4">
            <Suspense fallback={null}>
              <RecommendationsSection />
            </Suspense>
          </div>
        )}
      </main>

      <CartDrawer />
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
      
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
