/**
 * ProviderToday — the WhatIDog-benchmark focused provider view.
 *
 * Per CEO 2026-08-18 §"Provider TODAY" and §"DASHBOARD 'TODAY'":
 *   Provider home should detect: booking beginning soon.
 *   Show huge primary action: START WALK
 *   not: open dashboard → open bookings → find booking → open booking →
 *        scroll → click start.
 *
 * This is a SEPARATE surface from the existing ProviderHome / ProviderOS
 * dashboards. Both stay — this is the focused "one primary action, right
 * now" view the CEO benchmark asks for.
 *
 * Reads /api/provider-dashboard/v2/upcoming (already server-authoritative,
 * scoped to the caller's provider_id). Renders:
 *   1. The single most-imminent booking with a huge state-aware primary CTA
 *      (Start / Finish / View) sized by the CEO spec.
 *   2. The rest of today's schedule as compact rows.
 *   3. A quiet link to the full ProviderHome / ProviderOS dashboards for
 *      administrative work.
 *
 * Actions call the CANONICAL per-service endpoints already on the server:
 *   POST /api/booking-requests/:id/arriving
 *   POST /api/booking-requests/:id/start
 *   POST /api/booking-requests/:id/complete
 *
 * No new backend contract. No money math. No canonical-state change. No
 * cross-tenant risk (server derives provider_id from the Firebase token
 * on every one of those endpoints — client-supplied identity is ignored).
 */

import { useMemo, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock, MapPin, Dog, ChevronRight, Loader2, CalendarDays, RefreshCw,
  PlayCircle, Flag, Navigation2, Info,
} from 'lucide-react';

const IMMINENT_MINUTES = 15; // "starting soon" window per CEO spec

type UpcomingBooking = {
  id: string;
  // requestId is the public booking reference. The server routes
  // /api/booking-requests/:requestId/{start,complete,arriving,meet-greet}
  // match on booking_requests.requestId — NOT the internal numeric row
  // id. `id` here is `String(row.id)` (see toV1Shape in
  // server/routes/provider-dashboard-v2.ts) so posting to those routes
  // with `id` yields a 404. Always send `requestId` when calling those
  // handlers; fall back to `id` only for surfaces that navigate to a
  // client-side detail page keyed on the internal id.
  requestId?: string | null;
  bookingNumber?: string | null;
  userId?: string | null;
  providerId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  serviceType?: string | null;
  specialRequests?: string | null;
  status?: string | null;
  total?: string | null;
  currency?: string | null;
};

function minutesUntil(iso?: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now.getTime()) / 60000);
}

function isSameDay(iso?: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const nowIL = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const dIL = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  return (
    dIL.getFullYear() === nowIL.getFullYear() &&
    dIL.getMonth() === nowIL.getMonth() &&
    dIL.getDate() === nowIL.getDate()
  );
}

function fmtTime(iso?: string | null, locale = 'he-IL'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
}

function serviceLabel(t: string | null | undefined, isHe: boolean): string {
  const key = (t || '').toLowerCase();
  const map: Record<string, [string, string]> = {
    dog_walking:        ['Dog Walk',       'טיול עם הכלב'],
    pet_sitting:        ['Pet Sitting',    'שמרטוף'],
    boarding:           ['Boarding',       'לינה'],
    drop_in:            ['Drop-in Visit',  'ביקור קצר'],
    training:           ['Training',       'אימון'],
    pet_transport:      ['Pet Transport',  'הסעת חיה'],
    k9000_wash:         ['K9000 Wash',     'שטיפת K9000'],
  };
  const pair = map[key];
  if (pair) return isHe ? pair[1] : pair[0];
  return t || (isHe ? 'שירות' : 'Service');
}

/** State-aware primary action per CEO §"BOOKING CARD"/"Provider Booking Card". */
type PrimaryAction =
  | { kind: 'start';    label: string; endpoint: 'start' }
  | { kind: 'arriving'; label: string; endpoint: 'arriving' }
  | { kind: 'complete'; label: string; endpoint: 'complete' }
  | { kind: 'view';     label: string; endpoint: null };

function resolvePrimary(b: UpcomingBooking, isHe: boolean): PrimaryAction {
  const status = (b.status || '').toLowerCase();
  const minsLeft = minutesUntil(b.startTime);
  const svc = serviceLabel(b.serviceType, isHe);

  if (status === 'in_progress' || status === 'started') {
    return { kind: 'complete', endpoint: 'complete', label: isHe ? `סיים ${svc}` : `FINISH ${svc.toUpperCase()}` };
  }
  if (status === 'confirmed' && minsLeft != null && minsLeft <= IMMINENT_MINUTES) {
    return { kind: 'start', endpoint: 'start', label: isHe ? `התחל ${svc}` : `START ${svc.toUpperCase()}` };
  }
  if (status === 'confirmed' && minsLeft != null && minsLeft <= 60) {
    return { kind: 'arriving', endpoint: 'arriving', label: isHe ? 'בדרך' : "I'M ON THE WAY" };
  }
  return { kind: 'view', endpoint: null, label: isHe ? 'פרטי הזמנה' : 'View details' };
}

export default function ProviderToday() {
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const { toast } = useToast();
  const qc = useQueryClient();

  // Tick every 30s so the "starting soon" window flips without a manual refresh.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const upcomingQ = useQuery<{ success?: boolean; upcoming?: UpcomingBooking[] }>({
    queryKey: ['/api/provider-dashboard/v2/upcoming'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/provider-dashboard/v2/upcoming');
      if (!res.ok) throw new Error(`Upcoming fetch failed (${res.status})`);
      return res.json();
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const list = useMemo(() => {
    const raw = upcomingQ.data?.upcoming ?? [];
    // Only TODAY. Everything else lives on the full ProviderHome.
    const today = raw.filter((b) => isSameDay(b.startTime));
    today.sort((a, b) => {
      const at = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
      return at - bt;
    });
    return today;
    // `tick` keeps this memo fresh so `minutesUntil` re-evaluates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingQ.data, tick]);

  const focus = list[0];
  const rest = list.slice(1);

  const primary = focus ? resolvePrimary(focus, isHe) : null;

  const actionMutation = useMutation({
    mutationFn: async ({ id, endpoint }: { id: string; endpoint: 'start' | 'arriving' | 'complete' }) => {
      const res = await apiRequest('POST', `/api/booking-requests/${id}/${endpoint}`, {});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || body?.message || `Action failed (${res.status})`);
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/upcoming'] });
      qc.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/stats'] });
    },
    onError: (err: any) => {
      toast({
        title: isHe ? 'הפעולה נכשלה' : 'Action failed',
        description: err?.message || (isHe ? 'נסה שוב.' : 'Please try again.'),
        variant: 'destructive',
      });
    },
  });

  const trigger = (b: UpcomingBooking, action: PrimaryAction) => {
    if (actionMutation.isPending) return;
    if (action.endpoint == null) {
      navigate(`/provider/jobs/${b.id}`);
      return;
    }
    // CRITICAL fix (2026-08-18 adversarial review): the server routes
    // /api/booking-requests/:requestId/{start,complete,arriving} match on
    // booking_requests.requestId, NOT the internal numeric row `id`.
    // Prior code sent `b.id` (String(row.id)) → every tap 404'd. Use
    // requestId if available; only fall back to id for legacy row shapes
    // that never populated requestId.
    const pathId = b.requestId || b.id;
    actionMutation.mutate({ id: pathId, endpoint: action.endpoint });
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white" dir={isHe ? 'rtl' : 'ltr'} data-testid="provider-today-root">
        <main className="container mx-auto max-w-2xl px-4 py-6">
          {/* Header */}
          <div className="mb-6 flex items-baseline justify-between">
            <h1 className="text-3xl font-bold tracking-tight" data-testid="provider-today-title">
              {isHe ? 'היום' : 'Today'}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => upcomingQ.refetch()}
              data-testid="provider-today-refresh"
              aria-label={isHe ? 'רענן' : 'Refresh'}
            >
              <RefreshCw className={`h-4 w-4 ${upcomingQ.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Loading skeleton */}
          {upcomingQ.isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {/* Error */}
          {upcomingQ.isError && (
            <Card className="border-red-200 bg-red-50" data-testid="provider-today-error">
              <CardContent className="p-4 text-sm text-red-800">
                {isHe ? 'לא הצלחנו לטעון את היום שלך. נסה שוב.' : "We couldn't load your day. Please try again."}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!upcomingQ.isLoading && !upcomingQ.isError && list.length === 0 && (
            <Card data-testid="provider-today-empty">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <CalendarDays className="h-10 w-10 text-gray-400" />
                <p className="text-lg font-medium text-gray-800">
                  {isHe ? 'אין הזמנות היום' : 'Nothing scheduled today'}
                </p>
                <p className="text-sm text-gray-500 max-w-xs">
                  {isHe
                    ? 'כשלקוח יזמין אותך להיום, ההזמנה תופיע כאן — עם כפתור פעולה אחד גדול.'
                    : 'When a customer books you for today, it lands here with one big action button.'}
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/provider-os')}
                  data-testid="provider-today-open-dashboard"
                >
                  {isHe ? 'פתח לוח בקרה מלא' : 'Open full dashboard'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Focus card — huge state-aware primary action */}
          {focus && primary && (
            <FocusCard
              booking={focus}
              primary={primary}
              isHe={isHe}
              onTrigger={() => trigger(focus, primary)}
              busy={actionMutation.isPending}
            />
          )}

          {/* Rest of today, compact */}
          {rest.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {isHe ? 'ההמשך היום' : 'Next today'}
              </h2>
              <div className="space-y-2">
                {rest.map((b) => (
                  <NextRow key={b.id} booking={b} isHe={isHe} onOpen={() => navigate(`/provider/jobs/${b.id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* Quiet exit to the full dashboard */}
          {list.length > 0 && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => navigate('/provider-os')}
                className="text-sm text-gray-500 underline hover:text-gray-800"
                data-testid="provider-today-open-full"
              >
                {isHe ? 'לוח בקרה מלא' : 'Full provider dashboard'}
              </button>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}

function FocusCard({
  booking, primary, isHe, onTrigger, busy,
}: {
  booking: UpcomingBooking;
  primary: PrimaryAction;
  isHe: boolean;
  onTrigger: () => void;
  busy: boolean;
}) {
  const mins = minutesUntil(booking.startTime);
  const time = fmtTime(booking.startTime, isHe ? 'he-IL' : 'en-IL');
  const svc = serviceLabel(booking.serviceType, isHe);
  const pets = booking.specialRequests
    ? (booking.specialRequests.length > 60 ? booking.specialRequests.slice(0, 60) + '…' : booking.specialRequests)
    : null;

  const eyebrow = booking.status === 'in_progress' || booking.status === 'started'
    ? (isHe ? 'בתהליך' : 'IN PROGRESS')
    : mins != null && mins <= 0
      ? (isHe ? 'עכשיו' : 'NOW')
      : mins != null && mins <= IMMINENT_MINUTES
        ? (isHe ? `בעוד ${mins} דק'` : `IN ${mins} MIN`)
        : (isHe ? `בשעה ${time}` : `AT ${time}`);

  const Icon =
    primary.kind === 'start'    ? PlayCircle :
    primary.kind === 'complete' ? Flag :
    primary.kind === 'arriving' ? Navigation2 :
                                  Info;

  return (
    <Card data-testid="provider-today-focus" className="border-2 border-black shadow-lg">
      <CardContent className="p-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700">{eyebrow}</p>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-4xl font-bold leading-tight" data-testid="provider-today-focus-time">{time}</div>
            <div className="mt-1 text-lg text-gray-900">{svc}</div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div className="font-mono">{booking.bookingNumber || `#${booking.id}`}</div>
          </div>
        </div>

        {pets && (
          <div className="mt-3 flex items-start gap-2 text-sm text-gray-700">
            <Dog className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
            <span>{pets}</span>
          </div>
        )}

        {/* Huge primary action per CEO spec */}
        <Button
          type="button"
          onClick={onTrigger}
          disabled={busy}
          className="mt-5 h-14 w-full text-base font-semibold"
          data-testid={`provider-today-primary-${primary.kind}`}
          aria-label={primary.label}
        >
          {busy ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <Icon className="me-2 h-5 w-5" />}
          {primary.label}
        </Button>
      </CardContent>
    </Card>
  );
}

function NextRow({ booking, isHe, onOpen }: { booking: UpcomingBooking; isHe: boolean; onOpen: () => void }) {
  const time = fmtTime(booking.startTime, isHe ? 'he-IL' : 'en-IL');
  const svc = serviceLabel(booking.serviceType, isHe);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-start hover:bg-gray-50"
      data-testid={`provider-today-next-${booking.id}`}
    >
      <div className="flex items-center gap-3">
        <Clock className="h-4 w-4 text-gray-500" />
        <div>
          <div className="text-sm font-semibold text-gray-900">{time}</div>
          <div className="text-xs text-gray-600">{svc}</div>
        </div>
      </div>
      <ChevronRight className={`h-4 w-4 text-gray-400 ${isHe ? 'rotate-180' : ''}`} />
    </button>
  );
}
