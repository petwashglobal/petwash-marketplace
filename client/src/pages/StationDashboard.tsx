/**
 * Station Daily Dashboard — Phase 10, Task #26
 *
 * Route: /station/:stationId/dashboard
 * Auth:  requireStationRole('worker') — any active station operator can access.
 *
 * Sections:
 *   1. Downtime banner (shown only if station has active downtime)
 *   2. Today at a glance (bookings vs capacity, earnings, open disputes)
 *   3. Capacity progress bar
 *   4. Live booking list for today
 *   5. This-month settlement split
 *   6. Open disputes with links
 *
 * Franchise-owner header: a station selector dropdown when the user operates
 * more than one station (loaded from /api/station-operators/my-stations).
 *
 * Hebrew/RTL fully supported.
 */

import { useState } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Wrench,
  CalendarDays,
  Receipt,
  BarChart3,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

// ─── Types ────────────────────────────────────────────────────────────────────

type MyStation = {
  id: number;
  name: string;
  nameHe: string | null;
  role: string;
  isActive: boolean;
  equipmentStatus: string;
};

type Booking = {
  id: string;
  bookingNumber: string;
  customerId: string;
  customerName: string | null;
  serviceType: string | null;
  startTime: string;
  endTime: string;
  status: string;
  totalILS: number;
};

type Dispute = {
  id: number;
  caseRef: string;
  bookingId: string;
  amountDisputedCents: number;
  status: string;
  openedAt: string;
};

type DashboardData = {
  stationId: number;
  stationName: string;
  stationNameHe: string | null;
  stationStatus: string;
  isActive: boolean;
  callerRole: string;
  capacity: {
    daily: number;
    usedToday: number;
    remaining: number;
    atCapacity: boolean;
  };
  operationalStatus: {
    equipmentStatus: string;
    nextDowntimeStart: string | null;
    nextDowntimeEnd: string | null;
  };
  activeDowntime: {
    id: number;
    reason: string;
    startAt: string;
    endAt: string | null;
    reportedBy: string | null;
  } | null;
  glance: {
    bookingsToday: number;
    earningsTodayILS: number;
    openDisputeCount: number;
  };
  todayBookings: Booking[];
  settlement: {
    thisMonth: {
      totalRevenueCents: number;
      stationShareCents: number;
      platformFeeCents: number;
      franchiseShareCents: number;
      settlementCount: number;
    };
  };
  openDisputes: Dispute[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function centsToILS(cents: number) {
  return (cents / 100).toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });
}

function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jerusalem',
  });
}

// ─── Status chip ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { labelEn: string; labelHe: string; color: string }
> = {
  confirmed:    { labelEn: 'Confirmed',  labelHe: 'מאושר',   color: 'bg-blue-100 text-blue-700 border-blue-300' },
  pending:      { labelEn: 'Pending',    labelHe: 'ממתין',   color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  started:      { labelEn: 'In Progress',labelHe: 'בתהליך',  color: 'bg-purple-100 text-purple-700 border-purple-300' },
  completed:    { labelEn: 'Completed',  labelHe: 'הושלם',   color: 'bg-green-100 text-green-700 border-green-300' },
  accepted:     { labelEn: 'Accepted',   labelHe: 'התקבל',   color: 'bg-teal-100 text-teal-700 border-teal-300' },
};

function StatusChip({ status, isHebrew }: { status: string; isHebrew: boolean }) {
  const cfg = STATUS_CONFIG[status] ?? {
    labelEn: status,
    labelHe: status,
    color: 'bg-gray-100 text-gray-700 border-gray-300',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}
    >
      {isHebrew ? cfg.labelHe : cfg.labelEn}
    </span>
  );
}

// ─── Equipment status chip ────────────────────────────────────────────────────

function EquipmentChip({ status, isHebrew }: { status: string; isHebrew: boolean }) {
  if (status === 'operational')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300">
        <CheckCircle2 className="w-3 h-3" />
        {isHebrew ? 'תקין' : 'Operational'}
      </span>
    );
  if (status === 'degraded')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300">
        <AlertTriangle className="w-3 h-3" />
        {isHebrew ? 'ביצועים נמוכים' : 'Degraded'}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-300">
      <Wrench className="w-3 h-3" />
      {isHebrew ? 'לא פעיל' : 'Offline'}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StationDashboard() {
  const params = useParams<{ stationId: string }>();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const initialStationId = parseInt(params.stationId ?? '0', 10);
  const [selectedStationId, setSelectedStationId] = useState<number>(initialStationId);

  // ── My stations (for station selector) ──────────────────────────────────────
  const { data: myStationsData } = useQuery<{ stations: MyStation[] }>({
    queryKey: ['/api/station-operators/my-stations'],
  });

  const myStations = myStationsData?.stations ?? [];
  const showStationSelector = myStations.length > 1;

  // ── Client-side station membership guard ────────────────────────────────────
  // Once my-stations has loaded, verify the selected station is accessible.
  const myStationsLoaded = myStationsData !== undefined;
  const isStationAccessible =
    !myStationsLoaded || myStations.some((s) => s.id === selectedStationId);

  // ── Dashboard data ───────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<DashboardData>({
    queryKey: [`/api/stations/${selectedStationId}/dashboard`],
    enabled: selectedStationId > 0 && isStationAccessible,
    refetchInterval: 60_000, // auto-refresh every 60 s
  });

  function handleStationChange(value: string) {
    const id = parseInt(value, 10);
    setSelectedStationId(id);
    navigate(`/station/${id}/dashboard`);
  }

  // ─── Loading / error states ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  // Client-side membership guard: station not in user's list
  if (myStationsLoaded && !isStationAccessible) {
    return (
      <div
        className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4"
        dir={isHebrew ? 'rtl' : 'ltr'}
      >
        <Card className="max-w-sm w-full">
          <CardContent className="pt-10 pb-10 text-center">
            <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">
              {isHebrew
                ? 'אין לך הרשאה לצפות בעמדה זו.'
                : 'You do not have access to this station.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4"
        dir={isHebrew ? 'rtl' : 'ltr'}
      >
        <Card className="max-w-sm w-full">
          <CardContent className="pt-10 pb-10 text-center">
            <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">
              {isHebrew
                ? 'אין גישה לעמדה זו, או שהיא אינה קיימת.'
                : 'Access denied or station not found.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { capacity, glance, activeDowntime, todayBookings, settlement, openDisputes, operationalStatus } = data;
  const capacityPct = capacity.daily > 0 ? (capacity.usedToday / capacity.daily) * 100 : 0;
  const capacityColor = capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  const sm = settlement.thisMonth;

  const stationDisplayName = isHebrew && data.stationNameHe ? data.stationNameHe : data.stationName;

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6"
      dir={isHebrew ? 'rtl' : 'ltr'}
    >
      <div className="max-w-3xl mx-auto">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <BarChart3 className="w-5 h-5 text-blue-600 shrink-0" />
              <h1 className="text-xl font-bold truncate">{stationDisplayName}</h1>
              <EquipmentChip status={operationalStatus.equipmentStatus} isHebrew={isHebrew} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {isHebrew ? 'לוח בקרה יומי' : 'Station Daily Dashboard'}
              {' · '}
              {new Date().toLocaleDateString(isHebrew ? 'he-IL' : 'en-IL', {
                weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem',
              })}
            </p>
          </div>

          {/* Station selector (franchise owner / multi-station users) */}
          {showStationSelector && (
            <Select value={String(selectedStationId)} onValueChange={handleStationChange}>
              <SelectTrigger className="w-full sm:w-56 h-9 text-sm">
                <SelectValue placeholder={isHebrew ? 'בחר עמדה' : 'Select station'} />
              </SelectTrigger>
              <SelectContent>
                {myStations.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {isHebrew && s.nameHe ? s.nameHe : s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="self-end sm:self-auto"
            title={isHebrew ? 'רענן' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* ── Downtime Banner ───────────────────────────────────────────────── */}
        {activeDowntime && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-700 dark:text-red-300 text-sm">
                {isHebrew ? 'העמדה אינה פעילה' : 'Station Downtime Active'}
              </p>
              <p className="text-red-600 dark:text-red-400 text-sm mt-0.5">{activeDowntime.reason}</p>
              <p className="text-red-500 dark:text-red-500 text-xs mt-1">
                {isHebrew ? 'מאז' : 'Since'}{' '}
                {shortTime(activeDowntime.startAt)}{' '}
                {activeDowntime.endAt
                  ? (isHebrew ? `· יסתיים: ${shortTime(activeDowntime.endAt)}` : `· Until: ${shortTime(activeDowntime.endAt)}`)
                  : (isHebrew ? '· ללא תאריך סיום' : '· No end time set')}
              </p>
            </div>
          </div>
        )}

        {/* ── Today at a Glance ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {/* Bookings today */}
          <Card className="rounded-xl border-0 shadow-sm bg-white dark:bg-gray-900">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {isHebrew ? 'הזמנות היום' : 'Bookings Today'}
                  </p>
                  <p className="text-3xl font-black text-gray-800 dark:text-gray-100 leading-none">
                    {glance.bookingsToday}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isHebrew ? `מתוך ${capacity.daily}` : `of ${capacity.daily}`}
                  </p>
                </div>
                <CalendarDays className="w-8 h-8 text-blue-400 opacity-70" />
              </div>
            </CardContent>
          </Card>

          {/* Earnings today */}
          <Card className="rounded-xl border-0 shadow-sm bg-white dark:bg-gray-900">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {isHebrew ? 'הכנסות היום' : 'Earnings Today'}
                  </p>
                  <p className="text-2xl font-black text-green-700 dark:text-green-400 leading-none">
                    ₪{glance.earningsTodayILS.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isHebrew ? 'חלק העמדה' : 'Station share'}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400 opacity-70" />
              </div>
            </CardContent>
          </Card>

          {/* Open disputes */}
          <Card
            className={`rounded-xl border-0 shadow-sm col-span-2 sm:col-span-1 ${
              glance.openDisputeCount > 0
                ? 'bg-red-50 dark:bg-red-950/20'
                : 'bg-white dark:bg-gray-900'
            }`}
          >
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {isHebrew ? 'תלונות פתוחות' : 'Open Disputes'}
                  </p>
                  <p
                    className={`text-3xl font-black leading-none ${
                      glance.openDisputeCount > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-800 dark:text-gray-100'
                    }`}
                  >
                    {glance.openDisputeCount}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isHebrew ? 'דורש טיפול' : 'Require action'}
                  </p>
                </div>
                <ShieldAlert
                  className={`w-8 h-8 opacity-70 ${
                    glance.openDisputeCount > 0 ? 'text-red-400' : 'text-gray-300'
                  }`}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Capacity Progress Bar ─────────────────────────────────────────── */}
        <Card className="rounded-xl border-0 shadow-sm bg-white dark:bg-gray-900 mb-4">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {isHebrew ? 'ניצולת יומית' : 'Daily Capacity'}
              </span>
              <span className="text-sm text-gray-500">
                {capacity.usedToday} / {capacity.daily}
                {capacity.atCapacity && (
                  <span className="ms-2 text-xs font-bold text-red-600">
                    {isHebrew ? '· מלא' : '· Full'}
                  </span>
                )}
              </span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${capacityColor}`}
                style={{ width: `${Math.min(100, capacityPct).toFixed(1)}%` }}
              />
            </div>
            {operationalStatus.nextDowntimeStart && (
              <p className="text-xs text-orange-500 mt-2">
                {isHebrew ? 'השבתה מתוכננת' : 'Scheduled downtime'}:{' '}
                {shortDate(operationalStatus.nextDowntimeStart)}
                {operationalStatus.nextDowntimeEnd
                  ? ` → ${shortDate(operationalStatus.nextDowntimeEnd)}`
                  : ''}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Today's Bookings ──────────────────────────────────────────────── */}
        <Card className="rounded-xl border-0 shadow-sm bg-white dark:bg-gray-900 mb-4">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              {isHebrew ? 'הזמנות היום' : "Today's Bookings"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {todayBookings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {isHebrew ? 'אין הזמנות להיום' : 'No bookings today'}
              </p>
            ) : (
              <div className="space-y-2">
                {todayBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0"
                  >
                    {/* Time */}
                    <div className="text-sm font-mono text-gray-500 w-12 shrink-0 text-center">
                      {shortTime(b.startTime)}
                    </div>

                    {/* Service + customer */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate capitalize">
                        {b.serviceType
                          ? b.serviceType.replace(/-/g, ' ')
                          : isHebrew
                          ? 'שירות רחצה'
                          : 'Wash service'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {b.customerName
                          ? b.customerName
                          : `#${b.bookingNumber}`}
                        {b.customerName && (
                          <span className="ms-1 opacity-60">#{b.bookingNumber}</span>
                        )}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                      {b.totalILS > 0 ? `₪${b.totalILS.toFixed(0)}` : '—'}
                    </div>

                    {/* Status chip */}
                    <StatusChip status={b.status} isHebrew={isHebrew} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Settlement Summary (this month) ───────────────────────────────── */}
        <Card className="rounded-xl border-0 shadow-sm bg-white dark:bg-gray-900 mb-4">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-500" />
              {isHebrew ? 'סיכום חלוקת הכנסות — החודש' : 'Revenue Split — This Month'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {sm.settlementCount === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {isHebrew ? 'אין נתוני התחשבנות לחודש זה' : 'No settlements this month yet'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{isHebrew ? 'סה"כ הכנסות' : 'Total Revenue'}</p>
                  <p className="text-base font-bold text-gray-800 dark:text-gray-100">
                    {centsToILS(sm.totalRevenueCents)}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{isHebrew ? 'חלק העמדה' : 'Station Share'}</p>
                  <p className="text-base font-bold text-green-700 dark:text-green-400">
                    {centsToILS(sm.stationShareCents)}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{isHebrew ? 'עמלת פלטפורמה' : 'Platform Fee'}</p>
                  <p className="text-base font-bold text-blue-700 dark:text-blue-400">
                    {centsToILS(sm.platformFeeCents)}
                  </p>
                </div>
                {sm.franchiseShareCents > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">{isHebrew ? 'בעל הזכיינות' : 'Franchise'}</p>
                    <p className="text-base font-bold text-purple-700 dark:text-purple-400">
                      {centsToILS(sm.franchiseShareCents)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Open Disputes ─────────────────────────────────────────────────── */}
        {openDisputes.length > 0 && (
          <Card className="rounded-xl border border-red-200 shadow-sm bg-red-50 dark:bg-red-950/20 mb-4">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700 dark:text-red-300">
                <ShieldAlert className="w-4 h-4" />
                {isHebrew ? 'תלונות פתוחות' : 'Open Disputes'}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {openDisputes.map((d) => (
                  <Link
                    key={d.id}
                    href={`/disputes/${d.id}`}
                    className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-lg px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {d.caseRef}
                      </p>
                      <p className="text-xs text-gray-400">
                        {isHebrew ? 'הוגש' : 'Filed'} {shortDate(d.openedAt)}
                        {d.amountDisputedCents > 0
                          ? ` · ${centsToILS(d.amountDisputedCents)}`
                          : ''}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs border-red-300 text-red-600 bg-red-50 shrink-0"
                    >
                      {d.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Footer note ───────────────────────────────────────────────────── */}
        <p className="text-xs text-center text-gray-400 pb-8">
          {isHebrew
            ? 'מתעדכן אוטומטית כל דקה · כל הסכומים כוללים מע"מ'
            : 'Auto-refreshes every minute · All amounts include VAT'}
        </p>
      </div>
    </div>
  );
}
