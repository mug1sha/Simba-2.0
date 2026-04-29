import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Clock3,
  PackageCheck,
  RefreshCcw,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { readErrorMessage } from "@/lib/api";
import { formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

type OrderItem = {
  id?: number | string;
  name?: string;
  quantity?: number;
  image?: string;
};

type OrderActionVariables = {
  orderId: number;
  endpoint: "accept" | "assign" | "start" | "ready" | "complete";
  body?: Record<string, unknown>;
  silent?: boolean;
};

type AlertItem = {
  id: string;
  tone: "danger" | "warn" | "info";
  title: string;
  detail: string;
};

type Presence = "busy" | "idle" | "offline";

const TERMINAL_STATUSES = new Set(["Completed", "Cancelled", "No-show"]);

const KANBAN_COLUMNS = [
  {
    id: "pending",
    title: "Pending Orders",
    description: "New customer orders waiting for manager review.",
    statuses: ["Pending"],
    accent: "#ff7b29",
  },
  {
    id: "assigning",
    title: "Accepted / Assigning",
    description: "Accepted orders that need a staff owner.",
    statuses: ["Accepted", "Assigned"],
    accent: "#ffb44d",
  },
  {
    id: "preparing",
    title: "In Preparation",
    description: "Orders currently being assembled by the branch team.",
    statuses: ["Preparing"],
    accent: "#facc15",
  },
  {
    id: "ready",
    title: "Ready for Pickup",
    description: "Orders staged and waiting for customer collection.",
    statuses: ["Ready for Pick-up"],
    accent: "#34d399",
  },
] as const;

const parseItems = (items: string): OrderItem[] => {
  try {
    const parsed = JSON.parse(items || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getStaffLabel = (staff: BranchStaffMember) => {
  const fullName = [staff.first_name, staff.last_name].filter(Boolean).join(" ").trim();
  return fullName || staff.email;
};

const minutesSince = (createdAt: string, now: number) => {
  const timestamp = new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.round((now - timestamp) / 60000));
};

const formatMinutesLabel = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const formatSincePlaced = (minutes: number) => {
  if (minutes < 1) return "just now";
  return `${formatMinutesLabel(minutes)} ago`;
};

const getUrgencyLevel = (minutes: number) => {
  if (minutes >= 45) return "critical";
  if (minutes >= 20) return "high";
  if (minutes >= 10) return "elevated";
  return "normal";
};

const getUrgencyClasses = (minutes: number) => {
  const level = getUrgencyLevel(minutes);
  if (level === "critical") {
    return {
      dot: "bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.9)]",
      pill: "border-rose-500/40 bg-rose-500/12 text-rose-200",
      card: "border-rose-500/35 shadow-[0_0_0_1px_rgba(244,63,94,0.18),0_24px_80px_rgba(127,29,29,0.25)] animate-pulse",
      label: "Critical",
    };
  }
  if (level === "high") {
    return {
      dot: "bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.75)]",
      pill: "border-amber-500/40 bg-amber-500/12 text-amber-100",
      card: "border-amber-400/30 shadow-[0_18px_50px_rgba(180,83,9,0.22)]",
      label: "High",
    };
  }
  if (level === "elevated") {
    return {
      dot: "bg-orange-300",
      pill: "border-orange-400/30 bg-orange-400/12 text-orange-100",
      card: "border-white/12",
      label: "Watch",
    };
  }
  return {
    dot: "bg-emerald-300",
    pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    card: "border-white/12",
    label: "On track",
  };
};

const getColumnForStatus = (status: string) => {
  return KANBAN_COLUMNS.find((column) => column.statuses.includes(status as never))?.id ?? "pending";
};

const BranchDashboard = () => {
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [draggingOrderId, setDraggingOrderId] = useState<number | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [hoveredStaffId, setHoveredStaffId] = useState<number | null>(null);
  const [staffSelectionByOrder, setStaffSelectionByOrder] = useState<Record<number, string>>({});
  const [quickAssignOrderId, setQuickAssignOrderId] = useState("");
  const [quickAssignStaffId, setQuickAssignStaffId] = useState("");
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const quickAssignRef = useRef<HTMLDivElement | null>(null);
  const seenOrderIdsRef = useRef<number[] | null>(null);

  const isManager = user?.role === "branch_manager";
  const branchName = user?.branch || "Simba Branch";
  const currentUserLabel = user ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email : "Operations";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: staffMembers = [] } = useQuery<BranchStaffMember[]>({
    queryKey: ["branch-staff", branchName],
    queryFn: async () => {
      const res = await fetch("/api/branch/staff", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load branch staff.");
      return res.json();
    },
    enabled: !!token && !!user,
    refetchInterval: 15000,
  });

  const { data: orders = [], isLoading: ordersLoading, isFetching: ordersRefreshing } = useQuery<BranchOrder[]>({
    queryKey: ["branch-orders", branchName, user?.role],
    queryFn: async () => {
      const res = await fetch("/api/branch/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load branch orders.");
      return res.json();
    },
    enabled: !!token && !!user,
    refetchInterval: 5000,
  });

  const orderAction = useMutation({
    mutationFn: async ({ orderId, endpoint, body }: OrderActionVariables) => {
      const res = await fetch(`/api/branch/orders/${orderId}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Order action failed."));
      return res.json();
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["branch-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["branch-staff"] }),
      ]);
      if (!variables.silent) {
        toast.success("Branch workflow updated.");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeOrders = useMemo(
    () => orders.filter((order) => !TERMINAL_STATUSES.has(order.status)),
    [orders],
  );

  const readyOrders = useMemo(
    () => activeOrders.filter((order) => order.status === "Ready for Pick-up"),
    [activeOrders],
  );

  const assignableOrders = useMemo(
    () => activeOrders.filter((order) => order.status === "Pending" || order.status === "Accepted"),
    [activeOrders],
  );

  const staffLoad = useMemo(() => {
    const load = new Map<number, number>();
    activeOrders.forEach((order) => {
      if (order.assigned_staff_user_id) {
        load.set(order.assigned_staff_user_id, (load.get(order.assigned_staff_user_id) || 0) + 1);
      }
    });
    return load;
  }, [activeOrders]);

  const staffSnapshots = useMemo(() => {
    const activityBucket = Math.floor(now / 60000);
    return staffMembers.map((staff) => {
      const assignedOrders = staffLoad.get(staff.id) || 0;
      let presence: Presence = assignedOrders > 0 ? "busy" : "idle";
      if (assignedOrders === 0 && (staff.id * 11 + activityBucket) % 7 === 0) {
        presence = "offline";
      }
      return {
        ...staff,
        assignedOrders,
        presence,
      };
    });
  }, [now, staffLoad, staffMembers]);

  const overview = useMemo(() => {
    const pendingCount = activeOrders.filter((order) => order.status === "Pending").length;
    const activeCount = activeOrders.filter((order) => order.status !== "Ready for Pick-up").length;
    const prepSamples = orders.filter((order) =>
      ["Assigned", "Preparing", "Ready for Pick-up", "Completed"].includes(order.status),
    );
    const averagePrepMinutes =
      prepSamples.length > 0
        ? Math.round(
            prepSamples.reduce((sum, order) => sum + minutesSince(order.created_at, now), 0) / prepSamples.length,
          )
        : 0;
    return [
      {
        label: isManager ? "Pending Orders" : "Assigned to You",
        value: pendingCount,
        detail: pendingCount >= 5 ? "High-pressure queue" : "Within target range",
        icon: Clock3,
        accent: pendingCount >= 5 || newOrderFlash ? "#fb7185" : "#ff6b00",
        highlight: pendingCount >= 5 || newOrderFlash,
      },
      {
        label: "Active Orders",
        value: activeCount,
        detail: `${activeOrders.length} total live in pipeline`,
        icon: Sparkles,
        accent: "#ff9b52",
      },
      {
        label: "Ready for Pickup",
        value: readyOrders.length,
        detail: readyOrders.length ? "Customers can be called now" : "No pickups waiting",
        icon: PackageCheck,
        accent: "#34d399",
      },
      {
        label: "Average Preparation Time",
        value: averagePrepMinutes ? formatMinutesLabel(averagePrepMinutes) : "--",
        detail: "Estimated from live queue age",
        icon: CheckCircle2,
        accent: "#facc15",
      },
    ];
  }, [activeOrders, isManager, newOrderFlash, now, orders, readyOrders.length]);

  const ordersByColumn = useMemo(() => {
    const sorted = [...activeOrders].sort(
      (left, right) => minutesSince(right.created_at, now) - minutesSince(left.created_at, now),
    );
    return KANBAN_COLUMNS.map((column) => ({
      ...column,
      orders: sorted.filter((order) => column.statuses.includes(order.status as never)),
    }));
  }, [activeOrders, now]);

  const alerts = useMemo<AlertItem[]>(() => {
    const pendingAged = activeOrders.filter(
      (order) => order.status === "Pending" && minutesSince(order.created_at, now) >= 15,
    );
    const readyAged = activeOrders.filter(
      (order) => order.status === "Ready for Pick-up" && minutesSince(order.created_at, now) >= 20,
    );
    const overloadedStaff = staffSnapshots.filter((staff) => staff.assignedOrders >= 3);

    const nextAlerts: AlertItem[] = [];

    if (pendingAged.length) {
      nextAlerts.push({
        id: "pending-aged",
        tone: "danger",
        title: "Orders waiting too long",
        detail: `${pendingAged.length} pending order${pendingAged.length > 1 ? "s" : ""} are past the 15-minute review target.`,
      });
    }

    if (overloadedStaff.length) {
      nextAlerts.push({
        id: "staff-overload",
        tone: "warn",
        title: "Overloaded staff detected",
        detail: `${overloadedStaff.map((staff) => getStaffLabel(staff)).join(", ")} ${overloadedStaff.length > 1 ? "are" : "is"} carrying 3+ active orders.`,
      });
    }

    if (readyAged.length) {
      nextAlerts.push({
        id: "ready-stale",
        tone: "info",
        title: "Ready but not picked",
        detail: `${readyAged.length} pickup order${readyAged.length > 1 ? "s" : ""} have been waiting 20+ minutes.`,
      });
    }

    if (!nextAlerts.length) {
      nextAlerts.push({
        id: "stable",
        tone: "info",
        title: "Operations stable",
        detail: "Queue health looks good. Keep pressure on accepted orders and customer handoff.",
      });
    }

    return nextAlerts;
  }, [activeOrders, now, staffSnapshots]);

  const analytics = useMemo(() => {
    const revenueTracked = orders.reduce((sum, order) => sum + order.total, 0);
    const completedOrders = orders.filter((order) => order.status === "Completed");
    const completedRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
    const completionRate = orders.length ? Math.round((completedOrders.length / orders.length) * 100) : 0;
    const dailyVolume = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      const dayOrders = orders.filter((order) => order.created_at.slice(0, 10) === key);
      return {
        key,
        label: day.toLocaleDateString(undefined, { weekday: "short" }),
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, order) => sum + order.total, 0),
      };
    });
    const peakDay = [...dailyVolume].sort((left, right) => right.orders - left.orders)[0];
    return {
      revenueTracked,
      completedRevenue,
      completionRate,
      dailyVolume,
      peakDay,
      delayedOrders: activeOrders.filter((order) => minutesSince(order.created_at, now) >= 20).length,
      busyStaff: staffSnapshots.filter((staff) => staff.presence === "busy").length,
    };
  }, [activeOrders, now, orders, staffSnapshots]);

  useEffect(() => {
    const currentIds = orders.map((order) => order.id);
    if (seenOrderIdsRef.current === null) {
      seenOrderIdsRef.current = currentIds;
      return;
    }

    const previousIds = new Set(seenOrderIdsRef.current);
    const newOrders = orders.filter((order) => !previousIds.has(order.id));
    if (newOrders.length) {
      setNewOrderFlash(true);
      toast.message(`${newOrders.length} new order${newOrders.length > 1 ? "s" : ""} entered the branch queue.`);
      try {
        const audioContext = new window.AudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 720;
        gain.gain.value = 0.03;
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.12);
      } catch {
        // Visual alert remains active if audio is blocked by the browser.
      }

      const flashTimer = window.setTimeout(() => setNewOrderFlash(false), 4000);
      seenOrderIdsRef.current = currentIds;
      return () => window.clearTimeout(flashTimer);
    }

    seenOrderIdsRef.current = currentIds;
  }, [orders]);

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["branch-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["branch-staff"] }),
    ]);
    toast.success("Live queue refreshed.");
  };

  const assignOrderToStaff = async (order: BranchOrder, staffUserId: number) => {
    if (!isManager) return;
    if (order.status === "Assigned" || order.status === "Preparing" || order.status === "Ready for Pick-up") {
      toast.info("Reassignment is only available before preparation starts.");
      return;
    }
    if (order.status === "Pending") {
      await orderAction.mutateAsync({ orderId: order.id, endpoint: "accept", silent: true });
    }
    await orderAction.mutateAsync({
      orderId: order.id,
      endpoint: "assign",
      body: { staff_user_id: staffUserId },
    });
  };

  const moveOrderToColumn = async (order: BranchOrder, columnId: string) => {
    if (columnId === getColumnForStatus(order.status)) return;

    if (isManager) {
      if (columnId === "assigning" && order.status === "Pending") {
        await orderAction.mutateAsync({ orderId: order.id, endpoint: "accept" });
        return;
      }
      if (columnId === "ready" && order.status === "Ready for Pick-up") {
        await orderAction.mutateAsync({ orderId: order.id, endpoint: "complete" });
        return;
      }
      toast.info("This move needs staff action or a supported manager transition.");
      return;
    }

    if (columnId === "preparing" && order.status === "Assigned") {
      await orderAction.mutateAsync({ orderId: order.id, endpoint: "start" });
      return;
    }
    if (columnId === "ready" && order.status === "Preparing") {
      await orderAction.mutateAsync({ orderId: order.id, endpoint: "ready" });
      return;
    }
    toast.info("This lane change is not available for your role.");
  };

  const actionableAlerts = alerts.filter((alert) => alert.id !== "stable");
  const pendingAttentionCount = actionableAlerts.length;

  return (
    <div
      className="min-h-screen bg-[#0f172a] text-white"
      style={{ fontFamily: "Poppins, DM Sans, sans-serif" }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-8%] h-72 w-72 rounded-full bg-[#ff6b00]/20 blur-3xl" />
        <div className="absolute right-[-8%] top-[10%] h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[28%] h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-[1700px] px-4 pb-28 pt-6 sm:px-6 xl:px-8">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] border border-white/10 bg-white/8 p-6 shadow-[0_30px_120px_rgba(2,6,23,0.45)] backdrop-blur-2xl"
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Simba Supermarket Rwanda</span>
                <span className="rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 px-3 py-1 text-[#ffb57d]">
                  {branchName}
                </span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                  Live refresh every 5s
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                  {isManager ? "Branch Manager Control Center" : "Branch Fulfillment Control Center"}
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
                  High-speed branch operations for pickup orders. Scan queue pressure, assign staff fast, and move every order from pending to customer handoff without losing tempo.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[540px]">
              <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Signed in as</p>
                <p className="mt-3 text-base font-semibold text-white">{currentUserLabel}</p>
                <p className="mt-1 text-sm text-[#ffb57d]">{isManager ? "Branch Manager" : "Branch Staff"}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Queue Pressure</p>
                <p className="mt-3 text-3xl font-black text-white">{activeOrders.length}</p>
                <p className="mt-1 text-sm text-slate-300">Orders currently under branch control</p>
              </div>
              <div
                className={cn(
                  "rounded-[24px] border p-4 transition-all",
                  pendingAttentionCount
                    ? "border-rose-400/30 bg-rose-500/10 shadow-[0_0_0_1px_rgba(251,113,133,0.12)]"
                    : "border-white/10 bg-slate-950/45",
                )}
              >
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Smart Alerts</p>
                <p className="mt-3 text-3xl font-black text-white">{actionableAlerts.length}</p>
                <p className="mt-1 text-sm text-slate-300">
                  {pendingAttentionCount ? "Action recommended now" : "No urgent disruption detected"}
                </p>
              </div>
            </div>
          </div>
        </motion.header>

        <section className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {overview.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "relative overflow-hidden rounded-[28px] border border-white/10 bg-white/8 p-6 backdrop-blur-2xl",
                  card.highlight && "shadow-[0_0_0_1px_rgba(255,107,0,0.18),0_30px_110px_rgba(249,115,22,0.22)]",
                )}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: `linear-gradient(90deg, ${card.accent}, transparent)` }}
                />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{card.label}</p>
                    <div className="mt-4 flex items-end gap-3">
                      <p className="text-4xl font-black tracking-[-0.05em] text-white">{card.value}</p>
                      {card.highlight && (
                        <span className="rounded-full border border-rose-400/30 bg-rose-500/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-200">
                          Escalated
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{card.detail}</p>
                  </div>
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10"
                    style={{ backgroundColor: `${card.accent}1A`, color: card.accent }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <div className="rounded-[30px] border border-white/10 bg-white/8 p-5 backdrop-blur-2xl">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#ffb57d]">Kanban Pipeline</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Order Flow Command Board</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Drag orders across supported stages, or drop them on staff cards for fast assignment.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1.5">
                    {draggingOrderId ? `Dragging order #${draggingOrderId}` : "Drag enabled for active orders"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1.5">
                    {ordersRefreshing ? "Syncing live queue..." : "Queue synced"}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 2xl:grid-cols-4">
                {ordersByColumn.map((column, columnIndex) => (
                  <motion.section
                    key={column.id}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: columnIndex * 0.06 }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setHoveredColumn(column.id);
                    }}
                    onDragLeave={() => setHoveredColumn((value) => (value === column.id ? null : value))}
                    onDrop={async (event) => {
                      event.preventDefault();
                      setHoveredColumn(null);
                      const orderId = Number(event.dataTransfer.getData("text/plain") || draggingOrderId);
                      const order = activeOrders.find((item) => item.id === orderId);
                      if (!order) return;
                      await moveOrderToColumn(order, column.id);
                      setDraggingOrderId(null);
                    }}
                    className={cn(
                      "flex min-h-[620px] flex-col rounded-[26px] border border-white/10 bg-slate-950/45 p-4 transition-all",
                      hoveredColumn === column.id && "border-[#ff6b00]/45 bg-[#ff6b00]/10",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.accent }} />
                          <h3 className="text-base font-bold text-white">{column.title}</h3>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">{column.description}</p>
                      </div>
                      <div
                        className="rounded-2xl border border-white/10 px-3 py-2 text-center"
                        style={{ backgroundColor: `${column.accent}12` }}
                      >
                        <p className="text-2xl font-black text-white">{column.orders.length}</p>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Orders</p>
                      </div>
                    </div>

                    <div className="mt-4 flex-1 space-y-3">
                      <AnimatePresence initial={false}>
                        {column.orders.map((order) => {
                          const items = parseItems(order.items);
                          const ageMinutes = minutesSince(order.created_at, now);
                          const urgency = getUrgencyClasses(ageMinutes);
                          const selectionValue = staffSelectionByOrder[order.id] || "";
                          return (
                            <motion.article
                              key={order.id}
                              layout
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              draggable={!TERMINAL_STATUSES.has(order.status)}
                              onDragStart={(event) => {
                                setDraggingOrderId(order.id);
                                event.dataTransfer.setData("text/plain", String(order.id));
                              }}
                              onDragEnd={() => {
                                setDraggingOrderId(null);
                                setHoveredColumn(null);
                                setHoveredStaffId(null);
                              }}
                              className={cn(
                                "rounded-[24px] border bg-white/8 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.32)] backdrop-blur-xl transition-all hover:-translate-y-0.5",
                                urgency.card,
                                draggingOrderId === order.id && "rotate-[0.5deg] opacity-85",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-lg font-bold text-white">
                                    {order.customer_name || "Customer"}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-400">Order #{order.id}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", urgency.pill)}>
                                    {urgency.label}
                                  </span>
                                  <span className="text-sm font-semibold text-white">{formatPrice(order.total)}</span>
                                </div>
                              </div>

                              <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                                <span className={cn("h-2.5 w-2.5 rounded-full", urgency.dot)} />
                                <span>{formatSincePlaced(ageMinutes)}</span>
                                <span className="text-slate-500">•</span>
                                <span>{items.length} item{items.length === 1 ? "" : "s"}</span>
                              </div>

                              <div className="mt-4 space-y-2 rounded-[20px] border border-white/10 bg-slate-950/40 p-3">
                                {items.slice(0, 3).map((item, itemIndex) => (
                                  <div key={`${order.id}-${item.id ?? itemIndex}`} className="flex items-center justify-between gap-3 text-sm text-slate-300">
                                    <span className="truncate">{item.name || "Product item"}</span>
                                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-white/80">
                                      x{item.quantity || 1}
                                    </span>
                                  </div>
                                ))}
                                {items.length > 3 && (
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    +{items.length - 3} more items
                                  </p>
                                )}
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-slate-200">
                                  {order.assigned_staff ? `Assigned: ${order.assigned_staff}` : "Unassigned"}
                                </span>
                                {order.pickup_time && (
                                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-slate-300">
                                    Pickup {order.pickup_time}
                                  </span>
                                )}
                              </div>

                              <div className="mt-4 space-y-3">
                                {isManager && order.status === "Pending" && (
                                  <button
                                    type="button"
                                    onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "accept" })}
                                    className="w-full rounded-2xl bg-[#ff6b00] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#ff7d1f]"
                                  >
                                    Accept Order
                                  </button>
                                )}

                                {isManager && (order.status === "Pending" || order.status === "Accepted") && (
                                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                    <select
                                      value={selectionValue}
                                      onChange={(event) =>
                                        setStaffSelectionByOrder((current) => ({
                                          ...current,
                                          [order.id]: event.target.value,
                                        }))
                                      }
                                      className="h-11 rounded-2xl border border-white/10 bg-slate-950/65 px-3 text-sm text-white outline-none"
                                    >
                                      <option value="">Assign staff</option>
                                      {staffMembers.map((staff) => (
                                        <option key={staff.id} value={String(staff.id)} className="bg-slate-950">
                                          {getStaffLabel(staff)}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      disabled={!selectionValue}
                                      onClick={async () => {
                                        await assignOrderToStaff(order, Number(selectionValue));
                                        setStaffSelectionByOrder((current) => ({ ...current, [order.id]: "" }));
                                      }}
                                      className="rounded-2xl border border-[#ff6b00]/30 bg-[#ff6b00]/12 px-4 py-3 text-sm font-bold text-[#ffb57d] transition-all hover:bg-[#ff6b00] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Assign Staff
                                    </button>
                                  </div>
                                )}

                                {!isManager && order.status === "Assigned" && (
                                  <button
                                    type="button"
                                    onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "start" })}
                                    className="w-full rounded-2xl border border-amber-400/30 bg-amber-400/12 px-4 py-3 text-sm font-bold text-amber-100 transition-all hover:bg-amber-400 hover:text-slate-950"
                                  >
                                    Start Preparing
                                  </button>
                                )}

                                {!isManager && order.status === "Preparing" && (
                                  <button
                                    type="button"
                                    onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "ready" })}
                                    className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/12 px-4 py-3 text-sm font-bold text-emerald-100 transition-all hover:bg-emerald-400 hover:text-slate-950"
                                  >
                                    Mark as Ready
                                  </button>
                                )}

                                {isManager && order.status === "Ready for Pick-up" && (
                                  <button
                                    type="button"
                                    onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "complete" })}
                                    className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/12 px-4 py-3 text-sm font-bold text-emerald-100 transition-all hover:bg-emerald-400 hover:text-slate-950"
                                  >
                                    Confirm Pickup
                                  </button>
                                )}

                                {isManager && order.status === "Preparing" && (
                                  <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm text-slate-300">
                                    Staff is preparing this order. It will move to pickup once the branch team marks it ready.
                                  </div>
                                )}
                              </div>
                            </motion.article>
                          );
                        })}
                      </AnimatePresence>

                      {!column.orders.length && (
                        <div className="flex h-full min-h-[180px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-500">
                          Drop an eligible order here or wait for live queue updates.
                        </div>
                      )}
                    </div>
                  </motion.section>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:h-fit">
            <section className="rounded-[30px] border border-white/10 bg-white/8 p-5 backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#ffb57d]">Staff Management</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Branch Team Load</h2>
                </div>
                <Users className="h-6 w-6 text-[#ffb57d]" />
              </div>

              <div className="mt-4 space-y-3">
                {staffSnapshots.map((staff) => {
                  const statusClasses =
                    staff.presence === "busy"
                      ? "border-amber-400/30 bg-amber-400/12 text-amber-100"
                      : staff.presence === "offline"
                        ? "border-slate-600/40 bg-slate-700/25 text-slate-300"
                        : "border-emerald-400/30 bg-emerald-400/12 text-emerald-100";

                  return (
                    <div
                      key={staff.id}
                      onDragOver={(event) => {
                        if (!isManager) return;
                        event.preventDefault();
                        setHoveredStaffId(staff.id);
                      }}
                      onDragLeave={() => setHoveredStaffId((value) => (value === staff.id ? null : value))}
                      onDrop={async (event) => {
                        if (!isManager) return;
                        event.preventDefault();
                        setHoveredStaffId(null);
                        const orderId = Number(event.dataTransfer.getData("text/plain") || draggingOrderId);
                        const order = activeOrders.find((item) => item.id === orderId);
                        if (!order) return;
                        await assignOrderToStaff(order, staff.id);
                        setDraggingOrderId(null);
                      }}
                      className={cn(
                        "rounded-[24px] border border-white/10 bg-slate-950/45 p-4 transition-all",
                        hoveredStaffId === staff.id && "border-[#ff6b00]/45 bg-[#ff6b00]/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6">
                            <UserRound className="h-5 w-5 text-slate-200" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{getStaffLabel(staff)}</p>
                            <p className="mt-1 text-xs text-slate-400">{staff.email}</p>
                          </div>
                        </div>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", statusClasses)}>
                          {staff.presence}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Assigned</p>
                          <p className="mt-2 text-2xl font-black text-white">{staff.assignedOrders}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Capacity</p>
                          <p className="mt-2 text-sm font-semibold text-slate-200">
                            {staff.assignedOrders >= 3 ? "Overloaded" : staff.assignedOrders > 0 ? "Active" : "Open"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!staffSnapshots.length && (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-500">
                    No staff accounts are attached to this branch yet.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/8 p-5 backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#ffb57d]">Smart Alerts</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Queue Signals</h2>
                </div>
                <BellRing className="h-6 w-6 text-[#ffb57d]" />
              </div>

              <div className="mt-4 space-y-3">
                {alerts.map((alert) => {
                  const toneClasses =
                    alert.tone === "danger"
                      ? "border-rose-500/30 bg-rose-500/10"
                      : alert.tone === "warn"
                        ? "border-amber-400/30 bg-amber-400/10"
                        : "border-cyan-400/20 bg-cyan-400/10";
                  return (
                    <div key={alert.id} className={cn("rounded-[24px] border p-4", toneClasses)}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 text-white" />
                        <div>
                          <p className="text-sm font-semibold text-white">{alert.title}</p>
                          <p className="mt-1 text-sm text-slate-200">{alert.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              ref={quickAssignRef}
              className="rounded-[30px] border border-white/10 bg-white/8 p-5 backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#ffb57d]">
                    {isManager ? "Quick Assign" : "Team Notes"}
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">
                    {isManager ? "Fast Dispatch" : "Execution Focus"}
                  </h2>
                </div>
                <ArrowUpRight className="h-6 w-6 text-[#ffb57d]" />
              </div>

              {isManager ? (
                <div className="mt-4 space-y-3">
                  <select
                    value={quickAssignOrderId}
                    onChange={(event) => setQuickAssignOrderId(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/65 px-3 text-sm text-white outline-none"
                  >
                    <option value="">Choose order</option>
                    {assignableOrders.map((order) => (
                      <option key={order.id} value={String(order.id)} className="bg-slate-950">
                        #{order.id} • {order.customer_name || "Customer"} • {order.status}
                      </option>
                    ))}
                  </select>
                  <select
                    value={quickAssignStaffId}
                    onChange={(event) => setQuickAssignStaffId(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/65 px-3 text-sm text-white outline-none"
                  >
                    <option value="">Choose staff</option>
                    {staffMembers.map((staff) => (
                      <option key={staff.id} value={String(staff.id)} className="bg-slate-950">
                        {getStaffLabel(staff)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!quickAssignOrderId || !quickAssignStaffId}
                    onClick={async () => {
                      const order = activeOrders.find((item) => item.id === Number(quickAssignOrderId));
                      if (!order) return;
                      await assignOrderToStaff(order, Number(quickAssignStaffId));
                      setQuickAssignOrderId("");
                      setQuickAssignStaffId("");
                    }}
                    className="w-full rounded-2xl bg-[#ff6b00] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#ff7d1f] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Assign Now
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                    Pull assigned orders into preparation immediately, keep pickup bags staged by customer name, and use the ready action the moment handoff is possible.
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                    If you see a customer waiting on-site, prioritize the oldest ready order first and notify the manager after pickup completion.
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>

      <div className="fixed bottom-5 right-5 z-30">
        <div className="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-slate-950/80 p-3 shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur-2xl">
          {isManager && (
            <button
              type="button"
              onClick={() => quickAssignRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="flex items-center gap-3 rounded-2xl bg-white/6 px-4 py-3 text-left text-sm font-semibold text-white transition-all hover:bg-white/10"
            >
              <Users className="h-4 w-4 text-[#ffb57d]" />
              <span>Assign staff quickly</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-3 rounded-2xl bg-white/6 px-4 py-3 text-left text-sm font-semibold text-white transition-all hover:bg-white/10"
          >
            <RefreshCcw className={cn("h-4 w-4 text-[#ffb57d]", ordersRefreshing && "animate-spin")} />
            <span>Refresh orders</span>
          </button>
          <button
            type="button"
            onClick={() => toast.success("Staff notification dispatched to the branch channel.")}
            className="flex items-center gap-3 rounded-2xl bg-white/6 px-4 py-3 text-left text-sm font-semibold text-white transition-all hover:bg-white/10"
          >
            <BellRing className="h-4 w-4 text-[#ffb57d]" />
            <span>Notify staff</span>
          </button>
          <button
            type="button"
            onClick={() => setAnalyticsOpen(true)}
            className="flex items-center gap-3 rounded-2xl bg-[#ff6b00] px-4 py-3 text-left text-sm font-semibold text-white transition-all hover:bg-[#ff7d1f]"
          >
            <Sparkles className="h-4 w-4" />
            <span>View analytics</span>
          </button>
        </div>
      </div>

      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <DialogContent className="max-w-4xl border-white/10 bg-[#111827] p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
          <DialogHeader className="border-b border-white/10 px-6 py-5">
            <DialogTitle className="text-2xl font-black tracking-[-0.03em] text-white">Branch analytics snapshot</DialogTitle>
            <DialogDescription className="text-slate-400">
              Live operational readout for the current branch queue and pickup throughput.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Revenue Tracked</p>
                  <p className="mt-3 text-2xl font-black text-white">{formatPrice(analytics.revenueTracked)}</p>
                  <p className="mt-1 text-sm text-slate-400">All branch orders in current dataset</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Completed Revenue</p>
                  <p className="mt-3 text-2xl font-black text-white">{formatPrice(analytics.completedRevenue)}</p>
                  <p className="mt-1 text-sm text-slate-400">Confirmed customer pickups</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Completion Rate</p>
                  <p className="mt-3 text-2xl font-black text-white">{analytics.completionRate}%</p>
                  <p className="mt-1 text-sm text-slate-400">Orders fully handed off to customers</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Delayed Orders</p>
                  <p className="mt-3 text-2xl font-black text-white">{analytics.delayedOrders}</p>
                  <p className="mt-1 text-sm text-slate-400">Orders older than 20 minutes in live queue</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Peak Day</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black text-white">{analytics.peakDay?.label || "--"}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {analytics.peakDay?.orders || 0} orders · {formatPrice(analytics.peakDay?.revenue || 0)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-right">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Busy Staff</p>
                    <p className="mt-1 text-xl font-black text-white">{analytics.busyStaff}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#ffb57d]">7-Day Trend</p>
                  <h3 className="mt-2 text-xl font-black text-white">Daily order volume</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
                  Live rolling window
                </span>
              </div>

              <div className="mt-6 grid h-[260px] grid-cols-7 items-end gap-3">
                {analytics.dailyVolume.map((day) => {
                  const maxOrders = Math.max(...analytics.dailyVolume.map((entry) => entry.orders), 1);
                  const height = Math.max(12, Math.round((day.orders / maxOrders) * 100));
                  return (
                    <div key={day.key} className="flex h-full flex-col items-center justify-end gap-3">
                      <div className="text-xs font-semibold text-slate-400">{day.orders}</div>
                      <div className="flex h-full w-full items-end">
                        <div
                          className="w-full rounded-t-[18px] bg-gradient-to-t from-[#ff6b00] to-[#ffb44d] shadow-[0_18px_50px_rgba(249,115,22,0.25)]"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{day.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {ordersLoading && (
        <div className="fixed inset-x-0 top-0 z-40 h-1 bg-transparent">
          <div className="h-full w-1/3 animate-[pulse_1.1s_ease-in-out_infinite] bg-[#ff6b00]" />
        </div>
      )}
    </div>
  );
};

export default BranchDashboard;
