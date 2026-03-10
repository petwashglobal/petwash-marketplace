import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import type { BookingConversation } from "@shared/schema";
import {
  MessageSquare, Lock, CheckCheck, ChevronRight,
  Dog, Cat, PawPrint, Archive, Inbox
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationCenterPanel";

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  walk_my_pet:  { label: "Dog Walker", color: "#4F7942", Icon: Dog },
  sitter_suite: { label: "Pet Sitter", color: "#7B5EA7", Icon: Cat },
  petwash:      { label: "PetWash",    color: "#0B57D0", Icon: PawPrint },
  academy:      { label: "Academy",    color: "#B45309", Icon: PawPrint },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function PlatformBadge({ platform }: { platform: string }) {
  const cfg = PLATFORM_CONFIG[platform] ?? { label: platform.replace(/_/g, " "), color: "#6B7280", Icon: PawPrint };
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border"
      style={{ color: cfg.color, borderColor: cfg.color + "33", background: cfg.color + "0D" }}>
      {cfg.label}
    </span>
  );
}

function UnreadPill({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold text-white"
      style={{ background: "linear-gradient(135deg,#0B57D0,#4E8DF7)", boxShadow: "0 1px 6px rgba(11,87,208,0.35)" }}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ConversationAvatar({ platform }: { platform: string }) {
  const cfg = PLATFORM_CONFIG[platform] ?? { color: "#6B7280", Icon: PawPrint };
  const Icon = cfg.Icon;
  return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
      style={{ background: cfg.color + "12", border: `1.5px solid ${cfg.color}22` }}>
      <Icon size={22} style={{ color: cfg.color }} />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
      <Skeleton className="w-12 h-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-3 w-20 rounded-full" />
      </div>
    </div>
  );
}

// ─── Archived conversation state (§15 #6: ArchivedConversationScreenState) ───
function ArchivedConversation({ conv, uid }: { conv: BookingConversation; uid: string }) {
  const isCustomer = uid === conv.customerId;
  const partyLabel = isCustomer ? "Service Provider" : "Customer";
  const lastTime   = conv.lastMessageAt
    ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
    : null;

  return (
    <Link href={`/booking-chat/${conv.bookingId}`}>
      <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50/70 active:bg-gray-100/60 opacity-70">
        <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
          <Archive size={20} className="text-gray-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-sm font-semibold text-gray-500 truncate">{partyLabel}</span>
            <span className="text-[11px] text-gray-300 whitespace-nowrap ml-2">{lastTime ?? ""}</span>
          </div>
          <p className="text-sm text-gray-400 truncate mb-1.5 italic">
            {conv.lastMessagePreview || "No messages"}
          </p>
          <div className="flex items-center gap-2">
            <PlatformBadge platform={conv.platform} />
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-300">
              <Lock className="w-2.5 h-2.5" />
              {conv.closedReason || "Closed"}
            </span>
            <span className="text-[10px] text-gray-300 font-mono">#{conv.bookingId.slice(-6).toUpperCase()}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-200 shrink-0" />
      </div>
    </Link>
  );
}

// ─── Active conversation row ──────────────────────────────────────────────────
function ActiveConversation({ conv, uid }: { conv: BookingConversation; uid: string }) {
  const isCustomer  = uid === conv.customerId;
  const unreadCount = isCustomer ? (conv.customerUnread ?? 0) : (conv.providerUnread ?? 0);
  const partyLabel  = isCustomer ? "Service Provider" : "Customer";
  const lastTime    = conv.lastMessageAt
    ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
    : null;

  return (
    <Link href={`/booking-chat/${conv.bookingId}`}>
      <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50/70 active:bg-gray-100/60" style={{ position: "relative" }}>
        {/* Unread left accent bar */}
        {unreadCount > 0 && (
          <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full"
            style={{ background: "linear-gradient(180deg,#0B57D0,#4E8DF7)" }} />
        )}

        <ConversationAvatar platform={conv.platform} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-sm truncate ${unreadCount > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>
              {partyLabel}
            </span>
            <span className="text-[11px] text-gray-400 whitespace-nowrap ml-2">{lastTime ?? ""}</span>
          </div>
          <p className={`text-sm truncate mb-1.5 ${unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
            {conv.lastMessagePreview || "No messages yet"}
          </p>
          <div className="flex items-center gap-2">
            <PlatformBadge platform={conv.platform} />
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
            <span className="text-[10px] text-gray-300 font-mono">#{conv.bookingId.slice(-6).toUpperCase()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <UnreadPill count={unreadCount} />
          {unreadCount === 0 && <CheckCheck className="w-3.5 h-3.5 text-gray-200" />}
          <ChevronRight className="w-4 h-4 text-gray-200" />
        </div>
      </div>
    </Link>
  );
}

// ─── Main inbox ───────────────────────────────────────────────────────────────
export default function BookingChatInbox() {
  const { user } = useFirebaseAuth();
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");

  const { data: conversations, isLoading } = useQuery<BookingConversation[]>({
    queryKey: ["/api/booking-chat/inbox"],
    refetchInterval: 30000,
    enabled: !!user,
  });

  const activeConversations   = conversations?.filter(c => c.chatStatus === "active") ?? [];
  const archivedConversations = conversations?.filter(c => c.chatStatus !== "active") ?? [];

  const totalUnread = activeConversations.reduce((sum, c) => {
    return sum + (user?.uid === c.customerId ? (c.customerUnread ?? 0) : (c.providerUnread ?? 0));
  }, 0);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 pt-6 pb-0"
        style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Messages</h1>
              {totalUnread > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">{totalUnread} unread</p>
              )}
            </div>
            {/* Wave 1 #4: notification bell with grouped unread count */}
            <NotificationBell />
          </div>

          {/* ── Tabs: Active / Archived (§15 #6: ArchivedConversationScreenState) ── */}
          <div className="flex items-center gap-0">
            <button
              onClick={() => setActiveTab("active")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "active"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Active
              {activeConversations.length > 0 && (
                <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === "active" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                }`}>
                  {activeConversations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("archived")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "archived"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              Archived
              {archivedConversations.length > 0 && (
                <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === "archived" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                }`}>
                  {archivedConversations.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto">
        {/* Loading */}
        {isLoading && [1,2,3].map(i => <SkeletonRow key={i} />)}

        {/* ── Active tab ─────────────────────────────────────────────────────── */}
        {!isLoading && activeTab === "active" && (
          <>
            {activeConversations.length === 0 ? (
              /* §15 #7: EmptyInboxState */
              <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-5 border border-gray-100">
                  <MessageSquare className="w-9 h-9 text-gray-200" />
                </div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1.5">No active conversations</h2>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                  Your booking conversations will appear here once a booking is confirmed.
                </p>
              </div>
            ) : (
              <>
                {activeConversations.map(conv => (
                  <ActiveConversation key={conv.conversationId} conv={conv} uid={user?.uid ?? ""} />
                ))}
                <div className="px-5 py-6 text-center text-[11px] text-gray-300">
                  All conversations are monitored for safety.
                </div>
              </>
            )}
          </>
        )}

        {/* ── Archived tab (§15 #6: ArchivedConversationScreenState) ────────── */}
        {!isLoading && activeTab === "archived" && (
          <>
            {archivedConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-5 border border-gray-100">
                  <Archive className="w-9 h-9 text-gray-200" />
                </div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1.5">No archived conversations</h2>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                  Completed and cancelled booking conversations will be archived here.
                </p>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 flex items-center gap-2 border-b border-gray-50">
                  <Archive className="w-3.5 h-3.5 text-gray-300" />
                  <span className="text-[11px] text-gray-400">Archived conversations are read-only.</span>
                </div>
                {archivedConversations.map(conv => (
                  <ArchivedConversation key={conv.conversationId} conv={conv} uid={user?.uid ?? ""} />
                ))}
                <div className="px-5 py-6 text-center text-[11px] text-gray-300">
                  {archivedConversations.length} archived conversation{archivedConversations.length !== 1 ? "s" : ""}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
