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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export const fetchStoreInfo = async (): Promise<StoreInfo> => {
  const res = await fetch(`${API_BASE_URL}/store`);
  if (!res.ok) throw new Error("Failed to fetch store info");
  return res.json();
};

export const fetchProducts = async (category?: string, search?: string): Promise<Product[]> => {
  let url = `${API_BASE_URL}/products?limit=1000`;
  if (category) url += `&category=${encodeURIComponent(category)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
};

export const fetchCategories = async (): Promise<string[]> => {
  const res = await fetch(`${API_BASE_URL}/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
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
