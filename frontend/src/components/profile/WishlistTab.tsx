import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import ProductCard from "../ProductCard";

interface WishlistTabProps {
  favorites: any[];
}

const WishlistTab = ({ favorites }: WishlistTabProps) => {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">My Wishlist</h2>
        <p className="text-gray-500 text-sm">Products you've saved for later.</p>
      </div>

      {favorites?.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
          <Heart className="w-10 h-10 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Your wishlist is empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {favorites?.map((fav: any) => (
            <ProductCard key={fav.product.id} product={fav.product} />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default WishlistTab;
