/**
 * Dispute Detail Page — Phase 10, Task #26
 *
 * Route: /disputes/:disputeId
 * Auth:  Authenticated station operator for the dispute's station, or admin.
 *
 * Shows full detail for a single dispute_case record including booking info,
 * disputed amount, status, and resolution notes.
 */

import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  FileText,
  CalendarDays,
  DollarSign,
  User,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DisputeDetailData = {
  id: number;
  caseRef: string;
  bookingId: string;
  bookingNumber: string;
  serviceType: string | null;
  bookingStartTime: string;
  bookingTotalILS: number;
  bookingStatus: string;
  stationId: number;
  amountDisputedCents: number;
  status: string;
  openedAt: string;
  resolvedAt: string | null;
  notes: Array<{ authorName?: string; text?: string; createdAt?: string }>;
  customerName: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function centsToILS(cents: number) {
  return (cents / 100).toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });
}

function formatDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  });
}

const DISPUTE_STATUS_CONFIG: Record<
  string,
  { labelEn: string; labelHe: string; className: string }
> = {
  open:       { labelEn: 'Open',       labelHe: 'פתוח',       className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  in_review:  { labelEn: 'In Review',  labelHe: 'בבדיקה',     className: 'bg-blue-100 text-blue-700 border-blue-300' },
  resolved:   { labelEn: 'Resolved',   labelHe: 'נפתר',       className: 'bg-green-100 text-green-700 border-green-300' },
  dismissed:  { labelEn: 'Dismissed',  labelHe: 'נדחה',       className: 'bg-gray-100 text-gray-500 border-gray-300' },
  escalated:  { labelEn: 'Escalated',  labelHe: 'הועלה לדרגה', className: 'bg-red-100 text-red-700 border-red-300' },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DisputeDetail() {
  const params = useParams<{ disputeId: string }>();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const disputeId = params.disputeId ?? '';

  const { data, isLoading, isError } = useQuery<DisputeDetailData>({
    queryKey: [`/api/disputes/${disputeId}`],
    enabled: !!disputeId,
  });

  const BackIcon = isHebrew ? ArrowRight : ArrowLeft;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="max-w-xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
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
                ? 'התלונה לא נמצאה או שאין לך הרשאה לצפות בה.'
                : 'Dispute not found or access denied.'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={() => window.history.back()}
            >
              <BackIcon className="w-4 h-4 me-1" />
              {isHebrew ? 'חזרה' : 'Go back'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusCfg = DISPUTE_STATUS_CONFIG[data.status] ?? {
    labelEn: data.status,
    labelHe: data.status,
    className: 'bg-gray-100 text-gray-600 border-gray-300',
  };

  const locale = isHebrew ? 'he-IL' : 'en-IL';

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6"
      dir={isHebrew ? 'rtl' : 'ltr'}
    >
      <div className="max-w-xl mx-auto">

        {/* ── Back button ─────────────────────────────────────────────────── */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ms-2"
          onClick={() => navigate(`/station/${data.stationId}/dashboard`)}
        >
          <BackIcon className="w-4 h-4 me-1" />
          {isHebrew ? 'חזרה ללוח הבקרה' : 'Back to Dashboard'}
        </Button>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {data.caseRef}
              </h1>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {isHebrew ? 'פרטי תלונה' : 'Dispute Detail'}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${statusCfg.className}`}
          >
            {isHebrew ? statusCfg.labelHe : statusCfg.labelEn}
          </span>
        </div>

        {/* ── Dispute summary ─────────────────────────────────────────────── */}
        <Card className="rounded-xl border-0 shadow-sm bg-white dark:bg-gray-900 mb-4">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-500" />
              {isHebrew ? 'פרטי תלונה' : 'Dispute Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <Row
              icon={<DollarSign className="w-4 h-4 text-red-400" />}
              label={isHebrew ? 'סכום שנוי במחלוקת' : 'Disputed Amount'}
              value={
                data.amountDisputedCents > 0
                  ? centsToILS(data.amountDisputedCents)
                  : (isHebrew ? 'לא צוין' : 'Not specified')
              }
            />
            <Row
              icon={<CalendarDays className="w-4 h-4 text-gray-400" />}
              label={isHebrew ? 'תאריך הגשה' : 'Filed On'}
              value={formatDateTime(data.openedAt, locale)}
            />
            {data.resolvedAt && (
              <Row
                icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
                label={isHebrew ? 'תאריך סגירה' : 'Resolved On'}
                value={formatDateTime(data.resolvedAt, locale)}
              />
            )}
            {data.notes && data.notes.length > 0 && (
              <div className="pt-1">
                <p className="text-xs text-gray-400 mb-1">
                  {isHebrew ? 'הערות' : 'Notes'}
                </p>
                <div className="space-y-1">
                  {data.notes.map((n, i) => (
                    <div key={i} className="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                      {n.authorName && (
                        <span className="font-medium me-1">{n.authorName}:</span>
                      )}
                      {n.text ?? '—'}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Booking info ─────────────────────────────────────────────────── */}
        <Card className="rounded-xl border-0 shadow-sm bg-white dark:bg-gray-900 mb-4">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              {isHebrew ? 'פרטי הזמנה' : 'Booking Info'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <Row
              icon={<FileText className="w-4 h-4 text-gray-400" />}
              label={isHebrew ? 'מספר הזמנה' : 'Booking #'}
              value={`#${data.bookingNumber}`}
            />
            {data.customerName && (
              <Row
                icon={<User className="w-4 h-4 text-gray-400" />}
                label={isHebrew ? 'לקוח' : 'Customer'}
                value={data.customerName}
              />
            )}
            <Row
              icon={<CalendarDays className="w-4 h-4 text-gray-400" />}
              label={isHebrew ? 'מועד שירות' : 'Service Date'}
              value={formatDateTime(data.bookingStartTime, locale)}
            />
            {data.serviceType && (
              <Row
                icon={<AlertTriangle className="w-4 h-4 text-gray-400" />}
                label={isHebrew ? 'סוג שירות' : 'Service Type'}
                value={data.serviceType.replace(/-/g, ' ')}
              />
            )}
            <Row
              icon={<DollarSign className="w-4 h-4 text-gray-400" />}
              label={isHebrew ? 'סכום הזמנה' : 'Booking Total'}
              value={`₪${data.bookingTotalILS.toFixed(0)}`}
            />
            <Row
              icon={<CheckCircle2 className="w-4 h-4 text-gray-400" />}
              label={isHebrew ? 'סטטוס הזמנה' : 'Booking Status'}
              value={data.bookingStatus}
            />
          </CardContent>
        </Card>

        <p className="text-xs text-center text-gray-400 pb-8">
          {isHebrew
            ? 'לבירורים נוספים יש לפנות למנהל המערכת'
            : 'For further assistance, contact your station manager'}
        </p>
      </div>
    </div>
  );
}

// ─── Small helper ─────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-100 font-medium capitalize">{value}</p>
      </div>
    </div>
  );
}
