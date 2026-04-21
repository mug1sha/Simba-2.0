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
              <span className="cursor-pointer" onClick={logout}>Logout ({user?.email})</span>
            ) : (
              <div className="flex gap-2">
                <span>Login</span>
                <span>Sign Up</span>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("nav.search_placeholder")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
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
    </header>
  );
};

export default Navbar;
