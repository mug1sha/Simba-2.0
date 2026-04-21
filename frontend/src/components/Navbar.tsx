import { useState } from "react";
import { Search, ShoppingCart, Menu, X, MapPin, ChevronDown, User as UserIcon } from "lucide-react";
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
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["navbar-search", searchQuery],
    queryFn: () => fetchProducts(undefined, searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const previewResults = searchResults.slice(0, 6);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const element = document.getElementById("products");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        setIsSearchFocused(false);
      }
    }
  };

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border/50 shadow-sm">
      {/* Top bar */}
      <div className="bg-foreground text-primary-foreground">
        <div className="container mx-auto px-4 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Kigali, Rwanda</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <span className="cursor-pointer font-medium hover:text-primary transition-all duration-200" onClick={logout}>Logout ({user?.email})</span>
            ) : (
              <div className="flex gap-5">
                <span className="cursor-pointer text-muted-foreground font-medium hover:text-primary hover:-translate-y-0.5 transform transition-all duration-200" onClick={() => setIsAuthOpen(true)}>Login</span>
                <span className="cursor-pointer text-muted-foreground font-medium hover:text-primary hover:-translate-y-0.5 transform transition-all duration-200" onClick={() => setIsAuthOpen(true)}>Sign Up</span>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 hover:opacity-80 transition-opacity outline-none">
                <span>{currentLang.flag}</span>
                <span className="font-medium">{currentLang.code}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-heading font-bold text-lg">S</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-heading font-bold text-lg leading-tight text-foreground">Simba</h1>
              <p className="text-[10px] text-muted-foreground leading-none">Supermarket</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <input
              type="text"
              placeholder={t("nav.search_placeholder")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-muted/60 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Search Dropdown */}
            <AnimatePresence>
              {isSearchFocused && searchQuery.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden z-[60]"
                >
                  <div className="p-2 space-y-1">
                    {previewResults.length > 0 ? (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          Quick Results
                        </div>
                        {previewResults.map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-primary/5 cursor-pointer transition-colors group"
                            onClick={() => {
                              // Potentially navigate or open product details
                              onSearchChange(product.name);
                              document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
                            }}
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                              <p className="text-xs text-primary font-bold">{formatPrice(product.price)}</p>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}
                          className="w-full mt-2 py-2.5 text-xs font-bold text-primary hover:bg-primary/5 transition-colors border-t border-border/30 rounded-b-xl"
                        >
                          View All Results
                        </button>
                      </>
                    ) : (
                      <div className="py-8 text-center">
                        <p className="text-sm text-muted-foreground">No products found for "{searchQuery}"</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Cart */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="hidden md:inline">
              RWF {totalPrice.toLocaleString()}
            </span>
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-foreground text-background text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-count-up">
                {totalItems}
              </span>
            )}
          </button>

          {/* Mobile menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-foreground"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </header>
  );
};

export default Navbar;
