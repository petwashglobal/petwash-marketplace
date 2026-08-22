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
 *   POST /api/booking-requests/:requestId/arriving
 *   POST /api/booking-requests/:requestId/start
 *   POST /api/booking-requests/:requestId/complete
 *   POST /api/booking-requests/:requestId/meet-greet  { action: 'complete' }
 *      — Meet & Greet completion, per CEO §"Meet & Greet as first-class
 *        state". Server enforces that only the provider can complete;
 *        state machine enforces the transition to meet_greet_completed.
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
  PlayCircle, Flag, Navigation2, Info, Handshake,
} from 'lucide-react';

const IMMINENT_MINUTES = 15; // "starting soon" window per CEO spec

type UpcomingBooking = {
  id: string;
  requestId?: string | null;   // canonical public booking id — meet-greet route uses this
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
  // Meet & Greet — only populated when status is a meet_greet_* state
  meetGreetDate?: string | null;
  meetGreetLocation?: string | null;
  meetGreetNotes?: string | null;
};

/**
 * "When does this booking actually happen from the provider's POV?"
 * For meet_greet_scheduled rows, the effective time is the meet_greet_date
 * (the interview), NOT start_date (the eventual service that hasn't been
 * paid for yet). For everything else, use startTime.
 */
function effectiveStart(b: UpcomingBooking): string | null | undefined {
  if ((b.status || '').toLowerCase() === 'meet_greet_scheduled' && b.meetGreetDate) {
    return b.meetGreetDate;
  }
  return b.startTime;
}

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
  | { kind: 'start';                label: string; endpoint: 'start' }
  | { kind: 'arriving';             label: string; endpoint: 'arriving' }
  | { kind: 'complete';             label: string; endpoint: 'complete' }
  | { kind: 'meet_greet_complete';  label: string; endpoint: 'meet-greet' }
  // New first-class actions (Lane C audit 2026-08-22 highest-leverage #6):
  // server emitted ACCEPT / DECLINE / SCHEDULE_MEET_GREET but the client
  // collapsed all three to "View details", forcing a second tap into
  // /provider/jobs/:id. Surface them here so Rover/MadPaws-style one-tap
  // accept works from Today.
  | { kind: 'accept';               label: string; endpoint: 'accept' }
  | { kind: 'decline';              label: string; endpoint: 'decline' }
  | { kind: 'schedule_meet_greet';  label: string; endpoint: 'meet-greet-schedule' }
  | { kind: 'view';                 label: string; endpoint: null };

/**
 * Bridge server-authoritative `primaryAction` (CEO §P1-17, shipped in
 * provider-dashboard-v2 DTO) to this file's local PrimaryAction shape.
 * Returns null when the server didn't emit a primaryAction (older DTOs
 * or a status the server chose not to gate here) — caller falls back to
 * the local `resolvePrimary` derivation. When both server and local
 * agree, the server wins; when the server says VIEW_DETAILS but the
 * local rule would have offered an action, the server still wins (CEO
 * §P1-17: "Frontend decides button appearance. Do NOT make client infer
 * eligibility from text label only.").
 */
function primaryFromServer(b: UpcomingBooking, isHe: boolean): PrimaryAction | null {
  const svr = (b as any).primaryAction as string | undefined;
  if (!svr) return null;
  const svc = serviceLabel(b.serviceType, isHe);
  switch (svr) {
    case 'START_SERVICE':
      return { kind: 'start', endpoint: 'start', label: isHe ? `התחל ${svc}` : `START ${svc.toUpperCase()}` };
    case 'FINISH_SERVICE':
      return { kind: 'complete', endpoint: 'complete', label: isHe ? `סיים ${svc}` : `FINISH ${svc.toUpperCase()}` };
    case 'ARRIVING':
      return { kind: 'arriving', endpoint: 'arriving', label: isHe ? 'בדרך' : "I'M ON THE WAY" };
    case 'COMPLETE_MEET_GREET':
      return { kind: 'meet_greet_complete', endpoint: 'meet-greet', label: isHe ? 'סיים היכרות' : 'COMPLETE MEET & GREET' };
    case 'ACCEPT':
      return { kind: 'accept', endpoint: 'accept', label: isHe ? 'אשר הזמנה' : 'ACCEPT' };
    case 'DECLINE':
      return { kind: 'decline', endpoint: 'decline', label: isHe ? 'דחה' : 'DECLINE' };
    case 'SCHEDULE_MEET_GREET':
      return { kind: 'schedule_meet_greet', endpoint: 'meet-greet-schedule', label: isHe ? 'קבע פגישת היכרות' : 'SCHEDULE MEET & GREET' };
    case 'VIEW_DETAILS':
    case 'MESSAGE':
    default:
      // Genuinely no active step — surface View.
      return { kind: 'view', endpoint: null, label: isHe ? 'פרטי הזמנה' : 'View details' };
  }
}

function resolvePrimary(b: UpcomingBooking, isHe: boolean): PrimaryAction {
  // Prefer server-computed action when the DTO carries it (P1-17).
  const fromServer = primaryFromServer(b, isHe);
  if (fromServer) return fromServer;

  // Legacy fallback for older DTOs that don't emit primaryAction yet.
  const status = (b.status || '').toLowerCase();
  const minsLeft = minutesUntil(effectiveStart(b));
  const svc = serviceLabel(b.serviceType, isHe);

  // Meet & Greet — provider is the one who marks it complete after the
  // in-person / video interview. Show COMPLETE MEET & GREET once the
  // scheduled time is "here" (within IMMINENT_MINUTES going forward, or
  // any time in the past — meet-greets often run over).
  if (status === 'meet_greet_scheduled' && minsLeft != null && minsLeft <= IMMINENT_MINUTES) {
    return {
      kind: 'meet_greet_complete',
      endpoint: 'meet-greet',
      label: isHe ? 'סיים היכרות' : 'COMPLETE MEET & GREET',
    };
  }
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
    // For meet_greet_scheduled bookings, "today" is judged against the
    // meet_greet_date (the interview), not start_date (the eventual paid
    // service that isn't confirmed yet). Same rule for sort order.
    const today = raw.filter((b) => isSameDay(effectiveStart(b)));
    today.sort((a, b) => {
      const at = effectiveStart(a);
      const bt = effectiveStart(b);
      const atn = at ? new Date(at).getTime() : 0;
      const btn = bt ? new Date(bt).getTime() : 0;
      return atn - btn;
    });
    return today;
    // `tick` keeps this memo fresh so `minutesUntil` re-evaluates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingQ.data, tick]);

  const focus = list[0];
  const rest = list.slice(1);

  const primary = focus ? resolvePrimary(focus, isHe) : null;

  const actionMutation = useMutation({
    mutationFn: async ({
      id, endpoint, body,
    }: {
      id: string;
      endpoint: 'start' | 'arriving' | 'complete' | 'meet-greet' | 'accept' | 'decline' | 'meet-greet-schedule';
      body?: unknown;
    }) => {
      // The accept/decline/meet-greet-schedule endpoints all live under
      // /api/booking-requests/:id/... and share the same auth + idempotency
      // wrappers as start/complete/etc — see booking-requests.ts.
      // meet-greet-schedule reuses the same /meet-greet route with
      // action:'schedule' in the body.
      const path = endpoint === 'meet-greet-schedule' ? 'meet-greet' : endpoint;
      const res = await apiRequest('POST', `/api/booking-requests/${id}/${path}`, body ?? {});
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || payload?.message || `Action failed (${res.status})`);
      return payload;
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
    // Meet-greet route is keyed on requestId (public booking reference),
    // not the internal numeric id. Every other action accepts either but
    // requestId is the canonical public id, so prefer it.
    const pathId = b.requestId || b.id;
    if (action.endpoint === 'meet-greet') {
      actionMutation.mutate({ id: pathId, endpoint: 'meet-greet', body: { action: 'complete' } });
      return;
    }
    if (action.endpoint === 'meet-greet-schedule') {
      // Schedule needs a date/location — hand off to the full job page
      // where the calendar picker lives. (First-class inline schedule
      // form is a bigger UX change; ship the ACCEPT/DECLINE fast-paths
      // now and route SCHEDULE to the existing UI.)
      navigate(`/provider/jobs/${b.id}`);
      return;
    }
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
  const isMeetGreet = (booking.status || '').toLowerCase() === 'meet_greet_scheduled';
  const startIso = effectiveStart(booking);
  const mins = minutesUntil(startIso);
  const time = fmtTime(startIso, isHe ? 'he-IL' : 'en-IL');
  const svc = serviceLabel(booking.serviceType, isHe);
  const pets = booking.specialRequests
    ? (booking.specialRequests.length > 60 ? booking.specialRequests.slice(0, 60) + '…' : booking.specialRequests)
    : null;

  const eyebrowBase = booking.status === 'in_progress' || booking.status === 'started'
    ? (isHe ? 'בתהליך' : 'IN PROGRESS')
    : mins != null && mins <= 0
      ? (isHe ? 'עכשיו' : 'NOW')
      : mins != null && mins <= IMMINENT_MINUTES
        ? (isHe ? `בעוד ${mins} דק'` : `IN ${mins} MIN`)
        : (isHe ? `בשעה ${time}` : `AT ${time}`);

  const eyebrow = isMeetGreet
    ? (isHe ? `היכרות · ${eyebrowBase}` : `MEET & GREET · ${eyebrowBase}`)
    : eyebrowBase;

  const Icon =
    primary.kind === 'meet_greet_complete' ? Handshake :
    primary.kind === 'start'               ? PlayCircle :
    primary.kind === 'complete'            ? Flag :
    primary.kind === 'arriving'            ? Navigation2 :
                                             Info;

  return (
    <Card data-testid="provider-today-focus" className="border-2 border-black shadow-lg">
      <CardContent className="p-6">
        <p className={`mb-1 text-xs font-semibold uppercase tracking-wider ${isMeetGreet ? 'text-indigo-700' : 'text-amber-700'}`}>{eyebrow}</p>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-4xl font-bold leading-tight" data-testid="provider-today-focus-time">{time}</div>
            <div className="mt-1 text-lg text-gray-900">
              {isMeetGreet ? (isHe ? `היכרות לפני ${svc}` : `Meet & Greet · ${svc}`) : svc}
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div className="font-mono">{booking.bookingNumber || `#${booking.id}`}</div>
          </div>
        </div>

        {/* Meet & Greet — surface the location + provider-facing note so
            the provider isn't forced into details to see where to go. */}
        {isMeetGreet && booking.meetGreetLocation && (
          <div className="mt-3 flex items-start gap-2 text-sm text-gray-700" data-testid="provider-today-mg-location">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
            <span>{booking.meetGreetLocation}</span>
          </div>
        )}
        {isMeetGreet && booking.meetGreetNotes && (
          <div className="mt-2 flex items-start gap-2 text-sm text-gray-700">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
            <span>{booking.meetGreetNotes.length > 80 ? booking.meetGreetNotes.slice(0, 80) + '…' : booking.meetGreetNotes}</span>
          </div>
        )}

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
  const isMeetGreet = (booking.status || '').toLowerCase() === 'meet_greet_scheduled';
  const time = fmtTime(effectiveStart(booking), isHe ? 'he-IL' : 'en-IL');
  const svc = serviceLabel(booking.serviceType, isHe);
  const label = isMeetGreet
    ? (isHe ? `היכרות · ${svc}` : `Meet & Greet · ${svc}`)
    : svc;
  const RowIcon = isMeetGreet ? Handshake : Clock;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-start hover:bg-gray-50"
      data-testid={`provider-today-next-${booking.id}`}
    >
      <div className="flex items-center gap-3">
        <RowIcon className={`h-4 w-4 ${isMeetGreet ? 'text-indigo-600' : 'text-gray-500'}`} />
        <div>
          <div className="text-sm font-semibold text-gray-900">{time}</div>
          <div className="text-xs text-gray-600">{label}</div>
        </div>
      </div>
      <ChevronRight className={`h-4 w-4 text-gray-400 ${isHe ? 'rotate-180' : ''}`} />
    </button>
  );
}
