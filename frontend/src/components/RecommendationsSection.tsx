import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import ProductCard from "./ProductCard";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const RecommendationsSection = () => {
  const { isAuthenticated, token } = useAuth();
  
  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => {
      const res = await fetch("/api/user/recommendations", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    enabled: isAuthenticated
  });

  if (!isAuthenticated || recommendations.length === 0) return null;

  return (
    <section className="py-20 bg-muted/20 border-t border-border/50 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Recommended for You</h2>
            <p className="text-sm text-muted-foreground">Based on your interests</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6">
          {recommendations.map((product: any, idx: number) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RecommendationsSection;
