import { useState } from "react";
import { Search, ShoppingCart, X, MapPin, ChevronDown, User as UserIcon, Sparkles, ShoppingBag, LogOut } from "lucide-react";
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
import { useLocation, useNavigate } from "react-router-dom";

import { ThemeToggle } from "./ThemeToggle";
import { ThemePalettePicker } from "./ThemePalettePicker";
import { NavLink } from "./NavLink";

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "EN", label: "English", flag: "🇬🇧" },
  { code: "RW", label: "Kinyarwanda", flag: "🇷🇼" },
  { code: "FR", label: "Français", flag: "🇫🇷" },
];

const Navbar = ({ searchQuery, onSearchChange }: NavbarProps) => {
  const { totalItems, totalPrice, setIsCartOpen } = useCart();
  const { language, setLanguage, t } = useLanguage();
  const { isAuthenticated, user, logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
      try {
        const res = await fetch("/api/user/favorites/price-drops", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return [];
        return res.json();
      } catch (err) {
        console.error("Error fetching price drops:", err);
        return [];
      }
    },
    enabled: isAuthenticated && !!token
  });

  const previewResults = searchResults.slice(0, 6);
  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/88 backdrop-blur-xl transition-colors duration-500">
      <div className="border-b border-border/70 bg-[linear-gradient(90deg,hsl(var(--card)/0.9),hsl(var(--secondary)/0.85),hsl(var(--card)/0.9))] py-2">
        <div className="container mx-auto px-4 flex items-center justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-primary" /> Kigali, Rwanda</span>
            <span className="hidden md:inline font-black">{t("nav.free_delivery_short")}</span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationCenter token={token} />
            <ThemePalettePicker />
            <ThemeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 hover:text-primary transition-colors outline-none">
                <span>{currentLang.flag}</span>
                <span>{currentLang.code}</span>
                <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card dark:bg-[#08081a] border-border dark:border-white/10 min-w-[120px]">
                {languages.map((lang) => (
                  <DropdownMenuItem key={lang.code} onClick={() => setLanguage(lang.code)} className="flex items-center gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground">
                    <span>{lang.flag}</span>
                    <span className="text-xs font-bold">{lang.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-8">
          <div
            className="flex items-center gap-3 shrink-0 cursor-pointer"
            onClick={() => {
              if (location.pathname !== "/") {
                navigate("/");
                return;
              }
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-primary">
              <span className="text-white font-black text-xl italic tracking-tighter">S</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-black text-xl leading-none text-foreground tracking-tighter">SIMBA</h1>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.3em] leading-none text-muted-foreground">Market</p>
            </div>
          </div>

          <nav className="hidden xl:flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
            <NavLink
              to="/"
              end
              className="rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground transition-all hover:text-foreground"
              activeClassName="bg-primary text-white"
            >
              {t("nav.shop")}
            </NavLink>
            <NavLink
              to="/branches"
              className="rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground transition-all hover:text-foreground"
              activeClassName="bg-primary text-white"
            >
              {t("nav.branches")}
            </NavLink>
          </nav>

          <div className="flex-1 max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <input
              type="text"
              placeholder={t("nav.search_placeholder")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full rounded-2xl border border-border bg-card py-3.5 pl-11 pr-11 text-sm font-medium text-foreground placeholder:text-muted-foreground transition-all focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
            {searchQuery && (
              <button onClick={() => onSearchChange("")} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}

            <AnimatePresence>
              {isSearchFocused && searchQuery.length >= 2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 right-0 z-[60] mt-3 overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
                  <div className="p-3 space-y-1">
                    {previewResults.length > 0 ? (
                      <>
                        <div className="mb-2 border-b border-border px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("nav.quick_matches")}</div>
                        {previewResults.map((product) => (
                          <div key={product.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-accent cursor-pointer transition-all group" onClick={() => { onSearchChange(product.name); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }}>
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border">
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{product.name}</p>
                              <p className="text-xs text-primary font-black">{formatPrice(product.price)}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground text-xs font-bold uppercase tracking-widest">{t("nav.no_products")}</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="relative flex items-center gap-3 rounded-2xl border border-border px-4 py-2.5 outline-none transition-all hover:bg-accent">
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <UserIcon className="w-4 h-4 text-primary" />
                    {priceDrops.length > 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full border-2 border-background animate-pulse" />}
                  </div>
                  <div className="flex flex-col items-start pr-2">
                    <span className="text-xs font-bold text-foreground max-w-[80px] truncate">{user?.first_name || t("nav.user")}</span>
                    <span className="text-[9px] text-primary font-black uppercase tracking-tighter">{t("nav.premium_vip")}</span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="mt-2 w-64 rounded-[1.5rem] border border-border bg-card p-2 shadow-xl">
                  {priceDrops.length > 0 && (
                    <div className="m-1 mb-2 rounded-xl border border-primary/20 bg-primary/10 p-3">
                      <p className="text-[10px] font-black text-primary uppercase tracking-tighter flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> {priceDrops.length} {t("nav.price_drops")}
                      </p>
                    </div>
                  )}
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="flex items-center gap-3 p-3 rounded-xl focus:bg-accent cursor-pointer">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground">{t("nav.manage_account")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/customer")} className="flex items-center gap-3 p-3 rounded-xl focus:bg-accent cursor-pointer">
                    <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground">{t("nav.track_orders")}</span>
                  </DropdownMenuItem>
                  <div className="h-px bg-border my-2 mx-2" />
                  <DropdownMenuItem onClick={logout} className="flex items-center gap-3 p-3 rounded-xl focus:bg-destructive/10 text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4" />
                    <span className="text-xs font-bold">{t("nav.sign_out")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="rounded-2xl border border-border bg-card px-6 py-2.5 text-xs font-black text-foreground transition-all hover:bg-accent"
              >
                {t("nav.sign_in")}
              </button>
            )}

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-3 rounded-2xl border border-primary bg-primary px-6 py-3 text-xs font-black text-white transition-all hover:opacity-90 active:scale-[0.97]"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden lg:inline">RWF {totalPrice.toLocaleString()}</span>
              {totalItems > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-lg bg-foreground text-[10px] font-black text-background">
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
