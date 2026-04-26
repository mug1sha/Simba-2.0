import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  ExternalLink,
  ShoppingCart,
  Boxes,
  Search,
  CheckCircle2,
  LocateFixed,
  Navigation,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import ChatWidget from "@/components/ChatWidget";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPrice } from "@/lib/products";
import {
  BRANCH_LOCATIONS,
  getGoogleMapsDirectionsEmbedLink,
  getGoogleMapsLink,
} from "@/lib/branches";
import { toast } from "sonner";

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

type UserLocation = {
  latitude: number;
  longitude: number;
};

type RouteEstimate = {
  directMeters: number;
  routeMeters: number;
  driveMinutes: number;
  walkMinutes: number;
};

const USER_LOCATION_STORAGE_KEY = "simba-user-location";
const DEFAULT_BRANCH = BRANCH_LOCATIONS[0];

const readStoredLocation = (): UserLocation | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(USER_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.latitude === "number" && typeof parsed?.longitude === "number") {
      return { latitude: parsed.latitude, longitude: parsed.longitude };
    }
  } catch {
    return null;
  }

  return null;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceInMeters = (from: UserLocation, to: { latitude: number; longitude: number }) => {
  const earthRadius = 6371000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters: number) => {
  const roundedMeters = Math.round(meters);
  if (roundedMeters < 1000) {
    return `${roundedMeters} m`;
  }
  return `${(roundedMeters / 1000).toFixed(1)} km (${roundedMeters.toLocaleString()} m)`;
};

const formatKilometers = (meters: number) => `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;

const formatMetersOnly = (meters: number) => `${Math.round(meters).toLocaleString()} m`;

const getRouteEstimate = (distanceMeters: number): RouteEstimate => {
  const routeFactor = distanceMeters < 2000 ? 1.18 : distanceMeters < 7000 ? 1.24 : 1.31;
  const routeMeters = Math.round(distanceMeters * routeFactor + 140);
  return {
    directMeters: Math.round(distanceMeters),
    routeMeters,
    driveMinutes: Math.max(4, Math.round(routeMeters / 360)),
    walkMinutes: Math.max(10, Math.round(routeMeters / 78)),
  };
};

const getMapBounds = (
  branches: Array<{ latitude: number; longitude: number }>,
  userLocation: UserLocation | null,
) => {
  const points = [
    ...branches.map((branch) => ({ latitude: branch.latitude, longitude: branch.longitude })),
    ...(userLocation ? [userLocation] : []),
  ];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLon: Math.min(...longitudes),
    maxLon: Math.max(...longitudes),
  };
};

const projectMapPoint = (
  latitude: number,
  longitude: number,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  width: number,
  height: number,
) => {
  const padding = 36;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const lonRange = Math.max(bounds.maxLon - bounds.minLon, 0.0001);
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const x = padding + ((longitude - bounds.minLon) / lonRange) * usableWidth;
  const y = padding + (1 - (latitude - bounds.minLat) / latRange) * usableHeight;
  return { x, y };
};

const buildRoutePath = (
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const arc = Math.max(24, Math.abs(from.x - to.x) * 0.12 + Math.abs(from.y - to.y) * 0.08);
  return `M ${from.x} ${from.y} Q ${midX} ${midY - arc} ${to.x} ${to.y}`;
};

const BranchesPage = () => {
  const navigate = useNavigate();
  const { items, addItem, selectedBranch, setSelectedBranch, setIsCartOpen } = useCart();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBranch, setActiveBranch] = useState(DEFAULT_BRANCH);
  const [stockSearch, setStockSearch] = useState("");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(readStoredLocation);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied" | "unsupported">(
    readStoredLocation() ? "granted" : "idle",
  );

  const branchLocked = !!selectedBranch && items.length > 0 && selectedBranch !== activeBranch.name;

  const getBranchDescription = (branchName: string) => {
    switch (branchName) {
      case "Simba Kicukiro":
        return t("branches.kicukiro_desc");
      case "Simba Kigali Heights":
        return t("branches.kigali_heights_desc");
      case "Simba Gishushu":
        return t("branches.gishushu_desc");
      case "Simba Gacuriro":
        return t("branches.gacuriro_desc");
      case "Simba Kimironko":
        return t("branches.kimironko_desc");
      case "Simba Kisimenti":
        return t("branches.kisimenti_desc");
      case "Simba Gikondo":
        return t("branches.gikondo_desc");
      case "Simba Sonatube":
        return t("branches.sonatube_desc");
      case "Simba UTC":
        return t("branches.utc_desc");
      case "Simba Rebero":
        return t("branches.rebero_desc");
      case "Simba Centenary":
        return t("branches.centenary_desc");
      default:
        return BRANCH_LOCATIONS.find((branch) => branch.name === branchName)?.description || branchName;
    }
  };

  const getSourceLabel = (label: string) =>
    label === "Official Simba branch list" ? t("branches.official_source") : label;

  const getReviewSummary = (count?: number) =>
    count ? t("branches.review_summary", { count }) : t("branches.early_shoppers");

  const branchesWithDistance = useMemo(() => {
    return BRANCH_LOCATIONS.map((branch) => {
      const distanceMeters = userLocation
        ? getDistanceInMeters(userLocation, { latitude: branch.latitude, longitude: branch.longitude })
        : null;
      return { ...branch, distanceMeters };
    }).sort((a, b) => {
      if (a.distanceMeters === null && b.distanceMeters === null) return 0;
      if (a.distanceMeters === null) return 1;
      if (b.distanceMeters === null) return -1;
      return a.distanceMeters - b.distanceMeters;
    });
  }, [userLocation]);

  const nearestBranch = branchesWithDistance.find((branch) => branch.distanceMeters !== null) ?? null;
  const activeBranchWithDistance =
    branchesWithDistance.find((branch) => branch.name === activeBranch.name) ?? {
      ...activeBranch,
      distanceMeters: null,
    };
  const { data: branchRatings = [] } = useQuery({
    queryKey: ["branch-ratings"],
    queryFn: async () => {
      const res = await fetch("/api/branches/ratings");
      if (!res.ok) return [];
      return res.json();
    },
  });
  const ratingByBranch = branchRatings.reduce(
    (acc: Record<string, { average_rating: number; review_count: number }>, item: any) => {
      acc[item.branch] = item;
      return acc;
    },
    {},
  );
  const activeRoute = useMemo(
    () =>
      activeBranchWithDistance.distanceMeters !== null
        ? getRouteEstimate(activeBranchWithDistance.distanceMeters)
        : null,
    [activeBranchWithDistance.distanceMeters],
  );
  const overviewMapPoints = useMemo(() => {
    const width = 900;
    const height = 420;
    const bounds = getMapBounds(branchesWithDistance, userLocation);
    return {
      width,
      height,
      branches: branchesWithDistance.map((branch) => ({
        ...branch,
        ...projectMapPoint(branch.latitude, branch.longitude, bounds, width, height),
      })),
      user: userLocation ? projectMapPoint(userLocation.latitude, userLocation.longitude, bounds, width, height) : null,
    };
  }, [branchesWithDistance, userLocation]);
  const overviewActivePoint =
    overviewMapPoints.branches.find((branch) => branch.name === activeBranch.name) ?? null;
  const overviewRoutePath =
    overviewMapPoints.user && overviewActivePoint
      ? buildRoutePath(overviewMapPoints.user, overviewActivePoint)
      : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (userLocation) {
      window.localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(userLocation));
    } else {
      window.localStorage.removeItem(USER_LOCATION_STORAGE_KEY);
    }
  }, [userLocation]);

  useEffect(() => {
    if (selectedBranch) {
      const selected = BRANCH_LOCATIONS.find((branch) => branch.name === selectedBranch);
      if (selected) {
        setActiveBranch(selected);
        return;
      }
    }

    if (nearestBranch) {
      setActiveBranch((current) => (current.name === DEFAULT_BRANCH.name ? nearestBranch : current));
    }
  }, [nearestBranch, selectedBranch]);

  const requestUserLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("unsupported");
      toast.error(t("branches.location_unsupported"));
      return;
    }

    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(nextLocation);
        setLocationStatus("granted");
        const nearest = BRANCH_LOCATIONS
          .map((branch) => ({
            ...branch,
            distanceMeters: getDistanceInMeters(nextLocation, {
              latitude: branch.latitude,
              longitude: branch.longitude,
            }),
          }))
          .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
        if (nearest) {
          setActiveBranch(nearest);
          toast.success(t("branches.nearest_branch_found", { branch: nearest.name }), { duration: 1800 });
        }
      },
      () => {
        setLocationStatus("denied");
        toast.error(t("branches.location_denied"));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  };

  const { data: stock = [], isLoading } = useQuery<BranchStock[]>({
    queryKey: ["customer-branch-stock", activeBranch.name, stockSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ branch: activeBranch.name });
      if (stockSearch.trim()) params.set("search", stockSearch.trim());
      const res = await fetch(`/api/branch/stock?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch branch stock");
      return res.json();
    },
  });

  const inStockItems = useMemo(() => stock.filter((item) => item.stock_count > 0), [stock]);
  const topInventory = inStockItems.slice(0, 20);
  const activeGallery = topInventory.slice(0, 4);
  const activeHeroImage = activeGallery[0]?.product.image || "/Grocery-Store4.jpg";
  const embeddedDirectionsUrl = getGoogleMapsDirectionsEmbedLink(
    activeBranch.googleQuery,
    userLocation ?? undefined,
  );

  const focusBranchDirections = (branchName: string) => {
    const branch = BRANCH_LOCATIONS.find((item) => item.name === branchName);
    if (!branch) return;
    setActiveBranch(branch);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("branch-directions")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const chooseBranch = (branchName: string) => {
    if (items.length > 0 && selectedBranch && selectedBranch !== branchName) {
      toast.error(t("branches.cart_locked_switch", { selected: selectedBranch }));
      return;
    }
    setSelectedBranch(branchName);
    toast.success(t("branches.shopping_branch_set", { branch: branchName }), { duration: 1500 });
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-500">
      <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="container mx-auto px-4 py-10 space-y-10">
        <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-[2rem] border border-border/50 bg-card/80 p-6 shadow-2xl shadow-black/5"
          >
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">{t("branches.badge")}</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-foreground">{t("branches.title")}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {t("branches.subtitle")}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-primary/20 bg-primary/10 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">{t("branches.your_location")}</p>
                    {userLocation ? (
                      <>
                        <p className="text-sm font-bold text-foreground">
                          {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
                        </p>
                        {nearestBranch && nearestBranch.distanceMeters !== null && (
                          <p className="text-sm text-muted-foreground">{t("branches.closest_branch", {
                            branch: nearestBranch.name,
                            distance: formatDistance(nearestBranch.distanceMeters),
                          })}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("branches.location_prompt")}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={requestUserLocation}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
                  >
                    <LocateFixed className="h-4 w-4" />
                    {locationStatus === "granted"
                      ? t("branches.refresh_location")
                      : locationStatus === "loading"
                        ? t("branches.finding_location")
                        : t("branches.use_my_location")}
                  </button>
                </div>
                {locationStatus === "denied" && (
                  <p className="mt-3 text-xs text-amber-200">{t("branches.location_denied_inline")}</p>
                )}
                {locationStatus === "unsupported" && (
                  <p className="mt-3 text-xs text-amber-200">{t("branches.location_unsupported")}</p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  {
                    icon: Navigation,
                    label: activeRoute ? formatKilometers(activeRoute.routeMeters) : t("branches.route_ready"),
                    caption: activeRoute ? t("branches.suggested_road_distance") : t("branches.enable_location"),
                  },
                  {
                    icon: Clock,
                    label: activeRoute ? t("branches.drive_minutes", { count: activeRoute.driveMinutes }) : t("branches.eta"),
                    caption: activeRoute ? t("branches.estimated_drive_time") : t("branches.shown_after_location"),
                  },
                  {
                    icon: Boxes,
                    label: t("branches.items_count", { count: topInventory.length || 20 }),
                    caption: t("branches.visual_branch_inventory"),
                  },
                  {
                    icon: CheckCircle2,
                    label: `${(ratingByBranch[activeBranch.name]?.average_rating || 4.6).toFixed(1)}★`,
                    caption: t("branches.branch_ratings", {
                      count: ratingByBranch[activeBranch.name]?.review_count || 0,
                    }),
                  },
                ].map(({ icon: Icon, label, caption }, index) => (
                  <motion.div
                    key={caption}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * index }}
                    className="rounded-2xl border border-border/50 bg-background/70 p-4"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <p className="mt-4 text-lg font-black tracking-tight text-foreground">{label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="overflow-hidden rounded-[2rem] border border-border/50 bg-card shadow-2xl shadow-black/5"
          >
            <div className="relative h-[420px] overflow-hidden bg-[radial-gradient(circle_at_top,#1e293b_0%,#0f172a_38%,#020617_100%)]">
              <div className="absolute left-4 top-4 z-10 rounded-2xl border border-white/10 bg-[#08081a]/90 p-4 text-white shadow-xl backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">{t("branches.interactive_map")}</p>
                <p className="mt-2 max-w-[260px] text-xs leading-relaxed text-gray-300">
                  {t("branches.map_preview_desc")}
                </p>
              </div>
              <svg viewBox={`0 0 ${overviewMapPoints.width} ${overviewMapPoints.height}`} className="h-full w-full">
                <defs>
                  <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
                    <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width={overviewMapPoints.width} height={overviewMapPoints.height} fill="url(#grid)" />
                {overviewRoutePath && (
                  <>
                    <path
                      d={overviewRoutePath}
                      stroke="rgba(249,115,22,0.14)"
                      strokeLinecap="round"
                      strokeWidth="10"
                      fill="none"
                    />
                    <motion.path
                      d={overviewRoutePath}
                      stroke="rgba(59,130,246,0.78)"
                      strokeDasharray="10 8"
                      strokeLinecap="round"
                      strokeWidth="3"
                      fill="none"
                      initial={{ pathLength: 0, opacity: 0.4 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.8 }}
                    />
                  </>
                )}
                {overviewMapPoints.branches.map((branch, index) => {
                  const isSelected = branch.name === activeBranch.name;
                  return (
                    <motion.g
                      key={branch.name}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.03 * index }}
                      onClick={() => setActiveBranch(branch)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={branch.x}
                        cy={branch.y}
                        r={isSelected ? 13 : 9}
                        fill={isSelected ? "#f97316" : "#0f172a"}
                        stroke="#fb923c"
                        strokeWidth="4"
                      />
                      <text x={branch.x + 14} y={branch.y - 12} fill="white" fontSize="16" fontWeight="800">
                        {branch.name}
                      </text>
                      {branch.distanceMeters !== null && (
                        <text x={branch.x + 14} y={branch.y + 10} fill="rgba(255,255,255,0.72)" fontSize="12" fontWeight="700">
                          {formatDistance(branch.distanceMeters)}
                        </text>
                      )}
                    </motion.g>
                  );
                })}
                {overviewMapPoints.user && (
                  <g>
                    <circle cx={overviewMapPoints.user.x} cy={overviewMapPoints.user.y} r="18" fill="rgba(59,130,246,0.18)" />
                    <circle cx={overviewMapPoints.user.x} cy={overviewMapPoints.user.y} r="8" fill="#3b82f6" stroke="white" strokeWidth="4" />
                    <text x={overviewMapPoints.user.x + 14} y={overviewMapPoints.user.y - 14} fill="white" fontSize="15" fontWeight="900">
                      {t("branches.map_user_location")}
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branchesWithDistance.map((branch, index) => {
            const isActive = activeBranch.name === branch.name;
            const isSelected = selectedBranch === branch.name;
            const isNearest = nearestBranch?.name === branch.name;
            const routeEstimate = branch.distanceMeters !== null ? getRouteEstimate(branch.distanceMeters) : null;

            return (
              <motion.article
                key={branch.name}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * index }}
                className={`overflow-hidden rounded-[1.75rem] border transition-all ${
                  isActive
                    ? "border-primary/40 bg-primary/5 shadow-xl shadow-primary/10"
                    : "border-border/50 bg-card hover:border-primary/20"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveBranch(branch)}
                  className="group block w-full text-left"
                >
                  <div className="relative h-32 overflow-hidden">
                    <img
                      src={isActive ? activeHeroImage : "/Grocery-Store4.jpg"}
                      alt={branch.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-black/15 via-black/30 to-black/75" />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-200">
                        {branch.neighborhood}
                      </p>
                      <h2 className="mt-2 text-xl font-black tracking-tight">{branch.name}</h2>
                      <p className="mt-1 text-[11px] font-bold text-orange-100/90">
                        ★ {(ratingByBranch[branch.name]?.average_rating || 4.6).toFixed(1)}
                        {ratingByBranch[branch.name]?.review_count
                          ? ` • ${t("branches.ratings_count", { count: ratingByBranch[branch.name].review_count })}`
                          : ` • ${t("branches.new_branch")}`}
                      </p>
                    </div>
                  </div>
                </button>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{branch.address}</p>
                      {branch.distanceMeters !== null && (
                        <p className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-foreground">
                          <Navigation className="h-3.5 w-3.5 text-primary" />
                          {formatKilometers(branch.distanceMeters)} · {formatMetersOnly(branch.distanceMeters)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isNearest && (
                        <span className="rounded-full bg-green-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-green-600 dark:text-green-300">
                          {t("branches.nearest")}
                        </span>
                      )}
                      <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">
                        ★ {(ratingByBranch[branch.name]?.average_rating || 4.6).toFixed(1)}
                        {ratingByBranch[branch.name]?.review_count
                          ? ` (${t("branches.ratings_count", { count: ratingByBranch[branch.name].review_count })})`
                          : ` (${t("branches.new_branch")})`}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("branches.shopping")}
                        </span>
                      )}
                      {isActive && (
                        <span className="rounded-full bg-foreground/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-foreground">
                          {t("branches.viewing")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/50 bg-background/70 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">{t("branches.route")}</p>
                      <p className="mt-2 text-sm font-black text-foreground">
                        {routeEstimate ? formatKilometers(routeEstimate.routeMeters) : t("branches.enable_location")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {routeEstimate
                          ? t("branches.suggested_road_route", { distance: formatMetersOnly(routeEstimate.routeMeters) })
                          : t("branches.distance_after_permission")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-background/70 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">{t("branches.eta")}</p>
                      <p className="mt-2 text-sm font-black text-foreground">
                        {routeEstimate ? t("branches.drive_minutes", { count: routeEstimate.driveMinutes }) : t("branches.waiting_for_route")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {routeEstimate ? t("branches.walk_minutes", { count: routeEstimate.walkMinutes }) : t("branches.fast_trip_estimate")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => focusBranchDirections(branch.name)}
                      className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                        isActive ? "bg-primary text-white" : "bg-muted text-foreground hover:bg-accent"
                      }`}
                    >
                      {isActive ? t("branches.viewing_route") : t("branches.view_route")}
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseBranch(branch.name)}
                      className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-white"
                    >
                      {t("branches.shop_this_branch")}
                    </button>
                    <button
                      type="button"
                      onClick={() => focusBranchDirections(branch.name)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-4 py-2 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-primary/20 hover:bg-accent"
                    >
                      {t("branches.directions")}
                      <Navigation className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <a
                    href={branch.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-block text-[11px] font-bold text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    {t("branches.location_source", { source: getSourceLabel(branch.sourceLabel) })}
                  </a>
                </div>
              </motion.article>
            );
          })}
        </section>

        <section id="branch-directions" className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] scroll-mt-24">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[2rem] border border-border/50 bg-card shadow-2xl shadow-black/5">
              <div className="relative h-[520px] overflow-hidden bg-[radial-gradient(circle_at_top,#172554_0%,#111827_42%,#020617_100%)]">
                <iframe
                  src={embeddedDirectionsUrl}
                  title={t("branches.directions_map_title", { branch: activeBranch.name })}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 h-full w-full border-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 pointer-events-none" />
                <div className="absolute left-4 top-4 z-10 rounded-2xl border border-white/10 bg-[#08081a]/90 p-4 text-white shadow-xl backdrop-blur-md">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">{activeBranch.name}</p>
                  <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-gray-300">
                    {t("branches.embedded_map_desc")}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[2rem] border border-border/50 bg-card p-5 shadow-2xl shadow-black/5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">{t("branches.route_details")}</p>
                {activeRoute ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t("branches.suggested_route")}</p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
                        {formatKilometers(activeRoute.routeMeters)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatMetersOnly(activeRoute.routeMeters)}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t("branches.direct_line")}</p>
                        <p className="mt-2 text-lg font-black text-foreground">{formatKilometers(activeRoute.directMeters)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t("branches.eta")}</p>
                        <p className="mt-2 text-lg font-black text-foreground">{t("branches.drive_minutes", { count: activeRoute.driveMinutes })}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t("branches.walk_minutes", { count: activeRoute.walkMinutes })}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => focusBranchDirections(activeBranch.name)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
                    >
                      {t("branches.refresh_embedded_map")}
                      <Navigation className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-border/50 bg-background/60 p-6 text-sm text-muted-foreground">
                    {t("branches.enable_location_route_prompt")}
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-border/50 bg-card p-5 shadow-2xl shadow-black/5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">{t("branches.visual_guide")}</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/70 p-4">
                    <span className="mt-1 h-4 w-4 rounded-full border-4 border-[#fb923c] bg-[#f97316]" />
                    <div>
                      <p className="text-sm font-black text-foreground">{t("branches.selected_branch")}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{t("branches.selected_branch_desc")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/70 p-4">
                    <span className="mt-1 h-4 w-4 rounded-full border-4 border-white bg-[#3b82f6]" />
                    <div>
                      <p className="text-sm font-black text-foreground">{t("branches.your_location")}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{t("branches.your_location_desc")}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-xs leading-relaxed text-muted-foreground">
                    <p>
                      <span className="font-black text-foreground">{t("branches.animated_path")}</span> {t("branches.animated_path_desc")}
                    </p>
                    <p className="mt-2">
                      <span className="font-black text-foreground">{t("branches.eta_desc_label")}</span> {t("branches.eta_desc")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/50 bg-card p-6 shadow-2xl shadow-black/5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">{activeBranch.neighborhood}</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-foreground">{t("branches.store_title", { branch: activeBranch.name })}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("branches.store_preview")}
                </p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">
                  ★ {(ratingByBranch[activeBranch.name]?.average_rating || 4.6).toFixed(1)}
                  {" "}
                  {getReviewSummary(ratingByBranch[activeBranch.name]?.review_count)}
                </p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder={t("branches.search_this_branch")}
                  className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => chooseBranch(activeBranch.name)}
                className="rounded-2xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
              >
                {t("branches.use_branch", { branch: activeBranch.name })}
              </button>
              <button
                type="button"
                onClick={() => {
                  chooseBranch(activeBranch.name);
                  navigate("/");
                }}
                className="rounded-2xl border border-border px-5 py-3 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-primary/20 hover:bg-accent"
              >
                {t("branches.go_to_main_catalog")}
              </button>
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="rounded-2xl border border-border px-5 py-3 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-primary/20 hover:bg-accent"
              >
                {t("branches.open_cart")}
              </button>
              <a
                href={getGoogleMapsLink(activeBranch.googleQuery)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-border px-5 py-3 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-primary/20 hover:bg-accent"
              >
                {t("branches.open_in_maps")}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {branchLocked && (
              <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                {t("branches.branch_locked", {
                  selected: selectedBranch || "",
                  branch: activeBranch.name,
                })}
              </div>
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="relative min-h-[260px] overflow-hidden rounded-[1.8rem] border border-border/50 bg-black">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeHeroImage}
                    src={activeHeroImage}
                    alt={activeBranch.name}
                    initial={{ opacity: 0.35, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0.35, scale: 0.98 }}
                    transition={{ duration: 0.35 }}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-tr from-black/75 via-black/25 to-transparent" />
                <div className="relative flex h-full flex-col justify-between p-5 text-white">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-200">{t("branches.branch_moodboard")}</p>
                    <p className="mt-3 text-3xl font-black tracking-tight">{activeBranch.neighborhood}</p>
                    <p className="mt-2 max-w-sm text-sm text-white/75">{getBranchDescription(activeBranch.name)}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {activeGallery.map((item, index) => (
                      <motion.img
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 * index }}
                        src={item.product.image}
                        alt={item.product.name}
                        className="h-14 w-14 rounded-2xl border border-white/15 object-cover shadow-lg"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  {
                    label: t("branches.road_route"),
                    value: activeRoute ? formatKilometers(activeRoute.routeMeters) : t("branches.location_needed"),
                    caption: activeRoute ? formatMetersOnly(activeRoute.routeMeters) : t("branches.turn_on_location"),
                  },
                  {
                    label: t("branches.eta"),
                    value: activeRoute ? t("branches.drive_minutes", { count: activeRoute.driveMinutes }) : t("branches.quick_estimate"),
                    caption: activeRoute ? t("branches.walk_minutes", { count: activeRoute.walkMinutes }) : t("branches.shown_after_route_lock"),
                  },
                  {
                    label: t("branches.top_picks"),
                    value: t("branches.items_count", { count: topInventory.length || 0 }),
                    caption: t("branches.currently_visible"),
                  },
                  {
                    label: t("branches.branch_rating"),
                    value: `${(ratingByBranch[activeBranch.name]?.average_rating || 4.6).toFixed(1)}★`,
                    caption: ratingByBranch[activeBranch.name]?.review_count
                      ? t("branches.customer_reviews", { count: ratingByBranch[activeBranch.name].review_count })
                      : t("branches.no_reviews_yet"),
                  },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl border border-border/50 bg-background/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">{card.label}</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{card.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{card.caption}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {isLoading ? (
                <div className="rounded-2xl border border-dashed border-border/50 bg-background/60 p-10 text-center text-sm font-bold text-muted-foreground">
                  {t("branches.loading_inventory")}
                </div>
              ) : topInventory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/50 bg-background/60 p-10 text-center text-sm font-bold text-muted-foreground">
                  {t("branches.no_stock_products")}
                </div>
              ) : (
                topInventory.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * index }}
                    className="flex gap-4 rounded-2xl border border-border/50 bg-background/70 p-4"
                  >
                    <img src={item.product.image} alt={item.product.name} className="h-16 w-16 rounded-2xl object-cover bg-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-foreground">{item.product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t(`cat.${item.product.category}`)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-black text-primary">{formatPrice(item.product.price)}</span>
                        <span className="rounded-full bg-green-500/10 px-2 py-1 font-black text-green-600 dark:text-green-300">
                          {t("branches.in_stock_count", { count: item.stock_count })}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={branchLocked}
                      onClick={() => {
                        chooseBranch(activeBranch.name);
                        addItem({
                          id: item.product.id,
                          name: item.product.name,
                          price: item.product.price,
                          image: item.product.image,
                          unit: item.product.unit,
                        });
                        toast.success(t("branches.product_added_from", {
                          product: item.product.name,
                          branch: activeBranch.name,
                        }), { duration: 1500 });
                      }}
                      className="h-11 shrink-0 rounded-2xl bg-primary px-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-40"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      <CartDrawer />
      <ChatWidget />
    </div>
  );
};

export default BranchesPage;
