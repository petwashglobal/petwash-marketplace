import { useQuery } from "@tanstack/react-query";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import type { BookingConversation } from "@shared/schema";
import { 
  MessageSquare, 
  Lock, 
  CheckCheck, 
  ChevronRight,
  Dog,
  Cat,
  PawPrint
} from "lucide-react";

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  walk_my_pet: { label: "Dog Walker", color: "#4F7942" },
  sitter_suite: { label: "Pet Sitter", color: "#7B5EA7" },
  petwash: { label: "PetWash", color: "#0B57D0" },
  academy: { label: "Academy", color: "#B45309" },
};

function PlatformBadge({ platform }: { platform: string }) {
  const info = PLATFORM_LABELS[platform] ?? { label: platform.replace(/_/g, " "), color: "#6B7280" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border"
      style={{ color: info.color, borderColor: info.color + "33", background: info.color + "0D" }}
    >
      {info.label}
    </span>
  );
}

function UnreadPill({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold text-white"
      style={{ background: "linear-gradient(135deg, #0B57D0, #4E8DF7)", boxShadow: "0 1px 6px rgba(11,87,208,0.35)" }}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function AvatarIcon({ platform, size = 48 }: { platform: string; size?: number }) {
  const Icon = platform === "walk_my_pet" ? Dog : platform === "sitter_suite" ? Cat : PawPrint;
  const info = PLATFORM_LABELS[platform] ?? { color: "#6B7280" };
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size, height: size,
        background: info.color + "12",
        border: `1.5px solid ${info.color}22`,
      }}
    >
      <Icon size={size * 0.45} style={{ color: info.color }} />
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

export default function BookingChatInbox() {
  const { user } = useFirebaseAuth();

  const { data: conversations, isLoading } = useQuery<BookingConversation[]>({
    queryKey: ["/api/booking-chat/inbox"],
    refetchInterval: 30000,
    enabled: !!user,
  });

  const totalUnread = conversations?.reduce((sum, c) => {
    return sum + (user?.uid === c.customerId ? (c.customerUnread ?? 0) : (c.providerUnread ?? 0));
  }, 0) ?? 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 pt-6 pb-4"
        style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}>
        <div className="max-w-2xl mx-auto flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Messages</h1>
            {totalUnread > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{totalUnread} unread</p>
            )}
          </div>
          <MessageSquare className="w-5 h-5 text-gray-300 mb-0.5" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Loading */}
        {isLoading && (
          <div>
            {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!conversations || conversations.length === 0) && (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-5"
              style={{ border: "1.5px solid #E5E7EB" }}>
              <MessageSquare className="w-9 h-9 text-gray-200" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1.5">No conversations yet</h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
              Your booking conversations will appear here once a booking is confirmed.
            </p>
          </div>
        )}

        {/* Conversation list */}
        {!isLoading && conversations && conversations.length > 0 && (
          <div>
            {conversations.map((conv) => {
              const isCustomer = user?.uid === conv.customerId;
              const unreadCount = isCustomer ? (conv.customerUnread ?? 0) : (conv.providerUnread ?? 0);
              const isActive = conv.chatStatus === "active";
              const partyLabel = isCustomer ? "Service Provider" : "Customer";
              const lastTime = conv.lastMessageAt
                ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
                : null;

              return (
                <Link key={conv.conversationId} href={`/booking-chat/${conv.bookingId}`}>
                  <div
                    className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 cursor-pointer transition-colors duration-150 hover:bg-gray-50/70 active:bg-gray-100/60"
                    style={{ position: "relative" }}
                  >
                    {/* Unread left bar */}
                    {unreadCount > 0 && (
                      <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full"
                        style={{ background: "linear-gradient(180deg, #0B57D0, #4E8DF7)" }} />
                    )}

                    <AvatarIcon platform={conv.platform} size={48} />

                    <div className="flex-1 min-w-0">
                      {/* Row 1: name + timestamp */}
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm truncate ${unreadCount > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>
                          {partyLabel}
                        </span>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap ml-2">
                          {lastTime ?? ""}
                        </span>
                      </div>

                      {/* Row 2: last message preview */}
                      <p className={`text-sm truncate mb-1.5 ${unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                        {conv.lastSenderRole === "system"
                          ? <span className="italic">{conv.lastMessagePreview || "No messages yet"}</span>
                          : conv.lastMessagePreview || "No messages yet"
                        }
                      </p>

                      {/* Row 3: badges */}
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={conv.platform} />

                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                            <Lock className="w-2.5 h-2.5" />
                            Closed
                          </span>
                        )}

                        <span className="text-[10px] text-gray-300 font-mono">
                          #{conv.bookingId.slice(-6).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Right: unread pill + chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <UnreadPill count={unreadCount} />
                      {unreadCount === 0 && conv.lastSenderRole !== undefined && (
                        <CheckCheck className="w-3.5 h-3.5 text-gray-200" />
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-200" />
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Footer note */}
            <div className="px-5 py-6 text-center text-[11px] text-gray-300">
              All conversations are end-to-end monitored for safety.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
