import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Link, useLocation } from 'wouter';
import {
  Heart, CalendarDays, ChevronLeft, ChevronRight, Zap, RefreshCw, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSavedProviders, type SavedProviderItem } from '@/hooks/useSavedProviders';

const GOLD = '#C5A55A';

const TABS = [
  { id: 'shortlisted', labelHe: 'מועדפים',      labelEn: 'Shortlisted'       },
  { id: 'previously',  labelHe: 'הוזמנו בעבר',  labelEn: 'Previously Booked' },
] as const;
type TabId = typeof TABS[number]['id'];

const PLATFORM_META: Record<string, { he: string; en: string; emoji: string }> = {
  sitter_suite: { he: 'ישיבה לחיות', en: 'Pet Sitting', emoji: '🏠' },
  walk_my_pet:  { he: 'הליכה עם כלב', en: 'Dog Walking', emoji: '🦮' },
  groomers:     { he: 'טיפוח',        en: 'Grooming',    emoji: '✂️' },
  k9000:        { he: 'שטיפה K9000',  en: 'K9000 Wash',  emoji: '🚿' },
  pet_trek:     { he: 'הסעות',        en: 'Pet Taxi',    emoji: '🚗' },
};

const SERVICE_META: Record<string, { he: string; en: string; emoji: string; route: string }> = {
  k9000_wash:  { he: 'שטיפה K9000',  en: 'K9000 Wash',  emoji: '🚿', route: '/k9000/booking'  },
  pet_sitting: { he: 'ישיבה לחיות',  en: 'Pet Sitting', emoji: '🏠', route: '/sitter-suite'   },
  dog_walking: { he: 'הליכה עם כלב', en: 'Dog Walking', emoji: '🦮', route: '/walk-my-pet'    },
  grooming:    { he: 'טיפוח',        en: 'Grooming',    emoji: '✂️', route: '/groomers'        },
  pet_taxi:    { he: 'הסעות',        en: 'Pet Taxi',    emoji: '🚗', route: '/pettrek'         },
  daycare:     { he: 'פעוטון',       en: 'Daycare',     emoji: '🏫', route: '/sitter-suite'   },
  training:    { he: 'אימון',        en: 'Training',    emoji: '🎓', route: '/marketplace'     },
};

interface Booking {
  requestId: string;
  status: string;
  serviceType: string;
  startDate: string;
  totalCents: number;
  currency: string;
  providerName?: string | null;
  providerId?: string;
  platform?: string | null;
}

// ── Provider Avatar ───────────────────────────────────────────────────────────
function ProviderAvatar({
  name, photoUrl, size = 44,
}: { name: string; photoUrl?: string | null; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';
  return (
    <Avatar style={{ width: size, height: size }} className="flex-shrink-0">
      <AvatarImage src={photoUrl ?? undefined} alt={name} className="object-cover" />
      <AvatarFallback
        className="font-bold text-white"
        style={{ background: GOLD, fontSize: size * 0.35 }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="p-4 bg-white border border-gray-100 rounded-2xl mb-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-100 rounded-full animate-pulse w-32" />
          <div className="h-3 bg-gray-100 rounded-full animate-pulse w-20" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-20 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-7 w-16 bg-gray-100 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Shortlisted Card ──────────────────────────────────────────────────────────
function ShortlistedCard({
  provider, isRTL,
}: { provider: SavedProviderItem; isRTL: boolean }) {
  const [, navigate] = useLocation();
  const { toggle, isPending } = useSavedProviders();
  const meta = provider.platform ? PLATFORM_META[provider.platform] : null;
  const displayName = provider.displayName || (isRTL ? 'ספק' : 'Provider');
  const profileUrl  = provider.platform
    ? `/marketplace/${provider.platform}/${provider.providerId}`
    : '/marketplace';

  const handleBook = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(profileUrl);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(provider.providerId, provider.platform);
  };

  return (
    <Link href={profileUrl}>
      <div
        className="p-4 bg-white border border-gray-100 rounded-2xl mb-3 active:bg-gray-50 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-3">
          <ProviderAvatar name={displayName} photoUrl={provider.profilePicUrl} />

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{displayName}</p>
            {meta && (
              <p className="text-sm text-gray-500 mt-0.5">
                {meta.emoji} {isRTL ? meta.he : meta.en}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* View profile */}
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(profileUrl); }}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors hover:bg-gray-50"
              style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
            >
              <User size={10} />
              {isRTL ? 'פרופיל' : 'Profile'}
            </button>

            {/* Book now */}
            <button
              onClick={handleBook}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors"
              style={{ background: GOLD, color: '#fff' }}
            >
              <Zap size={10} />
              {isRTL ? 'הזמן' : 'Book'}
            </button>

            {/* Remove / heart */}
            <button
              disabled={isPending}
              onClick={handleRemove}
              aria-label={isRTL ? 'הסר ממועדפים' : 'Remove from saved'}
              className="p-1.5 rounded-full hover:bg-red-50 active:scale-90 transition-all duration-150 disabled:opacity-40 group/heart"
            >
              <Heart
                size={16}
                className={`transition-all duration-200 fill-rose-500 text-rose-500 group-hover/heart:fill-rose-300 group-hover/heart:text-rose-300 ${isPending ? 'animate-pulse' : ''}`}
              />
            </button>

            {isRTL
              ? <ChevronLeft size={14} className="text-gray-200" />
              : <ChevronRight size={14} className="text-gray-200" />
            }
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Previously Booked Card ────────────────────────────────────────────────────
function PreviouslyBookedCard({ booking, isRTL }: { booking: Booking; isRTL: boolean }) {
  const [, navigate] = useLocation();
  const svc = SERVICE_META[booking.serviceType]
    ?? { he: booking.serviceType, en: booking.serviceType, emoji: '🐾', route: '/marketplace' };
  const symbol = booking.currency === 'ILS' ? '₪' : '$';

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(isRTL ? 'he-IL' : 'en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  const handleRebook = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (booking.providerId && booking.platform) {
      navigate(`/marketplace/${booking.platform}/${booking.providerId}`);
    } else {
      navigate(svc.route);
    }
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

// ── Empty States ──────────────────────────────────────────────────────────────
function EmptyShortlisted({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-6xl mb-5">❤️</div>
      <p className="text-lg font-semibold text-gray-800">
        {isRTL ? 'אין ספקים שמורים עדיין.' : 'No providers shortlisted yet.'}
      </p>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed">
        {isRTL
          ? 'לחץ על אייקון הלב בפרופיל של ספק כדי לשמור אותו כאן.'
          : "Tap the ♡ on any provider's card to save them here for quick booking."
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CustomerFavourites() {
  const { language } = useLanguage();
  const { user } = useFirebaseAuth();
  const isRTL = language === 'he' || language === 'ar';

  const [activeTab, setActiveTab] = useState<TabId>('shortlisted');

  const { saved, isLoading: savedLoading } = useSavedProviders();

  const { data: bookingData, isLoading: bookingsLoading } = useQuery<{
    bookings: Booking[];
    total: number;
  }>({
    queryKey: ['/api/booking-requests'],
    enabled: !!user,
  });

  const previouslyBooked = useMemo(() => {
    const completed = (bookingData?.bookings ?? []).filter(b => b.status === 'completed');
    const seen = new Set<string>();
    return completed.filter(b => {
      if (seen.has(b.requestId)) return false;
      seen.add(b.requestId);
      return true;
    });
  }, [bookingData]);

  const tabCounts = {
    shortlisted: saved.length,
    previously:  previouslyBooked.length,
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

      {/* Tabs */}
      <div className="border-b border-gray-100">
        <div className="flex px-4">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const count    = tabCounts[tab.id];
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

      {/* Content */}
      <div className="px-4 pt-4">
        {activeTab === 'shortlisted' && (
          savedLoading ? (
            <div>
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : saved.length === 0 ? (
            <EmptyShortlisted isRTL={isRTL} />
          ) : (
            saved.map(p => (
              <ShortlistedCard key={p.providerId} provider={p} isRTL={isRTL} />
            ))
          )
        )}

        {activeTab === 'previously' && (
          bookingsLoading ? (
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
