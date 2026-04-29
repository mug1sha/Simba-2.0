import { type CSSProperties, type ReactNode, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LayoutGrid,
  type LucideIcon,
  PackageCheck,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildApiUrl, readErrorMessage, readJsonResponse } from "@/lib/api";
import { formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

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
  updated_at?: string | null;
};

type BranchStaffMember = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
  branch?: string | null;
};

type BranchStockItem = {
  id: number;
  product_id: number;
  stock_count: number;
  product: {
    id: number;
    name: string;
    price: number;
    category: string;
    image: string;
    unit: string;
  };
};

type RoleInviteLink = {
  email?: string | null;
  role: "branch_manager" | "branch_staff";
  branch?: string | null;
  expires_at: string;
  invite_url: string;
};

type OrderActionVariables = {
  orderId: number;
  endpoint: "accept" | "assign" | "start" | "ready" | "complete" | "no-show";
  body?: Record<string, unknown>;
};

type OrderItem = {
  id?: number | string;
  name?: string;
  quantity?: number;
};

type SidebarItem = {
  id: WorkspaceSection;
  label: string;
  icon: LucideIcon;
};

type WorkspaceSection = "overview" | "analytics" | "orders" | "staff" | "inventory" | "invites";

const TERMINAL_STATUSES = new Set(["Completed", "Cancelled", "No-show"]);
const ORDER_FILTERS = ["all", "Pending", "Accepted", "Assigned", "Preparing", "Ready for Pick-up", "Completed"] as const;

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

const minutesSince = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
};

const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const statusTone = (status: string) => {
  switch (status) {
    case "Pending":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200";
    case "Accepted":
    case "Assigned":
      return "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-200";
    case "Preparing":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-200";
    case "Ready for Pick-up":
    case "Completed":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
    case "Cancelled":
    case "No-show":
      return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
};

const SectionShell = ({
  id,
  title,
  description,
  actions,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section id={id} className="rounded-[28px] border border-border bg-card shadow-sm">
    <div className="flex flex-col gap-4 border-b border-border px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-lg font-black tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const StatCard = ({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
}) => (
  <div className="rounded-[24px] border border-border bg-background p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      </div>
      <div className="rounded-2xl border border-primary/15 bg-primary/10 p-3 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const SidebarContent = ({
  items,
  branchName,
  currentUserLabel,
  isManager,
  activeSection,
  onSelect,
  onNavigate,
  onClose,
}: {
  items: SidebarItem[];
  branchName: string;
  currentUserLabel: string;
  isManager: boolean;
  activeSection: WorkspaceSection;
  onSelect: (section: WorkspaceSection) => void;
  onNavigate?: () => void;
  onClose: () => void;
}) => (
  <div className="flex h-full flex-col">
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary p-2.5 text-primary-foreground shadow-sm">
          <Store className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black tracking-tight text-foreground">Simba Ops</p>
          <p className="truncate text-xs font-medium text-muted-foreground">{branchName}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-2xl border border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Close sidebar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>

    <div className="flex-1 overflow-y-auto px-4 py-5">
      <p className="px-3 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Workspace</p>
      <nav className="mt-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item.id);
                onNavigate?.();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition-all",
                activeSection === item.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", activeSection === item.id ? "text-primary-foreground" : "text-primary")} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>

    <div className="border-t border-border bg-card px-4 py-4">
      <div className="rounded-[24px] border border-border bg-background p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Signed in</p>
        <p className="mt-3 truncate text-sm font-semibold text-foreground">{currentUserLabel}</p>
        <p className="mt-1 text-sm text-primary">{isManager ? "Branch Manager" : "Branch Staff"}</p>
      </div>
    </div>
  </div>
);

const BranchDashboard = () => {
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const { t } = useLanguage();

  const isManager = user?.role === "branch_manager";
  const branchName = user?.branch || "Simba Branch";
  const currentUserLabel = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email
    : t("branch_dashboard.operations_user");

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("overview");
  const [orderFilter, setOrderFilter] = useState<(typeof ORDER_FILTERS)[number]>("all");
  const [orderSearch, setOrderSearch] = useState("");
  const deferredOrderSearch = useDeferredValue(orderSearch.trim().toLowerCase());
  const [staffSelectionByOrder, setStaffSelectionByOrder] = useState<Record<number, string>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [latestInvite, setLatestInvite] = useState<RoleInviteLink | null>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const deferredInventorySearch = useDeferredValue(inventorySearch.trim());

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const baseItems: SidebarItem[] = [
      { id: "overview", label: "Overview", icon: LayoutGrid },
      { id: "analytics", label: "Analytics", icon: ClipboardList },
      { id: "orders", label: "Orders", icon: PackageCheck },
      { id: "staff", label: "Staff", icon: Users },
    ];
    if (isManager) {
      baseItems.push({ id: "inventory", label: "Inventory", icon: Warehouse });
      baseItems.push({ id: "invites", label: "Invites", icon: ShieldCheck });
    }
    return baseItems;
  }, [isManager]);

  const activeSidebarItem = sidebarItems.find((item) => item.id === activeSection) ?? sidebarItems[0];

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = Math.min(380, Math.max(220, event.clientX));
      setSidebarWidth(nextWidth);
    };

    const stopResize = () => setIsResizingSidebar(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
  }, [isResizingSidebar]);

  const ordersQuery = useQuery<BranchOrder[]>({
    queryKey: ["branch-orders", branchName, user?.role],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/branch/orders"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("branch_dashboard.error.orders_load")));
      }
      return readJsonResponse<BranchOrder[]>(res, "Branch orders response was empty.");
    },
    enabled: !!token && !!user,
    refetchInterval: 5000,
  });

  const staffQuery = useQuery<BranchStaffMember[]>({
    queryKey: ["branch-staff", branchName],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/branch/staff"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("branch_dashboard.error.staff_load")));
      }
      return readJsonResponse<BranchStaffMember[]>(res, "Branch staff response was empty.");
    },
    enabled: !!token && !!user,
    refetchInterval: 15000,
  });

  const stockQuery = useQuery<BranchStockItem[]>({
    queryKey: ["branch-stock", branchName, deferredInventorySearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (deferredInventorySearch) params.set("search", deferredInventorySearch);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(buildApiUrl(`/api/branch/stock${suffix}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("branch_dashboard.error.stock_load")));
      }
      return readJsonResponse<BranchStockItem[]>(res, "Branch stock response was empty.");
    },
    enabled: !!token && !!isManager,
    refetchInterval: 30000,
  });

  const orderAction = useMutation({
    mutationFn: async ({ orderId, endpoint, body }: OrderActionVariables) => {
      const res = await fetch(buildApiUrl(`/api/branch/orders/${orderId}/${endpoint}`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("branch_dashboard.error.action_failed")));
      }
      return res.text();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["branch-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["branch-staff"] }),
      ]);
      toast.success(t("branch_dashboard.toast.order_updated"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/branch/staff/invites"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail.trim() || undefined }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("branch_dashboard.error.invite_create")));
      }
      return readJsonResponse<RoleInviteLink>(res, "Staff invite response was empty.");
    },
    onSuccess: (invite) => {
      setLatestInvite(invite);
      setInviteEmail("");
      toast.success(t("branch_dashboard.toast.invite_created"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stockMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await fetch(buildApiUrl(`/api/branch/stock/${productId}/out-of-stock`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("branch_dashboard.error.stock_update")));
      }
      return readJsonResponse<BranchStockItem>(res, "Stock update response was empty.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      toast.success(t("branch_dashboard.toast.stock_updated"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orders = ordersQuery.data ?? [];
  const staffMembers = staffQuery.data ?? [];
  const stock = stockQuery.data ?? [];

  const activeOrders = useMemo(() => orders.filter((order) => !TERMINAL_STATUSES.has(order.status)), [orders]);
  const pendingOrders = activeOrders.filter((order) => order.status === "Pending").length;
  const acceptedOrders = activeOrders.filter((order) => order.status === "Accepted" || order.status === "Assigned").length;
  const preparingOrders = activeOrders.filter((order) => order.status === "Preparing").length;
  const readyOrders = activeOrders.filter((order) => order.status === "Ready for Pick-up").length;
  const completedOrders = orders.filter((order) => order.status === "Completed").length;
  const trackedRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const completedRevenue = orders
    .filter((order) => order.status === "Completed")
    .reduce((sum, order) => sum + order.total, 0);
  const averageQueueAge = activeOrders.length
    ? Math.round(activeOrders.reduce((sum, order) => sum + minutesSince(order.created_at), 0) / activeOrders.length)
    : 0;

  const sortedOrders = useMemo(
    () => [...orders].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter((order) => {
      if (orderFilter !== "all" && order.status !== orderFilter) return false;
      if (!deferredOrderSearch) return true;
      const items = parseItems(order.items);
      return [
        String(order.id),
        order.customer_name || "",
        order.customer_phone || "",
        order.assigned_staff || "",
        order.status,
        ...items.map((item) => item.name || ""),
      ]
        .join(" ")
        .toLowerCase()
        .includes(deferredOrderSearch);
    });
  }, [deferredOrderSearch, orderFilter, sortedOrders]);

  const staffLoad = useMemo(() => {
    const load = new Map<number, number>();
    activeOrders.forEach((order) => {
      if (order.assigned_staff_user_id) {
        load.set(order.assigned_staff_user_id, (load.get(order.assigned_staff_user_id) || 0) + 1);
      }
    });
    return load;
  }, [activeOrders]);

  const staffRows = useMemo(
    () =>
      staffMembers.map((staff) => ({
        ...staff,
        assignedOrders: staffLoad.get(staff.id) || 0,
      })),
    [staffLoad, staffMembers],
  );

  const alerts = [
    pendingOrders >= 4
      ? {
          title: "Pending review pressure",
          detail: `${pendingOrders} orders are still waiting for manager review.`,
        }
      : null,
    readyOrders >= 3
      ? {
          title: "Ready orders waiting",
          detail: `${readyOrders} orders are ready for customer handoff.`,
        }
      : null,
    averageQueueAge >= 25
      ? {
          title: "Queue age rising",
          detail: `Average live queue age is ${formatMinutes(averageQueueAge)}.`,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string }>;

  const statusRows = [
    { label: t("branch_dashboard.status.Pending"), value: pendingOrders, color: "bg-amber-500" },
    { label: t("branch_dashboard.status.Accepted"), value: acceptedOrders, color: "bg-orange-500" },
    { label: t("branch_dashboard.status.Preparing"), value: preparingOrders, color: "bg-sky-500" },
    { label: t("branch_dashboard.status.Ready for Pick-up"), value: readyOrders, color: "bg-emerald-500" },
    { label: t("branch_dashboard.status.Completed"), value: completedOrders, color: "bg-primary" },
  ];
  const maxStatusCount = Math.max(...statusRows.map((item) => item.value), 1);

  const dailyVolume = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      const dayOrders = orders.filter((order) => order.created_at.slice(0, 10) === key);
      return {
        key,
        label: day.toLocaleDateString(undefined, { weekday: "short" }),
        orders: dayOrders.length,
      };
    });
  }, [orders]);
  const maxDailyOrders = Math.max(...dailyVolume.map((day) => day.orders), 1);

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["branch-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["branch-staff"] }),
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] }),
    ]);
    toast.success("Dashboard refreshed");
  };

  const assignToStaff = async (order: BranchOrder) => {
    const selectedStaff = Number(staffSelectionByOrder[order.id]);
    if (!selectedStaff) return;
    if (order.status === "Pending") {
      await orderAction.mutateAsync({ orderId: order.id, endpoint: "accept" });
    }
    await orderAction.mutateAsync({
      orderId: order.id,
      endpoint: "assign",
      body: { staff_user_id: selectedStaff },
    });
    setStaffSelectionByOrder((current) => ({ ...current, [order.id]: "" }));
  };

  const copyInviteLink = async () => {
    if (!latestInvite?.invite_url) return;
    await navigator.clipboard.writeText(latestInvite.invite_url);
    toast.success(t("branch_dashboard.toast.invite_copied"));
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-foreground dark:bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-orange-500/8 blur-3xl" />
      </div>

      <div
        className="relative flex min-h-screen"
        style={{ "--sidebar-width": sidebarVisible ? `${sidebarWidth}px` : "0px" } as CSSProperties}
      >
        {sidebarVisible ? (
          <aside
            className="fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-card shadow-sm lg:block"
            style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
          >
            <div className="relative h-full">
              <SidebarContent
                items={sidebarItems}
                branchName={branchName}
                currentUserLabel={currentUserLabel}
                isManager={isManager}
                activeSection={activeSection}
                onSelect={setActiveSection}
                onClose={() => setSidebarVisible(false)}
              />
              <div
                role="separator"
                aria-orientation="vertical"
                onPointerDown={(event) => {
                  event.preventDefault();
                  setIsResizingSidebar(true);
                }}
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30"
              />
            </div>
          </aside>
        ) : null}

        <AnimatePresence>
          {mobileSidebarOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex lg:hidden"
            >
              <button
                type="button"
                aria-label="Close sidebar"
                className="flex-1 bg-black/45"
                onClick={() => setMobileSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-[290px] border-r border-border bg-card shadow-2xl sm:w-80"
              >
                <div className="flex items-center justify-end px-4 py-4">
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="rounded-2xl border border-border p-2 text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <SidebarContent
                  items={sidebarItems}
                  branchName={branchName}
                  currentUserLabel={currentUserLabel}
                  isManager={isManager}
                  activeSection={activeSection}
                  onSelect={setActiveSection}
                  onNavigate={() => setMobileSidebarOpen(false)}
                  onClose={() => setMobileSidebarOpen(false)}
                />
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <main className="min-w-0 flex-1 lg:pl-[var(--sidebar-width)] lg:transition-[padding-left]">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSidebarVisible(true);
                  setMobileSidebarOpen(true);
                }}
                className="inline-flex max-w-[220px] items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-left text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <UserRound className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{currentUserLabel}</span>
              </button>
              <div className="min-w-0 text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">{t("branch_dashboard.kicker")}</p>
                <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                  <p className="text-lg font-black text-foreground">{branchName}</p>
                  <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {activeSidebarItem?.label || "Overview"}
                  </span>
                </div>
              </div>
            </div>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-xl rounded-[18px] border border-border bg-card px-4 py-3 shadow-sm sm:px-5 sm:py-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">{t("branch_dashboard.kicker")}</p>
                  <h1 className="mt-2 text-xl font-black tracking-tight text-foreground sm:text-2xl">
                    {isManager ? t("branch_dashboard.manager_title") : t("branch_dashboard.staff_title")}
                  </h1>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    {isManager
                      ? "A branch control workspace arranged around fast review, assignment, execution, and pickup completion."
                      : "A focused staff workspace for preparation and ready-for-pickup execution."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:w-full lg:max-w-xs">
                  <div className="rounded-[18px] border border-border bg-background p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{t("branch_dashboard.signed_in_as")}</p>
                    <p className="mt-2 truncate text-sm font-semibold text-foreground">{currentUserLabel}</p>
                    <p className="mt-1 truncate text-sm text-primary">{branchName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="inline-flex items-center justify-center gap-3 rounded-[18px] border border-primary/20 bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-95"
                  >
                    <RefreshCcw className={cn("h-4 w-4", ordersQuery.isFetching && "animate-spin")} />
                    Refresh workspace
                  </button>
                </div>
              </div>
            </motion.section>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="mt-6"
              >
                {activeSection === "overview" && (
                  <div className="space-y-6">
                    <motion.section
                      initial="hidden"
                      animate="show"
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                      className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4"
                    >
                      {[
                        {
                          label: isManager ? t("branch_dashboard.summary.pending_review") : t("branch_dashboard.summary.assigned_to_you"),
                          value: isManager ? pendingOrders : activeOrders.filter((order) => order.assigned_staff_user_id === user?.id).length,
                          detail: isManager ? "Orders waiting for manager action" : "Orders currently under your execution",
                          icon: Clock3,
                        },
                        {
                          label: t("branch_dashboard.summary.preparing"),
                          value: preparingOrders,
                          detail: "Orders currently being assembled",
                          icon: ClipboardList,
                        },
                        {
                          label: t("branch_dashboard.summary.ready"),
                          value: readyOrders,
                          detail: "Orders ready for customer handoff",
                          icon: PackageCheck,
                        },
                        {
                          label: t("branch_dashboard.summary.branch_staff"),
                          value: staffMembers.length,
                          detail: averageQueueAge ? `Average live queue age ${formatMinutes(averageQueueAge)}` : "No live queue right now",
                          icon: Users,
                        },
                      ].map((card) => (
                        <motion.div key={card.label} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
                          <StatCard {...card} />
                        </motion.div>
                      ))}
                    </motion.section>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
                      <SectionShell
                        id="overview"
                        title="Branch snapshot"
                        description="A compact operational summary for the current branch queue."
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-[24px] border border-border bg-background p-5">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Tracked revenue</p>
                            <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{formatPrice(trackedRevenue)}</p>
                            <p className="mt-2 text-sm text-muted-foreground">{completedOrders} completed pickups in this dataset</p>
                          </div>
                          <div className="rounded-[24px] border border-border bg-background p-5">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Live queue</p>
                            <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{activeOrders.length}</p>
                            <p className="mt-2 text-sm text-muted-foreground">{staffRows.filter((staff) => staff.assignedOrders > 0).length} staff carrying active work</p>
                          </div>
                        </div>
                      </SectionShell>

                      <SectionShell
                        id="alerts"
                        title="Queue signals"
                        description="Actionable alerts only, so the panel stays useful instead of noisy."
                      >
                        <div className="space-y-3">
                          {alerts.length ? (
                            alerts.map((alert, index) => (
                              <motion.div
                                key={alert.title}
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="rounded-[24px] border border-orange-500/20 bg-orange-500/5 p-4"
                              >
                                <div className="flex items-start gap-3">
                                  <AlertTriangle className="mt-0.5 h-4 w-4 text-primary" />
                                  <div>
                                    <p className="font-semibold text-foreground">{alert.title}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p>
                                  </div>
                                </div>
                              </motion.div>
                            ))
                          ) : (
                            <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/5 p-4">
                              <div className="flex items-start gap-3">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                                <div>
                                  <p className="font-semibold text-foreground">Operations stable</p>
                                  <p className="mt-1 text-sm text-muted-foreground">No urgent queue issues need intervention right now.</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </SectionShell>
                    </div>
                  </div>
                )}

                {activeSection === "analytics" && (
                  <SectionShell
                    id="analytics"
                    title="Branch analytics"
                    description="Quick metrics, queue health, and a simple performance chart."
                  >
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
                      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] border border-border bg-background p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Order trend</p>
                            <h3 className="mt-2 text-xl font-black tracking-tight text-foreground">Seven-day volume</h3>
                            <p className="mt-2 text-sm text-muted-foreground">Rolling branch order volume across the last seven days.</p>
                          </div>
                          <div className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                            {formatPrice(trackedRevenue)} tracked
                          </div>
                        </div>
                        <div className="mt-6 grid h-64 grid-cols-7 items-end gap-3">
                          {dailyVolume.map((day, index) => (
                            <motion.div
                              key={day.key}
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.04 }}
                              className="flex h-full flex-col items-center justify-end gap-3"
                            >
                              <span className="text-xs font-semibold text-muted-foreground">{day.orders}</span>
                              <div className="flex h-full w-full items-end rounded-2xl bg-muted/50 p-1">
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: `${Math.max(10, (day.orders / maxDailyOrders) * 100)}%` }}
                                  transition={{ delay: 0.08 + index * 0.04, duration: 0.3 }}
                                  className="w-full rounded-xl bg-gradient-to-t from-primary to-orange-400"
                                />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{day.label}</span>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>

                      <div className="space-y-4">
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                          <div className="rounded-[24px] border border-border bg-background p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{t("branch_dashboard.analytics.total_sales")}</p>
                            <p className="mt-3 text-2xl font-black tracking-tight text-foreground">{formatPrice(completedRevenue)}</p>
                            <p className="mt-2 text-sm text-muted-foreground">{t("branch_dashboard.analytics.completed_orders", { count: completedOrders })}</p>
                          </div>
                          <div className="rounded-[24px] border border-border bg-background p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{t("branch_dashboard.analytics.active_pipeline")}</p>
                            <p className="mt-3 text-2xl font-black tracking-tight text-foreground">{activeOrders.length}</p>
                            <p className="mt-2 text-sm text-muted-foreground">{staffRows.filter((staff) => staff.assignedOrders > 0).length} staff carrying live work</p>
                          </div>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-[24px] border border-border bg-background p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{t("branch_dashboard.analytics.status_mix")}</p>
                              <p className="mt-2 text-sm text-muted-foreground">{t("branch_dashboard.analytics.status_title")}</p>
                            </div>
                            <BellRing className="h-4 w-4 text-primary" />
                          </div>
                          <div className="mt-5 space-y-3">
                            {statusRows.map((row) => (
                              <div key={row.label} className="space-y-1.5">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-foreground">{row.label}</span>
                                  <span className="font-semibold text-muted-foreground">{row.value}</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${row.value ? (row.value / maxStatusCount) * 100 : 0}%` }}
                                    transition={{ duration: 0.35 }}
                                    className={cn("h-2 rounded-full", row.color)}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  </SectionShell>
                )}

                {activeSection === "orders" && (
                  <SectionShell
                    id="orders"
                    title={isManager ? t("branch_dashboard.orders.manager_heading") : t("branch_dashboard.orders.staff_heading")}
                    description={isManager ? "Tabular branch order control with fast filters and inline actions." : t("branch_dashboard.orders.staff_desc")}
                    actions={
                      <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
                        <div className="relative w-full lg:w-72">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={orderSearch}
                            onChange={(event) => setOrderSearch(event.target.value)}
                            placeholder="Search orders, customers, staff..."
                            className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none focus:border-primary/30"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {ORDER_FILTERS.map((filter) => (
                            <button
                              key={filter}
                              type="button"
                              onClick={() => setOrderFilter(filter)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-colors",
                                orderFilter === filter
                                  ? "border-primary/20 bg-primary text-primary-foreground"
                                  : "border-border bg-background text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {filter === "all" ? t("branch_dashboard.filters.all") : t(`branch_dashboard.status.${filter}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    }
                  >
                    {ordersQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">{t("branch_dashboard.loading_orders")}</p>
                    ) : filteredOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("branch_dashboard.no_orders")}</p>
                    ) : (
                      <>
                        <div className="space-y-4 xl:hidden">
                          {filteredOrders.map((order, index) => {
                            const items = parseItems(order.items);
                            const selectedStaff = staffSelectionByOrder[order.id] || "";
                            return (
                              <motion.div
                                key={order.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="rounded-[24px] border border-border bg-background p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-bold text-foreground">{t("branch_dashboard.order_number", { id: order.id })}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{order.customer_name || t("branch_dashboard.unknown_customer")}</p>
                                  </div>
                                  <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", statusTone(order.status))}>
                                    {t(`branch_dashboard.status.${order.status}`)}
                                  </span>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">{t("branch_dashboard.pickup_time")}</p>
                                    <p className="mt-1 font-medium text-foreground">{order.pickup_time || "--"}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">{t("branch_dashboard.order_total")}</p>
                                    <p className="mt-1 font-medium text-foreground">{formatPrice(order.total)}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">{t("branch_dashboard.items")}</p>
                                    <p className="mt-1 font-medium text-foreground">{items.length}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Assigned</p>
                                    <p className="mt-1 font-medium text-foreground">{order.assigned_staff || "--"}</p>
                                  </div>
                                </div>
                                <div className="mt-4 space-y-2">
                                  {isManager && (order.status === "Pending" || order.status === "Accepted") ? (
                                    <>
                                      <select
                                        value={selectedStaff}
                                        onChange={(event) =>
                                          setStaffSelectionByOrder((current) => ({ ...current, [order.id]: event.target.value }))
                                        }
                                        className="h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm text-foreground outline-none"
                                      >
                                        <option value="">Select staff</option>
                                        {staffRows.map((staff) => (
                                          <option key={staff.id} value={String(staff.id)}>
                                            {getStaffLabel(staff)}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="flex gap-2">
                                        {order.status === "Pending" ? (
                                          <button
                                            type="button"
                                            onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "accept" })}
                                            className="flex-1 rounded-2xl border border-primary/20 bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                                          >
                                            {t("branch_dashboard.action.accept_order")}
                                          </button>
                                        ) : null}
                                        <button
                                          type="button"
                                          disabled={!selectedStaff}
                                          onClick={() => assignToStaff(order)}
                                          className="flex-1 rounded-2xl border border-border bg-foreground px-4 py-2.5 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          Assign
                                        </button>
                                      </div>
                                    </>
                                  ) : null}
                                  {!isManager && order.status === "Assigned" ? (
                                    <button
                                      type="button"
                                      onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "start" })}
                                      className="w-full rounded-2xl border border-primary/20 bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                                    >
                                      {t("branch_dashboard.action.start_preparing")}
                                    </button>
                                  ) : null}
                                  {!isManager && order.status === "Preparing" ? (
                                    <button
                                      type="button"
                                      onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "ready" })}
                                      className="w-full rounded-2xl border border-primary/20 bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                                    >
                                      {t("branch_dashboard.action.mark_ready")}
                                    </button>
                                  ) : null}
                                  {isManager && order.status === "Ready for Pick-up" ? (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "complete" })}
                                        className="flex-1 rounded-2xl border border-primary/20 bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                                      >
                                        {t("branch_dashboard.action.complete_order")}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "no-show" })}
                                        className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground"
                                      >
                                        No-show
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>

                        <div className="hidden overflow-x-auto xl:block">
                          <table className="min-w-full text-left">
                            <thead>
                              <tr className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                <th className="pb-3 pr-4 font-bold">Order</th>
                                <th className="pb-3 pr-4 font-bold">{t("branch_dashboard.customer")}</th>
                                <th className="pb-3 pr-4 font-bold">Status</th>
                                <th className="pb-3 pr-4 font-bold">{t("branch_dashboard.pickup_time")}</th>
                                <th className="pb-3 pr-4 font-bold">{t("branch_dashboard.order_total")}</th>
                                <th className="pb-3 pr-4 font-bold">Staff</th>
                                <th className="pb-3 font-bold text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredOrders.map((order, index) => {
                                const items = parseItems(order.items);
                                const selectedStaff = staffSelectionByOrder[order.id] || "";
                                return (
                                  <motion.tr
                                    key={order.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    className="border-b border-border last:border-b-0"
                                  >
                                    <td className="py-4 pr-4 align-top">
                                      <p className="font-semibold text-foreground">{t("branch_dashboard.order_number", { id: order.id })}</p>
                                      <p className="mt-1 text-sm text-muted-foreground">{items.length} items</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                                    </td>
                                    <td className="py-4 pr-4 align-top">
                                      <p className="font-medium text-foreground">{order.customer_name || t("branch_dashboard.unknown_customer")}</p>
                                      <p className="mt-1 text-sm text-muted-foreground">{order.customer_phone || t("branch_dashboard.no_phone")}</p>
                                    </td>
                                    <td className="py-4 pr-4 align-top">
                                      <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", statusTone(order.status))}>
                                        {t(`branch_dashboard.status.${order.status}`)}
                                      </span>
                                    </td>
                                    <td className="py-4 pr-4 align-top text-sm text-foreground">{order.pickup_time || "--"}</td>
                                    <td className="py-4 pr-4 align-top text-sm font-semibold text-foreground">{formatPrice(order.total)}</td>
                                    <td className="py-4 pr-4 align-top">
                                      {isManager && (order.status === "Pending" || order.status === "Accepted") ? (
                                        <select
                                          value={selectedStaff}
                                          onChange={(event) =>
                                            setStaffSelectionByOrder((current) => ({ ...current, [order.id]: event.target.value }))
                                          }
                                          className="h-10 min-w-[180px] rounded-2xl border border-border bg-background px-3 text-sm text-foreground outline-none"
                                        >
                                          <option value="">Select staff</option>
                                          {staffRows.map((staff) => (
                                            <option key={staff.id} value={String(staff.id)}>
                                              {getStaffLabel(staff)}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">{order.assigned_staff || "--"}</span>
                                      )}
                                    </td>
                                    <td className="py-4 align-top">
                                      <div className="flex flex-wrap justify-end gap-2">
                                        {isManager && order.status === "Pending" ? (
                                          <button
                                            type="button"
                                            onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "accept" })}
                                            className="rounded-2xl border border-primary/20 bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                                          >
                                            {t("branch_dashboard.action.accept_order")}
                                          </button>
                                        ) : null}
                                        {isManager && (order.status === "Pending" || order.status === "Accepted") ? (
                                          <button
                                            type="button"
                                            disabled={!selectedStaff}
                                            onClick={() => assignToStaff(order)}
                                            className="rounded-2xl border border-border bg-foreground px-3 py-2 text-xs font-bold text-background disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            Assign
                                          </button>
                                        ) : null}
                                        {!isManager && order.status === "Assigned" ? (
                                          <button
                                            type="button"
                                            onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "start" })}
                                            className="rounded-2xl border border-primary/20 bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                                          >
                                            {t("branch_dashboard.action.start_preparing")}
                                          </button>
                                        ) : null}
                                        {!isManager && order.status === "Preparing" ? (
                                          <button
                                            type="button"
                                            onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "ready" })}
                                            className="rounded-2xl border border-primary/20 bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                                          >
                                            {t("branch_dashboard.action.mark_ready")}
                                          </button>
                                        ) : null}
                                        {isManager && order.status === "Ready for Pick-up" ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "complete" })}
                                              className="rounded-2xl border border-primary/20 bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                                            >
                                              {t("branch_dashboard.action.complete_order")}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => orderAction.mutate({ orderId: order.id, endpoint: "no-show" })}
                                              className="rounded-2xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground"
                                            >
                                              No-show
                                            </button>
                                          </>
                                        ) : null}
                                      </div>
                                    </td>
                                  </motion.tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </SectionShell>
                )}

                {activeSection === "staff" && (
                  <SectionShell
                    id="staff"
                    title={t("branch_dashboard.staff.heading")}
                    description={t("branch_dashboard.staff.desc", { branch: branchName })}
                  >
                    <div className="grid gap-3">
                      {staffRows.map((staff, index) => (
                        <motion.div
                          key={staff.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="flex items-center justify-between rounded-[24px] border border-border bg-background p-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-primary/15 bg-primary/10 p-2 text-primary">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{getStaffLabel(staff)}</p>
                              <p className="text-sm text-muted-foreground">{staff.email}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black tracking-tight text-foreground">{staff.assignedOrders}</p>
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">active</p>
                          </div>
                        </motion.div>
                      ))}
                      {staffRows.length === 0 ? <p className="text-sm text-muted-foreground">No branch staff found.</p> : null}
                    </div>
                  </SectionShell>
                )}

                {activeSection === "inventory" && isManager && (
                  <SectionShell
                    id="inventory"
                    title={t("branch_dashboard.inventory.heading")}
                    description={t("branch_dashboard.inventory.desc")}
                    actions={
                      <div className="relative w-full lg:w-64">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={inventorySearch}
                          onChange={(event) => setInventorySearch(event.target.value)}
                          placeholder={t("branch_dashboard.inventory.search")}
                          className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none focus:border-primary/30"
                        />
                      </div>
                    }
                  >
                    {stockQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">{t("branch_dashboard.inventory.loading")}</p>
                    ) : (
                      <div className="space-y-3">
                        {stock.slice(0, 8).map((item, index) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="flex items-center justify-between gap-3 rounded-[24px] border border-border bg-background p-4"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{item.product.name}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {formatPrice(item.product.price)} · {t("branch_dashboard.inventory.in_stock", { count: item.stock_count })}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => stockMutation.mutate(item.product_id)}
                              disabled={stockMutation.isPending}
                              className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t("branch_dashboard.inventory.mark_out")}
                            </button>
                          </motion.div>
                        ))}
                        {!stock.length ? <p className="text-sm text-muted-foreground">No inventory items match this search.</p> : null}
                      </div>
                    )}
                  </SectionShell>
                )}

                {activeSection === "invites" && isManager && (
                  <SectionShell
                    id="invites"
                    title={t("branch_dashboard.invite.heading")}
                    description={t("branch_dashboard.invite.desc", { branch: branchName })}
                  >
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <input
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder={t("branch_dashboard.invite.optional_email")}
                        className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-primary/30"
                      />
                      <button
                        type="button"
                        onClick={() => inviteMutation.mutate()}
                        disabled={inviteMutation.isPending}
                        className="w-full rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {inviteMutation.isPending ? t("branch_dashboard.invite.creating") : t("branch_dashboard.invite.create")}
                      </button>

                      {latestInvite ? (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[24px] border border-border bg-background p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{t("branch_dashboard.invite.latest")}</p>
                          <p className="mt-2 break-all text-sm text-foreground">{latestInvite.invite_url}</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t("branch_dashboard.invite.expires", { date: formatDateTime(latestInvite.expires_at) })}
                          </p>
                          <button
                            type="button"
                            onClick={copyInviteLink}
                            className="mt-3 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
                          >
                            {t("branch_dashboard.copy")}
                          </button>
                        </motion.div>
                      ) : null}
                    </motion.div>
                  </SectionShell>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};

export default BranchDashboard;
