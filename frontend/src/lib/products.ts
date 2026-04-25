import fallbackCatalog from "@/data/products.json";

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  subcategoryId: number;
  inStock: boolean;
  image: string;
  unit: string;
}

export interface StoreInfo {
  name: string;
  tagline: string;
  location: string;
  currency: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const bundledStoreInfo: StoreInfo = fallbackCatalog.store;
const bundledProducts: Product[] = fallbackCatalog.products;
const bundledCategories = Array.from(new Set(bundledProducts.map((product) => product.category)));

const warnAndUseBundledCatalog = (resource: string, error?: unknown) => {
  console.warn(`Using bundled ${resource} fallback because the API response was unavailable or empty.`, error);
};

export const fetchStoreInfo = async (): Promise<StoreInfo> => {
  try {
    const res = await fetch(`${API_BASE_URL}/store`);
    if (!res.ok) throw new Error(`Failed to fetch store info: ${res.status}`);
    return res.json();
  } catch (error) {
    warnAndUseBundledCatalog("store info", error);
    return bundledStoreInfo;
  }
};

export const fetchProducts = async (category?: string, search?: string): Promise<Product[]> => {
  const applyFallbackFilters = () => {
    const normalizedSearch = search?.trim().toLowerCase();

    return bundledProducts.filter((product) => {
      if (category && product.category !== category) return false;
      if (!normalizedSearch) return true;

      return [
        product.name,
        product.category,
        product.unit,
        String(product.price),
      ].some((field) => field.toLowerCase().includes(normalizedSearch));
    });
  };

  try {
    let url = `${API_BASE_URL}/products?limit=1000`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);

    const products: Product[] = await res.json();
    if (products.length === 0 && bundledProducts.length > 0) {
      warnAndUseBundledCatalog("products");
      return applyFallbackFilters();
    }
    return products;
  } catch (error) {
    warnAndUseBundledCatalog("products", error);
    return applyFallbackFilters();
  }
};

export const fetchCategories = async (): Promise<string[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/categories`);
    if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);

    const categories: string[] = await res.json();
    if (categories.length === 0 && bundledCategories.length > 0) {
      warnAndUseBundledCatalog("categories");
      return bundledCategories;
    }
    return categories;
  } catch (error) {
    warnAndUseBundledCatalog("categories", error);
    return bundledCategories;
  }
};

export const formatPrice = (price: number) =>
  `RWF ${price.toLocaleString("en-RW")}`;

export const getCategoryIcon = (category: string): string => {
  const icons: Record<string, string> = {
    "Food Products": "🍎",
    "Alcoholic Drinks": "🍷",
    "Baby Products": "🧸",
    "Cleaning & Sanitary": "🧹",
    "Cosmetics & Personal Care": "💄",
    "General": "📦",
    "Kitchen Storage": "🏺",
    "Kitchenware & Electronics": "🔌",
    "Pet Care": "🐾",
    "Sports & Wellness": "⚽",
  };
  return icons[category] || "📦";
};
