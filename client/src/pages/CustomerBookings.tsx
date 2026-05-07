import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Link, useLocation } from 'wouter';
import {
  SlidersHorizontal, X, CalendarDays, PawPrint,
  ChevronLeft, ChevronRight, RefreshCw, HandshakeIcon,
  XCircle, AlertTriangle, Banknote, Clock, ChevronDown, ChevronUp,
  CheckCircle2, CircleDot, Ban, Star, Timer, Hourglass,
  Loader2, MessageSquare, MapPin, Coins,
} from 'lucide-react';
import { WalletLifecycleMessage, resolveWalletAmountCents } from '@/components/wallet/WalletLifecycleMessage';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { NotificationBell } from '@/components/NotificationCenterPanel';

const GOLD = '#C5A55A';

const TABS = [
  { id: 'pending',  labelHe: 'ממתין',   labelEn: 'Pending'  },
  { id: 'upcoming', labelHe: 'קרוב',    labelEn: 'Upcoming' },
  { id: 'past',     labelHe: 'עבר',     labelEn: 'Past'     },
  { id: 'archived', labelHe: 'ארכיון',  labelEn: 'Archived' },
] as const;

type TabId = typeof TABS[number]['id'];

const STATUS_TO_TAB: Record<string, TabId> = {
  pending:     'pending',
  accepted:    'upcoming',
  confirmed:   'upcoming',
  in_progress: 'upcoming',
  meet_greet_scheduled: 'upcoming',
  meet_greet_completed: 'upcoming',
  payment_pending: 'upcoming',
  completed:   'past',
  reviewed:    'past',
  declined:    'archived',
  cancelled:   'archived',
  disputed:    'archived',
};

const CANCELLABLE_STATUSES = new Set([
  'pending', 'accepted', 'confirmed', 'meet_greet_scheduled', 'meet_greet_completed',
]);

const SERVICE_TYPES = [
  { id: 'all',          labelHe: 'הכל',             labelEn: 'All',          emoji: '🐾' },
  { id: 'k9000_wash',   labelHe: 'שטיפה K9000',     labelEn: 'K9000 Wash',   emoji: '🚿' },
  { id: 'pet_sitting',  labelHe: 'ישיבה לחיות',     labelEn: 'Pet Sitting',  emoji: '🏠' },
  { id: 'dog_walking',  labelHe: 'הליכה עם כלב',    labelEn: 'Dog Walking',  emoji: '🦮' },
  { id: 'grooming',     labelHe: 'טיפוח',           labelEn: 'Grooming',     emoji: '✂️' },
  { id: 'pet_taxi',     labelHe: 'הסעות',           labelEn: 'Pet Taxi',     emoji: '🚗' },
  { id: 'daycare',      labelHe: 'פעוטון',          labelEn: 'Daycare',      emoji: '🏫' },
  { id: 'training',     labelHe: 'אימון',           labelEn: 'Training',     emoji: '🎓' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:               { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  accepted:              { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  confirmed:             { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  meet_greet_scheduled:  { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' },
  meet_greet_completed:  { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' },
  payment_pending:       { bg: '#FEF9C3', text: '#854D0E', border: '#FEF08A' },
  in_progress:           { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
  completed:             { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  reviewed:              { bg: '#CCFBF1', text: '#0F766E', border: '#99F6E4' },
  declined:              { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  cancelled:             { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  disputed:              { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' },
};

const STATUS_ICONS: Record<string, any> = {
  pending:              Hourglass,
  accepted:             CheckCircle2,
  confirmed:            CheckCircle2,
  meet_greet_scheduled: HandshakeIcon,
  meet_greet_completed: HandshakeIcon,
  payment_pending:      Banknote,
  in_progress:          Timer,
  completed:            CheckCircle2,
  reviewed:             Star,
  declined:             XCircle,
  cancelled:            Ban,
  disputed:             AlertTriangle,
};

const STATUS_LABELS: Record<string, { he: string; en: string }> = {
  pending:              { he: 'ממתין',           en: 'Pending'             },
  accepted:             { he: 'אושר',            en: 'Accepted'            },
  confirmed:            { he: 'מאושר',           en: 'Confirmed'           },
  meet_greet_scheduled: { he: 'פגישה מתוכננת',  en: 'Meet & Greet'        },
  meet_greet_completed: { he: 'פגישה הושלמה',   en: 'Meet & Greet done'   },
  payment_pending:      { he: 'ממתין לתשלום',   en: 'Awaiting payment'    },
  in_progress:          { he: 'בתהליך',         en: 'In Progress'         },
  completed:            { he: 'הושלם',           en: 'Completed'           },
  reviewed:             { he: 'עם ביקורת',       en: 'Reviewed'            },
  declined:             { he: 'נדחה',            en: 'Declined'            },
  cancelled:            { he: 'בוטל',            en: 'Cancelled'           },
  disputed:             { he: 'במחלוקת',         en: 'Disputed'            },
};

const SERVICE_TO_ROUTE: Record<string, string> = {
  k9000_wash:  '/k9000',
  pet_sitting: '/sitter-suite',
  dog_walking: '/walk-my-pet',
  grooming:    '/groomers',
  pet_taxi:    '/pettrek',
  daycare:     '/sitter-suite',
  training:    '/marketplace',
};

interface Booking {
  requestId: string;
  status: string;
  serviceType: string;
  startDate: string;
  endDate: string;
  petCount: number;
  subtotalCents?: number;
  serviceFeeCents?: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  providerId?: string;
  providerName?: string | null;
  meetGreetDate?: string | null;
  meetGreetLocation?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: string | null;
  refundCents?: number;
  loyaltyRedeemedCents?: number;
  ownerMessage?: string | null;
  statusHistory?: Array<{ status: string; timestamp: string; note?: string }>;
  petIds?: string[];
  addonCodes?: string[];
  financeState?: string;
  walletHoldCents?: number;
  walletDebitedCents?: number;
  walletRefundedCents?: number;
  // Issue #153 priority 4 (OPT-A): tag a booking's source so the UI can
  // render a small badge ("Marketplace") and avoid sending invalid
  // booking_requests-only mutations to marketplace rows.
  kind?: 'request' | 'marketplace';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcNights(start: string, end: string): number {
  try {
    const s = new Date(start).setHours(0, 0, 0, 0);
    const e = new Date(end).setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((e - s) / 86400000));
  } catch { return 0; }
}

function daysUntil(dateStr: string): number {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  } catch { return 0; }
}

function formatDateShort(d: string | null | undefined, locale: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function formatDateFull(d: string | null | undefined, locale: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Timeline ───────────────────────────────────────────────────────────────────

const TIMELINE_STEPS: Array<{ statuses: string[]; labelHe: string; labelEn: string }> = [
  { statuses: ['pending'],                                    labelHe: 'בקשה נשלחה',      labelEn: 'Request sent'       },
  { statuses: ['accepted', 'meet_greet_scheduled',
               'meet_greet_completed', 'payment_pending'],   labelHe: 'ספק הגיב',         labelEn: 'Provider responded' },
  { statuses: ['confirmed'],                                  labelHe: 'הזמנה אושרה',      labelEn: 'Confirmed'          },
  { statuses: ['in_progress'],                                labelHe: 'השירות החל',       labelEn: 'Service started'    },
  { statuses: ['completed', 'reviewed'],                      labelHe: 'הושלם',            labelEn: 'Completed'          },
];

const TERMINAL_NODES: Record<string, { labelHe: string; labelEn: string; icon: any; color: string }> = {
  cancelled: { labelHe: 'בוטל',    labelEn: 'Cancelled', icon: Ban,          color: '#EF4444' },
  declined:  { labelHe: 'נדחה',    labelEn: 'Declined',  icon: XCircle,      color: '#EF4444' },
  disputed:  { labelHe: 'במחלוקת', labelEn: 'Disputed',  icon: AlertTriangle, color: '#F97316' },
};

function StatusTimeline({ booking, isRTL }: { booking: Booking; isRTL: boolean }) {
  const history = booking.statusHistory ?? [];
  const currentStatus = booking.status;
  const isTerminal = currentStatus in TERMINAL_NODES;
  const locale = isRTL ? 'he-IL' : 'en-AU';

  const formatTs = (ts: string) => {
    try {
      return new Date(ts).toLocaleDateString(locale, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  const stepReached = (stepStatuses: string[]) => {
    const order = [
      'pending', 'accepted', 'meet_greet_scheduled', 'meet_greet_completed',
      'payment_pending', 'confirmed', 'in_progress', 'completed', 'reviewed',
    ];
    const idx = order.indexOf(currentStatus);
    return stepStatuses.some(s => {
      const si = order.indexOf(s);
      return si !== -1 && idx >= si;
    }) || history.some(h => stepStatuses.includes(h.status));
  };

  const getTs = (stepStatuses: string[]) => {
    const entry = history.find(h => stepStatuses.includes(h.status));
    return entry?.timestamp ? formatTs(entry.timestamp) : null;
  };

  const terminalInfo = isTerminal ? TERMINAL_NODES[currentStatus] : null;
  const terminalTs = history.find(h => h.status === currentStatus)?.timestamp;

  return (
    <div className={`mt-3 pt-3 border-t border-gray-100 ${isRTL ? 'pr-1' : 'pl-1'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
        {isRTL ? 'ציר זמן הזמנה' : 'Booking Timeline'}
      </p>
      <div className="space-y-0">
        {TIMELINE_STEPS.map((step, i) => {
          const reached = stepReached(step.statuses);
          const ts = getTs(step.statuses);
          const isLast = i === TIMELINE_STEPS.length - 1;

          return (
            <div key={i} className={`flex items-stretch gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="flex flex-col items-center">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  reached ? 'border-transparent bg-emerald-500' : 'border-gray-200 bg-white'
                }`}>
                  {reached
                    ? <CheckCircle2 size={11} className="text-white" />
                    : <CircleDot size={9} className="text-gray-300" />
                  }
                </div>
                {(!isLast || isTerminal) && (
                  <div className={`w-0.5 flex-1 min-h-[18px] mt-0.5 ${reached ? 'bg-emerald-200' : 'bg-white'}`} />
                )}
              </div>
              <div className={`pb-3 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                <p className={`text-xs font-medium leading-tight ${reached ? 'text-gray-800' : 'text-gray-400'}`}>
                  {isRTL ? step.labelHe : step.labelEn}
                </p>
                {ts && <p className="text-[10px] text-gray-400 mt-0.5">{ts}</p>}
              </div>
            </div>
          );
        })}

        {isTerminal && terminalInfo && (
          <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="flex flex-col items-center">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${terminalInfo.color}18`, border: `2px solid ${terminalInfo.color}` }}
              >
                <terminalInfo.icon size={10} style={{ color: terminalInfo.color }} />
              </div>
            </div>
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              <p className="text-xs font-bold" style={{ color: terminalInfo.color }}>
                {isRTL ? terminalInfo.labelHe : terminalInfo.labelEn}
              </p>
              {terminalTs && <p className="text-[10px] text-gray-400 mt-0.5">{formatTs(terminalTs)}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Per-status contextual guidance card */}
      <StatusContextCard status={currentStatus} booking={booking} isRTL={isRTL} />
    </div>
  );
}

// ── Contextual status guidance card ───────────────────────────────────────────
const STATUS_CONTEXT: Record<string, {
  bg: string; border: string; textColor: string;
  icon: any; iconColor: string;
  he: string; en: string;
}> = {
  pending: {
    bg: 'bg-amber-50', border: 'border-amber-200', textColor: 'text-amber-800',
    icon: Hourglass, iconColor: '#D97706',
    he: 'ממתינים לתגובת הספק. תקבל עדכון בהקדם.',
    en: 'Awaiting provider response. You will be notified soon.',
  },
  accepted: {
    bg: 'bg-blue-50', border: 'border-blue-200', textColor: 'text-blue-800',
    icon: CheckCircle2, iconColor: '#2563EB',
    he: 'הספק הגיב! ייתכן שתתואם פגישת היכרות לפני האישור הסופי.',
    en: 'Provider responded! A Meet & Greet may be scheduled before final confirmation.',
  },
  meet_greet_scheduled: {
    bg: 'bg-orange-50', border: 'border-orange-200', textColor: 'text-orange-800',
    icon: Timer, iconColor: '#EA580C',
    he: 'פגישת היכרות מתוכננת. בדוק את הפרטים שקיבלת מהספק.',
    en: 'Meet & Greet is scheduled. Check the details shared by your provider.',
  },
  meet_greet_completed: {
    bg: 'bg-blue-50', border: 'border-blue-200', textColor: 'text-blue-800',
    icon: CheckCircle2, iconColor: '#2563EB',
    he: 'פגישת ההיכרות הושלמה. השלם תשלום לאישור סופי.',
    en: 'Meet & Greet done. Complete payment to finalize your booking.',
  },
  payment_pending: {
    bg: 'bg-yellow-50', border: 'border-yellow-200', textColor: 'text-yellow-800',
    icon: AlertTriangle, iconColor: '#CA8A04',
    he: 'ממתינים לתשלום שלך כדי לאשר את ההזמנה.',
    en: 'Waiting for your payment to confirm the booking.',
  },
  confirmed: {
    bg: 'bg-emerald-50', border: 'border-emerald-200', textColor: 'text-emerald-800',
    icon: CheckCircle2, iconColor: '#059669',
    he: 'ההזמנה אושרה! השירות יתחיל בקרוב.',
    en: 'Booking confirmed! Service will begin soon.',
  },
  in_progress: {
    bg: 'bg-sky-50', border: 'border-sky-200', textColor: 'text-sky-800',
    icon: Timer, iconColor: '#0284C7',
    he: 'השירות מתבצע כעת. חיית המחמד שלך בידיים טובות! 🐾',
    en: 'Service is in progress. Your pet is in good hands! 🐾',
  },
  completed: {
    bg: 'bg-violet-50', border: 'border-violet-200', textColor: 'text-violet-800',
    icon: Star, iconColor: '#7C3AED',
    he: 'השירות הושלם! נשמח לשמוע מה חשבת — השאר ביקורת.',
    en: "Service completed! We'd love your feedback — please leave a review.",
  },
  reviewed: {
    bg: 'bg-emerald-50', border: 'border-emerald-200', textColor: 'text-emerald-800',
    icon: Star, iconColor: '#059669',
    he: 'תודה על הביקורת! נשמח לראותך שוב.',
    en: 'Thank you for your review! Hope to see you again soon.',
  },
  declined: {
    bg: 'bg-red-50', border: 'border-red-200', textColor: 'text-red-800',
    icon: XCircle, iconColor: '#DC2626',
    he: 'הספק דחה את הבקשה. ניתן להזמין ספק אחר דרך דף הבית.',
    en: 'Provider declined your request. You can book a different provider.',
  },
  cancelled: {
    bg: 'bg-red-50', border: 'border-red-200', textColor: 'text-red-800',
    icon: Ban, iconColor: '#DC2626',
    he: 'ההזמנה בוטלה. החזר כספי יעובד בהתאם למדיניות.',
    en: 'Booking was cancelled. A refund will be processed per our policy.',
  },
  disputed: {
    bg: 'bg-orange-50', border: 'border-orange-200', textColor: 'text-orange-800',
    icon: AlertTriangle, iconColor: '#EA580C',
    he: 'פנייתך לבירור התקבלה. הצוות שלנו יצור קשר בקרוב.',
    en: 'Your dispute has been received. Our team will be in touch shortly.',
  },
};

function StatusContextCard({ status, booking, isRTL }: { status: string; booking: Booking; isRTL: boolean }) {
  const cfg = STATUS_CONTEXT[status];
  if (!cfg) return null;
  const Icon = cfg.icon;

  const extraHe = status === 'cancelled' && booking.refundCents && booking.refundCents > 0
    ? ` החזר של ₪${(booking.refundCents / 100).toFixed(2)} יעובד תוך 3-5 ימי עסקים.`
    : '';
  const extraEn = status === 'cancelled' && booking.refundCents && booking.refundCents > 0
    ? ` A refund of ₪${(booking.refundCents / 100).toFixed(2)} will be processed within 3-5 business days.`
    : '';

  return (
    <div className={`mt-3 rounded-xl border px-3 py-2.5 flex gap-2 items-start ${cfg.bg} ${cfg.border} ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}>
      <Icon size={14} style={{ color: cfg.iconColor, flexShrink: 0, marginTop: 1 }} />
      <p className={`text-[11px] leading-snug font-medium ${cfg.textColor}`}>
        {isRTL ? (cfg.he + extraHe) : (cfg.en + extraEn)}
      </p>
    </div>
  );
}

// ── ProviderAvatar ─────────────────────────────────────────────────────────────

function ProviderAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-2xl font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg,${GOLD},#d4af37)`, fontSize: size * 0.34 }}
    >
      {initials || '?'}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

function EmptyState({ tab, isRTL }: { tab: TabId; isRTL: boolean }) {
  const content: Record<TabId, {
    emoji: string; he: string; en: string;
    sub_he: string; sub_en: string;
    cta_he: string; cta_en: string; cta_href: string;
  }> = {
    pending:  {
      emoji: '⏳',
      he: 'אין בקשות ממתינות',  en: 'No pending requests',
      sub_he: 'הזמנות חדשות יופיעו כאן לפני שהספק אישר.',
      sub_en: 'New bookings appear here while waiting for provider confirmation.',
      cta_he: 'חפש שירות', cta_en: 'Find a service', cta_href: '/marketplace',
    },
    upcoming: {
      emoji: '📅',
      he: 'אין הזמנות קרובות',   en: 'No upcoming bookings',
      sub_he: 'הזמנות מאושרות יופיעו כאן. אפשר להזמין עכשיו.',
      sub_en: 'Confirmed bookings appear here. Ready to book something?',
      cta_he: 'הזמן שירות', cta_en: 'Book a service', cta_href: '/marketplace',
    },
    past:     {
      emoji: '🌟',
      he: 'אין הזמנות שעברו',    en: 'No past bookings yet',
      sub_he: 'הזמנות שהושלמו יופיעו כאן. ניתן להזמין שוב בלחיצה.',
      sub_en: 'Completed bookings appear here. You can rebook with one tap.',
      cta_he: 'הזמן שירות', cta_en: 'Book a service', cta_href: '/marketplace',
    },
    archived: {
      emoji: '📁',
      he: 'ארכיון ריק',           en: 'Archive is empty',
      sub_he: 'הזמנות שבוטלו ונדחו יופיעו כאן.',
      sub_en: 'Cancelled and declined bookings appear here.',
      cta_he: 'חפש שירות', cta_en: 'Find a service', cta_href: '/marketplace',
    },
  };

  const c = content[tab];
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-5xl mb-4">{c.emoji}</div>
      <p className="text-base font-bold text-gray-800">{isRTL ? c.he : c.en}</p>
      <p className="text-sm text-gray-400 mt-1.5 leading-relaxed max-w-[260px]">
        {isRTL ? c.sub_he : c.sub_en}
      </p>
      <Link href={c.cta_href}>
        <button
          className="mt-6 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: `linear-gradient(135deg,${GOLD},#d4af37)` }}
        >
          {isRTL ? c.cta_he : c.cta_en}
        </button>
      </Link>
    </div>
  );
}

// ── BookingCard ────────────────────────────────────────────────────────────────

function BookingCard({
  booking, isRTL, showRebook, onCancel, cancelling,
}: {
  booking: Booking;
  isRTL: boolean;
  showRebook?: boolean;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const [, navigate] = useLocation();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const locale = isRTL ? 'he-IL' : 'en-AU';

  const service    = SERVICE_TYPES.find(s => s.id === booking.serviceType) || SERVICE_TYPES[0];
  const statusInfo = STATUS_COLORS[booking.status] || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
  const statusLabel = STATUS_LABELS[booking.status] || { he: booking.status, en: booking.status };
  const StatusIcon  = STATUS_ICONS[booking.status] || CircleDot;

  const nights      = calcNights(booking.startDate, booking.endDate);
  const daysTil     = daysUntil(booking.startDate);
  const isUpcoming  = STATUS_TO_TAB[booking.status] === 'upcoming';
  // Issue #153 priority 4 (OPT-A): the UI cancel mutation hits
  // POST /api/booking-requests/:requestId/cancel which only knows the
  // legacy booking_requests table. Marketplace bookings live in `bookings`
  // and have a different cancel path; we intentionally hide the cancel
  // button on those rows for now (read-only bridge — no booking-state
  // mutation in this PR per the OPT-A constraints).
  const canCancel   = CANCELLABLE_STATUSES.has(booking.status) && !!onCancel && booking.kind !== 'marketplace';
  const hasRefund   = (booking.refundCents ?? 0) > 0;
  const hasMeetGreet = !!(booking.meetGreetDate || booking.meetGreetLocation);
  const canReview   = booking.status === 'completed';

  const cleanReason = (r: string | null | undefined) =>
    r?.replace(/^(DECLINED:|CANCELLED:|DISPUTE:|CANCELED:)\s*/i, '') || null;

  const handleRebook = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!booking.providerId) { navigate(SERVICE_TO_ROUTE[booking.serviceType] || '/marketplace'); return; }
    const p = new URLSearchParams({ rebook: '1' });
    if (booking.petIds?.length)     p.set('petIds',  booking.petIds.join(','));
    if (booking.addonCodes?.length) p.set('addons',  booking.addonCodes.join(','));
    if (booking.ownerMessage)       p.set('notes',   booking.ownerMessage);
    navigate(`/booking/new/${booking.serviceType}/${booking.providerId}?${p.toString()}`);
  };

  const handleReview = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    navigate(`/booking/confirmation/${booking.requestId}`);
  };

  // Countdown chip for upcoming bookings
  const countdownChip = isUpcoming && daysTil >= 0 ? (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{
        background: daysTil <= 2 ? '#FEF3C7' : '#F0FDF4',
        color: daysTil <= 2 ? '#92400E' : '#166534',
      }}
    >
      <Timer size={9} />
      {daysTil === 0
        ? (isRTL ? 'היום!' : 'Today!')
        : daysTil === 1
        ? (isRTL ? 'מחר' : 'Tomorrow')
        : isRTL ? `בעוד ${daysTil} ימים` : `In ${daysTil} days`}
    </span>
  ) : null;

  // Duration pill
  const durationPill = nights > 0 ? (
    <span className="text-[10px] font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full">
      {nights === 1
        ? (isRTL ? 'לילה אחד' : '1 night')
        : isRTL ? `${nights} לילות` : `${nights} nights`}
    </span>
  ) : null;

  return (
    <Link href={`/booking/confirmation/${booking.requestId}`}>
      <div
        className="bg-white border border-gray-100 rounded-2xl mb-3 overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-gray-200 active:scale-[0.995]"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* ── Main card body ─────────────────────────────────────────── */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            {booking.providerName ? (
              <ProviderAvatar name={booking.providerName} size={44} />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                {service.emoji}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Row 1: name + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {booking.providerName && (
                    <p className="font-bold text-gray-900 text-sm leading-tight truncate">
                      {booking.providerName}
                    </p>
                  )}
                  <p className={`text-xs text-gray-500 ${!booking.providerName ? 'font-bold text-gray-900 text-sm' : 'mt-0.5'}`}>
                    {service.emoji} {isRTL ? service.labelHe : service.labelEn}
                    {booking.kind === 'marketplace' && (
                      <span
                        className="ml-1.5 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200"
                        data-testid="badge-marketplace-source"
                      >
                        {isRTL ? 'מרקטפלייס' : 'Marketplace'}
                      </span>
                    )}
                  </p>
                </div>
                {/* Status badge with icon */}
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 border"
                  style={{ background: statusInfo.bg, color: statusInfo.text, borderColor: statusInfo.border }}
                >
                  <StatusIcon size={10} />
                  {isRTL ? statusLabel.he : statusLabel.en}
                </span>
              </div>

              {/* Row 2: dates + duration + countdown */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <CalendarDays size={11} />
                  {formatDateShort(booking.startDate, locale)}
                  {booking.endDate && booking.startDate !== booking.endDate && (
                    <> – {formatDateShort(booking.endDate, locale)}</>
                  )}
                </span>
                {durationPill}
                {countdownChip}
              </div>

              {/* Row 3: pets */}
              {booking.petCount > 0 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <PawPrint size={10} />
                  <span>
                    {booking.petCount === 1
                      ? (isRTL ? 'חיית מחמד אחת' : '1 pet')
                      : isRTL ? `${booking.petCount} חיות מחמד` : `${booking.petCount} pets`}
                  </span>
                </div>
              )}

              {/* Contextual chips */}
              {hasMeetGreet && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                    <HandshakeIcon size={9} />
                    {isRTL ? 'פגישת היכרות' : 'Meet & Greet'}
                    {booking.meetGreetDate && ` · ${formatDateShort(booking.meetGreetDate, locale)}`}
                  </span>
                  {booking.meetGreetLocation && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                      <MapPin size={9} /> {booking.meetGreetLocation}
                    </span>
                  )}
                </div>
              )}

              {booking.status === 'disputed' && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                    <AlertTriangle size={9} />
                    {isRTL ? 'תיק במחלוקת — בטיפול' : 'Dispute under review'}
                  </span>
                </div>
              )}

              {/* Cancellation / decline reason */}
              {(booking.status === 'declined' || booking.status === 'cancelled') &&
                cleanReason(booking.cancellationReason) && (
                <div className="mt-2 px-2.5 py-2 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-[11px] text-red-700 leading-snug">
                    <span className="font-semibold">
                      {isRTL
                        ? (booking.status === 'declined' ? 'סיבת דחייה: ' : 'סיבת ביטול: ')
                        : (booking.status === 'declined' ? 'Reason: ' : 'Cancelled: ')}
                    </span>
                    {cleanReason(booking.cancellationReason)}
                  </p>
                </div>
              )}

              {/* Refund badge */}
              {booking.status === 'cancelled' && hasRefund && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <Banknote size={9} />
                    {isRTL
                      ? `החזר ₪${((booking.refundCents ?? 0) / 100).toFixed(0)} בעיבוד`
                      : `Refund ₪${((booking.refundCents ?? 0) / 100).toFixed(0)} processing`}
                  </span>
                </div>
              )}

              {/* Loyalty credits redeemed badge */}
              {(booking.loyaltyRedeemedCents ?? 0) > 0 && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#C5A55A]/10 text-[#7A5C1E] border border-[#C5A55A]/20">
                    <Coins size={9} />
                    {isRTL
                      ? `קרדיטים מומשו ₪${((booking.loyaltyRedeemedCents ?? 0) / 100).toFixed(0)}`
                      : `₪${((booking.loyaltyRedeemedCents ?? 0) / 100).toFixed(0)} credits used`}
                  </span>
                </div>
              )}

              {/* Wallet lifecycle message */}
              {booking.financeState && booking.financeState !== 'none' && (
                <div className="mt-2">
                  <WalletLifecycleMessage
                    financeState={booking.financeState}
                    amountCents={resolveWalletAmountCents({
                      financeState: booking.financeState,
                      walletHoldCents: booking.walletHoldCents,
                      walletDebitedCents: booking.walletDebitedCents,
                      walletRefundedCents: booking.walletRefundedCents,
                    })}
                  />
                </div>
              )}
            </div>

            {/* Right column: price + chevron */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {booking.totalCents > 0 && (
                <p className="text-base font-bold" style={{ color: GOLD }}>
                  ₪{(booking.totalCents / 100).toFixed(0)}
                </p>
              )}
              {isRTL
                ? <ChevronLeft size={15} className="text-gray-300" />
                : <ChevronRight size={15} className="text-gray-300" />
              }
            </div>
          </div>
        </div>

        {/* ── Action footer ─────────────────────────────────────────── */}
        <div
          className={`px-4 py-2.5 border-t border-gray-50 bg-white/60 flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          {/* Cancel */}
          {canCancel && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onCancel?.(); }}
              disabled={cancelling}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {cancelling ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
              {isRTL ? 'ביטול' : 'Cancel'}
            </button>
          )}

          {/* Leave a review CTA — only for completed, not reviewed */}
          {canReview && (
            <button
              onClick={handleReview}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors"
              style={{ borderColor: `${GOLD}60`, color: GOLD, background: `${GOLD}0C` }}
            >
              <Star size={10} />
              {isRTL ? 'כתוב ביקורת' : 'Leave a review'}
            </button>
          )}

          {/* Rebook */}
          {showRebook && (
            <button
              onClick={handleRebook}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 transition-all hover:scale-[1.02] active:scale-[0.97]"
              style={{ borderColor: GOLD, color: GOLD, background: `${GOLD}0E` }}
            >
              <RefreshCw size={10} className="shrink-0" />
              <span>{isRTL ? 'הזמנה חוזרת' : 'Book again'}</span>
              {(booking.petIds?.length || booking.addonCodes?.length) ? (
                <span className="text-[10px] font-normal hidden sm:inline" style={{ opacity: 0.65 }}>
                  {isRTL ? '· אותם פרטים' : '· same details'}
                </span>
              ) : null}
            </button>
          )}

          {/* Spacer + Timeline toggle */}
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setTimelineOpen(o => !o); }}
            className={`inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors ${isRTL ? 'mr-auto' : 'ml-auto'}`}
          >
            <Clock size={10} />
            {isRTL ? 'ציר זמן' : 'Timeline'}
            {timelineOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>

        {/* ── Status timeline (expandable) ───────────────────────────── */}
        {timelineOpen && (
          <div className="px-4 pb-3">
            <StatusTimeline booking={booking} isRTL={isRTL} />
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CustomerBookings() {
  const { language } = useLanguage();
  const { user } = useFirebaseAuth();
  const isRTL = language === 'he' || language === 'ar';
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('upcoming');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedService, setSelectedService] = useState('all');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading } = useQuery<{ bookings: Booking[]; total: number }>({
    queryKey: ['/api/booking-requests'],
    enabled: !!user,
  });

  // ── Issue #153 priority 4 (OPT-A): bridge customer visibility for marketplace
  //    bookings stored in `bookings` (PG). Read-only second query, customer-scoped
  //    by token (`req.user.uid` server-side). On error or unavailable endpoint
  //    the legacy booking_requests view continues to render — partial failure
  //    is intentionally graceful.
  //
  //    SAFE-FIELD ALLOWLIST: only the keys in `marketplaceFromRow` below are
  //    forwarded to the UI. Provider payout, platform fee, payment intent,
  //    payout status, platform data, and other internals are NEVER copied.
  //    Out of scope for launch: Firestore K9000 station washes (separate
  //    Firestore source, not safe to merge in a UI bridge per #153 OPT-C).
  type MarketplaceRow = {
    id?: string;
    bookingNumber?: string;
    status?: string;
    serviceType?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    total?: string | number | null;
    currency?: string | null;
    createdAt?: string | null;
    providerId?: string | null;
    cancellationReason?: string | null;
    cancelledBy?: string | null;
    refundAmountCents?: number | null;
  };

  const decimalToCents = (v: string | number | null | undefined): number => {
    if (v == null) return 0;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };

  const marketplaceFromRow = (row: MarketplaceRow): Booking => ({
    requestId: row.bookingNumber || row.id || '',
    status: row.status || 'pending',
    serviceType: row.serviceType || 'unknown',
    startDate: row.startTime || row.createdAt || '',
    endDate: row.endTime || row.startTime || row.createdAt || '',
    petCount: 1,
    totalCents: decimalToCents(row.total),
    currency: row.currency || 'ILS',
    createdAt: row.createdAt || '',
    providerId: row.providerId || undefined,
    providerName: null,
    cancellationReason: row.cancellationReason || null,
    cancelledBy: row.cancelledBy || null,
    refundCents: row.refundAmountCents ?? undefined,
    kind: 'marketplace',
  });

  const marketplaceQuery = useQuery<{ success: boolean; bookings: MarketplaceRow[] }>({
    queryKey: ['/api/marketplace-bookings/my-bookings'],
    enabled: !!user,
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) =>
      apiRequest('POST', `/api/booking-requests/${requestId}/cancel`, { reason }),
    onSuccess: () => {
      setCancelTarget(null);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests'] });
      toast({
        title: isRTL ? 'ההזמנה בוטלה' : 'Booking cancelled',
        description: isRTL ? 'ההזמנה בוטלה בהצלחה.' : 'Your booking has been cancelled.',
      });
    },
    onError: () => {
      toast({
        title: isRTL ? 'שגיאה בביטול' : 'Cancellation failed',
        description: isRTL ? 'לא ניתן לבטל כעת. נסה שוב.' : 'Could not cancel right now. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const legacyBookings = data?.bookings ?? [];
  const marketplaceRows = marketplaceQuery.data?.bookings ?? [];
  const marketplaceBookings = useMemo(
    () => marketplaceRows.map(marketplaceFromRow),
    [marketplaceRows],
  );
  const allBookings = useMemo(() => {
    // Tag legacy rows so the UI can distinguish them from marketplace rows.
    const tagged = legacyBookings.map((b) => ({ ...b, kind: b.kind ?? ('request' as const) }));
    const combined = [...tagged, ...marketplaceBookings];
    return combined.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [legacyBookings, marketplaceBookings]);

  const filtered = useMemo(() =>
    allBookings.filter(b => {
      const tabMatch = STATUS_TO_TAB[b.status] === activeTab;
      const serviceMatch = selectedService === 'all' || b.serviceType === selectedService;
      return tabMatch && serviceMatch;
    }),
  [allBookings, activeTab, selectedService]);

  // Count per tab for badges
  const counts = useMemo(() => {
    const c: Record<TabId, number> = { pending: 0, upcoming: 0, past: 0, archived: 0 };
    allBookings.forEach(b => {
      const tab = STATUS_TO_TAB[b.status] as TabId | undefined;
      if (tab) c[tab]++;
    });
    return c;
  }, [allBookings]);

  const activeServiceLabel = SERVICE_TYPES.find(s => s.id === selectedService);

  return (
    <div className="min-h-[100dvh] bg-white pb-24" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 pt-10 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {isRTL ? 'הזמנות' : 'Bookings'}
              </h1>
              {!isLoading && allBookings.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {allBookings.length === 1
                    ? (isRTL ? 'הזמנה אחת' : '1 booking')
                    : isRTL ? `${allBookings.length} הזמנות` : `${allBookings.length} bookings`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/my/timeline">
                <button className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-full border border-gray-200 text-gray-600 bg-white">
                  <Coins size={12} />
                  {isRTL ? 'ציר זמן' : 'Timeline'}
                </button>
              </Link>
              <NotificationBell language={isRTL ? 'he' : 'en'} />
              <button
                onClick={() => setFilterOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border transition-colors"
                style={selectedService !== 'all'
                  ? { borderColor: GOLD, color: GOLD, background: `${GOLD}0E` }
                  : { borderColor: '#E5E7EB', color: '#374151', background: '#fff' }}
              >
                <SlidersHorizontal size={13} />
                {isRTL ? 'סינון' : 'Filter'}
                {selectedService !== 'all' && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
                )}
              </button>
            </div>
          </div>

          {/* Active filter chip */}
          {selectedService !== 'all' && activeServiceLabel && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setSelectedService('all')}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border"
                style={{ background: `${GOLD}18`, color: GOLD, borderColor: `${GOLD}40` }}
              >
                {activeServiceLabel.emoji} {isRTL ? activeServiceLabel.labelHe : activeServiceLabel.labelEn}
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex overflow-x-auto scrollbar-hide px-4 gap-1 pb-0">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const count = counts[tab.id];
            const isPending = tab.id === 'pending' && count > 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {isRTL ? tab.labelHe : tab.labelEn}
                {count > 0 && (
                  <span
                    className={`text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
                {/* Red pulse dot for pending tab with bookings */}
                {isPending && !isActive && (
                  <span className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-red-500">
                    <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-white border border-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState tab={activeTab} isRTL={isRTL} />
        ) : (
          filtered.map(b => (
            <BookingCard
              key={b.requestId}
              booking={b}
              isRTL={isRTL}
              showRebook={activeTab === 'past' || activeTab === 'archived'}
              onCancel={CANCELLABLE_STATUSES.has(b.status) ? () => setCancelTarget(b) : undefined}
              cancelling={cancelMutation.isPending && cancelTarget?.requestId === b.requestId}
            />
          ))
        )}
      </div>

      {/* ── Filter sheet ───────────────────────────────────────────────── */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>{isRTL ? 'סינון לפי שירות' : 'Filter by service'}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 pb-6">
            {SERVICE_TYPES.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedService(s.id); setFilterOpen(false); }}
                className="flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all text-left"
                style={selectedService === s.id
                  ? { borderColor: GOLD, background: `${GOLD}12`, color: GOLD }
                  : { borderColor: '#E5E7EB', background: '#fff', color: '#374151' }}
              >
                <span className="text-base">{s.emoji}</span>
                {isRTL ? s.labelHe : s.labelEn}
                {selectedService === s.id && <span className="ml-auto text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Cancel confirmation dialog ─────────────────────────────────── */}
      <AlertDialog open={!!cancelTarget} onOpenChange={open => { if (!open) { setCancelTarget(null); setCancelReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'ביטול הזמנה' : 'Cancel booking'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? 'האם אתה בטוח שברצונך לבטל הזמנה זו? פעולה זו אינה ניתנת לביטול.'
                : 'Are you sure you want to cancel this booking? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={isRTL ? 'סיבת הביטול (אופציונלי)' : 'Reason for cancellation (optional)'}
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            className="mt-2 text-sm"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'שמור הזמנה' : 'Keep booking'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (cancelTarget) cancelMutation.mutate({ requestId: cancelTarget.requestId, reason: cancelReason });
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending
                ? (isRTL ? 'מבטל...' : 'Cancelling...')
                : (isRTL ? 'בטל הזמנה' : 'Cancel booking')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
