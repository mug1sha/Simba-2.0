import { Truck, Shield, CreditCard, Clock, Headphones, Award } from "lucide-react";

const trustItems = [
  { icon: Truck, title: "Free Delivery", desc: "On orders over RWF 50,000" },
  { icon: Shield, title: "Quality Assured", desc: "100% genuine products" },
  { icon: CreditCard, title: "MoMo & Cards", desc: "Pay your way securely" },
  { icon: Clock, title: "Same-Day", desc: "Order before 2PM in Kigali" },
  { icon: Headphones, title: "24/7 Support", desc: "We're always here to help" },
  { icon: Award, title: "Best Prices", desc: "Price match guarantee" },
];

const TrustSection = () => (
  <section className="bg-brand-warm section-padding">
    <div className="container mx-auto px-4">
      <div className="text-center mb-10">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">Why Shop With Simba?</h2>
        <p className="text-muted-foreground mt-2">Trusted by thousands of families in Kigali</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {trustItems.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-card rounded-2xl p-5 text-center border border-border/50 hover-lift">
            <div className="w-12 h-12 mx-auto bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-[11px] text-muted-foreground mt-1">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TrustSection;