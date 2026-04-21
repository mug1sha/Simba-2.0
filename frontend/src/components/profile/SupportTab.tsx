import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const SupportTab = () => {
  const { token } = useAuth();
  const { toast } = useToast();

  const faqs = [
    { q: "Where do you deliver?", a: "We deliver all across Kigali, including Kimironko, Nyarutarama, and Kicukiro!" },
    { q: "What are your delivery hours?", a: "We operate from 8 AM to 8 PM daily. Same-day delivery for orders before 2 PM." },
    { q: "How can I pay?", a: "We accept MTN MoMo, Airtel Money, and all major Credit/Debit cards." }
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const ticket = {
      subject: formData.get("subject") as string,
      message: formData.get("message") as string
    };
    try {
      const res = await fetch("/api/user/support", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(ticket)
      });
      if (!res.ok) throw new Error();
      toast({ title: "Message Sent", description: "We'll get back to you soon!" });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to send message." });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Help & Support</h2>
        <p className="text-gray-500 text-sm">Find answers or get in touch with our team.</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-primary uppercase tracking-widest">Frequently Asked Questions</h3>
        <div className="space-y-2">
          {faqs.map((item, i) => (
            <details key={i} className="group bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
              <summary className="p-4 cursor-pointer font-bold text-sm text-white flex items-center justify-between list-none">
                {item.q}
                <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-xs text-gray-400 leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-white/5">
        <h3 className="text-sm font-bold text-primary uppercase tracking-widest">Send us a Message</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input name="subject" placeholder="Subject" required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50" />
          <textarea name="message" placeholder="How can we help?" rows={4} required className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 resize-none" />
          <button type="submit" className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all">
            Submit Inquiry
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default SupportTab;
