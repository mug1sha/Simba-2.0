import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, User, Bot, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ChatWidget = () => {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    { role: "bot", text: `Hi ${user?.first_name || "there"}! 👋 How can Simba help you today?`, time: new Date() }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMsg = { role: "user", text: message, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setMessage("");
    
    // Simulate Bot Response
    setIsTyping(true);
    setTimeout(() => {
      let botText = "That's a great question! Let me check that for you.";
      if (message.toLowerCase().includes("delivery")) {
        botText = "We offer same-day delivery in Kigali for orders placed before 2PM! 🚚";
      } else if (message.toLowerCase().includes("momo")) {
        botText = "Yes! We accept both MTN MoMo and Airtel Money directly at checkout. 📱";
      } else if (message.toLowerCase().includes("return")) {
        botText = "We have a 24-hour return policy for fresh produce if you're not satisfied. 🍎";
      }
      
      setMessages(prev => [...prev, { role: "bot", text: botText, time: new Date() }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20, transformOrigin: "bottom right" }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="mb-4 w-[380px] h-[520px] bg-[#08081a]/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_32px_80px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#08081a]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Simba Support</h4>
                  <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Active Now</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.role === "user" 
                      ? "bg-primary text-white rounded-tr-none" 
                      : "bg-white/[0.05] text-gray-300 border border-white/5 rounded-tl-none"
                  }`}>
                    {msg.text}
                    <p className={`text-[8px] mt-1 opacity-50 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                      {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.05] p-3 rounded-2xl rounded-tl-none border border-white/5 flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-white/[0.01]">
              <div className="relative">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about delivery, payment..."
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-primary/50 transition-all pr-12"
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
              <div className="absolute -top-12 right-0 bg-white text-[#08081a] px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 shadow-xl border border-white/20">
                NEED HELP?
                <div className="absolute bottom-[-4px] right-5 w-2 h-2 bg-white rotate-45" />
              </div>
              <MessageCircle className="w-6 h-6" />
              <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-primary animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

export default ChatWidget;
