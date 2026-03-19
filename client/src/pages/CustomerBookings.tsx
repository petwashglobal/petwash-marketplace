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
  CheckCircle2, CircleDot, Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

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

const STATUS_COLORS: Record<string, string> = {
  pending:               'bg-amber-100 text-amber-800',
  accepted:              'bg-blue-100 text-blue-800',
  confirmed:             'bg-blue-100 text-blue-800',
  meet_greet_scheduled:  'bg-violet-100 text-violet-800',
  meet_greet_completed:  'bg-violet-100 text-violet-800',
  payment_pending:       'bg-yellow-100 text-yellow-800',
  in_progress:           'bg-green-100 text-green-800',
  completed:             'bg-gray-100 text-gray-700',
  reviewed:              'bg-teal-100 text-teal-700',
  declined:              'bg-red-100 text-red-700',
  cancelled:             'bg-red-100 text-red-700',
  disputed:              'bg-orange-100 text-orange-700',
};

const STATUS_LABELS: Record<string, { he: string; en: string }> = {
  pending:              { he: 'ממתין',           en: 'Pending'             },
  accepted:             { he: 'אושר',            en: 'Accepted'            },
  confirmed:            { he: 'מאושר',           en: 'Confirmed'           },
  meet_greet_scheduled: { he: 'פגישה מתוכננת',  en: 'Meet & Greet set'    },
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
  k9000_wash:  '/k9000/booking',
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
  statusHistory?: Array<{ status: string; timestamp: string; note?: string }>;
  // Rebook prefill fields
  petIds?: string[];
  addonCodes?: string[];
  ownerMessage?: string | null;
}

const TIMELINE_STEPS: Array<{
  statuses: string[];
  labelHe: string;
  labelEn: string;
  terminal?: boolean;
}> = [
  { statuses: ['pending'],                                    labelHe: 'בקשה נשלחה',      labelEn: 'Request sent'       },
  { statuses: ['accepted', 'meet_greet_scheduled',
               'meet_greet_completed', 'payment_pending'],   labelHe: 'ספק הגיב',         labelEn: 'Provider responded' },
  { statuses: ['confirmed'],                                  labelHe: 'אושר',             labelEn: 'Confirmed'          },
  { statuses: ['in_progress'],                                labelHe: 'השירות החל',       labelEn: 'Service started'    },
  { statuses: ['completed', 'reviewed'],                      labelHe: 'הושלם',            labelEn: 'Completed'          },
];

const TERMINAL_STATUSES: Record<string, { labelHe: string; labelEn: string; icon: any; color: string }> = {
  cancelled: { labelHe: 'בוטל',       labelEn: 'Cancelled', icon: Ban,         color: '#EF4444' },
  declined:  { labelHe: 'נדחה',       labelEn: 'Declined',  icon: XCircle,     color: '#EF4444' },
  disputed:  { labelHe: 'במחלוקת',    labelEn: 'Disputed',  icon: AlertTriangle, color: '#F97316' },
};

function StatusTimeline({
  booking, isRTL,
}: { booking: Booking; isRTL: boolean }) {
  const history = booking.statusHistory ?? [];
  const currentStatus = booking.status;
  const isTerminal = currentStatus in TERMINAL_STATUSES;

  const formatTs = (ts: string) => {
    try {
      return new Date(ts).toLocaleDateString(isRTL ? 'he-IL' : 'en-AU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  const getStepTimestamp = (stepStatuses: string[]) => {
    const entry = history.find(h => stepStatuses.includes(h.status));
    return entry?.timestamp ? formatTs(entry.timestamp) : null;
  };

  const stepReached = (stepStatuses: string[]) => {
    const allStatusesInOrder = [
      'pending', 'accepted', 'meet_greet_scheduled', 'meet_greet_completed',
      'payment_pending', 'confirmed', 'in_progress', 'completed', 'reviewed',
    ];
    const currentIdx = allStatusesInOrder.indexOf(currentStatus);
    return stepStatuses.some(s => {
      const sIdx = allStatusesInOrder.indexOf(s);
      return sIdx !== -1 && currentIdx >= sIdx;
    }) || history.some(h => stepStatuses.includes(h.status));
  };

  const terminalInfo = isTerminal ? TERMINAL_STATUSES[currentStatus] : null;
  const terminalTs = history.find(h => h.status === currentStatus)?.timestamp;

  return (
    <div className={`mt-3 pt-3 border-t border-gray-100 ${isRTL ? 'pr-1' : 'pl-1'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        {isRTL ? 'ציר זמן' : 'Timeline'}
      </p>
      <div className="space-y-0">
        {TIMELINE_STEPS.map((step, i) => {
          const reached = stepReached(step.statuses);
          const ts = getStepTimestamp(step.statuses);
          const isLast = i === TIMELINE_STEPS.length - 1;

          return (
            <div key={i} className={`flex items-stretch gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="flex flex-col items-center">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  reached
                    ? 'border-transparent bg-green-500'
                    : 'border-gray-200 bg-white'
                }`}>
                  {reached && <CheckCircle2 size={12} className="text-white" />}
                  {!reached && <CircleDot size={10} className="text-gray-300" />}
                </div>
                {(!isLast || isTerminal) && (
                  <div className={`w-0.5 flex-1 min-h-[16px] ${reached ? 'bg-green-300' : 'bg-gray-100'}`} />
                )}
              </div>
              <div className={`pb-2 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                <p className={`text-xs font-medium leading-tight ${reached ? 'text-gray-800' : 'text-gray-400'}`}>
                  {isRTL ? step.labelHe : step.labelEn}
                </p>
                {ts && <p className="text-[10px] text-gray-400">{ts}</p>}
              </div>
            </div>
          );
        })}

        {isTerminal && terminalInfo && (
          <div className={`flex items-start gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="flex flex-col items-center">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${terminalInfo.color}20`, border: `2px solid ${terminalInfo.color}` }}
              >
                <terminalInfo.icon size={10} style={{ color: terminalInfo.color }} />
              </div>
            </div>
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              <p className="text-xs font-semibold" style={{ color: terminalInfo.color }}>
                {isRTL ? terminalInfo.labelHe : terminalInfo.labelEn}
              </p>
              {terminalTs && <p className="text-[10px] text-gray-400">{formatTs(terminalTs)}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: GOLD, fontSize: size * 0.35 }}
    >
      {initials || '?'}
    </div>
  );
}

function EmptyState({ tab, isRTL }: { tab: TabId; isRTL: boolean }) {
  const messages: Record<TabId, { he: string; en: string; sub_he: string; sub_en: string }> = {
    pending:  { he: 'אין הזמנות ממתינות',  en: 'No pending bookings',  sub_he: 'בקשות הזמנה יופיעו כאן.',          sub_en: 'Booking requests will appear here.'              },
    upcoming: { he: 'אין הזמנות קרובות',   en: 'No upcoming bookings', sub_he: 'הזמנות מאושרות יופיעו כאן.',       sub_en: 'Your confirmed bookings will appear here.'       },
    past:     { he: 'אין הזמנות שעברו',    en: 'No past bookings',     sub_he: 'הזמנות שהושלמו יופיעו כאן.',      sub_en: 'Completed bookings will appear here.'            },
    archived: { he: 'אין הזמנות בארכיון',  en: 'No archived bookings', sub_he: 'הזמנות שנדחו ובוטלו יופיעו כאן.', sub_en: 'Declined and cancelled bookings will appear here.' },
  };
  const m = messages[tab];
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-6xl mb-5">🐾</div>
      <p className="text-lg font-semibold text-gray-800">{isRTL ? m.he : m.en}</p>
      <p className="text-sm text-gray-500 mt-1">{isRTL ? m.sub_he : m.sub_en}</p>
      <Link href="/marketplace">
        <Button className="mt-6 rounded-full px-6" style={{ backgroundColor: GOLD, color: '#fff' }}>
          {isRTL ? 'חפש שירות' : 'Find a Service'}
        </Button>
      </Link>
    </div>
  );
}

function BookingCard({
  booking,
  isRTL,
  showRebook,
  onCancel,
  cancelling,
}: {
  booking: Booking;
  isRTL: boolean;
  showRebook?: boolean;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const [, navigate] = useLocation();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const hasHistory = (booking.statusHistory ?? []).length > 0;
  const service = SERVICE_TYPES.find(s => s.id === booking.serviceType) || SERVICE_TYPES[0];
  const statusLabel = STATUS_LABELS[booking.status] || { he: booking.status, en: booking.status };
  const statusColor = STATUS_COLORS[booking.status] || 'bg-gray-100 text-gray-700';
  const hasMeetGreet = !!(booking.meetGreetDate || booking.meetGreetLocation);
  const canCancel = CANCELLABLE_STATUSES.has(booking.status) && !!onCancel;
  const hasRefund = (booking.refundCents ?? 0) > 0;

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(isRTL ? 'he-IL' : 'en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const formatPrice = (cents: number, currency: string) => {
    if (!cents) return null;
    const symbol = currency === 'ILS' ? '₪' : '$';
    return `${symbol}${(cents / 100).toFixed(0)}`;
  };

  const handleRebook = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!booking.providerId) {
      navigate(SERVICE_TO_ROUTE[booking.serviceType] || '/marketplace');
      return;
    }
    const params = new URLSearchParams({ rebook: '1' });
    if (booking.petIds?.length) params.set('petIds', booking.petIds.join(','));
    if (booking.addonCodes?.length) params.set('addons', booking.addonCodes.join(','));
    if (booking.ownerMessage) params.set('notes', booking.ownerMessage);
    navigate(`/booking/new/${booking.serviceType}/${booking.providerId}?${params.toString()}`);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCancel?.();
  };

  const cleanReason = (reason: string | null | undefined) => {
    if (!reason) return null;
    return reason.replace(/^(DECLINED:|CANCELLED:|DISPUTE:|CANCELED:)\s*/i, '');
  };

  return (
    <Link href={`/booking/confirmation/${booking.requestId}`}>
      <div
        className="p-4 bg-white border border-gray-100 rounded-2xl mb-3 active:bg-gray-50 transition-colors cursor-pointer shadow-sm hover:shadow-md"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex items-start gap-3">
          {booking.providerName ? (
            <ProviderAvatar name={booking.providerName} size={44} />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">
              {service.emoji}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                {booking.providerName && (
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{booking.providerName}</p>
                )}
                <p className={`text-xs text-gray-500 ${booking.providerName ? 'mt-0' : 'font-semibold text-gray-900 text-sm'}`}>
                  {service.emoji} {isRTL ? service.labelHe : service.labelEn}
                </p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}>
                {isRTL ? statusLabel.he : statusLabel.en}
              </span>
            </div>

            <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500">
              <CalendarDays size={11} />
              <span>{formatDate(booking.startDate)}</span>
              {booking.endDate && booking.startDate !== booking.endDate && (
                <><span>–</span><span>{formatDate(booking.endDate)}</span></>
              )}
            </div>

            {booking.petCount > 0 && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                <PawPrint size={11} />
                <span>{booking.petCount} {isRTL ? 'חיות' : booking.petCount === 1 ? 'pet' : 'pets'}</span>
              </div>
            )}

            {hasMeetGreet && (
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 flex items-center gap-1">
                  <HandshakeIcon size={10} />
                  {isRTL ? 'פגישת היכרות מתוכננת' : 'Meet & Greet scheduled'}
                </span>
              </div>
            )}

            {booking.status === 'disputed' && (
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  {isRTL ? 'תיק במחלוקת — בטיפול' : 'Dispute under review'}
                </span>
              </div>
            )}

            {booking.status === 'declined' && cleanReason(booking.cancellationReason) && (
              <p className="text-[11px] text-red-600 mt-1 leading-snug line-clamp-2">
                {isRTL ? 'סיבת דחייה: ' : 'Reason: '}
                {cleanReason(booking.cancellationReason)}
              </p>
            )}

            {booking.status === 'cancelled' && hasRefund && (
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 flex items-center gap-1">
                  <Banknote size={10} />
                  {isRTL
                    ? `החזר ₪${((booking.refundCents ?? 0) / 100).toFixed(0)} בעיבוד`
                    : `Refund ₪${((booking.refundCents ?? 0) / 100).toFixed(0)} processing`}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {booking.totalCents > 0 && (
              <p className="text-sm font-semibold" style={{ color: GOLD }}>
                {formatPrice(booking.totalCents, booking.currency || 'ILS')}
              </p>
            )}
            {isRTL
              ? <ChevronLeft size={16} className="text-gray-300" />
              : <ChevronRight size={16} className="text-gray-300" />
            }
          </div>
        </div>

        <div className={`mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <XCircle size={12} />
              {isRTL ? 'בטל הזמנה' : 'Cancel booking'}
            </button>
          )}
          {showRebook && (
            <button
              onClick={handleRebook}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border-2 transition-all hover:scale-[1.02] active:scale-[0.97]"
              style={{ borderColor: GOLD, color: GOLD, background: `${GOLD}0E` }}
            >
              <RefreshCw size={11} className="shrink-0" />
              <span>{isRTL ? 'הזמנה חוזרת' : 'Book again'}</span>
              {(booking.petIds?.length || booking.addonCodes?.length) ? (
                <span
                  className="text-[10px] font-normal hidden sm:inline-block"
                  style={{ opacity: 0.65 }}
                >
                  {isRTL ? '· אותם פרטים' : '· same details'}
                </span>
              ) : null}
            </button>
          )}
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setTimelineOpen(o => !o); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors ml-auto"
          >
            <Clock size={11} />
            {isRTL ? 'ציר זמן' : 'Timeline'}
            {timelineOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>

        {timelineOpen && (
          <StatusTimeline booking={booking} isRTL={isRTL} />
        )}
      </div>
    </Link>
  );
}

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

  const allBookings = data?.bookings ?? [];

  const filtered = useMemo(() => {
    return allBookings.filter(b => {
      const tabMatch = STATUS_TO_TAB[b.status] === activeTab;
      const serviceMatch = selectedService === 'all' || b.serviceType === selectedService;
      return tabMatch && serviceMatch;
    });
  }, [allBookings, activeTab, selectedService]);

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { pending: 0, upcoming: 0, past: 0, archived: 0 };
    allBookings.forEach(b => {
      const tab = STATUS_TO_TAB[b.status];
      if (tab) c[tab]++;
    });
    return c;
  }, [allBookings]);

  const activeServiceLabel = SERVICE_TYPES.find(s => s.id === selectedService);

  return (
    <div className="min-h-[100dvh] bg-white pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="px-4 pt-12 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {isRTL ? 'הזמנות' : 'Bookings'}
          </h1>
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200"
            style={selectedService !== 'all' ? { borderColor: GOLD, color: GOLD } : { color: '#374151' }}
          >
            <SlidersHorizontal size={15} />
            {isRTL ? 'סינון' : 'Filters'}
            {selectedService !== 'all' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />}
          </button>
        </div>

        {selectedService !== 'all' && activeServiceLabel && (
          <div className="flex items-center gap-2 mt-2">
            <Badge
              className="flex items-center gap-1 pr-1 cursor-pointer"
              style={{ background: `${GOLD}20`, color: GOLD, borderColor: `${GOLD}40` }}
              onClick={() => setSelectedService('all')}
            >
              {activeServiceLabel.emoji}
              {isRTL ? activeServiceLabel.labelHe : activeServiceLabel.labelEn}
              <X size={12} />
            </Badge>
          </div>
        )}
      </div>

      <div className="border-b border-gray-100">
        <div className="flex overflow-x-auto scrollbar-hide px-4">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const count = counts[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive ? 'border-current' : 'border-transparent text-gray-500'
                }`}
                style={isActive ? { color: GOLD, borderColor: GOLD } : {}}
              >
                {isRTL ? tab.labelHe : tab.labelEn}
                {count > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isActive ? `${GOLD}20` : '#F3F4F6',
                      color: isActive ? GOLD : '#6B7280',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
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

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]" dir={isRTL ? 'rtl' : 'ltr'}>
          <SheetHeader>
            <SheetTitle className={`text-lg font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
              {isRTL ? 'סינון' : 'Filter'}
            </SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              {isRTL ? 'סוג שירות' : 'Pet service'}
            </p>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map(s => {
                const isSelected = selectedService === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedService(s.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
                    style={isSelected
                      ? { borderColor: GOLD, color: GOLD, background: `${GOLD}10` }
                      : { borderColor: '#E5E7EB', color: '#374151' }
                    }
                  >
                    <span>{s.emoji}</span>
                    {isRTL ? s.labelHe : s.labelEn}
                  </button>
                );
              })}
            </div>
          </div>
          <Button
            className="w-full rounded-full py-3 font-semibold"
            style={{ backgroundColor: GOLD, color: '#fff' }}
            onClick={() => setFilterOpen(false)}
          >
            {isRTL ? 'החל סינון' : 'Apply filter'}
          </Button>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!cancelTarget} onOpenChange={open => { if (!open) { setCancelTarget(null); setCancelReason(''); } }}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle size={18} className="text-red-500" />
              {isRTL ? 'ביטול הזמנה' : 'Cancel booking'}
            </AlertDialogTitle>
            <AlertDialogDescription className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
              {isRTL
                ? 'האם אתה בטוח שברצונך לבטל? פעולה זו אינה ניתנת לביטול.'
                : 'Are you sure you want to cancel? This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <Textarea
              placeholder={isRTL ? 'סיבת ביטול (אופציונלי)' : 'Reason for cancellation (optional)'}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="resize-none text-sm"
              rows={3}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <AlertDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              {isRTL ? 'שמור הזמנה' : 'Keep booking'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelTarget) {
                  cancelMutation.mutate({ requestId: cancelTarget.requestId, reason: cancelReason });
                }
              }}
              disabled={cancelMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelMutation.isPending
                ? (isRTL ? 'מבטל...' : 'Cancelling...')
                : (isRTL ? 'אשר ביטול' : 'Confirm cancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
