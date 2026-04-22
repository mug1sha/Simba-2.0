import { motion } from "framer-motion";

export const ProductSkeleton = () => {
  return (
    <div className="bg-card rounded-3xl border border-border/50 overflow-hidden shadow-sm">
      <div className="relative aspect-square bg-muted animate-pulse overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      </div>
      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <div className="h-2 w-1/3 bg-muted rounded-full animate-pulse" />
          <div className="h-4 w-3/4 bg-muted rounded-full animate-pulse" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="h-5 w-1/3 bg-muted rounded-full animate-pulse" />
          <div className="h-9 w-9 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export const ProductsGridSkeleton = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
      {[...Array(10)].map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  );
};
