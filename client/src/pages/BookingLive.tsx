/**
 * BookingLive — customer-facing "Track Service" full-page view.
 *
 * Per CEO 2026-08-18 §P1-7:
 *   Build real page: /bookings/:bookingId/live
 *   Customer must not need to know walkId / sitterBookingId / pettrekTripId
 *   — those are adapter internals. Server resolves canonical service
 *   session and verifies caller.
 *
 * Reads /api/service-sessions/:bookingRef via `useServiceSession`. The
 * canonical adapter (server/lib/serviceSessionAdapter.ts) picks the
 * right underlying universe (booking_requests / walk_bookings /
 * pettrek_trips) and enforces caller ∈ { owner, assigned provider } —
 * unauthorized callers see the "we couldn't load this service" state
 * with no confirmation that the booking exists (privacy 404).
 *
 * Renders:
 *   - Big status card (in progress / awaiting confirmation / completed
 *     / cancelled / scheduled).
 *   - Elapsed time since actualStartTime.
 *   - Last-GPS-ping age with amber tint at > 60s (CEO §16 — never
 *     pretend an old marker is live).
 *   - Location coordinates placeholder — the real map SDK integration
 *     is a separate concern (external CSP + font hosting decisions).
 *   - Back-to-booking link.
 *
 * Route: /bookings/:bookingRef/live (wired separately in App.tsx).
 * bookingRef is the public booking id (requestId) — never a raw walkId
 * or tripId.
 */

import { useMemo } from 'react';
import { Link, useParams } from 'wouter';
import { useLanguage } from '@/lib/languageStore';
import { useServiceSession } from '@/hooks/useServiceSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity, MapPin, Clock, CheckCircle2, XCircle,
  ArrowLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import type { ServiceSessionDTO } from '@shared/lib/serviceSession';

export default function BookingLive() {
  const params = useParams<{ bookingRef?: string }>();
  const bookingRef = params?.bookingRef || null;
  const { language } = useLanguage();
  const isHe = language === 'he';

  const { session, error, isLoading, refetch, isFetching } = useServiceSession(bookingRef, {
    refetchIntervalMs: 10_000, // faster than the compact card — this IS the "watching" surface
  });

  const backHref = bookingRef ? `/booking/confirmation/${bookingRef}` : '/bookings';
  const BackArrow = isHe ? ChevronRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-gray-50" dir={isHe ? 'rtl' : 'ltr'} data-testid="booking-live-root">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link href={backHref}>
            <Button variant="ghost" size="sm" data-testid="booking-live-back" aria-label={isHe ? 'חזרה להזמנה' : 'Back to booking'}>
              <BackArrow className={`h-4 w-4 ${isHe ? '' : ''}`} />
            </Button>
          </Link>
          <h1 className="flex-1 text-base font-semibold">{isHe ? 'מעקב שירות' : 'Track service'}</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="booking-live-refresh"
          >
            {isFetching ? (isHe ? 'טוען…' : 'Loading…') : (isHe ? 'רענן' : 'Refresh')}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {isLoading && (
          <div className="space-y-3" data-testid="booking-live-loading">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!isLoading && !session && (
          <UnavailablePanel error={error} isHe={isHe} backHref={backHref} />
        )}

        {!isLoading && session && (
          <>
            <StatusPanel session={session} isHe={isHe} />
            <MapPlaceholder session={session} isHe={isHe} />
            <StatsRow session={session} isHe={isHe} />
            <FooterNote isHe={isHe} />
          </>
        )}
      </main>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function StatusPanel({ session, isHe }: { session: ServiceSessionDTO; isHe: boolean }) {
  const startedAgo = minutesSince(session.startedAt);
  const eyebrow = statusEyebrow(session, isHe);

  const primaryLine = (() => {
    switch (session.status) {
      case 'in_progress':
        return startedAgo != null
          ? (isHe ? `בתהליך · לפני ${startedAgo} דק'` : `In progress · started ${startedAgo} min ago`)
          : (isHe ? 'בתהליך' : 'In progress');
      case 'awaiting_report':
        return isHe ? 'הספק סיים — ממתין לאישורך' : 'Provider finished — awaiting your confirmation';
      case 'completed':
        return isHe ? 'השירות הושלם' : 'Service completed';
      case 'cancelled':
        return isHe ? 'השירות בוטל' : 'Service cancelled';
      default:
        return isHe ? 'מתוכנן' : 'Scheduled';
    }
  })();

  const Icon = session.status === 'in_progress' ? Activity
    : session.status === 'completed' ? CheckCircle2
    : session.status === 'cancelled' ? XCircle
    : Clock;

  const tone = session.status === 'in_progress' ? 'text-blue-600'
    : session.status === 'awaiting_report' ? 'text-amber-700'
    : session.status === 'completed' ? 'text-green-600'
    : session.status === 'cancelled' ? 'text-red-600'
    : 'text-gray-600';

  return (
    <Card data-testid="booking-live-status">
      <CardContent className="p-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{eyebrow}</p>
        <div className="flex items-center gap-3">
          <Icon className={`h-6 w-6 ${session.status === 'in_progress' ? 'animate-pulse ' : ''}${tone}`} />
          <p className="text-xl font-semibold text-gray-900" data-testid="booking-live-status-line">{primaryLine}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MapPlaceholder({ session, isHe }: { session: ServiceSessionDTO; isHe: boolean }) {
  const loc = session.lastLocation;
  const ageSec = loc ? secondsSince(loc.recordedAt) : null;
  const stale = ageSec != null && ageSec > 60;

  return (
    <Card className="mt-4" data-testid="booking-live-map">
      <CardContent className="p-0">
        <div className="flex h-48 items-center justify-center rounded-t-lg bg-gradient-to-br from-gray-100 to-gray-200">
          <div className="text-center">
            <MapPin className={`mx-auto h-10 w-10 ${loc ? 'text-blue-600' : 'text-gray-400'}`} />
            <p className="mt-2 text-sm text-gray-700">
              {loc
                ? (isHe ? 'מיקום חי זמין' : 'Live location available')
                : (isHe ? 'עדיין אין מיקום חי' : 'No live location yet')}
            </p>
          </div>
        </div>

        {loc && (
          <div className="p-4">
            <p className="font-mono text-xs text-gray-700" data-testid="booking-live-coords">
              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
            </p>
            <p
              className={`mt-1 text-xs ${stale ? 'text-amber-700' : 'text-gray-500'}`}
              data-testid="booking-live-updated"
            >
              {isHe ? 'עודכן ' : 'Updated '}{formatAge(ageSec, isHe)}
              {stale && (isHe ? ' · לא עדכני' : ' · stale')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatsRow({ session, isHe }: { session: ServiceSessionDTO; isHe: boolean }) {
  const startedAt = session.startedAt ? new Date(session.startedAt) : null;
  const endedAt = session.endedAt ? new Date(session.endedAt) : null;
  const durationSec = startedAt
    ? Math.max(0, Math.round(((endedAt?.getTime() ?? Date.now()) - startedAt.getTime()) / 1000))
    : null;

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <Card data-testid="booking-live-started">
        <CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {isHe ? 'התחיל בשעה' : 'Started at'}
          </p>
          <p className="mt-1 text-lg font-semibold">
            {startedAt ? startedAt.toLocaleTimeString(isHe ? 'he-IL' : 'en-IL', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
        </CardContent>
      </Card>
      <Card data-testid="booking-live-duration">
        <CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {isHe ? 'משך' : 'Duration'}
          </p>
          <p className="mt-1 text-lg font-semibold">
            {durationSec != null ? formatDuration(durationSec, isHe) : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FooterNote({ isHe }: { isHe: boolean }) {
  return (
    <p className="mt-6 text-center text-xs text-gray-500">
      {isHe
        ? 'המיקום מתעדכן אוטומטית כל 10 שניות בזמן שירות פעיל.'
        : 'Location refreshes automatically every 10 seconds while the service is active.'}
    </p>
  );
}

function UnavailablePanel({
  error, isHe, backHref,
}: {
  error: 'not_found' | 'forbidden' | 'unknown' | undefined;
  isHe: boolean;
  backHref: string;
}) {
  // Show the same message for not_found + forbidden (privacy 404 — never
  // confirm the booking exists to a caller who isn't a party to it).
  const generic = error === 'not_found' || error === 'forbidden' || error == null;
  return (
    <Card className="border-amber-200 bg-amber-50" data-testid="booking-live-unavailable">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold text-amber-900">
              {isHe ? 'לא ניתן להציג מעקב חי' : 'We couldn’t load this service'}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {generic
                ? (isHe
                  ? 'ייתכן שהשירות עדיין לא התחיל, שהוא לא בנתיב שלך, או שהוא הסתיים.'
                  : 'The service may not have started yet, may not belong to you, or may already be finished.')
                : (isHe ? 'שגיאה זמנית — נסה שוב.' : 'A temporary error occurred. Try again.')}
            </p>
            <Link href={backHref}>
              <Button variant="outline" size="sm" className="mt-3" data-testid="booking-live-back-to-booking">
                {isHe ? 'חזרה להזמנה' : 'Back to booking'}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── helpers ────────────────────────────────────────────────────────── */

function secondsSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}
function minutesSince(iso: string | null | undefined): number | null {
  const s = secondsSince(iso);
  return s == null ? null : Math.round(s / 60);
}
function formatAge(seconds: number | null, isHe: boolean): string {
  if (seconds == null) return isHe ? 'לא ידוע' : 'unknown';
  if (seconds < 60) return isHe ? `לפני ${seconds} שניות` : `${seconds}s ago`;
  const min = Math.round(seconds / 60);
  if (min < 60) return isHe ? `לפני ${min} דק'` : `${min} min ago`;
  const hr = Math.round(min / 60);
  return isHe ? `לפני ${hr} שעות` : `${hr}h ago`;
}
function formatDuration(seconds: number, isHe: boolean): string {
  const min = Math.round(seconds / 60);
  if (min < 60) return isHe ? `${min} דקות` : `${min} min`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  return isHe ? `${hr}‏ש‏ ${rem}‏ד‏` : `${hr}h ${rem}m`;
}
function statusEyebrow(session: ServiceSessionDTO, isHe: boolean): string {
  const label = (() => {
    switch (session.source) {
      case 'walk_bookings':    return isHe ? 'טיול כלב' : 'Dog walk';
      case 'pettrek_trips':    return isHe ? 'הסעת חיה' : 'Pet transport';
      default: {
        const s = session.serviceType || '';
        if (s === 'dog_walking')   return isHe ? 'טיול כלב'    : 'Dog walk';
        if (s === 'pet_sitting')   return isHe ? 'שמרטפות'     : 'Pet sitting';
        if (s === 'training')      return isHe ? 'אילוף'       : 'Training';
        if (s === 'k9000_wash')    return isHe ? 'K9000'       : 'K9000';
        return isHe ? 'שירות' : 'Service';
      }
    }
  })();
  return label;
}
