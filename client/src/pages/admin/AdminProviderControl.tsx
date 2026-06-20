/**
 * Admin Provider Control Tower — בקרת נותני שירות.
 *
 * Drives the per-service approval ladder (waitlist → profile → booking → payout).
 * READS from the thin GET /api/admin/provider-control list endpoint.
 * ACTS via the EXISTING, audited per-service approve endpoint:
 *   POST /api/provider-applications/admin/:applicationId/service/:serviceType/approve
 *        { level, reason }
 * (Demote / block = set a lower level. No approval logic lives here.)
 *
 * Hebrew-first, RTL, brand = white / black / metallic gold #D4AF37.
 */
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search, RefreshCw, Loader2, ShieldCheck, AlertTriangle, Eye, EyeOff,
  Calendar, CreditCard, ArrowUpRight, ArrowDownRight, XCircle, CheckCircle2,
} from 'lucide-react';

const GOLD = '#D4AF37';

type ServiceLevel = 'waitlist' | 'profile' | 'booking' | 'payout';

interface ProviderServiceRow {
  serviceId: number;
  providerId: string;
  applicationId: number | null;
  providerName: string | null;
  email: string | null;
  phone: string | null;
  serviceType: string;
  serviceStatus: string;
  profileVisible: boolean;
  bookingEnabled: boolean;
  payoutEnabled: boolean;
  pausedByAdmin: boolean;
  pausedByProvider: boolean;
  blockPayoutReason: string | null;
  reconfirmationDue: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ListResponse {
  ok: boolean;
  services: ProviderServiceRow[];
  ladder: string[];
  pagination: { limit: number; offset: number };
}

// Hebrew labels for the ladder statuses.
const STATUS_HE: Record<string, string> = {
  not_started: 'לא התחיל',
  draft: 'טיוטה',
  submitted: 'הוגש',
  needs_more_info: 'נדרש מידע נוסף',
  approved_for_waitlist: 'אושר לרשימת המתנה',
  approved_for_profile_display: 'אושר לתצוגת פרופיל',
  approved_for_booking: 'אושר להזמנות',
  approved_for_payout: 'אושר לתשלום',
  suspended: 'מושעה',
  rejected: 'נדחה',
  needs_reconfirmation: 'נדרש אישור מחדש',
};

const BLOCK_REASON_HE: Record<string, string> = {
  paused_by_admin: 'הושעה ע״י מנהל',
  suspended: 'מושעה',
  needs_reconfirmation: 'נדרש אישור מחדש',
  awaiting_payout_approval: 'ממתין לאישור תשלום',
};

const LEVEL_HE: Record<ServiceLevel, string> = {
  waitlist: 'רשימת המתנה',
  profile: 'תצוגת פרופיל',
  booking: 'הזמנות',
  payout: 'תשלום',
};

const SERVICE_TYPE_HE: Record<string, string> = {
  grooming: 'טיפוח',
  pet_sitting: 'פנסיון/שמרטפות',
  dog_walking: 'הולכת כלבים',
  pet_transport: 'הסעות',
  training: 'אילוף',
  veterinary_house_calls: 'וטרינר בית',
};

function statusTone(status: string): { bg: string; color: string; border: string } {
  if (status === 'approved_for_payout') return { bg: 'rgba(212,175,55,0.14)', color: '#7a6212', border: GOLD };
  if (status === 'approved_for_booking') return { bg: 'rgba(16,185,129,0.10)', color: '#047857', border: '#10b981' };
  if (status === 'approved_for_profile_display') return { bg: 'rgba(59,130,246,0.10)', color: '#1d4ed8', border: '#3b82f6' };
  if (status === 'approved_for_waitlist') return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  if (status === 'suspended' || status === 'rejected') return { bg: 'rgba(239,68,68,0.10)', color: '#b91c1c', border: '#ef4444' };
  if (status === 'needs_reconfirmation' || status === 'needs_more_info') return { bg: 'rgba(245,158,11,0.12)', color: '#b45309', border: '#f59e0b' };
  return { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' };
}

function StatusBadge({ status }: { status: string }) {
  const t = statusTone(status);
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}
    >
      {STATUS_HE[status] || status}
    </span>
  );
}

function Bool({ value }: { value: boolean }) {
  return value
    ? <CheckCircle2 className="h-4 w-4 mx-auto" style={{ color: '#10b981' }} />
    : <XCircle className="h-4 w-4 mx-auto text-gray-300" />;
}

const STATUS_FILTERS = [
  'all', 'approved_for_waitlist', 'approved_for_profile_display',
  'approved_for_booking', 'approved_for_payout', 'needs_reconfirmation',
  'suspended', 'rejected',
];

const SERVICE_FILTERS = ['all', 'grooming', 'pet_sitting', 'dog_walking', 'pet_transport', 'training', 'veterinary_house_calls'];

interface PendingAction {
  row: ProviderServiceRow;
  level: ServiceLevel;
  /** Advancing up the ladder vs demoting/blocking down. */
  direction: 'up' | 'down';
}

export default function AdminProviderControl() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');

  // Debounce search a touch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams();
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (serviceFilter !== 'all') params.set('serviceType', serviceFilter);
  if (debouncedSearch) params.set('q', debouncedSearch);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ListResponse>({
    queryKey: ['/api/admin/provider-control', statusFilter, serviceFilter, debouncedSearch],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/admin/provider-control?${params.toString()}`);
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (action: PendingAction) => {
      if (!action.row.applicationId) {
        throw new Error('לנותן שירות זה אין בקשה מקושרת — לא ניתן לשנות רמת אישור.');
      }
      const res = await apiRequest(
        'POST',
        `/api/provider-applications/admin/${action.row.applicationId}/service/${encodeURIComponent(action.row.serviceType)}/approve`,
        { level: action.level, reason },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || 'הפעולה נכשלה');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'עודכן', description: 'רמת האישור עודכנה בהצלחה.' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/provider-control'] });
      setPending(null);
      setReason('');
    },
    onError: (e: any) => {
      toast({ title: 'שגיאה', description: e?.message || 'הפעולה נכשלה', variant: 'destructive' });
    },
  });

  const rows = data?.services ?? [];

  function openAction(row: ProviderServiceRow, level: ServiceLevel, direction: 'up' | 'down') {
    setReason('');
    setPending({ row, level, direction });
  }

  return (
    <div dir="rtl" className="min-h-screen bg-white text-black" style={{ fontFamily: 'inherit' }}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'rgba(212,175,55,0.12)', border: `1px solid ${GOLD}` }}>
              <ShieldCheck className="h-5 w-5" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">בקרת נותני שירות</h1>
              <p className="text-sm text-gray-500">סולם אישור פר-שירות: רשימת המתנה ← פרופיל ← הזמנות ← תשלום</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            רענן
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם, אימייל או מזהה ספק"
              className="pr-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'כל הסטטוסים' : (STATUS_HE[s] || s)}</option>
            ))}
          </select>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
          >
            {SERVICE_FILTERS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'כל השירותים' : (SERVICE_TYPE_HE[s] || s)}</option>
            ))}
          </select>
        </div>

        {/* States */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-100 bg-red-50 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-red-600">טעינת הנתונים נכשלה.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>נסה שוב</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-100 bg-gray-50 py-20 text-center">
            <ShieldCheck className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">לא נמצאו שירותי נותני שירות התואמים את הסינון.</p>
          </div>
        ) : (
          <>
            {/* Desktop matrix */}
            <div className="hidden overflow-x-auto rounded-lg border border-gray-100 md:block">
              <table className="w-full border-collapse text-right text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                    <th className="px-3 py-3 font-medium">ספק</th>
                    <th className="px-3 py-3 font-medium">שירות</th>
                    <th className="px-3 py-3 font-medium">סטטוס אישור</th>
                    <th className="px-3 py-3 text-center font-medium">פרופיל גלוי</th>
                    <th className="px-3 py-3 text-center font-medium">הזמנות</th>
                    <th className="px-3 py-3 text-center font-medium">תשלומים</th>
                    <th className="px-3 py-3 font-medium">סיבת חסימת תשלום</th>
                    <th className="px-3 py-3 font-medium">אישור מחדש</th>
                    <th className="px-3 py-3 font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.serviceId} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium">{r.providerName || '—'}</div>
                        <div className="text-xs text-gray-400">{r.email || r.providerId}</div>
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap">{SERVICE_TYPE_HE[r.serviceType] || r.serviceType}</td>
                      <td className="px-3 py-3 align-top"><StatusBadge status={r.serviceStatus} /></td>
                      <td className="px-3 py-3 align-top"><Bool value={r.profileVisible} /></td>
                      <td className="px-3 py-3 align-top"><Bool value={r.bookingEnabled} /></td>
                      <td className="px-3 py-3 align-top"><Bool value={r.payoutEnabled} /></td>
                      <td className="px-3 py-3 align-top text-xs text-gray-600 whitespace-nowrap">
                        {r.blockPayoutReason ? (BLOCK_REASON_HE[r.blockPayoutReason] || r.blockPayoutReason) : '—'}
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-gray-600 whitespace-nowrap">
                        {r.reconfirmationDue
                          ? <span className="inline-flex items-center gap-1 text-amber-700"><Calendar className="h-3 w-3" />{new Date(r.reconfirmationDue).toLocaleDateString('he-IL')}</span>
                          : '—'}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <RowActions row={r} onAct={openAction} disabled={mutation.isPending} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {rows.map((r) => (
                <div key={r.serviceId} className="rounded-lg border border-gray-100 p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{r.providerName || '—'}</div>
                      <div className="text-xs text-gray-400">{r.email || r.providerId}</div>
                    </div>
                    <StatusBadge status={r.serviceStatus} />
                  </div>
                  <div className="mb-3 text-sm text-gray-600">{SERVICE_TYPE_HE[r.serviceType] || r.serviceType}</div>
                  <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded bg-gray-50 py-1.5">
                      <div className="text-gray-400">פרופיל</div><div className="mt-1"><Bool value={r.profileVisible} /></div>
                    </div>
                    <div className="rounded bg-gray-50 py-1.5">
                      <div className="text-gray-400">הזמנות</div><div className="mt-1"><Bool value={r.bookingEnabled} /></div>
                    </div>
                    <div className="rounded bg-gray-50 py-1.5">
                      <div className="text-gray-400">תשלומים</div><div className="mt-1"><Bool value={r.payoutEnabled} /></div>
                    </div>
                  </div>
                  {(r.blockPayoutReason || r.reconfirmationDue) && (
                    <div className="mb-3 space-y-1 text-xs">
                      {r.blockPayoutReason && (
                        <div className="text-gray-600">חסימת תשלום: {BLOCK_REASON_HE[r.blockPayoutReason] || r.blockPayoutReason}</div>
                      )}
                      {r.reconfirmationDue && (
                        <div className="text-amber-700">אישור מחדש עד: {new Date(r.reconfirmationDue).toLocaleDateString('he-IL')}</div>
                      )}
                    </div>
                  )}
                  <RowActions row={r} onAct={openAction} disabled={mutation.isPending} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) { setPending(null); setReason(''); } }}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">
              {pending?.direction === 'down' ? 'הורדת רמת אישור / חסימה' : 'קידום רמת אישור'}
            </DialogTitle>
            <DialogDescription className="text-right">
              {pending && (
                <>
                  {pending.row.providerName || pending.row.providerId} — {SERVICE_TYPE_HE[pending.row.serviceType] || pending.row.serviceType}
                  <br />
                  הגדרת רמה ל: <strong style={{ color: pending.direction === 'down' ? '#b91c1c' : GOLD }}>{LEVEL_HE[pending.level]}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {pending?.direction === 'down' && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              פעולה זו מורידה הרשאות פעילות של נותן השירות. ודא שהסיבה מתועדת.
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">סיבה (חובה, לפחות 3 תווים)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: השלים אימות מסמכים / חסימה עקב תלונה"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setPending(null); setReason(''); }}>ביטול</Button>
            <Button
              onClick={() => pending && mutation.mutate(pending)}
              disabled={mutation.isPending || reason.trim().length < 3}
              style={pending?.direction === 'down'
                ? { background: '#dc2626', color: '#fff' }
                : { background: GOLD, color: '#000' }}
            >
              {mutation.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
              אישור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Per-row action buttons — advance up or demote/block down the ladder. */
function RowActions({
  row, onAct, disabled,
}: {
  row: ProviderServiceRow;
  onAct: (row: ProviderServiceRow, level: ServiceLevel, direction: 'up' | 'down') => void;
  disabled: boolean;
}) {
  const noApp = !row.applicationId;
  return (
    <div className="flex flex-wrap gap-1.5">
      {!row.profileVisible && (
        <ActionBtn label="הצג פרופיל" icon={<Eye className="h-3.5 w-3.5" />} disabled={disabled || noApp}
          onClick={() => onAct(row, 'profile', 'up')} />
      )}
      {!row.bookingEnabled && (
        <ActionBtn label="אשר הזמנות" icon={<ArrowUpRight className="h-3.5 w-3.5" />} disabled={disabled || noApp} primary
          onClick={() => onAct(row, 'booking', 'up')} />
      )}
      {!row.payoutEnabled && (
        <ActionBtn label="אשר תשלום" icon={<CreditCard className="h-3.5 w-3.5" />} disabled={disabled || noApp} primary
          onClick={() => onAct(row, 'payout', 'up')} />
      )}
      {/* Demote / block paths */}
      {row.payoutEnabled && (
        <ActionBtn label="חסום תשלום" icon={<ArrowDownRight className="h-3.5 w-3.5" />} disabled={disabled || noApp} danger
          onClick={() => onAct(row, 'booking', 'down')} />
      )}
      {row.bookingEnabled && (
        <ActionBtn label="עצור הזמנות" icon={<ArrowDownRight className="h-3.5 w-3.5" />} disabled={disabled || noApp} danger
          onClick={() => onAct(row, 'profile', 'down')} />
      )}
      {(row.profileVisible && !row.bookingEnabled) && (
        <ActionBtn label="הסתר פרופיל" icon={<EyeOff className="h-3.5 w-3.5" />} disabled={disabled || noApp} danger
          onClick={() => onAct(row, 'waitlist', 'down')} />
      )}
      {noApp && <span className="text-xs text-gray-400">אין בקשה מקושרת</span>}
    </div>
  );
}

function ActionBtn({
  label, icon, onClick, disabled, primary, danger,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const style = primary
    ? { background: GOLD, color: '#000', borderColor: GOLD }
    : danger
      ? { background: '#fff', color: '#b91c1c', borderColor: '#fca5a5' }
      : { background: '#fff', color: '#111', borderColor: '#e5e7eb' };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition hover:opacity-85 disabled:opacity-40"
      style={style}
    >
      {icon}{label}
    </button>
  );
}
