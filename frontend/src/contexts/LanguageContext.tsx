import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "EN" | "RW" | "FR";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  EN: {
    "nav.categories": "Categories",
    "nav.deals": "Deals",
    "nav.all_products": "All Products",
    "nav.search_placeholder": "Search products, categories...",
    "nav.momo_accepted": "MTN MoMo accepted",
    "nav.free_delivery": "Free delivery on orders over RWF 50,000",
    "hero.badge": "Rwanda's #1 Online Supermarket",
    "hero.title": "Fresh Groceries, Delivered to Your Door",
    "hero.delivered": "Delivered",
    "hero.subtitle": "Shop 700+ quality products from Kigali's favorite supermarket. Fast delivery, fair prices, and payment with MTN MoMo.",
    "hero.shop_now": "Shop Now",
    "hero.browse": "Browse Categories",
    "hero.trust_delivery": "Free delivery 50K+",
    "hero.trust_sameday": "Same-day delivery",
    "hero.trust_quality": "Quality guaranteed",
    "deals.title": "Fresh Deals Today",
    "deals.hot": "HOT DEALS",
    "deals.view_all": "View all",
    "categories.title": "Shop by Category",
    "categories.subtitle": "Find exactly what you need",
    "categories.all": "All Products",
    "categories.items": "items",
    "footer.tagline": "Rwanda's Online Supermarket",
    "cart.title": "Your Cart",
    "cart.empty": "Your cart is empty",
    "cart.start_shopping": "Start Shopping",
    "cart.checkout": "Checkout",
    "cart.subtotal": "Subtotal",
    "cart.clear": "Clear cart",
  },
  RW: {
    "nav.categories": "Ibyiciro",
    "nav.deals": "Gahunda",
    "nav.all_products": "Ibicuruzwa byose",
    "nav.search_placeholder": "Shaka ibicuruzwa, ibyiciro...",
    "nav.momo_accepted": "MTN MoMo iremewe",
    "nav.free_delivery": "Kugeza ku buntu ku burenganzira burenze RWF 50,000",
    "hero.badge": "Supermarket ya mbere mu Rwanda kuri interineti",
    "hero.title": "Ibiribwa bishya, Bikugezeho mu rugo",
    "hero.delivered": "Bikugezeho",
    "hero.subtitle": "Haha ibicuruzwa 700+ bifite ireme muri supermarket ikunzwe i Kigali. Kugeza vuba, ibiciro byiza, no kwishyura na MTN MoMo.",
    "hero.shop_now": "Haha nonaha",
    "hero.browse": "Reba ibyiciro",
    "hero.trust_delivery": "Kugeza ku buntu 50K+",
    "hero.trust_sameday": "Kugeza uwo munsi",
    "hero.trust_quality": "Ireme ryizewe",
    "deals.title": "Gahunda z'uyu munsi",
    "deals.hot": "Gahunda zishushye",
    "deals.view_all": "Reba byose",
    "categories.title": "Shakira mu byiciro",
    "categories.subtitle": "Bona neza icyo ukeneye",
    "categories.all": "Ibicuruzwa byose",
    "categories.items": "ibicuruzwa",
    "footer.tagline": "Supermarket yo mu Rwanda kuri interineti",
    "cart.title": "Ikarita yawe",
    "cart.empty": "Ikarita yawe irimo ubusa",
    "cart.start_shopping": "Tangira guhaha",
    "cart.checkout": "Ishyura",
    "cart.subtotal": "Igiteranyo",
    "cart.clear": "Vanamo byose",
  },
  FR: {
    "nav.categories": "Catégories",
    "nav.deals": "Offres",
    "nav.all_products": "Tous les produits",
    "nav.search_placeholder": "Rechercher des produits, catégories...",
    "nav.momo_accepted": "MTN MoMo accepté",
    "nav.free_delivery": "Livraison gratuite dès 50 000 RWF",
    "hero.badge": "Le supermarché en ligne n°1 au Rwanda",
    "hero.title": "Produits frais, livrés à votre porte",
    "hero.delivered": "Livrés",
    "hero.subtitle": "Achetez plus de 700 produits de qualité du supermarché préféré de Kigali. Livraison rapide, prix justes et paiement par MTN MoMo.",
    "hero.shop_now": "Acheter maintenant",
    "hero.browse": "Parcourir les catégories",
    "hero.trust_delivery": "Livraison gratuite 50K+",
    "hero.trust_sameday": "Livraison le jour même",
    "hero.trust_quality": "Qualité garantie",
    "deals.title": "Offres du jour",
    "deals.hot": "OFFRES CHAUDES",
    "deals.view_all": "Voir tout",
    "categories.title": "Acheter par catégorie",
    "categories.subtitle": "Trouvez exactement ce dont vous avez besoin",
    "categories.all": "Tous les produits",
    "categories.items": "articles",
    "footer.tagline": "Le supermarché en ligne du Rwanda",
    "cart.title": "Votre Panier",
    "cart.empty": "Votre panier est vide",
    "cart.start_shopping": "Commencer vos achats",
    "cart.checkout": "Payer",
    "cart.subtotal": "Sous-total",
    "cart.clear": "Vider le panier",

  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>("EN");

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
