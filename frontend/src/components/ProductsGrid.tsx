import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "./ProductCard";
import { fetchProducts } from "@/lib/products";

interface ProductsGridProps {
  searchQuery: string;
  selectedCategory: string;
}

const ITEMS_PER_PAGE = 20;

const ProductsGrid = ({ searchQuery, selectedCategory }: ProductsGridProps) => {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["products", selectedCategory, searchQuery],
    queryFn: () => fetchProducts(selectedCategory, searchQuery),
  });

  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Loading products...</p>
      </div>
    );
  }

  return (
    <section id="products" className="section-padding bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
              {selectedCategory || "All Products"}
            </h2>
            <p className="text-muted-foreground mt-1">
              {products.length} product{products.length !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-5xl">🔍</span>
            <p className="text-lg text-muted-foreground mt-4">No products found</p>
            <p className="text-sm text-muted-foreground">Try a different search or category</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {visibleProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {hasMore && (
              <div className="text-center mt-10">
                <button
                  onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                  className="bg-card text-foreground px-8 py-3 rounded-xl font-medium border border-border hover:border-primary/30 transition-all"
                >
                  Load More Products ({products.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default ProductsGrid;