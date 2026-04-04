import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { auth } from "@/lib/firebase";
import { formatDistanceToNow } from "date-fns";
import {
  Bell, X, CheckCheck, Dog, Cat, PawPrint, ChevronRight, Inbox,
  MessageCircle, CheckCircle, Star, Car, Scissors,
  AlertCircle, RefreshCw, Search
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
  notificationType?: string | null;
  actionType?: string | null;
  rebookTriggerId?: number | null;
}

interface GroupedNotifResponse {
  groups: NotifGroup[];
  totalUnread: number;
}

type TabFilter = 'all' | 'bookings' | 'messages';

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  walk_my_pet:  { label: "Dog Walker", color: "#4F7942", Icon: Dog },
  sitter_suite: { label: "Pet Sitter", color: "#7B5EA7", Icon: Cat },
  petwash:      { label: "PetWash",    color: "#0B57D0", Icon: PawPrint },
  academy:      { label: "Academy",    color: "#B45309", Icon: PawPrint },
  pettrek:      { label: "PetTrek",    color: "#0369A1", Icon: Car },
  groomers:     { label: "Groomers",   color: "#7C3AED", Icon: Scissors },
};

// ─── Notification type config ─────────────────────────────────────────────────
// Only types that are actually written to superAppNotifications are listed here.
// booking_request, booking_confirmed, meet_greet, reminder, message were removed
// as they are never inserted into superAppNotifications (verified 2026-03).
const TYPE_CONFIG: Record<string, {
  label: string; labelHe: string; color: string; Icon: any;
  actionLabel?: string; actionLabelHe?: string;
  hint?: string; hintHe?: string;
}> = {
  // ── Status-change types — written by booking-requests.ts on accept/decline/cancel ──
  booking_accepted: {
    label: "Accepted", labelHe: "אושרה", color: "#10B981", Icon: CheckCircle,
    actionLabel: "Chat now", actionLabelHe: "שוחח עכשיו",
    hint: "💬 Chat with your provider now →", hintHe: "💬 שוחח עם הספק עכשיו →",
  },
  booking_declined: {
    label: "Declined", labelHe: "נדחתה", color: "#EF4444", Icon: AlertCircle,
    actionLabel: "Find another", actionLabelHe: "חפש ספק אחר",
    hint: "🔍 Find another provider →", hintHe: "🔍 חפש ספק אחר →",
  },
  booking_cancelled: {
    label: "Cancelled", labelHe: "בוטלה", color: "#F97316", Icon: AlertCircle,
    actionLabel: "View", actionLabelHe: "צפה",
    hint: "🔍 Find similar providers →", hintHe: "🔍 מצא ספקים דומים →",
  },
  // ── Chat messages — written by booking-chat.ts on new message ──
  booking_chat_message: {
    label: "Message", labelHe: "הודעה", color: "#3B82F6", Icon: MessageCircle,
    actionLabel: "Reply", actionLabelHe: "השב",
    hint: "↩ Reply to message →", hintHe: "↩ השב להודעה →",
  },
  // ── Reviews — written by review submission flow ──
  review_received: {
    label: "New Review", labelHe: "ביקורת חדשה", color: "#8B5CF6", Icon: Star,
    actionLabel: "View", actionLabelHe: "צפה",
    hint: "⭐ View your new review →", hintHe: "⭐ צפה בביקורת החדשה →",
  },
  // ── Smart rebook reminders — written by rebook-scheduler.ts ──
  rebook_reminder_post_completion: {
    label: "Book again?", labelHe: "הזמן שוב?", color: "#C5A55A", Icon: RefreshCw,
    actionLabel: "Book again", actionLabelHe: "הזמן שוב",
    hint: "🐾 One tap to rebook →", hintHe: "🐾 לחיצה אחת להזמנה חוזרת →",
  },
  rebook_reminder_weekly_rebook: {
    label: "Weekly reminder", labelHe: "תזכורת שבועית", color: "#C5A55A", Icon: RefreshCw,
    actionLabel: "Book now", actionLabelHe: "הזמן עכשיו",
    hint: "📅 Keep the routine going →", hintHe: "📅 שמרו על השגרה →",
  },
  rebook_reminder_cancelled_recovery: {
    label: "Find a provider", labelHe: "מצא ספק", color: "#3B82F6", Icon: Search,
    actionLabel: "Browse providers", actionLabelHe: "עיין בספקים",
    hint: "🔍 Similar providers are available →", hintHe: "🔍 ספקים דומים זמינים עכשיו →",
  },
  rebook_reminder_declined_recovery: {
    label: "Try another provider", labelHe: "נסה ספק אחר", color: "#3B82F6", Icon: Search,
    actionLabel: "Find provider", actionLabelHe: "מצא ספק",
    hint: "🔍 Other great providers ready →", hintHe: "🔍 ספקים מעולים נוספים מחכים →",
  },
};

function resolveTypeConfig(notificationType: string | null | undefined, platform: string | null | undefined) {
  if (notificationType && TYPE_CONFIG[notificationType]) return TYPE_CONFIG[notificationType];
  const pCfg = PLATFORM_CONFIG[platform ?? ""];
  if (pCfg) return { ...pCfg, label: pCfg.label, labelHe: pCfg.label, Icon: pCfg.Icon };
  return { label: "Notification", labelHe: "הודעה", color: "#6B7280", Icon: PawPrint };
}

function PlatformIcon({ platform, notificationType }: { platform: string | null; notificationType?: string | null }) {
  const cfg = resolveTypeConfig(notificationType, platform);
  const Icon = cfg.Icon;
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
      style={{ background: cfg.color + "12", border: `1.5px solid ${cfg.color}22` }}
    >
      <Icon size={18} style={{ color: cfg.color }} />
    </div>
  );
}

const MESSAGE_TYPES = new Set(['booking_chat_message', 'message']);
const BOOKING_STATUS_TYPES = new Set([
  'booking_request', 'booking_accepted', 'booking_confirmed',
  'booking_declined', 'booking_cancelled', 'meet_greet', 'reminder',
  'rebook_reminder_post_completion', 'rebook_reminder_weekly_rebook',
  'rebook_reminder_cancelled_recovery', 'rebook_reminder_declined_recovery',
]);

function isMessageType(group: NotifGroup) {
  return MESSAGE_TYPES.has(group.notificationType ?? '');
}

function isBookingType(group: NotifGroup) {
  const t = group.notificationType;
  if (!t) return true; // legacy untyped → show under bookings
  return BOOKING_STATUS_TYPES.has(t);
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
interface NotificationCenterPanelProps {
  open: boolean;
  onClose: () => void;
  language?: 'en' | 'he';
}

export function NotificationCenterPanel({ open, onClose, language = 'en' }: NotificationCenterPanelProps) {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const isHebrew = language === 'he';

  const { data, isLoading } = useQuery<GroupedNotifResponse>({
    queryKey: ["/api/booking-chat/notifications/grouped"],
    enabled: open && !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async (payload: { bookingId?: string; ids?: string[] }) =>
      apiRequest("PUT", "/api/booking-chat/notifications/mark-read", payload),
    onSuccess: () => {
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
    // Fire rebook click tracking (fire-and-forget)
    if (group.rebookTriggerId) {
      apiRequest('POST', `/api/booking-requests/rebook-triggers/${group.rebookTriggerId}/clicked`).catch(() => {});
    }

    // ── force_token_refresh ─────────────────────────────────────────────────
    // When the backend approves a provider, it sets Firebase custom claims
    // (role: 'provider') and inserts this actionType into superAppNotifications.
    // The provider's frontend session token is stale — tapping this notification
    // forces an immediate token refresh so the new claims propagate instantly
    // instead of waiting up to 60 minutes for natural expiry.
    if (group.actionType === 'force_token_refresh' || group.notificationType === 'force_token_refresh') {
      auth.currentUser?.getIdToken(true)
        .then(() => {
          // Reload the page after token refresh so all role-gated components re-evaluate
          qc.invalidateQueries();
          onClose();
          const target = group.actionUrl ?? '/provider-os';
          setLocation(target);
        })
        .catch(() => {
          onClose();
          setLocation(group.actionUrl ?? '/provider-os');
        });
      return;
    }

    // Prefer explicit actionUrl (always set for new notifications).
    const fallback = group.bookingId
      ? isMessageType(group)
        ? `/booking-chat/${group.bookingId}`
        : `/booking/confirmation/${group.bookingId}`
      : null;
    const target = group.actionUrl ?? fallback;
    if (target) {
      onClose();
      setLocation(target);
    }
  }

  function handleMarkAllRead() {
    const allIds = data?.groups.flatMap(g => g.ids) ?? [];
    if (allIds.length) markReadMutation.mutate({ ids: allIds });
  }

  const filteredGroups = (data?.groups ?? []).filter(g => {
    if (activeTab === 'bookings') return isBookingType(g);
    if (activeTab === 'messages') return isMessageType(g);
    return true;
  });

  const bookingCount  = (data?.groups ?? []).filter(isBookingType).length;
  const messageCount  = (data?.groups ?? []).filter(isMessageType).length;
  const unreadBooking = (data?.groups ?? []).filter(g => isBookingType(g) && g.unreadCount > 0).length;
  const unreadMessage = (data?.groups ?? []).filter(g => isMessageType(g) && g.unreadCount > 0).length;

  const TABS: { key: TabFilter; label: string; labelHe: string; count: number; unread: number }[] = [
    { key: 'all',      label: 'All',      labelHe: 'הכל',     count: data?.groups.length ?? 0, unread: data?.totalUnread ?? 0 },
    { key: 'bookings', label: 'Bookings', labelHe: 'הזמנות',  count: bookingCount,              unread: unreadBooking },
    { key: 'messages', label: 'Messages', labelHe: 'הודעות',  count: messageCount,              unread: unreadMessage },
  ];

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="bottom"
        className="bg-white rounded-t-2xl max-h-[85vh] flex flex-col p-0"
        style={{ border: "none" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white" />
        </div>

        {/* Header */}
        <SheetHeader className="px-5 pb-3 border-b border-gray-50 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-500" />
              {isHebrew ? 'התראות' : 'Notifications'}
              {(data?.totalUnread ?? 0) > 0 && (
                <span
                  className="text-[11px] font-bold text-white px-1.5 py-0.5 rounded-full"
                  style={{ background: "linear-gradient(135deg,#0B57D0,#4E8DF7)" }}
                >
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
                <CheckCheck className="w-3 h-3" />
                {isHebrew ? 'סמן הכל כנקרא' : 'Mark all read'}
              </button>
            )}
          </div>

          {/* Category Tabs — Airbnb-style */}
          <div className="flex gap-1 mt-3 -mb-3">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-white'
                }`}
              >
                {isHebrew ? tab.labelHe : tab.label}
                {tab.unread > 0 && (
                  <span
                    className={`text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ${
                      activeTab === tab.key ? 'bg-white/20 text-white' : 'text-white'
                    }`}
                    style={activeTab !== tab.key ? { background: "linear-gradient(135deg,#0B57D0,#4E8DF7)" } : {}}
                  >
                    {tab.unread}
                  </span>
                )}
                {tab.unread === 0 && tab.count > 0 && (
                  <span className={`text-[10px] ${activeTab === tab.key ? 'text-white/60' : 'text-gray-400'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* List */}
        <div className="flex-1 overflow-y-auto pt-3">
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

          {!isLoading && filteredGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-white border border-gray-100 flex items-center justify-center mb-4">
                <Inbox className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-400">
                {isHebrew ? 'כל ההתראות נקראו' : "You're all caught up"}
              </p>
              <p className="text-xs text-gray-300 mt-1">
                {isHebrew
                  ? 'אין התראות ב-30 הימים האחרונים'
                  : 'No notifications in the last 30 days'}
              </p>
            </div>
          )}

          {!isLoading && filteredGroups.map((group, idx) => {
            const typeCfg = resolveTypeConfig(group.notificationType, group.platform);
            const platformCfg = PLATFORM_CONFIG[group.platform ?? ""] ?? { label: group.platform ?? "Other", color: "#6B7280" };
            const isUnread = group.unreadCount > 0;
            const hasAction = !!typeCfg.actionLabel;

            return (
              <div
                key={idx}
                className={`flex items-start gap-3 px-5 py-4 border-b border-gray-50 transition-colors ${
                  isUnread ? "bg-blue-50/40" : "bg-white"
                }`}
              >
                {/* Platform Icon */}
                <PlatformIcon platform={group.platform} notificationType={group.notificationType} />

                {/* Content */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleGroupTap(group)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm leading-tight ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-600"}`}>
                      {group.latestTitle}
                    </span>
                    <span className="text-[10px] text-gray-300 shrink-0 mt-0.5">
                      {group.latestAt ? formatDistanceToNow(new Date(group.latestAt), { addSuffix: true }) : ""}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {group.latestBody}
                  </p>

                  {/* Contextual action hint — per notification type */}
                  {typeCfg.hint && (
                    <p
                      className="text-[11px] font-semibold mt-1"
                      style={{ color: typeCfg.color }}
                    >
                      {isHebrew ? (typeCfg.hintHe ?? typeCfg.hint) : typeCfg.hint}
                    </p>
                  )}

                  {/* Type chip + platform + booking id */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {group.notificationType && TYPE_CONFIG[group.notificationType] && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ color: typeCfg.color, background: typeCfg.color + "12", border: `1px solid ${typeCfg.color}22` }}
                      >
                        {isHebrew ? typeCfg.labelHe : typeCfg.label}
                      </span>
                    )}
                    {group.platform && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ color: platformCfg.color, background: platformCfg.color + "12", border: `1px solid ${platformCfg.color}22` }}
                      >
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
                        · {group.totalCount} {isHebrew ? 'התראות' : 'notifications'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: unread badge + action button + chevron */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    {isUnread && group.unreadCount > 1 && (
                      <span
                        className="text-[11px] font-bold text-white min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg,#0B57D0,#4E8DF7)" }}
                      >
                        {group.unreadCount}
                      </span>
                    )}
                    {isUnread && group.unreadCount === 1 && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                    {group.bookingId && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                  </div>

                  {/* Action button — shown for any notification with a destination */}
                  {hasAction && (group.bookingId || group.actionUrl) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleGroupTap(group); }}
                      className="text-[11px] font-semibold px-3 py-1 rounded-full border transition-all hover:opacity-80"
                      style={{ color: typeCfg.color, borderColor: typeCfg.color + "44", background: typeCfg.color + "0D" }}
                    >
                      {isHebrew ? typeCfg.actionLabelHe : typeCfg.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Bell trigger badge (for embedding in headers) ────────────────────────────
interface NotificationBellProps {
  className?: string;
  language?: 'en' | 'he';
}

export function NotificationBell({ className = "", language = 'en' }: NotificationBellProps) {
  const { user } = useFirebaseAuth();
  const [open, setOpen] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const prevCount = useRef(0);

  const { data } = useQuery<GroupedNotifResponse>({
    queryKey: ["/api/booking-chat/notifications/grouped"],
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const count = data?.totalUnread ?? 0;

  // Pulse animation when new notifications arrive
  useEffect(() => {
    if (count > prevCount.current && prevCount.current !== 0) {
      setIsPulsing(true);
      const t = setTimeout(() => setIsPulsing(false), 2000);
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  return (
    <>
      <style>{`
        @keyframes bell-pulse {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15%       { transform: rotate(-15deg) scale(1.15); }
          30%       { transform: rotate(12deg) scale(1.1); }
          45%       { transform: rotate(-8deg) scale(1.05); }
          60%       { transform: rotate(5deg) scale(1.02); }
          75%       { transform: rotate(-3deg) scale(1); }
        }
        .bell-animate { animation: bell-pulse 0.6s ease-in-out; }
        @keyframes badge-glow {
          0%, 100% { box-shadow: 0 1px 4px rgba(11,87,208,0.4); }
          50%       { box-shadow: 0 0 10px rgba(11,87,208,0.7), 0 0 20px rgba(11,87,208,0.3); }
        }
        .badge-glow { animation: badge-glow 1s ease-in-out 2; }
      `}</style>

      <button
        onClick={() => setOpen(true)}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-white transition-colors ${className}`}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
      >
        <Bell className={`w-5 h-5 transition-transform ${isPulsing ? 'bell-animate' : ''}`} />
        {count > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${isPulsing ? 'badge-glow' : ''}`}
            style={{ background: "linear-gradient(135deg,#0B57D0,#4E8DF7)", boxShadow: "0 1px 4px rgba(11,87,208,0.4)" }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      <NotificationCenterPanel open={open} onClose={() => setOpen(false)} language={language} />
    </>
  );
}
