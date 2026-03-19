import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Link } from 'wouter';
import { SlidersHorizontal, X, CalendarDays, PawPrint, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

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
  completed:   'past',
  declined:    'archived',
  cancelled:   'archived',
};

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
  pending:     'bg-amber-100 text-amber-800',
  accepted:    'bg-blue-100 text-blue-800',
  confirmed:   'bg-blue-100 text-blue-800',
  in_progress: 'bg-green-100 text-green-800',
  completed:   'bg-gray-100 text-gray-700',
  declined:    'bg-red-100 text-red-700',
  cancelled:   'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, { he: string; en: string }> = {
  pending:     { he: 'ממתין',     en: 'Pending'     },
  accepted:    { he: 'אושר',      en: 'Accepted'    },
  confirmed:   { he: 'מאושר',     en: 'Confirmed'   },
  in_progress: { he: 'בתהליך',    en: 'In Progress' },
  completed:   { he: 'הושלם',     en: 'Completed'   },
  declined:    { he: 'נדחה',      en: 'Declined'    },
  cancelled:   { he: 'בוטל',      en: 'Cancelled'   },
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

function BookingCard({ booking, isRTL }: { booking: Booking; isRTL: boolean }) {
  const service = SERVICE_TYPES.find(s => s.id === booking.serviceType) || SERVICE_TYPES[0];
  const statusLabel = STATUS_LABELS[booking.status] || { he: booking.status, en: booking.status };
  const statusColor = STATUS_COLORS[booking.status] || 'bg-gray-100 text-gray-700';

  const formatDate = (d: string) => {
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

  return (
    <Link href={`/booking/${booking.requestId}`}>
      <div
        className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-xl mb-3 active:bg-gray-50 transition-colors cursor-pointer"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">
          {service.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-900 text-sm">
              {isRTL ? service.labelHe : service.labelEn}
            </p>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
              {isRTL ? statusLabel.he : statusLabel.en}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
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
    </Link>
  );
}

export default function CustomerBookings() {
  const { language } = useLanguage();
  const { user } = useFirebaseAuth();
  const isRTL = language === 'he' || language === 'ar';

  const [activeTab, setActiveTab] = useState<TabId>('upcoming');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedService, setSelectedService] = useState('all');

  const { data, isLoading } = useQuery<{ bookings: Booking[]; total: number }>({
    queryKey: ['/api/booking-requests'],
    enabled: !!user,
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
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState tab={activeTab} isRTL={isRTL} />
        ) : (
          filtered.map(b => <BookingCard key={b.requestId} booking={b} isRTL={isRTL} />)
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
    </div>
  );
}
