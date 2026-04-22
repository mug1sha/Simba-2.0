import { MapPin, Phone, Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchStoreInfo } from "@/lib/products";

const FooterSection = () => {
  const { data: storeInfo } = useQuery({
    queryKey: ["store-info"],
    queryFn: fetchStoreInfo,
  });

  const name = storeInfo?.name || "Simba";
  const location = storeInfo?.location || "Kigali, Rwanda";

  return (
    <footer className="bg-foreground text-primary-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <span className="font-heading font-bold text-lg text-primary-foreground">{name.charAt(0)}</span>
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg">{name}</h3>
                <p className="text-[10px] opacity-60">{storeInfo?.tagline || "Supermarket Rwanda"}</p>
              </div>
            </div>
            <p className="text-sm opacity-70 leading-relaxed">
              Rwanda's favorite online supermarket. Quality products, fair prices, delivered to your door in {location ? location.split(",")[0] : "Kigali"}.
            </p>
          </div>

          <div>
            <h4 className="font-heading font-semibold mb-4">Shop</h4>
            <ul className="space-y-2 text-sm opacity-70">
              <li><a href="#categories" className="hover:opacity-100 transition-opacity">All Categories</a></li>
              <li><a href="#deals" className="hover:opacity-100 transition-opacity">Weekly Deals</a></li>
              <li><a href="#products" className="hover:opacity-100 transition-opacity">New Arrivals</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">Best Sellers</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold mb-4">Help</h4>
            <ul className="space-y-2 text-sm opacity-70">
              <li><a href="#" className="hover:opacity-100 transition-opacity">Track Order</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">Returns & Refunds</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">FAQ</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">Privacy Policy</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold mb-4">Contact</h4>
            <ul className="space-y-3 text-sm opacity-70">
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> {location || "Kigali, Rwanda"}</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> +250 788 000 000</li>
              <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> hello@{name ? name.toLowerCase().replace(/\s+/g, '') : "simba"}.rw</li>
            </ul>
            <div className="flex gap-2 mt-4">
              <span className="bg-primary/20 text-xs px-3 py-1 rounded-full">💳 Visa</span>
              <span className="bg-primary/20 text-xs px-3 py-1 rounded-full">📱 MoMo</span>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-10 pt-6 text-center text-xs opacity-50">
          © {new Date().getFullYear()} {name} {location.includes("Rwanda") ? "Rwanda" : ""}. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;