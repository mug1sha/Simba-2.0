import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Copy,
  PackageCheck,
  Play,
  Search,
  ShoppingBag,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/products";
import { toast } from "sonner";
import { readErrorMessage } from "@/lib/api";

type BranchOrder = {
  id: number;
  total: number;
  items: string;
  status: string;
  pickup_branch?: string;
  pickup_time?: string;
  assigned_staff?: string;
  assigned_staff_user_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  created_at: string;
};

type BranchStaffMember = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  branch?: string | null;
};

type BranchStock = {
  id: number;
  product_id: number;
  stock_count: number;
  product: {
    id: number;
    name: string;
    price: number;
    image: string;
    category: string;
  };
};

type RoleInviteLink = {
  email?: string | null;
  role: string;
  branch?: string | null;
  expires_at: string;
  invite_url: string;
};

const statusClass: Record<string, string> = {
  Pending: "bg-yellow-500/12 text-yellow-300 border-yellow-500/20",
  Accepted: "bg-sky-500/12 text-sky-300 border-sky-500/20",
  Assigned: "bg-blue-500/12 text-blue-300 border-blue-500/20",
  Preparing: "bg-orange-500/12 text-orange-300 border-orange-500/20",
  "Ready for Pick-up": "bg-green-500/12 text-green-300 border-green-500/20",
  Completed: "bg-emerald-500/12 text-emerald-300 border-emerald-500/20",
  "No-show": "bg-red-500/12 text-red-300 border-red-500/20",
  Cancelled: "bg-white/8 text-gray-300 border-white/10",
};

const parseItems = (items: string) => {
  try {
    return JSON.parse(items || "[]");
  } catch {
    return [];
  }
};

const getStaffLabel = (staff: BranchStaffMember) => {
  const fullName = [staff.first_name, staff.last_name].filter(Boolean).join(" ").trim();
  return fullName || staff.email;
};

const BranchDashboard = () => {
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockSearch, setStockSearch] = useState("");
  const [staffInviteEmail, setStaffInviteEmail] = useState("");
  const [latestStaffInvite, setLatestStaffInvite] = useState<RoleInviteLink | null>(null);

  const isManager = user?.role === "branch_manager";
  const isStaff = user?.role === "branch_staff";
  const branchName = user?.branch || "Unassigned Branch";

  const { data: staffMembers = [] } = useQuery<BranchStaffMember[]>({
    queryKey: ["branch-staff", branchName],
    queryFn: async () => {
      const res = await fetch("/api/branch/staff", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load branch staff");
      return res.json();
    },
    enabled: !!token && !!user && (isManager || isStaff),
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<BranchOrder[]>({
    queryKey: ["branch-orders", branchName, statusFilter, user?.role],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/branch/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load branch orders");
      return res.json();
    },
    enabled: !!token && !!user,
    refetchInterval: 5000,
  });

  const { data: stock = [], isLoading: stockLoading } = useQuery<BranchStock[]>({
    queryKey: ["branch-stock", branchName, stockSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stockSearch.trim()) params.set("search", stockSearch.trim());
      const res = await fetch(`/api/branch/stock?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load branch stock");
      return res.json();
    },
    enabled: !!token && !!user && isManager,
  });

  const action = useMutation({
    mutationFn: async ({ orderId, endpoint, body }: { orderId: number; endpoint: string; body?: Record<string, unknown> }) => {
      const res = await fetch(`/api/branch/orders/${orderId}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Action failed"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-orders"] });
      toast.success("Order updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markOutOfStock = useMutation({
    mutationFn: async (productId: number) => {
      const res = await fetch(`/api/branch/stock/${productId}/out-of-stock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Stock update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      toast.success("Stock updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createStaffInvite = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/branch/staff/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: staffInviteEmail.trim() || null }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to create invite link"));
      return res.json() as Promise<RoleInviteLink>;
    },
    onSuccess: (invite) => {
      setLatestStaffInvite(invite);
      toast.success("Staff invite link created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const availableFilters = isManager
    ? ["all", "Pending", "Accepted", "Assigned", "Preparing", "Ready for Pick-up", "Completed"]
    : ["all", "Assigned", "Preparing", "Ready for Pick-up", "Completed"];

  const summaryCards = useMemo(() => {
    const countByStatus = (status: string) => orders.filter((order) => order.status === status).length;
    return [
      {
        label: isManager ? "Pending review" : "Assigned to you",
        value: isManager ? countByStatus("Pending") : countByStatus("Assigned"),
        icon: Clock3,
      },
      {
        label: "Preparing now",
        value: countByStatus("Preparing"),
        icon: Play,
      },
      {
        label: "Ready for pick-up",
        value: countByStatus("Ready for Pick-up"),
        icon: PackageCheck,
      },
      {
        label: isManager ? "Branch staff" : "Completed",
        value: isManager ? staffMembers.length : countByStatus("Completed"),
        icon: isManager ? Users : CheckCircle2,
      },
    ];
  }, [isManager, orders, staffMembers.length]);

  return (
    <div className="min-h-screen bg-[#050510] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#08081a]/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">Simba Branch Operations</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                {isManager ? "Branch Manager Dashboard" : "Branch Staff Dashboard"}
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                {branchName} · {isManager ? "Manage every pickup order in your branch." : "Work only on the orders assigned to you."}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Signed in as</p>
              <p className="mt-2 text-sm font-black text-white">
                {user ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email : "Operations User"}
              </p>
              <p className="mt-1 text-xs text-primary">{isManager ? "Branch Manager" : "Branch Staff"}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-3xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className={`grid gap-6 ${isManager ? "xl:grid-cols-[1.1fr_0.9fr]" : ""}`}>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    {isManager ? "Branch order queue" : "Your assigned orders"}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {isManager
                      ? "Accept, assign, and complete pickup orders for your branch."
                      : "Update preparation and ready-for-pickup states as work progresses."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableFilters.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all ${
                        statusFilter === status ? "bg-primary text-white" : "bg-white/[0.04] text-gray-400 hover:text-white"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="divide-y divide-white/10">
              {ordersLoading ? (
                <div className="p-10 text-center text-sm font-bold text-gray-500">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="p-10 text-center text-sm font-bold text-gray-500">No orders match this queue.</div>
              ) : (
                orders.map((order) => {
                  const items = parseItems(order.items);
                  return (
                    <article key={order.id} className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-black">Order #{order.id}</h3>
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass[order.status] || "bg-white/10 text-gray-300 border-white/10"}`}>
                            {order.status}
                          </span>
                          {order.assigned_staff && (
                            <span className="text-xs text-gray-400">Assigned to {order.assigned_staff}</span>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Customer</p>
                            <p className="mt-1 text-sm font-bold text-white">{order.customer_name || "Unknown customer"}</p>
                            <p className="text-xs text-gray-500">{order.customer_phone || "No phone on file"}</p>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pickup branch</p>
                            <p className="mt-1 text-sm font-bold text-white">{order.pickup_branch}</p>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pickup time</p>
                            <p className="mt-1 text-sm font-bold text-white">{order.pickup_time || "Not set"}</p>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Order total</p>
                            <p className="mt-1 text-sm font-bold text-white">{formatPrice(order.total)}</p>
                          </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-white/5 bg-black/20 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Items</p>
                          <div className="mt-3 space-y-2">
                            {items.map((item: any) => (
                              <div key={`${order.id}-${item.id}`} className="flex items-center gap-3 text-xs text-gray-300">
                                <img src={item.image} alt={item.name} className="h-9 w-9 rounded-xl object-cover bg-white/5" />
                                <span className="flex-1 truncate">{item.name}</span>
                                <span className="font-black text-white">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-gray-500">
                          Ordered on {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex min-w-[220px] flex-col gap-2">
                        {isManager && order.status === "Pending" && (
                          <button
                            type="button"
                            onClick={() => action.mutate({ orderId: order.id, endpoint: "accept" })}
                            className="rounded-2xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
                          >
                            Accept Order
                          </button>
                        )}

                        {isManager && order.status === "Accepted" && staffMembers.map((staff) => (
                          <button
                            key={staff.id}
                            type="button"
                            onClick={() => action.mutate({
                              orderId: order.id,
                              endpoint: "assign",
                              body: { staff_user_id: staff.id },
                            })}
                            className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-left text-xs font-black text-primary transition-all hover:bg-primary hover:text-white"
                          >
                            Assign Staff: {getStaffLabel(staff)}
                          </button>
                        ))}

                        {isStaff && order.status === "Assigned" && (
                          <button
                            type="button"
                            onClick={() => action.mutate({ orderId: order.id, endpoint: "start" })}
                            className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-orange-300 transition-all hover:bg-orange-500 hover:text-white"
                          >
                            Start Preparing
                          </button>
                        )}

                        {isStaff && order.status === "Preparing" && (
                          <button
                            type="button"
                            onClick={() => action.mutate({ orderId: order.id, endpoint: "ready" })}
                            className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-green-300 transition-all hover:bg-green-500 hover:text-white"
                          >
                            Mark Ready
                          </button>
                        )}

                        {isManager && order.status === "Ready for Pick-up" && (
                          <button
                            type="button"
                            onClick={() => action.mutate({ orderId: order.id, endpoint: "complete" })}
                            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-300 transition-all hover:bg-emerald-500 hover:text-white"
                          >
                            Complete Order
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          {isManager && (
            <div className="space-y-6">
              <section className="rounded-[2rem] border border-white/10 bg-white/[0.03]">
                <div className="border-b border-white/10 p-5">
                  <h2 className="text-xl font-black">Branch staff</h2>
                  <p className="mt-1 text-sm text-gray-500">Only staff from {branchName} can be assigned orders here.</p>
                </div>
                <div className="space-y-4 p-5">
                  <div className="rounded-[1.5rem] border border-primary/15 bg-primary/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Private staff invite</p>
                    <p className="mt-2 text-sm text-gray-400">
                      Generate a secret sign-up link for a staff member in {branchName}. Anyone with the link can create that branch staff account.
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                      <input
                        type="email"
                        value={staffInviteEmail}
                        onChange={(event) => setStaffInviteEmail(event.target.value)}
                        placeholder="Optional invited email address"
                        className="h-12 rounded-2xl border border-white/10 bg-[#101024] px-4 text-sm text-white outline-none placeholder:text-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => createStaffInvite.mutate()}
                        disabled={createStaffInvite.isPending}
                        className="rounded-2xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-60"
                      >
                        {createStaffInvite.isPending ? "Creating invite..." : "Create Staff Invite"}
                      </button>
                    </div>
                    {latestStaffInvite && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Latest invite link</p>
                        <a
                          href={latestStaffInvite.invite_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block break-all text-sm text-primary hover:underline"
                        >
                          {latestStaffInvite.invite_url}
                        </a>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                          <span>Expires {new Date(latestStaffInvite.expires_at).toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(latestStaffInvite.invite_url);
                              toast.success("Invite link copied");
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-black text-white transition-all hover:bg-white/[0.08]"
                          >
                            <Copy className="h-4 w-4" />
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {staffMembers.map((staff) => (
                    <div key={staff.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
                        <UserRound className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">{getStaffLabel(staff)}</p>
                        <p className="truncate text-xs text-gray-500">{staff.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-white/[0.03]">
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black">Branch inventory</h2>
                      <p className="mt-1 text-sm text-gray-500">Quick branch stock visibility for pickup planning.</p>
                    </div>
                    <div className="relative w-full max-w-xs">
                      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      <input
                        value={stockSearch}
                        onChange={(event) => setStockSearch(event.target.value)}
                        placeholder="Search branch stock..."
                        className="w-full rounded-2xl border border-white/10 bg-[#101024] py-3 pl-11 pr-4 text-xs font-bold text-white outline-none placeholder:text-gray-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  {stockLoading ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-gray-500">
                      Loading stock...
                    </div>
                  ) : (
                    stock.slice(0, 10).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                        <img src={item.product.image} alt={item.product.name} className="h-12 w-12 rounded-xl object-cover bg-white/5" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-white">{item.product.name}</p>
                          <p className="text-[11px] text-gray-500">{item.product.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-white">{item.stock_count} in stock</p>
                          <button
                            type="button"
                            disabled={item.stock_count === 0}
                            onClick={() => markOutOfStock.mutate(item.product_id)}
                            className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-300 transition-all hover:bg-red-500 hover:text-white disabled:opacity-40"
                          >
                            Mark out
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default BranchDashboard;
