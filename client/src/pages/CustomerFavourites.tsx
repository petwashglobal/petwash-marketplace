import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Link, useLocation } from 'wouter';
import { Heart, CalendarDays, ChevronLeft, ChevronRight, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GOLD = '#C5A55A';

const TABS = [
  { id: 'shortlisted',     labelHe: 'מועדפים',          labelEn: 'Shortlisted'       },
  { id: 'previously',      labelHe: 'הוזמנו בעבר',      labelEn: 'Previously Booked' },
] as const;

type TabId = typeof TABS[number]['id'];

const LS_KEY = 'petwash_favourites_v1';

export interface SavedProvider {
  providerId: string;
  providerName: string;
  serviceType: string;
  serviceEmoji: string;
  savedAt: string;
}

const SERVICE_LABELS: Record<string, { he: string; en: string; emoji: string; route: string }> = {
  k9000_wash:  { he: 'שטיפה K9000',   en: 'K9000 Wash',  emoji: '🚿', route: '/k9000/booking'  },
  pet_sitting: { he: 'ישיבה לחיות',   en: 'Pet Sitting', emoji: '🏠', route: '/sitter-suite'   },
  dog_walking: { he: 'הליכה עם כלב',  en: 'Dog Walking', emoji: '🦮', route: '/walk-my-pet'    },
  grooming:    { he: 'טיפוח',         en: 'Grooming',    emoji: '✂️', route: '/groomers'        },
  pet_taxi:    { he: 'הסעות',         en: 'Pet Taxi',    emoji: '🚗', route: '/pettrek'         },
  daycare:     { he: 'פעוטון',        en: 'Daycare',     emoji: '🏫', route: '/sitter-suite'   },
  training:    { he: 'אימון',         en: 'Training',    emoji: '🎓', route: '/marketplace'     },
};

export function useFavourites() {
  const [favourites, setFavourites] = useState<SavedProvider[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const save = (providers: SavedProvider[]) => {
    setFavourites(providers);
    localStorage.setItem(LS_KEY, JSON.stringify(providers));
  };

  const toggle = (provider: SavedProvider) => {
    const existing = favourites.find(f => f.providerId === provider.providerId);
    if (existing) {
      save(favourites.filter(f => f.providerId !== provider.providerId));
    } else {
      save([...favourites, { ...provider, savedAt: new Date().toISOString() }]);
    }
  };

  const isSaved = (providerId: string) => favourites.some(f => f.providerId === providerId);

  return { favourites, toggle, isSaved };
}

interface Booking {
  requestId: string;
  status: string;
  serviceType: string;
  startDate: string;
  totalCents: number;
  currency: string;
  providerName?: string | null;
  providerId?: string;
}

function ProviderAvatar({ name, size = 44 }: { name: string; size?: number }) {
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

function ShortlistedCard({ provider, onRemove, isRTL }: {
  provider: SavedProvider;
  onRemove: () => void;
  isRTL: boolean;
}) {
  const [, navigate] = useLocation();
  const svc = SERVICE_LABELS[provider.serviceType] || { he: provider.serviceType, en: provider.serviceType, emoji: '🐾', route: '/marketplace' };

  const handleQuickBook = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(svc.route);
  };

  return (
    <Link href={`/marketplace?provider=${provider.providerId}`}>
      <div
        className="p-4 bg-white border border-gray-100 rounded-2xl mb-3 active:bg-gray-50 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-3">
          <ProviderAvatar name={provider.providerName} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{provider.providerName}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {svc.emoji} {isRTL ? svc.he : svc.en}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickBook}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: GOLD, color: '#fff' }}
            >
              <Zap size={11} />
              {isRTL ? 'הזמן' : 'Book'}
            </button>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
              aria-label={isRTL ? 'הסר ממועדפים' : 'Remove from favourites'}
              className="p-2 rounded-full hover:bg-red-50 transition-colors"
            >
              <Heart size={18} fill={GOLD} style={{ color: GOLD }} />
            </button>
            {isRTL
              ? <ChevronLeft size={16} className="text-gray-300" />
              : <ChevronRight size={16} className="text-gray-300" />
            }
          </div>
        </div>
      </div>
    </Link>
  );
}

function PreviouslyBookedCard({ booking, isRTL }: { booking: Booking; isRTL: boolean }) {
  const [, navigate] = useLocation();
  const svc = SERVICE_LABELS[booking.serviceType] || { he: booking.serviceType, en: booking.serviceType, emoji: '🐾', route: '/marketplace' };
  const formatDate = (d: string) => new Date(d).toLocaleDateString(isRTL ? 'he-IL' : 'en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const symbol = booking.currency === 'ILS' ? '₪' : '$';

  const handleRebook = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(svc.route);
  };

  return (
    <Link href={`/booking/${booking.requestId}`}>
      <div
        className="p-4 bg-white border border-gray-100 rounded-2xl mb-3 active:bg-gray-50 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-3">
          {booking.providerName ? (
            <ProviderAvatar name={booking.providerName} />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
              {svc.emoji}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {booking.providerName && (
              <p className="font-semibold text-gray-900 text-sm">{booking.providerName}</p>
            )}
            <p className={`text-sm ${booking.providerName ? 'text-gray-500' : 'font-semibold text-gray-900'}`}>
              {isRTL ? svc.he : svc.en}
            </p>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
              <CalendarDays size={10} />
              <span>{formatDate(booking.startDate)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {booking.totalCents > 0 && (
              <span className="text-sm font-semibold" style={{ color: GOLD }}>
                {symbol}{(booking.totalCents / 100).toFixed(0)}
              </span>
            )}
            <button
              onClick={handleRebook}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border"
              style={{ borderColor: GOLD, color: GOLD, background: `${GOLD}10` }}
            >
              <RefreshCw size={11} />
              {isRTL ? 'חזור' : 'Rebook'}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyShortlisted({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-6xl mb-5">❤️</div>
      <p className="text-lg font-semibold text-gray-800">
        {isRTL ? 'אין ספקים שמורים עדיין.' : 'No sitters shortlisted yet.'}
      </p>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed">
        {isRTL
          ? 'לחץ על אייקון הלב בפרופיל של ספק כדי לשמור אותו כאן.'
          : "Tap the ♡ on any provider's profile to save them here for quick booking."
        }
      </p>
      <Link href="/marketplace">
        <Button className="mt-6 rounded-full px-6" style={{ backgroundColor: GOLD, color: '#fff' }}>
          {isRTL ? 'מצא ספק' : 'Find a Carer'}
        </Button>
      </Link>
    </div>
  );
}

function EmptyPrevious({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-6xl mb-5">📅</div>
      <p className="text-lg font-semibold text-gray-800">
        {isRTL ? 'אין היסטוריית הזמנות.' : 'No previous bookings yet.'}
      </p>
      <p className="text-sm text-gray-500 mt-2">
        {isRTL ? 'הזמנות שהושלמו יופיעו כאן.' : 'Your completed bookings will appear here.'}
      </p>
      <Link href="/marketplace">
        <Button className="mt-6 rounded-full px-6" style={{ backgroundColor: GOLD, color: '#fff' }}>
          {isRTL ? 'הזמן עכשיו' : 'Book a Service'}
        </Button>
      </Link>
    </div>
  );
}

export default function CustomerFavourites() {
  const { language } = useLanguage();
  const { user } = useFirebaseAuth();
  const isRTL = language === 'he' || language === 'ar';

  const [activeTab, setActiveTab] = useState<TabId>('shortlisted');
  const { favourites, toggle } = useFavourites();

  const { data, isLoading } = useQuery<{ bookings: Booking[]; total: number }>({
    queryKey: ['/api/booking-requests'],
    enabled: !!user,
  });

  const previouslyBooked = useMemo(() => {
    const completed = (data?.bookings ?? []).filter(b => b.status === 'completed');
    const seen = new Set<string>();
    return completed.filter(b => {
      if (seen.has(b.requestId)) return false;
      seen.add(b.requestId);
      return true;
    });
  }, [data]);

  const tabCounts = {
    shortlisted: favourites.length,
    previously: previouslyBooked.length,
  };

  return (
    <div className="min-h-[100dvh] bg-white pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="px-4 pt-12 pb-3">
        <h1 className="text-2xl font-bold text-gray-900">
          {isRTL ? 'מועדפים' : 'Favourites'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isRTL ? 'ספקים שמורים והיסטוריית הזמנות' : 'Saved providers and booking history'}
        </p>
      </div>

      <div className="border-b border-gray-100">
        <div className="flex px-4">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors ${
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
        {activeTab === 'shortlisted' && (
          favourites.length === 0
            ? <EmptyShortlisted isRTL={isRTL} />
            : favourites.map(p => (
                <ShortlistedCard
                  key={p.providerId}
                  provider={p}
                  onRemove={() => toggle(p)}
                  isRTL={isRTL}
                />
              ))
        )}

        {activeTab === 'previously' && (
          isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : previouslyBooked.length === 0 ? (
            <EmptyPrevious isRTL={isRTL} />
          ) : (
            previouslyBooked.map(b => (
              <PreviouslyBookedCard key={b.requestId} booking={b} isRTL={isRTL} />
            ))
          )
        )}
      </div>
    </div>
  );
}
