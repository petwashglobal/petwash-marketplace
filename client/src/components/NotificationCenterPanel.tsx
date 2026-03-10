import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { formatDistanceToNow } from "date-fns";
import {
  Bell, X, CheckCheck, Dog, Cat, PawPrint, ChevronRight, Inbox
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────
interface NotifGroup {
  bookingId: string | null;
  platform: string | null;
  totalCount: number;
  unreadCount: number;
  latestTitle: string;
  latestBody: string;
  latestAt: string | null;
  ids: string[];
  actionUrl: string | null;
}

interface GroupedNotifResponse {
  groups: NotifGroup[];
  totalUnread: number;
}

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  walk_my_pet:  { label: "Dog Walker", color: "#4F7942", Icon: Dog },
  sitter_suite: { label: "Pet Sitter", color: "#7B5EA7", Icon: Cat },
  petwash:      { label: "PetWash",    color: "#0B57D0", Icon: PawPrint },
  academy:      { label: "Academy",    color: "#B45309", Icon: PawPrint },
};

function PlatformIcon({ platform }: { platform: string | null }) {
  const cfg = PLATFORM_CONFIG[platform ?? ""] ?? { color: "#6B7280", Icon: PawPrint };
  const Icon = cfg.Icon;
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
      style={{ background: cfg.color + "12", border: `1.5px solid ${cfg.color}22` }}>
      <Icon size={18} style={{ color: cfg.color }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface NotificationCenterPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationCenterPanel({ open, onClose }: NotificationCenterPanelProps) {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<GroupedNotifResponse>({
    queryKey: ["/api/booking-chat/notifications/grouped"],
    enabled: open && !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async (payload: { bookingId?: string; ids?: string[] }) =>
      apiRequest("PUT", "/api/booking-chat/notifications/mark-read", payload),
    onSuccess: () => {
      // Invalidate both notification panel AND inbox unread badge
      qc.invalidateQueries({ queryKey: ["/api/booking-chat/notifications/grouped"] });
      qc.invalidateQueries({ queryKey: ["/api/booking-chat/inbox"] });
    },
  });

  function handleGroupTap(group: NotifGroup) {
    if (group.unreadCount > 0 && group.bookingId) {
      markReadMutation.mutate({ bookingId: group.bookingId });
    } else if (group.unreadCount > 0 && group.ids.length) {
      markReadMutation.mutate({ ids: group.ids });
    }
    const target = group.actionUrl ?? (group.bookingId ? `/booking-chat/${group.bookingId}` : null);
    if (target) {
      onClose();
      setLocation(target);
    }
  }

  function handleMarkAllRead() {
    const allIds = data?.groups.flatMap(g => g.ids) ?? [];
    if (allIds.length) markReadMutation.mutate({ ids: allIds });
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="bottom"
        className="bg-white rounded-t-2xl max-h-[80vh] flex flex-col p-0"
        style={{ border: "none" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <SheetHeader className="px-5 pb-3 border-b border-gray-50 flex flex-row items-center justify-between shrink-0">
          <SheetTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-500" />
            Notifications
            {(data?.totalUnread ?? 0) > 0 && (
              <span className="text-[11px] font-bold text-white px-1.5 py-0.5 rounded-full"
                style={{ background: "linear-gradient(135deg,#0B57D0,#4E8DF7)" }}>
                {data!.totalUnread > 99 ? "99+" : data!.totalUnread}
              </span>
            )}
          </SheetTitle>

          {(data?.totalUnread ?? 0) > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markReadMutation.isPending}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
            >
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
        </SheetHeader>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="px-5 py-4 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && (!data?.groups.length) && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                <Inbox className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-400">You're all caught up</p>
              <p className="text-xs text-gray-300 mt-1">No notifications in the last 30 days</p>
            </div>
          )}

          {!isLoading && data?.groups.map((group, idx) => {
            const platformCfg = PLATFORM_CONFIG[group.platform ?? ""] ?? { label: group.platform ?? "Other", color: "#6B7280" };
            const isUnread = group.unreadCount > 0;

            return (
              <button
                key={idx}
                onClick={() => handleGroupTap(group)}
                className={`w-full flex items-center gap-3 px-5 py-4 border-b border-gray-50 text-left transition-colors ${isUnread ? "bg-blue-50/60 hover:bg-blue-50" : "bg-white hover:bg-gray-50"}`}
              >
                <PlatformIcon platform={group.platform} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm leading-tight truncate ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-600"}`}>
                      {group.latestTitle}
                    </span>
                    <span className="text-[10px] text-gray-300 shrink-0 mt-0.5">
                      {group.latestAt ? formatDistanceToNow(new Date(group.latestAt), { addSuffix: true }) : ""}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {group.latestBody}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1.5">
                    {group.platform && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ color: platformCfg.color, background: platformCfg.color + "12", border: `1px solid ${platformCfg.color}22` }}>
                        {platformCfg.label}
                      </span>
                    )}
                    {group.bookingId && (
                      <span className="text-[10px] text-gray-300 font-mono">
                        #{group.bookingId.slice(-6).toUpperCase()}
                      </span>
                    )}
                    {group.totalCount > 1 && (
                      <span className="text-[10px] text-gray-400">
                        · {group.totalCount} notifications
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isUnread && group.unreadCount > 1 && (
                    <span className="text-[11px] font-bold text-white min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,#0B57D0,#4E8DF7)" }}>
                      {group.unreadCount}
                    </span>
                  )}
                  {isUnread && group.unreadCount === 1 && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                  {group.bookingId && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Bell trigger badge (for embedding in headers) ────────────────────────────
export function NotificationBell({ className = "" }: { className?: string }) {
  const { user } = useFirebaseAuth();
  const [open, setOpen] = useState(false);

  const { data } = useQuery<GroupedNotifResponse>({
    queryKey: ["/api/booking-chat/notifications/grouped"],
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const count = data?.totalUnread ?? 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors ${className}`}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#0B57D0,#4E8DF7)", boxShadow: "0 1px 4px rgba(11,87,208,0.4)" }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      <NotificationCenterPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
