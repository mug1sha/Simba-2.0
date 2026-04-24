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
    <div className="group overflow-hidden rounded-[1.5rem] border border-border bg-card hover-lift">
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        {!imgError ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">📦</div>
        )}
        <span className="absolute left-3 top-3 rounded-full border border-border bg-card/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t(`cat.${product.category}`)}
        </span>
        
        <button
          onClick={toggleFavorite}
          disabled={isFavoriting}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md border transition-all ${
            isFavorite 
              ? "bg-red-500/15 border-red-500/30 text-red-500" 
              : "bg-card/90 border-border text-foreground hover:bg-card"
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
        </button>

        {hasPriceDrop && (
          <div className="absolute bottom-3 left-3 rounded-full bg-green-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
            {t("products.price_drop")}
          </div>
        )}

        {!product.inStock && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 p-4 text-center backdrop-blur-[2px]">
            <span className="mb-3 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">{t("products.out_of_stock")}</span>
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
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95"
            >
              {t("products.notify_me")}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <h3 className="min-h-[2.5rem] line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {product.name}
        </h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-lg font-bold text-foreground">{formatPrice(product.price)}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("unit.per")} {product.unit}</p>
          </div>
          <button
            onClick={handleAdd}
            disabled={!product.inStock}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
              inCart
                ? "border-green-500 bg-green-500 text-primary-foreground"
                : "border-primary bg-primary text-primary-foreground hover:opacity-90"
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
