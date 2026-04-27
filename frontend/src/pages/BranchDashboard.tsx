import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart as AreaChartIcon,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  LineChart,
  PackageCheck,
  PieChart as PieChartIcon,
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
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemePalettePicker } from "@/components/ThemePalettePicker";
import { usePaletteTheme } from "@/contexts/PaletteThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

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

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "EN", label: "English", flag: "🇬🇧" },
  { code: "RW", label: "Kinyarwanda", flag: "🇷🇼" },
  { code: "FR", label: "Français", flag: "🇫🇷" },
];

const localeByLanguage: Record<Language, string> = {
  EN: "en-US",
  RW: "rw-RW",
  FR: "fr-FR",
};

const BranchDashboard = () => {
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { currentPalette } = usePaletteTheme();
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockSearch, setStockSearch] = useState("");
  const [staffInviteEmail, setStaffInviteEmail] = useState("");
  const [latestStaffInvite, setLatestStaffInvite] = useState<RoleInviteLink | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<7 | 14 | 30>(14);
  const [analyticsMetric, setAnalyticsMetric] = useState<"sales" | "orders" | "average">("sales");
  const [analyticsVisual, setAnalyticsVisual] = useState<"area" | "bar">("area");

  const isManager = user?.role === "branch_manager";
  const isStaff = user?.role === "branch_staff";
  const branchName = user?.branch || "Unassigned Branch";
  const currentLang = languages.find((lang) => lang.code === language) || languages[0];
  const locale = localeByLanguage[language];
  const compactFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }),
    [locale],
  );
  const statusLabelMap = useMemo<Record<string, string>>(
    () => ({
      Pending: t("branch_dashboard.status.Pending"),
      Accepted: t("branch_dashboard.status.Accepted"),
      Assigned: t("branch_dashboard.status.Assigned"),
      Preparing: t("branch_dashboard.status.Preparing"),
      "Ready for Pick-up": t("branch_dashboard.status.Ready for Pick-up"),
      Completed: t("branch_dashboard.status.Completed"),
      "No-show": t("branch_dashboard.status.No-show"),
      Cancelled: t("branch_dashboard.status.Cancelled"),
    }),
    [t],
  );
  const statusLabel = useCallback((status: string) => statusLabelMap[status] || status, [statusLabelMap]);

  const { data: staffMembers = [] } = useQuery<BranchStaffMember[]>({
    queryKey: ["branch-staff", branchName],
    queryFn: async () => {
      const res = await fetch("/api/branch/staff", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t("branch_dashboard.error.staff_load"));
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
      if (!res.ok) throw new Error(t("branch_dashboard.error.orders_load"));
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
      if (!res.ok) throw new Error(t("branch_dashboard.error.stock_load"));
      return res.json();
    },
    enabled: !!token && !!user && isManager,
  });

  const { data: analyticsOrders = [] } = useQuery<BranchOrder[]>({
    queryKey: ["branch-orders-analytics", branchName],
    queryFn: async () => {
      const res = await fetch("/api/branch/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t("branch_dashboard.error.orders_load"));
      return res.json();
    },
    enabled: !!token && !!user && isManager,
    refetchInterval: 5000,
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
      if (!res.ok) throw new Error(await readErrorMessage(res, t("branch_dashboard.error.action_failed")));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-orders"] });
      toast.success(t("branch_dashboard.toast.order_updated"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markOutOfStock = useMutation({
    mutationFn: async (productId: number) => {
      const res = await fetch(`/api/branch/stock/${productId}/out-of-stock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t("branch_dashboard.error.stock_update"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      toast.success(t("branch_dashboard.toast.stock_updated"));
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
      if (!res.ok) throw new Error(await readErrorMessage(res, t("branch_dashboard.error.invite_create")));
      return res.json() as Promise<RoleInviteLink>;
    },
    onSuccess: (invite) => {
      setLatestStaffInvite(invite);
      toast.success(t("branch_dashboard.toast.invite_created"));
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
        label: isManager ? t("branch_dashboard.summary.pending_review") : t("branch_dashboard.summary.assigned_to_you"),
        value: isManager ? countByStatus("Pending") : countByStatus("Assigned"),
        icon: Clock3,
      },
      {
        label: t("branch_dashboard.summary.preparing"),
        value: countByStatus("Preparing"),
        icon: Play,
      },
      {
        label: t("branch_dashboard.summary.ready"),
        value: countByStatus("Ready for Pick-up"),
        icon: PackageCheck,
      },
      {
        label: isManager ? t("branch_dashboard.summary.branch_staff") : t("branch_dashboard.summary.completed"),
        value: isManager ? staffMembers.length : countByStatus("Completed"),
        icon: isManager ? Users : CheckCircle2,
      },
    ];
  }, [isManager, orders, staffMembers.length, t]);

  const analyticsChartConfig = useMemo<ChartConfig>(
    () => ({
      sales: {
        label: t("branch_dashboard.analytics.metric_sales"),
        color: currentPalette.swatches[0],
      },
      orders: {
        label: t("branch_dashboard.analytics.metric_orders"),
        color: currentPalette.swatches[1],
      },
      average: {
        label: t("branch_dashboard.analytics.metric_average"),
        color: currentPalette.swatches[2],
      },
      completed: {
        label: t("branch_dashboard.status.Completed"),
        color: "#22c55e",
      },
      active: {
        label: t("branch_dashboard.analytics.active_pipeline"),
        color: "#f59e0b",
      },
    }),
    [currentPalette.swatches, t],
  );

  const analytics = useMemo(() => {
    if (!isManager) return null;

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(end.getDate() - (analyticsRange - 1));
    start.setHours(0, 0, 0, 0);

    const buckets = Array.from({ length: analyticsRange }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        key: date.toISOString().slice(0, 10),
        date,
        label: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date),
        sales: 0,
        orders: 0,
        average: 0,
      };
    });
    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    let revenueTotal = 0;
    let ordersTotal = 0;
    let completedRevenue = 0;
    let completedOrders = 0;
    let activePipeline = 0;
    const statusCounts: Record<string, number> = {};

    analyticsOrders.forEach((order) => {
      const createdAt = new Date(order.created_at);
      if (Number.isNaN(createdAt.getTime())) return;

      const key = createdAt.toISOString().slice(0, 10);
      const bucket = bucketMap.get(key);
      if (createdAt >= start && createdAt <= end && bucket) {
        bucket.sales += order.total;
        bucket.orders += 1;
      }

      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      ordersTotal += 1;
      revenueTotal += order.total;

      if (order.status === "Completed") {
        completedRevenue += order.total;
        completedOrders += 1;
      }
      if (!["Completed", "Cancelled", "No-show"].includes(order.status)) {
        activePipeline += order.total;
      }
    });

    buckets.forEach((bucket) => {
      bucket.average = bucket.orders ? bucket.sales / bucket.orders : 0;
    });

    const statusData = Object.entries(statusCounts)
      .map(([status, value]) => ({
        status,
        label: statusLabel(status),
        value,
      }))
      .sort((a, b) => b.value - a.value);

    const bestDay = [...buckets].sort((a, b) => b.sales - a.sales)[0];

    return {
      series: buckets,
      statusData,
      totals: {
        revenueTotal,
        ordersTotal,
        completedRevenue,
        completedOrders,
        activePipeline,
        completionRate: ordersTotal ? (completedOrders / ordersTotal) * 100 : 0,
        averageOrderValue: ordersTotal ? revenueTotal / ordersTotal : 0,
        bestDayLabel: bestDay?.label || "--",
        bestDaySales: bestDay?.sales || 0,
      },
    };
  }, [analyticsOrders, analyticsRange, isManager, locale, statusLabel]);

  const formatCurrencyCompact = (value: number) => `RWF ${compactFormatter.format(value)}`;
  const formatMetricValue = (metric: "sales" | "orders" | "average", value: number) => {
    if (metric === "orders") return value.toLocaleString(locale);
    return formatCurrencyCompact(value);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">{t("branch_dashboard.kicker")}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                {isManager ? t("branch_dashboard.manager_title") : t("branch_dashboard.staff_title")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {branchName} · {isManager ? t("branch_dashboard.manager_subtitle") : t("branch_dashboard.staff_subtitle")}
              </p>
            </div>
            <div className="flex flex-col gap-4 lg:items-end">
              <div className="flex flex-wrap items-center gap-3">
                <ThemePalettePicker />
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-accent outline-none">
                    <span>{currentLang.flag}</span>
                    <span>{currentLang.code}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl border border-border bg-card">
                    {languages.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => setLanguage(lang.code)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <span>{lang.flag}</span>
                        <span className="text-xs font-bold">{lang.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="rounded-3xl border border-border bg-card/70 px-5 py-4 text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.signed_in_as")}</p>
                <p className="mt-2 text-sm font-black text-foreground">
                  {user ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email : t("branch_dashboard.operations_user")}
                </p>
                <p className="mt-1 text-xs text-primary">{isManager ? t("branch_dashboard.role_manager") : t("branch_dashboard.role_staff")}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-[1.75rem] border border-border bg-card/70 p-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-3xl font-black">{value}</p>
            </div>
          ))}
        </section>

        {isManager && analytics && (
          <section className="rounded-[2rem] border border-border bg-card/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">{t("branch_dashboard.analytics.kicker")}</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">{t("branch_dashboard.analytics.title")}</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("branch_dashboard.analytics.desc")}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.analytics.total_sales")}</p>
                  <p className="mt-2 text-xl font-black">{formatPrice(analytics.totals.completedRevenue)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("branch_dashboard.analytics.completed_orders", { count: analytics.totals.completedOrders })}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.analytics.pipeline")}</p>
                  <p className="mt-2 text-xl font-black">{formatPrice(analytics.totals.activePipeline)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("branch_dashboard.analytics.completion_rate", { rate: analytics.totals.completionRate.toFixed(0) })}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.analytics.best_day")}</p>
                  <p className="mt-2 text-xl font-black">{analytics.totals.bestDayLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatPrice(analytics.totals.bestDaySales)}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-[1.5rem] border border-border bg-background/60 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{t("branch_dashboard.analytics.comfort_controls")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("branch_dashboard.analytics.comfort_desc")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[7, 14, 30].map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setAnalyticsRange(range as 7 | 14 | 30)}
                      className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all ${
                        analyticsRange === range ? "bg-primary text-white" : "bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t("branch_dashboard.analytics.range_days", { count: range })}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {[
                    ["sales", BarChart3, t("branch_dashboard.analytics.metric_sales")],
                    ["orders", ShoppingBag, t("branch_dashboard.analytics.metric_orders")],
                    ["average", LineChart, t("branch_dashboard.analytics.metric_average")],
                  ].map(([metric, Icon, label]) => (
                    <button
                      key={metric}
                      type="button"
                      onClick={() => setAnalyticsMetric(metric as "sales" | "orders" | "average")}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                        analyticsMetric === metric
                          ? "bg-primary text-white"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["area", AreaChartIcon, t("branch_dashboard.analytics.visual_area")],
                    ["bar", BarChart3, t("branch_dashboard.analytics.visual_bar")],
                  ].map(([visual, Icon, label]) => (
                    <button
                      key={visual}
                      type="button"
                      onClick={() => setAnalyticsVisual(visual as "area" | "bar")}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                        analyticsVisual === visual
                          ? "bg-primary text-white"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-[1.75rem] border border-border bg-background/70 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">{t("branch_dashboard.analytics.trend")}</p>
                    <h3 className="mt-2 text-xl font-black">{t(`branch_dashboard.analytics.metric_heading.${analyticsMetric}`)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t("branch_dashboard.analytics.trend_desc", { count: analyticsRange })}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.analytics.current_focus")}</p>
                    <p className="mt-1 text-sm font-black text-foreground">
                      {formatMetricValue(
                        analyticsMetric,
                        analytics.series.reduce((sum, item) => sum + item[analyticsMetric], 0) / (analyticsMetric === "average" ? Math.max(analytics.series.filter((item) => item.orders > 0).length, 1) : 1),
                      )}
                    </p>
                  </div>
                </div>
                <ChartContainer config={analyticsChartConfig} className="mt-4 h-[320px] w-full">
                  {analyticsVisual === "area" ? (
                    <AreaChart data={analytics.series}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => analyticsMetric === "orders" ? String(value) : compactFormatter.format(value)} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => (
                              <>
                                <div className="flex flex-1 items-center justify-between gap-3">
                                  <span className="text-muted-foreground">{analyticsChartConfig[String(name)]?.label || name}</span>
                                  <span className="font-mono font-medium text-foreground">
                                    {formatMetricValue(analyticsMetric, Number(value))}
                                  </span>
                                </div>
                              </>
                            )}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey={analyticsMetric}
                        stroke={`var(--color-${analyticsMetric})`}
                        fill={`var(--color-${analyticsMetric})`}
                        fillOpacity={0.2}
                        strokeWidth={3}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={analytics.series}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => analyticsMetric === "orders" ? String(value) : compactFormatter.format(value)} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => (
                              <>
                                <div className="flex flex-1 items-center justify-between gap-3">
                                  <span className="text-muted-foreground">{analyticsChartConfig[String(name)]?.label || name}</span>
                                  <span className="font-mono font-medium text-foreground">
                                    {formatMetricValue(analyticsMetric, Number(value))}
                                  </span>
                                </div>
                              </>
                            )}
                          />
                        }
                      />
                      <Bar dataKey={analyticsMetric} fill={`var(--color-${analyticsMetric})`} radius={[12, 12, 4, 4]} />
                    </BarChart>
                  )}
                </ChartContainer>
              </div>

              <div className="grid gap-5">
                <div className="rounded-[1.75rem] border border-border bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">{t("branch_dashboard.analytics.status_mix")}</p>
                      <h3 className="mt-2 text-xl font-black">{t("branch_dashboard.analytics.status_title")}</h3>
                    </div>
                    <PieChartIcon className="h-5 w-5 text-primary" />
                  </div>
                  <ChartContainer config={analyticsChartConfig} className="mt-4 h-[240px] w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie data={analytics.statusData} dataKey="value" nameKey="status" innerRadius={58} outerRadius={88} paddingAngle={3}>
                        {analytics.statusData.map((entry, index) => {
                          const colorPool = [
                            currentPalette.swatches[0],
                            currentPalette.swatches[1],
                            "#22c55e",
                            "#f59e0b",
                            "#ef4444",
                            "#94a3b8",
                          ];
                          return <Cell key={entry.status} fill={colorPool[index % colorPool.length]} />;
                        })}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="mt-3 grid gap-2">
                    {analytics.statusData.map((entry, index) => {
                      const colorPool = [
                        currentPalette.swatches[0],
                        currentPalette.swatches[1],
                        "#22c55e",
                        "#f59e0b",
                        "#ef4444",
                        "#94a3b8",
                      ];
                      return (
                        <div key={entry.status} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/80 px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorPool[index % colorPool.length] }} />
                            <span className="font-bold text-foreground">{entry.label}</span>
                          </div>
                          <span className="font-mono font-medium text-muted-foreground">{entry.value.toLocaleString(locale)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-border bg-background/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">{t("branch_dashboard.analytics.quick_insights")}</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-border bg-card/80 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.analytics.average_order_value")}</p>
                      <p className="mt-1 text-lg font-black">{formatPrice(analytics.totals.averageOrderValue)}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card/80 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.analytics.orders_seen")}</p>
                      <p className="mt-1 text-lg font-black">{analytics.totals.ordersTotal.toLocaleString(locale)}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card/80 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.analytics.total_revenue_tracked")}</p>
                      <p className="mt-1 text-lg font-black">{formatPrice(analytics.totals.revenueTotal)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className={`grid gap-6 ${isManager ? "xl:grid-cols-[1.1fr_0.9fr]" : ""}`}>
          <div className="rounded-[2rem] border border-border bg-card/60">
            <div className="border-b border-border p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    {isManager ? t("branch_dashboard.orders.manager_heading") : t("branch_dashboard.orders.staff_heading")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isManager
                      ? t("branch_dashboard.orders.manager_desc")
                      : t("branch_dashboard.orders.staff_desc")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableFilters.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all ${
                        statusFilter === status ? "bg-primary text-white" : "bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {status === "all" ? t("branch_dashboard.filters.all") : statusLabel(status)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="divide-y divide-border">
              {ordersLoading ? (
                <div className="p-10 text-center text-sm font-bold text-muted-foreground">{t("branch_dashboard.loading_orders")}</div>
              ) : orders.length === 0 ? (
                <div className="p-10 text-center text-sm font-bold text-muted-foreground">{t("branch_dashboard.no_orders")}</div>
              ) : (
                orders.map((order) => {
                  const items = parseItems(order.items);
                  return (
                    <article key={order.id} className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-black">{t("branch_dashboard.order_number", { id: order.id })}</h3>
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass[order.status] || "bg-background text-muted-foreground border-border"}`}>
                            {statusLabel(order.status)}
                          </span>
                          {order.assigned_staff && (
                            <span className="text-xs text-muted-foreground">{t("branch_dashboard.assigned_to", { name: order.assigned_staff })}</span>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.customer")}</p>
                            <p className="mt-1 text-sm font-bold text-foreground">{order.customer_name || t("branch_dashboard.unknown_customer")}</p>
                            <p className="text-xs text-muted-foreground">{order.customer_phone || t("branch_dashboard.no_phone")}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.pickup_branch")}</p>
                            <p className="mt-1 text-sm font-bold text-foreground">{order.pickup_branch}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.pickup_time")}</p>
                            <p className="mt-1 text-sm font-bold text-foreground">{order.pickup_time || t("common.not_set")}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.order_total")}</p>
                            <p className="mt-1 text-sm font-bold text-foreground">{formatPrice(order.total)}</p>
                          </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.items")}</p>
                          <div className="mt-3 space-y-2">
                            {items.map((item: any) => (
                              <div key={`${order.id}-${item.id}`} className="flex items-center gap-3 text-xs text-muted-foreground">
                                <img src={item.image} alt={item.name} className="h-9 w-9 rounded-xl object-cover bg-muted" />
                                <span className="flex-1 truncate">{item.name}</span>
                                <span className="font-black text-foreground">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {t("branch_dashboard.ordered_on", { date: new Date(order.created_at).toLocaleString() })}
                        </p>
                      </div>

                      <div className="flex min-w-[220px] flex-col gap-2">
                        {isManager && order.status === "Pending" && (
                          <button
                            type="button"
                            onClick={() => action.mutate({ orderId: order.id, endpoint: "accept" })}
                            className="rounded-2xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
                          >
                            {t("branch_dashboard.action.accept_order")}
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
                            {t("branch_dashboard.action.assign_staff", { name: getStaffLabel(staff) })}
                          </button>
                        ))}

                        {isStaff && order.status === "Assigned" && (
                          <button
                            type="button"
                            onClick={() => action.mutate({ orderId: order.id, endpoint: "start" })}
                            className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-orange-300 transition-all hover:bg-orange-500 hover:text-white"
                          >
                            {t("branch_dashboard.action.start_preparing")}
                          </button>
                        )}

                        {isStaff && order.status === "Preparing" && (
                          <button
                            type="button"
                            onClick={() => action.mutate({ orderId: order.id, endpoint: "ready" })}
                            className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-green-300 transition-all hover:bg-green-500 hover:text-white"
                          >
                            {t("branch_dashboard.action.mark_ready")}
                          </button>
                        )}

                        {isManager && order.status === "Ready for Pick-up" && (
                          <button
                            type="button"
                            onClick={() => action.mutate({ orderId: order.id, endpoint: "complete" })}
                            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-300 transition-all hover:bg-emerald-500 hover:text-white"
                          >
                            {t("branch_dashboard.action.complete_order")}
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
              <section className="rounded-[2rem] border border-border bg-card/60">
                <div className="border-b border-border p-5">
                  <h2 className="text-xl font-black">{t("branch_dashboard.staff.heading")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("branch_dashboard.staff.desc", { branch: branchName })}</p>
                </div>
                <div className="space-y-4 p-5">
                  <div className="rounded-[1.5rem] border border-primary/15 bg-primary/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t("branch_dashboard.invite.heading")}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("branch_dashboard.invite.desc", { branch: branchName })}
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                      <input
                        type="email"
                        value={staffInviteEmail}
                        onChange={(event) => setStaffInviteEmail(event.target.value)}
                        placeholder={t("branch_dashboard.invite.optional_email")}
                        className="h-12 rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => createStaffInvite.mutate()}
                        disabled={createStaffInvite.isPending}
                        className="rounded-2xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-60"
                      >
                        {createStaffInvite.isPending ? t("branch_dashboard.invite.creating") : t("branch_dashboard.invite.create")}
                      </button>
                    </div>
                    {latestStaffInvite && (
                      <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("branch_dashboard.invite.latest")}</p>
                        <a
                          href={latestStaffInvite.invite_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block break-all text-sm text-primary hover:underline"
                        >
                          {latestStaffInvite.invite_url}
                        </a>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{t("branch_dashboard.invite.expires", { date: new Date(latestStaffInvite.expires_at).toLocaleString() })}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(latestStaffInvite.invite_url);
                              toast.success(t("branch_dashboard.toast.invite_copied"));
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 font-black text-foreground transition-all hover:bg-accent"
                          >
                            <Copy className="h-4 w-4" />
                            {t("branch_dashboard.copy")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {staffMembers.map((staff) => (
                    <div key={staff.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
                        <UserRound className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-foreground">{getStaffLabel(staff)}</p>
                        <p className="truncate text-xs text-muted-foreground">{staff.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[2rem] border border-border bg-card/60">
                <div className="border-b border-border p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black">{t("branch_dashboard.inventory.heading")}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{t("branch_dashboard.inventory.desc")}</p>
                    </div>
                    <div className="relative w-full max-w-xs">
                      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={stockSearch}
                        onChange={(event) => setStockSearch(event.target.value)}
                        placeholder={t("branch_dashboard.inventory.search")}
                        className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-xs font-bold text-foreground outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  {stockLoading ? (
                    <div className="rounded-2xl border border-dashed border-border bg-background/70 p-8 text-center text-sm font-bold text-muted-foreground">
                      {t("branch_dashboard.inventory.loading")}
                    </div>
                  ) : (
                    stock.slice(0, 10).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-3">
                        <img src={item.product.image} alt={item.product.name} className="h-12 w-12 rounded-xl object-cover bg-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-foreground">{item.product.name}</p>
                          <p className="text-[11px] text-muted-foreground">{item.product.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-foreground">{t("branch_dashboard.inventory.in_stock", { count: item.stock_count })}</p>
                          <button
                            type="button"
                            disabled={item.stock_count === 0}
                            onClick={() => markOutOfStock.mutate(item.product_id)}
                            className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-300 transition-all hover:bg-red-500 hover:text-white disabled:opacity-40"
                          >
                            {t("branch_dashboard.inventory.mark_out")}
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
