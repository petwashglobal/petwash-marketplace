/**
 * PetWashInbox — the ONE luxury inbox (replaces the Replit-era sprawl of 8 surfaces).
 *
 * Three tabs, all on backends that already exist:
 *  • Messages  → 1:1 in-platform chat with providers (booking-chat, Postgres). Airbnb/Uber
 *                model: you reply inside PetWash, your phone number is never shared.
 *  • Alerts    → vouchers / receipts / system messages (userInbox, /api/inbox/user).
 *  • Concierge → the Kenzo AI assistant (opens the global widget).
 *
 * Brand: pure white, emerald accents (#D9B84C/#B8860B/#F4D77A), gold only for Prestige.
 * Layout is intentionally DENSE — compact rows, 13–14px text, minimal padding, no dead space.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { formatDistanceToNow } from 'date-fns';
import type { BookingConversation } from '@shared/schema';

/** Smart inbox row decoration from GET /api/inbox/v2/threads. */
interface SmartThread {
  threadId: string;
  threadType: string;
  bookingId: string | null;
  badge: string;
  badgeLabel: { en: string; he: string };
  action: string;
  actionLabel: { en: string; he: string };
}
// Badge colour by intent — luxury palette (green=good, gold=needs action, red=alert).
const BADGE_STYLE: Record<string, { bg: string; fg: string }> = {
  WAITING_FOR_PROVIDER: { bg: '#FBF3DC', fg: '#8a6a12' },
  PROVIDER_ACCEPTED: { bg: '#E6F3EE', fg: '#1f7a52' },
  PAYMENT_REQUIRED: { bg: '#FBF3DC', fg: '#8a6a12' },
  BOOKING_CONFIRMED: { bg: '#E6F3EE', fg: '#1f7a52' },
  STARTS_SOON: { bg: '#FBF3DC', fg: '#8a6a12' },
  ACTIVE_NOW: { bg: '#E6F3EE', fg: '#1f7a52' },
  COMPLETED: { bg: '#EEF1F4', fg: '#475569' },
  CANCELLED: { bg: '#FBEAEA', fg: '#b42318' },
  INCIDENT_OPEN: { bg: '#FBEAEA', fg: '#b42318' },
  SUPPORT_WAITING: { bg: '#FBF3DC', fg: '#8a6a12' },
  ARCHIVED: { bg: '#EEF1F4', fg: '#475569' },
  OPEN: { bg: '#EEF1F4', fg: '#475569' },
};
import {
  Bell, Lock, Sparkles, ChevronRight, Dog, Cat, PawPrint, GraduationCap,
  Gift, Receipt, Megaphone, Inbox as InboxIcon, MessageSquare,
} from 'lucide-react';

const EMERALD = '#D9B84C';
const EMERALD_DEEP = '#B8860B';
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

// Strip HTML tags to a plain-text preview. Loops to a fixed point so a single pass
// can't leave a tag behind on nested/obfuscated input (e.g. "<scr<script>ipt>") —
// fixes CodeQL js/incomplete-multi-character-sanitization.
function stripTags(s: string): string {
  let prev: string;
  let out = s;
  do { prev = out; out = out.replace(/<[^>]*>/g, ''); } while (out !== prev);
  return out;
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

  // Smart inbox feed (Communication Hub): per-thread status badge + next action.
  // Fail-safe + additive — empty until migration 0084 makes chat_threads live, so
  // rows just render as before until then.
  const { language } = useLanguage();
  const he = language === 'he';
  const { data: smartData } = useQuery<{ ok: boolean; threads: SmartThread[] }>({
    queryKey: ['/api/inbox/v2/threads'],
    enabled: !!user,
    refetchInterval: 30000,
  });
  const smartByBooking = new Map<string, SmartThread>();
  (smartData?.threads ?? []).forEach(t => { if (t.bookingId) smartByBooking.set(t.bookingId, t); });

  const active = conversations.filter(c => c.chatStatus === 'active');
  const archived = conversations.filter(c => c.chatStatus === 'archived');
  const unreadMsgs = active.reduce((s, c) => s + (user?.uid === c.customerId ? (c.customerUnread ?? 0) : (c.providerUnread ?? 0)), 0);
  const unreadAlerts = alerts.filter(a => !a.readAt).length;

  // Category tabs (spec): organise the inbox. Bookings is the live data today;
  // Support fills in as the hub's SUPPORT threads come online. Archived stays
  // readable (never deleted) per the spec.
  const [cat, setCat] = useState<'all' | 'bookings' | 'support' | 'archived'>('all');
  const CATS = [
    { id: 'all' as const,       label: he ? 'הכול' : 'All',        list: active },
    { id: 'bookings' as const,  label: he ? 'הזמנות' : 'Bookings', list: active },
    { id: 'support' as const,   label: he ? 'תמיכה' : 'Support',   list: [] as typeof active },
    { id: 'archived' as const,  label: he ? 'ארכיון' : 'Archived', list: archived },
  ];
  const shown = CATS.find(x => x.id === cat)?.list ?? active;

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

          {/* Category filter — only under Messages */}
          {tab === 'messages' && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {CATS.map(x => {
                const on = cat === x.id;
                return (
                  <button key={x.id} onClick={() => setCat(x.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] whitespace-nowrap shrink-0 transition-colors"
                    style={on ? { background: EMERALD_DEEP, color: '#fff' } : { background: '#F3F4F6', color: '#4b5563' }}>
                    {x.label}{x.list.length > 0 && <span style={{ opacity: 0.7 }}>· {x.list.length}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* MESSAGES */}
        {tab === 'messages' && (
          <div>
            {msgLoading ? (
              <div className="px-4 py-6 text-[13px] text-gray-400">Loading…</div>
            ) : shown.length === 0 ? (
              <EmptyState Icon={MessageSquare}
                title={cat === 'archived' ? (he ? 'אין שיחות בארכיון' : 'No archived chats')
                  : cat === 'support' ? (he ? 'אין שיחות תמיכה' : 'No support chats')
                  : (he ? 'אין הודעות עדיין' : 'No messages yet')}
                sub={cat === 'support'
                  ? (he ? 'שיחות תמיכה ואירועים יופיעו כאן.' : 'Support and incident chats appear here.')
                  : (he ? 'כשתזמינו טיפול, הצ׳אט יופיע כאן.' : 'When you book a walker, sitter or groomer, your chat appears here.')} />
            ) : (
              shown.map(c => {
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
                        {(() => {
                          const smart = c.bookingId ? smartByBooking.get(String(c.bookingId)) : undefined;
                          if (!smart) return null;
                          const bs = BADGE_STYLE[smart.badge] ?? BADGE_STYLE.OPEN;
                          return (
                            <div className="flex items-center justify-between gap-2 mt-1.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
                                style={{ background: bs.bg, color: bs.fg }}>
                                {he ? smart.badgeLabel.he : smart.badgeLabel.en}
                              </span>
                              {smart.action !== 'OPEN_CHAT' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-semibold shrink-0"
                                  style={{ background: EMERALD, color: '#fff' }}>
                                  {he ? smart.actionLabel.he : smart.actionLabel.en}
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#F4D77A' }}>
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
                const body = stripTags(a.bodyHtml || '').slice(0, 90);
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
