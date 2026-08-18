/**
 * LiveServiceCard — compact drop-in surface that renders the canonical
 * ServiceSessionDTO for a given bookingRef.
 *
 * Per CEO 2026-08-18 §14 + §16:
 *   Customer needs one obvious Track Service experience.
 *   Show "Last updated N seconds ago" — do NOT pretend an old marker is live.
 *
 * Consumers drop this into any surface that has a bookingRef and wants a
 * live-service summary:
 *   <LiveServiceCard bookingRef={booking.requestId} />
 *
 * Handles:
 *   • loading    → skeleton
 *   • not_found  → nothing (silent — caller decides what to show)
 *   • forbidden  → nothing (least-privilege UX)
 *   • active     → status label + "started N min ago" + last GPS ping age
 *   • completed  → status + when it ended
 *   • cancelled  → status only
 *
 * NO map rendering — that comes in a follow-up (customer LiveMap screen,
 * §35.10). This is the compact "live pulse" widget that fits anywhere.
 */

import { Link } from 'wouter';
import { useLanguage } from '@/lib/languageStore';
import { useServiceSession } from '@/hooks/useServiceSession';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, MapPin, CheckCircle2, XCircle, Clock, ChevronRight } from 'lucide-react';
import type { ServiceSessionDTO } from '@shared/lib/serviceSession';

export interface LiveServiceCardProps {
  bookingRef: string | null | undefined;
  /** Extra outer classes. */
  className?: string;
  /** Test-id root; default 'live-service-card'. */
  testId?: string;
}

export function LiveServiceCard({
  bookingRef, className = '', testId = 'live-service-card',
}: LiveServiceCardProps) {
  const { language } = useLanguage();
  const isHe = language === 'he';
  const { session, error, isLoading } = useServiceSession(bookingRef);

  if (!bookingRef) return null;
  if (isLoading) {
    return <Skeleton className={`h-16 w-full rounded-lg ${className}`} data-testid={`${testId}-loading`} />;
  }
  if (error || !session) return null;

  // Only make the card tap-through when the session is worth watching.
  // For scheduled/cancelled statuses there is nothing to drill into.
  const canDrillDown = session.isActive || session.status === 'completed';
  const liveHref = `/booking/${encodeURIComponent(bookingRef)}/live`;
  const chevron = <ChevronRight className={`h-4 w-4 text-gray-400 ${isHe ? 'rotate-180' : ''}`} />;

  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <StatusRow session={session} isHe={isHe} testId={testId} />
          {session.isActive && (
            <LastPingRow session={session} isHe={isHe} testId={testId} />
          )}
        </div>
        {canDrillDown && chevron}
      </div>
    </>
  );

  const baseClass = `block rounded-lg border border-gray-200 bg-white p-3 ${className}`;

  if (canDrillDown) {
    return (
      <Link
        href={liveHref}
        className={`${baseClass} transition hover:border-gray-300 hover:bg-gray-50`}
        data-testid={testId}
        aria-label={isHe ? 'פתח מעקב חי' : 'Open live tracking'}
      >
        <div dir={isHe ? 'rtl' : 'ltr'}>{inner}</div>
      </Link>
    );
  }

  return (
    <div
      dir={isHe ? 'rtl' : 'ltr'}
      className={baseClass}
      data-testid={testId}
    >
      {inner}
    </div>
  );
}

function StatusRow({
  session, isHe, testId,
}: {
  session: ServiceSessionDTO;
  isHe: boolean;
  testId: string;
}) {
  const { icon, label, tone } = statusRowContent(session, isHe);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={tone}>{icon}</span>
      <span className="font-medium text-gray-900" data-testid={`${testId}-status`}>{label}</span>
    </div>
  );
}

function statusRowContent(session: ServiceSessionDTO, isHe: boolean) {
  switch (session.status) {
    case 'in_progress': {
      const startedAgoMin = minutesAgo(session.startedAt);
      const suffix = startedAgoMin != null
        ? (isHe ? ` · לפני ${startedAgoMin} דק'` : ` · started ${startedAgoMin} min ago`)
        : '';
      return {
        icon: <Activity className="h-4 w-4 animate-pulse" />,
        label: (isHe ? 'בתהליך' : 'In progress') + suffix,
        tone: 'text-blue-600',
      };
    }
    case 'awaiting_report':
      return {
        icon: <Clock className="h-4 w-4" />,
        label: isHe ? 'הספק סיים — ממתין לאישור' : 'Provider finished — awaiting confirmation',
        tone: 'text-amber-700',
      };
    case 'completed':
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        label: isHe ? 'הושלם' : 'Completed',
        tone: 'text-green-600',
      };
    case 'cancelled':
      return {
        icon: <XCircle className="h-4 w-4" />,
        label: isHe ? 'בוטל' : 'Cancelled',
        tone: 'text-red-600',
      };
    case 'scheduled':
    default:
      return {
        icon: <Clock className="h-4 w-4" />,
        label: isHe ? 'מתוכנן' : 'Scheduled',
        tone: 'text-gray-600',
      };
  }
}

/**
 * "Last updated N seconds/minutes ago" — CEO §16 exact requirement.
 * If the source has no lastLocation, show "no live location yet" instead
 * of a fake marker.
 */
function LastPingRow({
  session, isHe, testId,
}: {
  session: ServiceSessionDTO;
  isHe: boolean;
  testId: string;
}) {
  if (!session.lastLocation) {
    return (
      <div
        className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500"
        data-testid={`${testId}-no-location`}
      >
        <MapPin className="h-3.5 w-3.5" />
        {isHe ? 'אין עדיין מיקום חי' : 'No live location yet'}
      </div>
    );
  }
  const ageSec = secondsAgo(session.lastLocation.recordedAt);
  const ageLabel = formatAge(ageSec, isHe);
  const stale = ageSec != null && ageSec > 60;
  return (
    <div
      className={`mt-1.5 flex items-center gap-1.5 text-xs ${stale ? 'text-amber-700' : 'text-gray-600'}`}
      data-testid={`${testId}-last-ping`}
    >
      <MapPin className="h-3.5 w-3.5" />
      {isHe ? `עודכן ${ageLabel}` : `Updated ${ageLabel}`}
    </div>
  );
}

function formatAge(seconds: number | null, isHe: boolean): string {
  if (seconds == null) return isHe ? 'לא ידוע' : 'unknown';
  if (seconds < 60) return isHe ? `לפני ${seconds} שניות` : `${seconds}s ago`;
  const min = Math.round(seconds / 60);
  if (min < 60) return isHe ? `לפני ${min} דק'` : `${min} min ago`;
  const hr = Math.round(min / 60);
  return isHe ? `לפני ${hr} שעות` : `${hr}h ago`;
}

function secondsAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}

function minutesAgo(iso: string | null | undefined): number | null {
  const s = secondsAgo(iso);
  return s == null ? null : Math.round(s / 60);
}
