import { useState } from "react";
import { Search, ShoppingCart, Menu, X, MapPin, ChevronDown, User as UserIcon, Bell, Info, Package, Sparkles, ShoppingBag, LogOut } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthDialog } from "@/components/AuthDialog";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts, formatPrice } from "@/lib/products";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileDialog } from "@/components/ProfileDialog";
import NotificationCenter from "./NotificationCenter";

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "EN", label: "English", flag: "🇺🇸" },
  { code: "RW", label: "Kinyarwanda", flag: "🇷🇼" },
  { code: "FR", label: "Français", flag: "🇫🇷" },
];

const Navbar = ({ searchQuery, onSearchChange }: NavbarProps) => {
  const { totalItems, totalPrice, setIsCartOpen } = useCart();
  const { language, setLanguage, t } = useLanguage();
  const { isAuthenticated, user, logout, token } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["navbar-search", searchQuery],
    queryFn: () => fetchProducts(undefined, searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const { data: priceDrops = [] } = useQuery({
    queryKey: ["price-drops"],
    queryFn: async () => {
      if (!isAuthenticated || !token) return [];
      const res = await fetch("/api/user/favorites/price-drops", {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.json();
    },
    enabled: isAuthenticated && !!token
  });

  const previewResults = searchResults.slice(0, 6);
  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <header className="sticky top-0 z-50 bg-[#08081a]/95 backdrop-blur-3xl border-b border-white/10 shadow-2xl">
      {/* Top Header/Utility Bar */}
      <div className="bg-white/[0.02] border-b border-white/5 py-2">
        <div className="container mx-auto px-4 flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-primary" /> Kigali, Rwanda</span>
            <span className="hidden md:inline font-medium">Free Delivery over RWF 50,000</span>
          </div>
          <div className="flex items-center gap-6">
            <NotificationCenter token={token} />
            
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 hover:text-white transition-colors outline-none">
                <span>{currentLang.flag}</span>
                <span>{currentLang.code}</span>
                <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#08081a] border-white/10 min-w-[120px]">
                {languages.map((lang) => (
                  <DropdownMenuItem key={lang.code} onClick={() => setLanguage(lang.code)} className="flex items-center gap-2 cursor-pointer focus:bg-white/5">
                    <span>{lang.flag}</span>
                    <span className="text-xs">{lang.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-8">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-11 h-11 bg-primary rounded-[1rem] flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-white font-black text-xl italic">S</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-black text-xl leading-none text-white tracking-tighter">SIMBA</h1>
              <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] leading-none mt-1">Market</p>
            </div>
          </div>

          {/* Intelligent Search Bar */}
          <div className="flex-1 max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 z-10" />
            <input
              type="text"
              placeholder={t("nav.search_placeholder")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white/[0.05] transition-all shadow-2xl"
            />
            {searchQuery && (
              <button onClick={() => onSearchChange("")} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}

            <AnimatePresence>
              {isSearchFocused && searchQuery.length >= 2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 right-0 mt-3 bg-[#08081a]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-[60]">
                  <div className="p-3 space-y-1">
                    {previewResults.length > 0 ? (
                      <>
                        <div className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-white/5 mb-2">QUICK MATCHES</div>
                        {previewResults.map((product) => (
                          <div key={product.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-all group" onClick={() => { onSearchChange(product.name); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }}>
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{product.name}</p>
                              <p className="text-xs text-primary font-black">{formatPrice(product.price)}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="py-12 text-center text-gray-500 text-xs font-bold uppercase tracking-widest">No products found</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User & Actions */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-white/5 px-4 py-2.5 rounded-2xl transition-all outline-none border border-white/5 hover:border-white/10 relative">
                  <div className="w-8 h-8 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30 relative">
                    <UserIcon className="w-4 h-4 text-primary" />
                    {priceDrops.length > 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#08081a] animate-pulse" />}
                  </div>
                  <div className="flex flex-col items-start pr-2">
                    <span className="text-xs font-bold text-white max-w-[80px] truncate">{user?.first_name || "User"}</span>
                    <span className="text-[9px] text-gray-500 uppercase tracking-tighter">Premium</span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#08081a] border-white/10 w-64 p-2 mt-2 rounded-[1.5rem] shadow-2xl">
                  {priceDrops.length > 0 && (
                    <div className="m-1 p-3 bg-primary/10 rounded-xl border border-primary/20 mb-2">
                      <p className="text-[10px] font-black text-primary uppercase tracking-tighter flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> {priceDrops.length} Price drops in Wishlist!
                      </p>
                    </div>
                  )}
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="flex items-center gap-3 p-3 rounded-xl focus:bg-white/5 cursor-pointer">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-bold text-white">Manage Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="flex items-center gap-3 p-3 rounded-xl focus:bg-white/5 cursor-pointer">
                    <ShoppingBag className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-bold text-white">Track Orders</span>
                  </DropdownMenuItem>
                  <div className="h-px bg-white/5 my-2 mx-2" />
                  <DropdownMenuItem onClick={logout} className="flex items-center gap-3 p-3 rounded-xl focus:bg-red-500/10 text-red-500 cursor-pointer">
                    <LogOut className="w-4 h-4" />
                    <span className="text-xs font-bold">Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="px-6 py-2.5 bg-white/[0.03] border border-white/10 rounded-2xl text-xs font-bold text-white hover:bg-white/[0.06] transition-all"
              >
                Sign In
              </button>
            )}

            {/* Cart Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-3 bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs hover:scale-[1.03] active:scale-[0.97] transition-all shadow-xl shadow-primary/20 border border-primary/30"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden lg:inline">RWF {totalPrice.toLocaleString()}</span>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-primary text-[10px] font-black w-5 h-5 rounded-lg flex items-center justify-center shadow-2xl transform rotate-12">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <ProfileDialog isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </header>
  );
};

export default Navbar;
