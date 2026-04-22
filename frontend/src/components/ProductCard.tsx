import { Plus, Check, Heart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice, type Product } from "@/lib/products";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

const ProductCard = ({ product }: { product: Product }) => {
  const { t } = useLanguage();
  const { addItem, items } = useCart();
  const { token, user, isAuthenticated, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [imgError, setImgError] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  
  const inCart = items.some((i) => i.id === product.id);
  const isFavorite = user?.favorites?.some((f: any) => f.product_id === product.id);
  
  // Check for price drop
  const favoriteData = user?.favorites?.find((f: any) => f.product_id === product.id);
  const hasPriceDrop = favoriteData && product.price < favoriteData.original_price;

  const handleAdd = () => {
    addItem({ ...product });
    toast.success(`${product.name} ${t("products.added_cart")}`, { duration: 1500 });
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) return toast.info(t("products.login_favorites"));
    
    setIsFavoriting(true);
    try {
      if (isFavorite) {
        await fetch(`/api/user/favorites/${product.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(t("products.removed_wishlist"));
      } else {
        await fetch(`/api/user/favorites?product_id=${product.id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(t("products.added_wishlist"));
      }
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["user-favorites"] });
    } catch (err) {
      toast.error(t("products.wishlist_failed"));
    } finally {
      setIsFavoriting(false);
    }
  };

  return (
    <div className="group bg-card rounded-2xl border border-border/50 overflow-hidden hover-lift">
      {/* Image */}
      <div className="relative aspect-square bg-muted/30 overflow-hidden">
        {!imgError ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
        )}
        <span className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm text-[10px] font-medium text-muted-foreground px-2.5 py-1 rounded-full border border-border/50">
          {t(`cat.${product.category}`)}
        </span>
        
        <button
          onClick={toggleFavorite}
          disabled={isFavoriting}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md border transition-all ${
            isFavorite 
              ? "bg-red-500/20 border-red-500/30 text-red-500" 
              : "bg-black/20 border-white/10 text-white hover:bg-black/40"
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
        </button>

        {hasPriceDrop && (
          <div className="absolute bottom-3 left-3 bg-green-500/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg animate-pulse">
            {t("products.price_drop")}
          </div>
        )}

        {!product.inStock && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center">
            <span className="bg-white/10 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-3 border border-white/20">{t("products.out_of_stock")}</span>
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                if (!isAuthenticated) return toast.info(t("products.login_alerts"));
                try {
                  await fetch(`/api/user/products/${product.id}/notify`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  toast.success(t("products.alert_success"), { icon: "🔔" });
                } catch (err) {
                  toast.error(t("products.alert_failed"));
                }
              }}
              className="bg-primary text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              {t("products.notify_me")}
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug min-h-[2.5rem]">
          {product.name}
        </h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-lg font-bold text-primary">{formatPrice(product.price)}</p>
            <p className="text-[10px] text-muted-foreground">{t("unit.per")} {product.unit}</p>
          </div>
          <button
            onClick={handleAdd}
            disabled={!product.inStock}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              inCart
                ? "bg-green-500 text-primary-foreground"
                : "bg-primary text-primary-foreground hover:opacity-90"
            } disabled:opacity-40`}
          >
            {inCart ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
