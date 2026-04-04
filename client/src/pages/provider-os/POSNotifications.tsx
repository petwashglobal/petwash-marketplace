import { useState } from 'react';
import {
  Bell, Briefcase, CreditCard, FileText, Settings,
  CheckCheck, Trash2, Check, ChevronRight, Info,
} from 'lucide-react';

type NotifType = 'job' | 'payment' | 'document' | 'system' | 'chat';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  action?: string;
}

const TYPE_STYLES: Record<NotifType, { icon: React.ComponentType<any>; color: string; bg: string }> = {
  job: { icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50' },
  payment: { icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50' },
  document: { icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  system: { icon: Settings, color: 'text-blue-600', bg: 'bg-blue-50' },
  chat: { icon: Bell, color: 'text-teal-600', bg: 'bg-teal-50' },
};

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'job', title: 'New booking request', body: 'Yael Cohen wants to book a PetSitter for Max (Golden Retriever) on March 15.', time: '2 min ago', read: false, action: 'View Request' },
  { id: '2', type: 'payment', title: 'Payment released', body: '₪87.50 from booking #PW-2847 has been released to your available balance.', time: '1 hour ago', read: false, action: 'View Wallet' },
  { id: '3', type: 'document', title: 'Document expires soon', body: 'Your Insurance Certificate expires in 14 days. Upload a renewed copy to stay active.', time: '3 hours ago', read: false, action: 'Upload Now' },
  { id: '4', type: 'job', title: 'Job confirmed', body: 'Your booking with David Levi for Walk My Pet on March 12 has been confirmed.', time: 'Yesterday', read: true },
  { id: '5', type: 'system', title: 'Profile verification approved', body: 'Your identity has been verified. Your "Verified Provider" badge is now active.', time: 'Yesterday', read: true },
  { id: '6', type: 'payment', title: 'Payout processing', body: 'Your payout request of ₪320.00 is being processed. Expected: 3 business days.', time: '2 days ago', read: true },
  { id: '7', type: 'job', title: 'Client left a review', body: 'Sarah K. left a 5-star review: "Amazing care for our Labrador! Highly recommend."', time: '3 days ago', read: true },
  { id: '8', type: 'chat', title: 'Message from Orna M.', body: 'Hi! Can I check if you\'re available for an extra session next week?', time: '3 days ago', read: true },
];

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'job', label: 'Jobs' },
  { id: 'payment', label: 'Payments' },
  { id: 'document', label: 'Documents' },
  { id: 'system', label: 'System' },
];

export default function POSNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState('all');

  const filtered = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.read;
    return n.type === activeTab;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const deleteNotif = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
            <button onClick={markAllRead}
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
      {filtered.length === 0 ? (
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
                className={`bg-white border rounded-xl p-4 transition-colors ${!notif.read ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}
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
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }}
                        className="p-1 text-gray-300 hover:text-gray-500 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{notif.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-gray-400">{notif.time}</span>
                      {notif.action && (
                        <button className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5 hover:text-amber-700 transition-colors">
                          {notif.action} <ChevronRight className="w-3 h-3" />
                        </button>
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
