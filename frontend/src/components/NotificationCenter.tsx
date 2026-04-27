import { Bell, Info, Package, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";

interface NotificationCenterProps {
  token: string | null;
}

const NotificationCenter = ({ token }: NotificationCenterProps) => {
  const { t } = useLanguage();
  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      if (!token) return [];
      try {
        const res = await fetch("/api/user/notifications", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return [];
        return res.json();
      } catch (err) {
        console.error("Error fetching notifications:", err);
        return [];
      }
    },
    enabled: !!token,
    refetchInterval: 30000 
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markRead = async (id: number) => {
    try {
      await fetch(`/api/user/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      refetch();
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/user/notifications/read-all", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      refetch();
    } catch (err) {
      console.error("Error clearing notifications:", err);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative p-2 text-muted-foreground hover:text-primary transition-colors outline-none group">
        <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#050510]">
            {unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#08081a]/95 backdrop-blur-2xl border-white/10 w-80 p-0 overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.5)] rounded-2xl mt-2">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">{t("notifications.title")}</h4>
          {unreadCount > 0 && <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase">{unreadCount} {t("notifications.new")}</span>}
        </div>
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-8 h-8 text-white/5 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t("notifications.empty")}</p>
            </div>
          ) : (
            notifications.map((notif: any) => {
              const Icon = notif.type === "Order" ? Package : notif.type === "Promo" ? Sparkles : Info;
              return (
                <div 
                  key={notif.id} 
                  onClick={() => !notif.is_read && markRead(notif.id)}
                  className={`p-4 border-b border-white/5 hover:bg-white/[0.03] transition-all cursor-pointer relative group ${!notif.is_read ? "bg-primary/[0.03]" : ""}`}
                >
                  <div className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!notif.is_read ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold leading-tight mb-1 ${!notif.is_read ? "text-white" : "text-gray-400"}`}>{notif.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{notif.message}</p>
                      <p className="text-[9px] text-gray-600 mt-2 font-medium uppercase tracking-tighter">
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1 shrink-0 shadow-lg shadow-primary/50" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {notifications.length > 0 && (
          <div className="p-3 bg-white/[0.01] text-center border-t border-white/5">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-[10px] font-bold text-gray-500 hover:text-primary transition-colors uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("notifications.clear_all")}
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationCenter;
