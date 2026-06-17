/**
 * PetWashInbox — the ONE luxury inbox (replaces the Replit-era sprawl of 8 surfaces).
 *
 * Three tabs, all on backends that already exist:
 *  • Messages  → 1:1 in-platform chat with providers (booking-chat, Postgres). Airbnb/Uber
 *                model: you reply inside PetWash, your phone number is never shared.
 *  • Alerts    → vouchers / receipts / system messages (userInbox, /api/inbox/user).
 *  • Concierge → the Kenzo AI assistant (opens the global widget).
 *
 * Brand: pure white, emerald accents (#12936A/#0C5B3F/#36C98F), gold only for Prestige.
 * Layout is intentionally DENSE — compact rows, 13–14px text, minimal padding, no dead space.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { formatDistanceToNow } from 'date-fns';
import type { BookingConversation } from '@shared/schema';
import {
  Bell, Lock, Sparkles, ChevronRight, Dog, Cat, PawPrint, GraduationCap,
  Gift, Receipt, Megaphone, Inbox as InboxIcon, MessageSquare,
} from 'lucide-react';

const EMERALD = '#12936A';
const EMERALD_DEEP = '#0C5B3F';
const EMERALD_TINT = '#E6F3EE';
const GOLD = '#8a6a12';
const GOLD_TINT = '#FBF3DC';

type Tab = 'messages' | 'concierge' | 'alerts';

const PLATFORM: Record<string, { label: string; Icon: any }> = {
  walk_my_pet:  { label: 'Dog walker', Icon: Dog },
  sitter_suite: { label: 'Pet sitter', Icon: Cat },
  petwash:      { label: 'PetWash',    Icon: PawPrint },
  academy:      { label: 'Academy',    Icon: GraduationCap },
};

const ALERT_ICON: Record<string, any> = {
  voucher: Gift, receipt: Receipt, promo: Megaphone, system: Bell,
};

function rel(d?: string | Date | null): string {
  if (!d) return '';
  try { return formatDistanceToNow(new Date(d), { addSuffix: false }); } catch { return ''; }
}

interface InboxAlert {
  id: string; title: string; bodyHtml?: string; type?: string;
  createdAt?: string; readAt?: string | null; ctaUrl?: string;
}

export default function PetWashInbox() {
  const { user } = useFirebaseAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>('messages');

  const { data: conversations = [], isLoading: msgLoading } = useQuery<BookingConversation[]>({
    queryKey: ['/api/booking-chat/inbox'],
    refetchInterval: 30000,
    enabled: !!user,
  });
  const { data: alertData, isLoading: alertLoading } = useQuery<{ messages: InboxAlert[] }>({
    queryKey: ['/api/inbox/user'],
    enabled: !!user,
  });
  const alerts = alertData?.messages ?? [];

  const active = conversations.filter(c => c.chatStatus === 'active');
  const unreadMsgs = active.reduce((s, c) => s + (user?.uid === c.customerId ? (c.customerUnread ?? 0) : (c.providerUnread ?? 0)), 0);
  const unreadAlerts = alerts.filter(a => !a.readAt).length;

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'messages',  label: 'Messages',  badge: unreadMsgs },
    { id: 'concierge', label: 'Concierge' },
    { id: 'alerts',    label: 'Alerts',    badge: unreadAlerts },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto">

        {/* Header — compact */}
        <div className="sticky top-0 z-10 bg-white px-4 pt-3 pb-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-medium text-gray-900 leading-none">Inbox</h1>
            <Bell className="w-[18px] h-[18px] text-gray-400" />
          </div>
          {/* Segmented tabs */}
          <div className="flex gap-1.5 mt-2.5">
            {TABS.map(t => {
              const on = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[13px] transition-colors"
                  style={on ? { background: EMERALD, color: '#fff', fontWeight: 500 } : { background: EMERALD_TINT, color: EMERALD_DEEP }}>
                  {t.label}
                  {!!t.badge && t.badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold"
                      style={on ? { background: '#fff', color: EMERALD_DEEP } : { background: EMERALD, color: '#fff' }}>
                      {t.badge > 99 ? '99+' : t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* MESSAGES */}
        {tab === 'messages' && (
          <div>
            {msgLoading ? (
              <div className="px-4 py-6 text-[13px] text-gray-400">Loading…</div>
            ) : active.length === 0 ? (
              <EmptyState Icon={MessageSquare} title="No messages yet"
                sub="When you book a walker, sitter or groomer, your chat appears here." />
            ) : (
              active.map(c => {
                const cfg = PLATFORM[c.platform] ?? { label: (c.platform || '').replace(/_/g, ' '), Icon: PawPrint };
                const Icon = cfg.Icon;
                const unread = user?.uid === c.customerId ? (c.customerUnread ?? 0) : (c.providerUnread ?? 0);
                const preview = (c as any).lastMessagePreview as string | undefined;
                return (
                  <Link key={c.conversationId} href={`/booking-chat/${c.bookingId}`}>
                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 active:bg-gray-50 cursor-pointer">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: EMERALD_TINT }}>
                        <Icon className="w-[18px] h-[18px]" style={{ color: EMERALD_DEEP }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[14px] font-medium text-gray-900 truncate">{cfg.label}</span>
                          <span className="text-[11px] text-gray-400 shrink-0">{rel(c.lastMessageAt as any)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12.5px] text-gray-500 truncate">{preview || 'Tap to open conversation'}</span>
                          {unread > 0 && <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: EMERALD }} />}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* CONCIERGE */}
        {tab === 'concierge' && (
          <div className="px-4 py-4">
            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: EMERALD_DEEP }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#36C98F' }}>
                <Sparkles className="w-5 h-5" style={{ color: '#06372a' }} />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-white">PetWash Concierge</div>
                <div className="text-[12px]" style={{ color: '#CDE9DD' }}>Ask about washes, bookings or your pet</div>
              </div>
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('petwash:open-concierge'))}
              className="w-full mt-3 py-2.5 rounded-full text-[14px] font-medium text-white"
              style={{ background: EMERALD }}>
              Ask the Concierge
            </button>
            <p className="text-[12px] text-gray-400 mt-3 leading-snug">
              The Concierge is an AI assistant. For a person, use Messages to reach your provider.
            </p>
          </div>
        )}

        {/* ALERTS */}
        {tab === 'alerts' && (
          <div>
            {alertLoading ? (
              <div className="px-4 py-6 text-[13px] text-gray-400">Loading…</div>
            ) : alerts.length === 0 ? (
              <EmptyState Icon={InboxIcon} title="No alerts" sub="Vouchers, receipts and updates land here." />
            ) : (
              alerts.map(a => {
                const Icon = ALERT_ICON[a.type || 'system'] ?? Bell;
                const isVoucher = a.type === 'voucher';
                const body = (a.bodyHtml || '').replace(/<[^>]+>/g, '').slice(0, 90);
                const row = (
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 active:bg-gray-50">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: isVoucher ? GOLD_TINT : EMERALD_TINT }}>
                      <Icon className="w-[18px] h-[18px]" style={{ color: isVoucher ? GOLD : EMERALD_DEEP }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[14px] font-medium text-gray-900 truncate">{a.title}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">{rel(a.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] text-gray-500 truncate">{body || 'Open to view'}</span>
                        {!a.readAt && <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: EMERALD }} />}
                      </div>
                    </div>
                  </div>
                );
                return a.ctaUrl
                  ? <div key={a.id} onClick={() => navigate(a.ctaUrl!)} className="cursor-pointer">{row}</div>
                  : <div key={a.id}>{row}</div>;
              })
            )}
          </div>
        )}

        {/* Trust footer — Airbnb/Uber style */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 mt-1">
          <Lock className="w-[15px] h-[15px]" style={{ color: EMERALD }} />
          <span className="text-[11.5px] text-gray-500">Chat stays inside PetWash — your phone number is never shared</span>
        </div>

      </div>
    </div>
  );
}

function EmptyState({ Icon, title, sub }: { Icon: any; title: string; sub: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-gray-300" />
      </div>
      <p className="text-[15px] font-medium text-gray-800">{title}</p>
      <p className="text-[12.5px] text-gray-400 mt-1 max-w-[260px] mx-auto leading-snug">{sub}</p>
    </div>
  );
}
