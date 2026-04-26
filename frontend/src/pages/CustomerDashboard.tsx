import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Clock3, MapPin, PackageCheck, ShoppingBag } from "lucide-react";
import Navbar from "@/components/Navbar";
import ChatWidget from "@/components/ChatWidget";
import CartDrawer from "@/components/CartDrawer";
import OrderCard from "@/components/profile/OrderCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["customer-dashboard-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    enabled: !!token,
  });

  const orders = profile?.orders || [];
  const pickupOrders = orders.filter((order: any) => order.fulfillment_type === "pickup");
  const activeOrders = pickupOrders.filter((order: any) => !["Completed", "Cancelled", "No-show"].includes(order.status));
  const readyOrders = pickupOrders.filter((order: any) => order.status === "Ready for Pick-up");
  const latestBranch = pickupOrders[0]?.pickup_branch || "No branch selected";

  const stats = useMemo(() => ([
    { label: "Active pickup orders", value: activeOrders.length, icon: Clock3 },
    { label: "Ready for pick-up", value: readyOrders.length, icon: PackageCheck },
    { label: "Orders placed", value: pickupOrders.length, icon: ShoppingBag },
    { label: "Latest branch", value: latestBranch, icon: MapPin },
  ]), [activeOrders.length, latestBranch, pickupOrders.length, readyOrders.length]);

  return (
    <div className="min-h-screen bg-background transition-colors duration-500">
      <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="container mx-auto space-y-8 px-4 py-10">
        <section className="rounded-[2rem] border border-border/50 bg-card/80 p-6 shadow-2xl shadow-black/5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">Customer Dashboard</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-foreground">Track your pickup orders clearly</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Monitor branch assignment, preparation progress, and ready-for-pickup updates in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded-2xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
              >
                Back to Store
              </button>
              <button
                type="button"
                onClick={() => navigate("/branches")}
                className="rounded-2xl border border-border px-5 py-3 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-primary/20 hover:bg-accent"
              >
                Explore Branches
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-3xl border border-border/50 bg-background/70 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-4 text-2xl font-black tracking-tight text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-border/50 bg-card p-6 shadow-2xl shadow-black/5">
          <div className="flex flex-col gap-2 border-b border-border pb-4">
            <h2 className="text-2xl font-black tracking-tight text-foreground">{t("profile.orders_title")}</h2>
            <p className="text-sm text-muted-foreground">Each pickup order updates live from branch acceptance through completion.</p>
          </div>

          <div className="mt-6 space-y-4">
            {isLoading ? (
              <div className="rounded-3xl border border-dashed border-border/50 bg-background/60 p-10 text-center text-sm font-bold text-muted-foreground">
                Loading your orders...
              </div>
            ) : pickupOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/50 bg-background/60 p-10 text-center text-sm font-bold text-muted-foreground">
                {t("profile.no_orders")}
              </div>
            ) : (
              pickupOrders
                .slice()
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((order: any) => (
                  <OrderCard key={order.id} order={order} onCancel={() => refetch()} />
                ))
            )}
          </div>
        </section>
      </main>

      <CartDrawer />
      <ChatWidget />
    </div>
  );
};

export default CustomerDashboard;
