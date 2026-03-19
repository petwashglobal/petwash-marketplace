/**
 * POSJobs — Provider job list with full request lifecycle management.
 *
 * Architecture (Phase 3 — V2 active):
 *   source_of_truth:    booking_requests table (new system, Firebase UID provider ref)
 *   read_path:          GET /api/provider-dashboard/v2/bookings?status=&page=&limit=
 *   write_path:         POST /api/provider-dashboard/bookings/:id/{accept|decline|cancel|start|report|complete}
 *                       (action routes still write to V1; will migrate in Phase 4)
 *   cache_invalidation: ['/api/provider-dashboard/v2/bookings'], ['/api/provider-dashboard/stats'],
 *                       ['/api/provider-dashboard/v2/booking-counts']
 *   v1_fallback:        V1 routes stay live as read-only fallback until migration-diff confirms parity
 */
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2, XCircle, MessageSquare, Play, Square,
  AlertTriangle, Clock, Dog, Loader2, RefreshCw, CreditCard,
  Banknote, Smartphone, ChevronDown, Receipt, Phone, Mail,
  CalendarDays, Hash, Star, MapPin,
} from 'lucide-react';

type Platform = 'all' | 'petsitter' | 'walkpet' | 'petwash' | 'academy';

const STATUSES = [
  { id: 'all',         label: 'All' },
  { id: 'new_request', label: 'New' },
  { id: 'pending',     label: 'Pending' },
  { id: 'confirmed',   label: 'Confirmed' },
  { id: 'in_progress', label: 'Active' },
  { id: 'completed',   label: 'Done' },
  { id: 'cancelled',   label: 'Cancelled' },
  { id: 'dispute',     label: 'Dispute' },
];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  // V2 booking_requests statuses
  pending:              { label: 'Pending',      color: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
  accepted:             { label: 'Accepted',     color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
  meet_greet_scheduled: { label: 'Meet & Greet', color: '#92400e', bg: '#fef3c7', border: '#fbbf24' },
  meet_greet_completed: { label: 'Meet Done',    color: '#92400e', bg: '#fef3c7', border: '#fbbf24' },
  payment_pending:      { label: 'Awaiting Pmt', color: '#b45309', bg: '#fef3c7', border: '#fbbf24' },
  confirmed:            { label: 'Confirmed',    color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
  in_progress:          { label: 'In Progress',  color: '#5b21b6', bg: '#ede9fe', border: '#a78bfa' },
  completed:            { label: 'Completed',    color: '#374151', bg: '#f3f4f6', border: '#d1d5db' },
  reviewed:             { label: 'Reviewed',     color: '#374151', bg: '#f3f4f6', border: '#d1d5db' },
  cancelled:            { label: 'Cancelled',    color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  declined:             { label: 'Declined',     color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  disputed:             { label: 'Dispute',      color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  // V1 compat aliases (stale cache / V1 action write-back)
  new_request:          { label: 'New Request',  color: '#92400e', bg: '#fef3c7', border: '#fbbf24' },
  dispute:              { label: 'Dispute',      color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  provider_confirmed:   { label: 'Confirmed',    color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
};

const CANCEL_REASONS  = ['Schedule conflict', 'Emergency', 'Pet is unwell', 'Client request', 'Other'];
const DECLINE_REASONS = ['Not available on this date', 'Pet type not suitable', 'Service not offered', 'Location out of range', 'Other'];

const PAYMENT_METHODS = [
  { id: 'cash',     label: 'מזומן',           labelEn: 'Cash',          icon: Banknote },
  { id: 'credit',   label: 'כרטיס אשראי',      labelEn: 'Credit Card',   icon: CreditCard },
  { id: 'bit',      label: 'Bit',              labelEn: 'Bit',           icon: Smartphone },
  { id: 'paybox',   label: 'Paybox',           labelEn: 'Paybox',        icon: Smartphone },
  { id: 'transfer', label: 'העברה בנקאית',    labelEn: 'Bank Transfer',  icon: Banknote },
];

const PLATFORM_LABELS: Record<string, string> = {
  petsitter: 'Sitter Suite', walkpet: 'Walk My Pet',
  petwash: 'K9000', academy: 'PetWash Academy', all: 'PetWash',
};

const EMPTY_STATES: Record<string, { icon: any; title: string; sub: string }> = {
  new_request: { icon: Star,        title: 'No new requests',      sub: 'New booking requests from clients will appear here' },
  pending:     { icon: Clock,       title: 'No pending requests',  sub: 'Requests waiting on client confirmation' },
  confirmed:   { icon: CheckCircle2,title: 'No confirmed bookings', sub: 'Accepted bookings will appear here' },
  in_progress: { icon: Play,        title: 'No active jobs',        sub: 'Jobs you have started will appear here' },
  completed:   { icon: CheckCircle2,title: 'No completed jobs yet', sub: 'Completed jobs and their payouts will appear here' },
  cancelled:   { icon: XCircle,     title: 'No cancellations',     sub: 'Cancelled bookings will show here' },
  dispute:     { icon: AlertTriangle,title:'No disputes',           sub: 'Any reported issues will appear here' },
  all:         { icon: Dog,         title: 'No jobs found',         sub: 'Jobs will appear here when clients book you' },
};

function fetchWithAuth(url: string, opts?: RequestInit) {
  return fetch(url, { ...opts, credentials: 'include' }).then(r => r.json());
}

interface FinishModal { booking: any; amountILS: string; paymentMethod: string; }

export default function POSJobs({ activePlatform }: { activePlatform: Platform }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [cancelJobId, setCancelJobId]   = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('Schedule conflict');
  const [declineJobId, setDeclineJobId]   = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('Not available on this date');
  const [finishModal, setFinishModal]   = useState<FinishModal | null>(null);

  const statusParam = statusFilter === 'all' ? '' : statusFilter;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/provider-dashboard/v2/bookings', statusParam, activePlatform, page],
    queryFn: () => fetchWithAuth(`/api/provider-dashboard/v2/bookings?status=${statusParam}&page=${page}&limit=15`),
  });

  const { data: countsData } = useQuery({
    queryKey: ['/api/provider-dashboard/v2/booking-counts'],
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/booking-counts'),
    staleTime: 30_000,
  });
  const statusCounts: Record<string, number> = (countsData as any)?.counts ?? {};

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/bookings'] });
    queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/stats'] });
    queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/booking-counts'] });
  };

  const actionMutation = useMutation({
    mutationFn: async ({ bookingId, action, reason }: { bookingId: string; action: string; reason?: string }) =>
      fetchWithAuth(`/api/provider-dashboard/bookings/${bookingId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: reason ? JSON.stringify({ reason }) : undefined,
      }),
    onSuccess: (_, vars) => {
      invalidateAll();
      const labels: Record<string, string> = {
        accept: 'Job accepted', decline: 'Request declined',
        start: 'Job started', cancel: 'Job cancelled', report: 'Issue reported',
      };
      toast({ title: labels[vars.action] || 'Done' });
      setCancelJobId(null);
      setDeclineJobId(null);
    },
  });

  const finishMutation = useMutation({
    mutationFn: async (modal: FinishModal) => {
      const amountILS = parseFloat(modal.amountILS);
      if (!amountILS || amountILS <= 0) throw new Error('Please enter a valid amount');
      const booking = modal.booking;
      return apiRequest('POST', '/api/orchestrator/job-complete', {
        bookingRef:    booking.bookingNumber || booking.id,
        platform:      PLATFORM_LABELS[activePlatform] || 'PetWash',
        serviceType:   booking.serviceName || booking.serviceType || 'Pet Service',
        customerName:  booking.clientName || 'Customer',
        customerEmail: booking.clientEmail || 'customer@petwash.co.il',
        providerName:  booking.providerName || 'Provider',
        providerEmail: booking.providerEmail,
        petName:       booking.petName,
        amountILS,
        paymentMethod: modal.paymentMethod,
        notes:         booking.notes,
      });
    },
    onSuccess: async (res: any, modal) => {
      await actionMutation.mutateAsync({ bookingId: modal.booking.id, action: 'complete' });
      setFinishModal(null);
      const invoiceNum = res?.invoiceNumber || '';
      toast({
        title: '✅ Job completed!',
        description: invoiceNum ? `Invoice ${invoiceNum} sent to client.` : 'Invoice sent to client.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Error completing job', description: err.message, variant: 'destructive' });
    },
  });

  const bookings: any[] = (data as any)?.bookings || [];
  const total: number   = (data as any)?.total || 0;
  const totalPages = Math.ceil(total / 15);

  const handleFinishRequest = (booking: any) => {
    setFinishModal({
      booking,
      amountILS: parseFloat(booking.providerPayout || booking.subtotal || '0').toFixed(0),
      paymentMethod: 'cash',
    });
  };

  const emptyState = EMPTY_STATES[statusFilter] || EMPTY_STATES.all;

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1.5 min-w-max pb-1">
          {STATUSES.map(s => {
            const count = statusCounts[s.id];
            const isNew = s.id === 'new_request' && (count ?? 0) > 0;
            return (
              <button key={s.id} onClick={() => { setStatusFilter(s.id); setPage(1); }}
                className={`relative px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === s.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {isNew && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse" />}
                {s.label}
                {count != null && count > 0 && (
                  <span className={`text-[10px] font-bold px-1 rounded-full leading-tight ${
                    statusFilter === s.id ? 'bg-amber-400 text-white' : 'bg-gray-300 text-gray-700'
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{total} job{total !== 1 ? 's' : ''}</p>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <emptyState.icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 text-sm font-medium">{emptyState.title}</p>
          <p className="text-gray-400 text-xs mt-1">{emptyState.sub}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b: any) => (
            <JobCard
              key={b.id}
              booking={b}
              onAction={(id, action) => actionMutation.mutate({ bookingId: id, action })}
              onCancelRequest={(id) => setCancelJobId(id)}
              onDeclineRequest={(id) => setDeclineJobId(id)}
              onFinishRequest={handleFinishRequest}
              isPending={actionMutation.isPending || finishMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
            Previous
          </button>
          <span className="text-xs text-gray-500">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
            Next
          </button>
        </div>
      )}

      {/* Decline modal */}
      {declineJobId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Decline Request</h3>
            <p className="text-xs text-gray-500 mb-4">Please select a reason so the client can rebook appropriately</p>
            <div className="space-y-2 mb-4">
              {DECLINE_REASONS.map(r => (
                <button key={r} onClick={() => setDeclineReason(r)}
                  className={`w-full text-start px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                    declineReason === r ? 'border-red-300 bg-red-50 text-red-800' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeclineJobId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button
                onClick={() => actionMutation.mutate({ bookingId: declineJobId, action: 'decline', reason: declineReason })}
                disabled={actionMutation.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                {actionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {cancelJobId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Cancel Job</h3>
            <p className="text-xs text-gray-500 mb-4">Please select a reason for cancellation</p>
            <div className="space-y-2 mb-4">
              {CANCEL_REASONS.map(r => (
                <button key={r} onClick={() => setCancelReason(r)}
                  className={`w-full text-start px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                    cancelReason === r ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCancelJobId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button
                onClick={() => actionMutation.mutate({ bookingId: cancelJobId, action: 'cancel', reason: cancelReason })}
                disabled={actionMutation.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                {actionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finish Job modal */}
      {finishModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-gray-900">Complete Job</h3>
              </div>
              <p className="text-xs text-gray-500">Confirm payment — a tax invoice will be sent to the client automatically.</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs text-gray-500">Client</p>
                <p className="text-sm font-medium text-gray-900">{finishModal.booking.clientName || 'Customer'}</p>
                {finishModal.booking.petName && <p className="text-xs text-gray-500">🐾 {finishModal.booking.petName}</p>}
                <p className="text-xs text-gray-500">{finishModal.booking.serviceName || finishModal.booking.serviceType || 'Service'}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Amount (₪)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">₪</span>
                  <input type="number" min="0" step="1"
                    value={finishModal.amountILS}
                    onChange={e => setFinishModal(m => m ? { ...m, amountILS: e.target.value } : null)}
                    className="w-full pl-7 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                    style={{ fontSize: '16px' }} />
                </div>
                {finishModal.booking.providerPayout && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Your net payout: ₪{parseFloat(finishModal.booking.providerPayout).toFixed(0)} (after platform fee)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(pm => {
                    const Icon = pm.icon;
                    const selected = finishModal.paymentMethod === pm.id;
                    return (
                      <button key={pm.id} type="button"
                        onClick={() => setFinishModal(m => m ? { ...m, paymentMethod: pm.id } : null)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                          selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}>
                        <Icon className="w-4 h-4" />
                        <span>{pm.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setFinishModal(null)} disabled={finishMutation.isPending}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => finishMutation.mutate(finishModal!)}
                disabled={finishMutation.isPending || !finishModal.amountILS || Number(finishModal.amountILS) <= 0}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {finishMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Finish & Invoice</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function JobCard({
  booking, onAction, onCancelRequest, onDeclineRequest, onFinishRequest, isPending,
}: {
  booking: any;
  onAction: (id: string, action: string) => void;
  onCancelRequest: (id: string) => void;
  onDeclineRequest: (id: string) => void;
  onFinishRequest: (booking: any) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;

  const formattedStart = booking.startTime
    ? new Date(booking.startTime).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;
  const formattedEnd = booking.endTime
    ? new Date(booking.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : null;

  const payout = parseFloat(booking.providerPayout || booking.subtotal || '0');

  const actions = [];
  // V2: pending/accepted = new requests awaiting provider decision
  if (['new_request', 'pending', 'accepted'].includes(booking.status)) {
    actions.push({ label: 'Accept', action: 'accept',   icon: CheckCircle2, className: 'bg-green-600 text-white hover:bg-green-700' });
    actions.push({ label: 'Decline', action: '_decline', icon: XCircle,      className: 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-700' });
  }
  // V2: confirmed = ready to start
  if (['confirmed', 'provider_confirmed'].includes(booking.status)) {
    actions.push({ label: 'Start',  action: 'start',   icon: Play,    className: 'bg-purple-600 text-white hover:bg-purple-700' });
    actions.push({ label: 'Cancel', action: '_cancel', icon: XCircle, className: 'bg-gray-100 text-red-600 hover:bg-red-50' });
  }
  if (booking.status === 'in_progress') {
    actions.push({ label: 'Finish', action: '_finish', icon: Square,        className: 'bg-blue-600 text-white hover:bg-blue-700' });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <Dog className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-gray-900 truncate">{booking.clientName || 'Client'}</p>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate">{booking.serviceName || booking.serviceType || 'Service'}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              {formattedStart && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {formattedStart}{formattedEnd ? ` – ${formattedEnd}` : ''}
                </span>
              )}
              {payout > 0 && (
                <span className="font-semibold text-green-700">₪{payout.toFixed(0)}</span>
              )}
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            {/* Pet info */}
            {(booking.petName || booking.petSpecies) && (
              <div className="flex items-start gap-2">
                <Dog className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-700">
                  <span className="font-medium">Pet: </span>
                  {[booking.petName, booking.petSpecies, booking.petBreed].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}

            {/* Schedule */}
            {(booking.startTime || booking.duration) && (
              <div className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div className="text-xs text-gray-700">
                  {booking.startTime && (
                    <p><span className="font-medium">Start: </span>
                      {new Date(booking.startTime).toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {booking.endTime && (
                    <p><span className="font-medium">End: </span>
                      {new Date(booking.endTime).toLocaleDateString('he-IL', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {booking.duration && <p><span className="font-medium">Duration: </span>{booking.duration}</p>}
                </div>
              </div>
            )}

            {/* Address */}
            {booking.address && (
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-700">{booking.address}</p>
              </div>
            )}

            {/* Contact */}
            {(booking.clientEmail || booking.clientPhone) && (
              <div className="flex items-center gap-3">
                {booking.clientEmail && (
                  <a href={`mailto:${booking.clientEmail}`}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    <Mail className="w-3.5 h-3.5" /> Email client
                  </a>
                )}
                {booking.clientPhone && (
                  <a href={`tel:${booking.clientPhone}`}
                    className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium">
                    <Phone className="w-3.5 h-3.5" /> Call client
                  </a>
                )}
              </div>
            )}

            {/* Notes / special requests */}
            {booking.specialRequests && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                <p className="text-[10px] font-semibold text-amber-700 mb-0.5">Special requests</p>
                <p className="text-xs text-amber-800">{booking.specialRequests}</p>
              </div>
            )}
            {booking.notes && !booking.specialRequests && (
              <p className="text-xs text-gray-600"><span className="font-medium">Notes: </span>{booking.notes}</p>
            )}

            {/* Booking ref + payout breakdown */}
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              {booking.bookingNumber && (
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />{booking.bookingNumber}
                </span>
              )}
              {booking.providerPayout && booking.subtotal && (
                <span>
                  Gross ₪{parseFloat(booking.subtotal).toFixed(0)} →
                  Fee ₪{parseFloat(booking.platformFee || '0').toFixed(0)} →
                  Net ₪{parseFloat(booking.providerPayout).toFixed(0)}
                </span>
              )}
            </div>

            {/* Report issue — available for any non-terminal active booking */}
            {!['completed', 'reviewed', 'cancelled', 'declined', 'disputed'].includes(booking.status) && (
              <button
                onClick={() => onAction(booking.id, 'report')}
                disabled={isPending}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors">
                <AlertTriangle className="w-3.5 h-3.5" /> Report issue
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 flex gap-2 bg-gray-50">
          {actions.map(a => {
            const Icon = a.icon;
            return (
              <button key={a.action} disabled={isPending}
                onClick={() => {
                  if (a.action === '_cancel')  onCancelRequest(booking.id);
                  else if (a.action === '_decline') onDeclineRequest(booking.id);
                  else if (a.action === '_finish') onFinishRequest(booking);
                  else onAction(booking.id, a.action);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${a.className}`}>
                <Icon className="w-3.5 h-3.5" />
                {a.label}
              </button>
            );
          })}
          <button
            onClick={() => setExpanded(e => !e)}
            title="View details"
            className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
