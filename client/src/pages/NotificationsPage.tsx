import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Bell, BellOff, Check, CheckCheck, ArrowLeft, Calendar, Package, User, CreditCard, Star, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface InAppNotification {
  id: number;
  templateKey: string;
  eventType: string | null;
  title: string | null;
  body: string | null;
  deepLink: string | null;
  bookingId: string | null;
  isRead: boolean;
  createdAt: string;
}

function getNotificationIcon(eventType: string | null) {
  if (!eventType) return <Bell className="w-5 h-5 text-gray-400" />;
  if (eventType.includes("booking")) return <Calendar className="w-5 h-5 text-blue-500" />;
  if (eventType.includes("payout") || eventType.includes("settlement")) return <CreditCard className="w-5 h-5 text-green-500" />;
  if (eventType.includes("provider")) return <User className="w-5 h-5 text-purple-500" />;
  if (eventType.includes("loyalty") || eventType.includes("tier")) return <Star className="w-5 h-5 text-yellow-500" />;
  if (eventType.includes("wash") || eventType.includes("k9000")) return <Zap className="w-5 h-5 text-orange-500" />;
  if (eventType.includes("inventory") || eventType.includes("incident")) return <Package className="w-5 h-5 text-red-500" />;
  return <Bell className="w-5 h-5 text-gray-400" />;
}

function groupNotificationsByDate(notifications: InAppNotification[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: InAppNotification[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) {
      groups[0].items.push(n);
    } else if (d.getTime() === yesterday.getTime()) {
      groups[1].items.push(n);
    } else {
      groups[2].items.push(n);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

export default function NotificationsPage() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ notifications: InAppNotification[] }>({
    queryKey: ["/api/notifications"],
  });

  const markReadMutation = useMutation({
    mutationFn: (logId: number) =>
      apiRequest("POST", `/api/notifications/${logId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const groups = groupNotificationsByDate(notifications);

  function handleItemClick(n: InAppNotification) {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
    if (n.deepLink) {
      navigate(n.deepLink);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {unreadCount} unread
                </p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="text-blue-600 hover:text-blue-700 gap-1"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 flex gap-3 shadow-sm">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <BellOff className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
              You're all caught up
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No notifications yet. We'll let you know when something happens.
            </p>
          </div>
        )}

        {/* Grouped notifications */}
        {!isLoading && groups.map((group) => (
          <div key={group.label} className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1">
              {group.label}
            </h2>
            <div className="space-y-2">
              {group.items.map((n) => (
                <div
                  key={n.id}
                  className={`
                    relative bg-white dark:bg-gray-800 rounded-xl px-4 py-3 shadow-sm flex gap-3 cursor-pointer
                    transition-all hover:shadow-md
                    ${!n.isRead ? "border-l-4 border-blue-500" : "border-l-4 border-transparent"}
                  `}
                  onClick={() => handleItemClick(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleItemClick(n)}
                >
                  {/* Icon */}
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                    ${!n.isRead ? "bg-blue-50 dark:bg-blue-900/30" : "bg-gray-100 dark:bg-gray-700"}
                  `}>
                    {getNotificationIcon(n.eventType)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-gray-900 dark:text-white" : "font-medium text-gray-700 dark:text-gray-300"}`}>
                        {n.title || n.templateKey}
                      </p>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    {n.deepLink && (
                      <span className="text-xs text-blue-500 mt-1 inline-block">View →</span>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!n.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full absolute top-4 right-4 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
