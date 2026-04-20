import { Plus, Check } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { formatPrice, type Product } from "@/lib/products";
import { useState } from "react";
import { toast } from "sonner";

const ProductCard = ({ product }: { product: Product }) => {
  const { addItem, items } = useCart();
  const [imgError, setImgError] = useState(false);
  const inCart = items.some((i) => i.id === product.id);

  const handleAdd = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      unit: product.unit,
    });
    toast.success(`${product.name} added to cart`, { duration: 1500 });
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
          {product.category}
        </span>
        {!product.inStock && (
          <div className="absolute inset-0 bg-foreground/50 flex items-center justify-center">
            <span className="bg-card text-foreground text-sm font-medium px-3 py-1 rounded-full">Out of Stock</span>
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
            <p className="text-[10px] text-muted-foreground">per {product.unit}</p>
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