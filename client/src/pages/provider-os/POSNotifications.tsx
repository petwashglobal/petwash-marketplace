import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Briefcase, CreditCard, FileText, Settings,
  CheckCheck, Trash2, ChevronRight, Loader2,
} from 'lucide-react';

type NotifType = 'job' | 'payment' | 'document' | 'system' | 'chat';

interface ApiNotification {
  id: number;
  templateKey: string;
  channel: string;
  title: string | null;
  body: string | null;
  isRead: boolean;
  createdAt: string;
  deepLink: string | null;
  eventType: string | null;
}

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  action?: string;
  deepLink?: string | null;
}

const TYPE_STYLES: Record<NotifType, { icon: React.ComponentType<any>; color: string; bg: string }> = {
  job: { icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50' },
  payment: { icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50' },
  document: { icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  system: { icon: Settings, color: 'text-blue-600', bg: 'bg-blue-50' },
  chat: { icon: Bell, color: 'text-teal-600', bg: 'bg-teal-50' },
};

function eventTypeToNotifType(eventType: string | null, templateKey: string): NotifType {
  const key = (eventType || templateKey || '').toLowerCase();
  if (key.includes('booking') || key.includes('job') || key.includes('review')) return 'job';
  if (key.includes('payment') || key.includes('payout') || key.includes('wallet') || key.includes('egift')) return 'payment';
  if (key.includes('document') || key.includes('kyc') || key.includes('kyb') || key.includes('compliance')) return 'document';
  if (key.includes('chat') || key.includes('message')) return 'chat';
  return 'system';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function toNotification(n: ApiNotification): Notification {
  return {
    id: String(n.id),
    type: eventTypeToNotifType(n.eventType, n.templateKey),
    title: n.title || n.templateKey,
    body: n.body || '',
    time: n.createdAt ? relativeTime(n.createdAt) : '',
    read: n.isRead,
    deepLink: n.deepLink,
  };
}

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'job', label: 'Jobs' },
  { id: 'payment', label: 'Payments' },
  { id: 'document', label: 'Documents' },
  { id: 'system', label: 'System' },
];

export default function POSNotifications() {
  const [activeTab, setActiveTab] = useState('all');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ notifications: ApiNotification[] }>({
    queryKey: ['/api/notifications'],
    queryFn: () => fetch('/api/notifications', { credentials: 'include' }).then(r => r.json()),
    staleTime: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/notifications/${id}/read`, { method: 'POST', credentials: 'include' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const notifications: Notification[] = (data?.notifications || []).map(toNotification);

  const filtered = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.read;
    return n.type === activeTab;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (id: string) => {
    if (!notifications.find(n => n.id === id)?.read) {
      markReadMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</span>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 text-xs text-amber-600 font-medium hover:text-amber-700 transition-colors">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1.5 min-w-max pb-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-white'
              }`}>
              {tab.label}
              {tab.id === 'unread' && unreadCount > 0 && (
                <span className="ms-1.5 bg-white/30 rounded-full px-1 text-[10px]">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No notifications here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(notif => {
            const style = TYPE_STYLES[notif.type];
            const Icon = style.icon;
            return (
              <div
                key={notif.id}
                className={`bg-white border rounded-xl p-4 transition-colors cursor-pointer ${!notif.read ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}
                onClick={() => markRead(notif.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 ${style.bg} rounded-xl flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${style.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {!notif.read && <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0" />}
                        <p className={`text-sm font-medium ${!notif.read ? 'text-gray-900' : 'text-gray-700'}`}>{notif.title}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{notif.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-gray-400">{notif.time}</span>
                      {notif.deepLink && (
                        <a href={notif.deepLink} onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5 hover:text-amber-700 transition-colors">
                          View <ChevronRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
