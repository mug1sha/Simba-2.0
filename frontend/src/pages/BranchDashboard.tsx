import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, MapPin, PackageCheck, Play, Search, UserRound, Users } from "lucide-react";
import { formatPrice } from "@/lib/products";

type BranchRole = "manager" | "staff";

type BranchOrder = {
  id: number;
  total: number;
  items: string;
  status: string;
  pickup_branch?: string;
  pickup_time?: string;
  deposit_amount?: number;
  deposit_method?: string;
  assigned_staff?: string;
  created_at: string;
};

type BranchStock = {
  id: number;
  branch: string;
  product_id: number;
  stock_count: number;
  updated_at?: string;
  product: {
    id: number;
    name: string;
    price: number;
    image: string;
    category: string;
    unit: string;
  };
};

const branches = [
  "Simba Supermarket Remera",
  "Simba Supermarket Kimironko",
  "Simba Supermarket Kacyiru",
  "Simba Supermarket Nyamirambo",
  "Simba Supermarket Gikondo",
  "Simba Supermarket Kanombe",
  "Simba Supermarket Kinyinya",
  "Simba Supermarket Kibagabaga",
  "Simba Supermarket Nyanza",
];

const statusClass: Record<string, string> = {
  Pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
  Assigned: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  Preparing: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  "Ready for Pick-up": "bg-green-500/15 text-green-300 border-green-500/20",
  "Picked Up": "bg-white/10 text-gray-300 border-white/10",
  "No-show": "bg-red-500/15 text-red-300 border-red-500/20",
};

const parseItems = (items: string) => {
  try {
    return JSON.parse(items || "[]");
  } catch {
    return [];
  }
};

const BranchDashboard = () => {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<BranchRole>("manager");
  const [branch, setBranch] = useState(branches[0]);
  const [staffMember, setStaffMember] = useState("Aline");
  const [stockSearch, setStockSearch] = useState("");

  const { data: staff = [] } = useQuery<string[]>({
    queryKey: ["branch-staff"],
    queryFn: async () => {
      const res = await fetch("/api/branch/staff");
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });

  const { data: orders = [], isLoading } = useQuery<BranchOrder[]>({
    queryKey: ["branch-orders", role, branch, staffMember],
    queryFn: async () => {
      const params = new URLSearchParams({ branch });
      if (role === "staff") params.set("staff_member", staffMember);
      const res = await fetch(`/api/branch/orders?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: stock = [], isLoading: stockLoading } = useQuery<BranchStock[]>({
    queryKey: ["branch-stock", branch, stockSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ branch });
      if (stockSearch.trim()) params.set("search", stockSearch.trim());
      const res = await fetch(`/api/branch/stock?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch branch stock");
      return res.json();
    },
  });

  const action = useMutation({
    mutationFn: async ({ orderId, endpoint, staff }: { orderId: number; endpoint: string; staff?: string }) => {
      const res = await fetch(`/api/branch/orders/${orderId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: endpoint === "assign" ? JSON.stringify({ staff_member: staff }) : undefined,
      });
      if (!res.ok) throw new Error("Action failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branch-orders"] }),
  });

  const markOutOfStock = useMutation({
    mutationFn: async (productId: number) => {
      const params = new URLSearchParams({ branch });
      const res = await fetch(`/api/branch/stock/${productId}/out-of-stock?${params.toString()}`, { method: "POST" });
      if (!res.ok) throw new Error("Stock update failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branch-stock"] }),
  });

  const counts = useMemo(() => ({
    pending: orders.filter((order) => order.status === "Pending").length,
    preparing: orders.filter((order) => order.status === "Preparing").length,
    ready: orders.filter((order) => order.status === "Ready for Pick-up").length,
  }), [orders]);

  return (
    <div className="min-h-screen bg-[#050510] text-white">
      <header className="border-b border-white/10 bg-[#08081a]/95 sticky top-0 z-20 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-primary font-black">Simba Operations</p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Branch Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              {[
                { id: "manager", label: "Branch Manager", icon: Users },
                { id: "staff", label: "Branch Staff", icon: UserRound },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setRole(id as BranchRole)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${role === id ? "bg-primary text-white" : "text-gray-400 hover:text-white"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-2xl border border-white/10 bg-[#101024] px-4 py-3 text-xs font-bold outline-none">
              {branches.map((item) => <option key={item}>{item}</option>)}
            </select>
            {role === "staff" && (
              <select value={staffMember} onChange={(e) => setStaffMember(e.target.value)} className="rounded-2xl border border-white/10 bg-[#101024] px-4 py-3 text-xs font-bold outline-none">
                {staff.map((name) => <option key={name}>{name}</option>)}
              </select>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Pending", value: counts.pending, icon: Clock },
            { label: "Preparing", value: counts.preparing, icon: Play },
            { label: "Ready", value: counts.ready, icon: PackageCheck },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-gray-500 font-black">{label}</span>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-3 text-3xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="border-b border-white/10 p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black">Branch Inventory</h2>
              <p className="text-xs text-gray-500 mt-1">Stock is tracked separately for {branch}. Updating this branch does not change other branches.</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Search branch stock..."
                className="w-full rounded-2xl border border-white/10 bg-[#101024] py-3 pl-10 pr-4 text-xs font-bold text-white outline-none placeholder:text-gray-600"
              />
            </div>
          </div>

          {stockLoading ? (
            <div className="p-10 text-center text-gray-500 text-sm font-bold">Loading stock...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-5">
              {stock.slice(0, 24).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex gap-3">
                    <img src={item.product.image} alt={item.product.name} className="h-12 w-12 rounded-xl object-cover bg-white/5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-white">{item.product.name}</p>
                      <p className="text-[10px] text-gray-500">{item.product.category}</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.stock_count > 0 ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                          {item.stock_count} in stock
                        </span>
                        <button
                          onClick={() => markOutOfStock.mutate(item.product_id)}
                          disabled={item.stock_count === 0}
                          className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-black text-red-300 hover:bg-red-500 hover:text-white disabled:opacity-40"
                        >
                          Mark out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="border-b border-white/10 p-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">{role === "manager" ? "All Branch Orders" : `${staffMember}'s Assigned Orders`}</h2>
              <p className="text-xs text-gray-500 flex items-center gap-2 mt-1"><MapPin className="h-3.5 w-3.5" /> {branch}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-gray-500 text-sm font-bold">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm font-bold">No orders in this queue.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {orders.map((order) => {
                const items = parseItems(order.items);
                return (
                  <article key={order.id} className="p-5 grid gap-5 lg:grid-cols-[1fr_auto]">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-black">Order #{order.id}</h3>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass[order.status] || "bg-white/10 text-gray-300 border-white/10"}`}>
                          {order.status}
                        </span>
                        {order.assigned_staff && <span className="text-xs text-gray-400">Assigned to {order.assigned_staff}</span>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                          <p className="text-gray-500 font-black uppercase tracking-widest mb-1">Pickup</p>
                          <p className="font-bold">{order.pickup_time || "Not set"}</p>
                        </div>
                        <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                          <p className="text-gray-500 font-black uppercase tracking-widest mb-1">Deposit</p>
                          <p className="font-bold">{formatPrice(order.deposit_amount || 0)}</p>
                        </div>
                        <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                          <p className="text-gray-500 font-black uppercase tracking-widest mb-1">Total</p>
                          <p className="font-bold">{formatPrice(order.total)}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {items.slice(0, 5).map((item: any) => (
                          <div key={item.id} className="flex items-center gap-3 text-xs text-gray-300">
                            <img src={item.image} alt={item.name} className="h-8 w-8 rounded-lg object-cover bg-white/5" />
                            <span className="flex-1 truncate">{item.name}</span>
                            <span className="font-black text-white">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[180px]">
                      {role === "manager" && order.status === "Pending" && (
                        staff.map((name) => (
                          <button
                            key={name}
                            onClick={() => action.mutate({ orderId: order.id, endpoint: "assign", staff: name })}
                            className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-black text-primary hover:bg-primary hover:text-white transition-all"
                          >
                            Assign to {name}
                          </button>
                        ))
                      )}
                      {role === "staff" && order.status === "Assigned" && (
                        <button onClick={() => action.mutate({ orderId: order.id, endpoint: "start" })} className="rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-3 text-xs font-black text-orange-300 hover:bg-orange-500 hover:text-white transition-all">
                          Start Preparing
                        </button>
                      )}
                      {role === "staff" && order.status === "Preparing" && (
                        <button onClick={() => action.mutate({ orderId: order.id, endpoint: "ready" })} className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-xs font-black text-green-300 hover:bg-green-500 hover:text-white transition-all">
                          <CheckCircle2 className="inline h-4 w-4 mr-2" />
                          Mark Ready
                        </button>
                      )}
                      {role === "manager" && order.status === "Ready for Pick-up" && (
                        <>
                          <button onClick={() => action.mutate({ orderId: order.id, endpoint: "picked-up" })} className="rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-xs font-black text-white hover:bg-white hover:text-[#08081a] transition-all">
                            Customer Picked Up
                          </button>
                          <button onClick={() => action.mutate({ orderId: order.id, endpoint: "no-show" })} className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs font-black text-red-300 hover:bg-red-500 hover:text-white transition-all">
                            Flag No-show
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default BranchDashboard;
