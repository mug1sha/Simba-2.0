import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { formatPrice, type Product } from "@/lib/products";
import { toast } from "sonner";

type ChatMessage = {
  role: "bot" | "user";
  text: string;
  time: Date;
  products?: Product[];
};

type CartAddMode = "first" | "all" | null;
type StoredLocation = {
  latitude: number;
  longitude: number;
};

const USER_LOCATION_STORAGE_KEY = "simba-user-location";

const readStoredLocation = (): StoredLocation | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(USER_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.latitude === "number" && typeof parsed?.longitude === "number") {
      return { latitude: parsed.latitude, longitude: parsed.longitude };
    }
  } catch {
    return null;
  }

  return null;
};

const getCartAddMode = (text: string): CartAddMode => {
  const msg = text.toLowerCase();
  const hasAddIntent = [
    "add", "put", "place", "cart", "basket", "buy this", "buy it", "i want this",
    "shyira", "ongeramo", "panier", "ajoute", "ajouter", "mets", "mettez"
  ].some((term) => msg.includes(term));

  if (!hasAddIntent) return null;

  const wantsAll = [
    "all", "everything", "them", "these", "all of them", "all products",
    "byose", "zose", "tous", "toutes", "tout"
  ].some((term) => msg.includes(term));

  return wantsAll ? "all" : "first";
};

const ChatWidget = () => {
  const { user, token } = useAuth();
  const { language, t } = useLanguage();
  const { addItem } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: `Hi ${user?.first_name || "there"}! 👋 How can Simba help you today?`, time: new Date() }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getLastSuggestedProducts = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const products = messages[i].products;
      if (products && products.length > 0) return products;
    }
    return [];
  };

  const addProductsFromChat = (products: Product[], mode: CartAddMode) => {
    if (!mode || products.length === 0) return "";
    const productsToAdd = mode === "all" ? products.filter((product) => product.inStock) : products.filter((product) => product.inStock).slice(0, 1);
    if (productsToAdd.length === 0) return t("products.ai_no_match_add");

    productsToAdd.forEach((product) => addItem(product));
    if (productsToAdd.length === 1) {
      const confirmation = t("products.ai_added_one").replace("{name}", productsToAdd[0].name);
      toast.success(confirmation, { duration: 1500 });
      return confirmation;
    }

    const confirmation = t("products.ai_added_many").replace("{count}", String(productsToAdd.length));
    toast.success(confirmation, { duration: 1500 });
    return confirmation;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMsg: ChatMessage = { role: "user", text: message, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentMsg = message;
    const addMode = getCartAddMode(currentMsg);
    const fallbackProducts = getLastSuggestedProducts();
    const storedLocation = readStoredLocation();
    setMessage("");
    
    setIsTyping(true);
    try {
      const res = await fetch("/api/support/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: currentMsg,
          lang: language,
          user_context: storedLocation ? { location: storedLocation } : undefined,
        })
      });
      const data = await res.json();
      const responseProducts = Array.isArray(data.products) ? data.products : [];
      const productsForAction = responseProducts.length > 0 ? responseProducts : fallbackProducts;
      const cartConfirmation = addProductsFromChat(productsForAction, addMode);
      const responseText = data.response || t("support.trouble");
      
      setMessages(prev => [...prev, { 
        role: "bot", 
        text: cartConfirmation ? `${responseText}\n\n${cartConfirmation}` : responseText, 
        products: responseProducts,
        time: new Date() 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: "bot", 
        text: t("support.offline"), 
        time: new Date() 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20, transformOrigin: "bottom right" }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="mb-4 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-[2rem] border border-border bg-card/95 shadow-[0_32px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/70 bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary)/0.88))] p-5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/18">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-[hsl(var(--brand-support))]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">{t("support.chat_title")}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--brand-support))]">{t("support.active_now")}</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-muted-foreground transition-colors hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[86%] rounded-2xl p-3 text-xs leading-relaxed ${
                    msg.role === "user" 
                      ? "bg-primary text-white rounded-tr-none" 
                      : "rounded-tl-none border border-border bg-accent/70 text-foreground"
                  }`}>
                    {msg.text}
                    {msg.products && msg.products.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.products.map((product) => (
                          <div key={product.id} className="flex items-center gap-2 rounded-xl border border-border/80 bg-card/85 p-2">
                            <img src={product.image} alt={product.name} className="h-10 w-10 rounded-lg bg-muted object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-bold text-foreground">{product.name}</p>
                              <p className="text-[10px] font-black text-primary">{formatPrice(product.price)}</p>
                            </div>
                            <button
                              type="button"
                              disabled={!product.inStock}
                              onClick={() => {
                                addItem(product);
                                toast.success(`${product.name} ${t("products.added_cart")}`, { duration: 1500 });
                              }}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-all hover:scale-105 disabled:opacity-40"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className={`mt-1 text-[8px] opacity-50 ${msg.role === "user" ? "text-right text-white/80" : "text-left text-muted-foreground"}`}>
                      {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-tl-none border border-border bg-accent/70 p-3">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0.2s]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="border-t border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--secondary)/0.72))] p-4">
              <div className="relative">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("support.ask_placeholder")}
                  className="w-full rounded-xl border border-border bg-background/90 px-4 py-3 pr-12 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none transition-all"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1.5 p-1.5 bg-primary rounded-lg text-white hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-primary rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.3)] flex items-center justify-center text-white relative group border border-white/10"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <div className="absolute -top-12 right-0 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-[10px] font-black text-foreground opacity-0 shadow-xl transition-all translate-y-2 group-hover:translate-y-0 group-hover:opacity-100">
                {t("support.need_help")}
                <div className="absolute bottom-[-4px] right-5 h-2 w-2 rotate-45 border-b border-r border-border bg-card" />
              </div>
              <MessageCircle className="w-6 h-6" />
              <div className="absolute right-0 top-0 h-3 w-3 animate-pulse rounded-full border-2 border-primary bg-[hsl(var(--brand-support))]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

export default ChatWidget;
