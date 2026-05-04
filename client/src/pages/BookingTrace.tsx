/**
 * BookingTrace — Phase 12.7
 * Route: /booking-trace/:bookingId
 *
 * Full operational + financial trace for a booking:
 *   T37 - Executive summary panel
 *   T31 - Booking core + station + customer + status history
 *   T33 - Dispute detail view
 *   T34 - Resolution actions
 *   T35 - Refund linkage
 *         Audit trail
 */

import { Link, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, TriangleAlert,
  Building2, User, Receipt, ArrowRight, ShieldAlert, Banknote,
  ClipboardList, History, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingCore {
  id: string; bookingNumber: string; userId: string;
  providerId: string | null; stationId: number | null;
  startTime: string | null; endTime: string | null;
  status: string; paymentStatus: string; paymentMethod: string | null;
  payoutStatus: string;
  subtotal: number; platformFee: number; providerPayout: number;
  total: number; taxAmount: number; currency: string;
  serviceType: string | null; serviceDescription: string | null;
  cancellationReason: string | null; cancelledBy: string | null; cancelledAt: string | null;
  confirmedAt: string | null; startedAt: string | null; completedAt: string | null;
  createdAt: string | null;
}

interface Station { id: number; name: string; stationCode: string; ownershipType: string; }
interface Customer { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; }

interface StatusHistoryEntry {
  fromStatus: string | null; toStatus: string; changedByUserId: string;
  changedByRole: string; reason: string | null; changedAt: string | null;
}

interface Settlement {
  id: number; status: string;
  totalAmount: number; platformFeePct: number; platformAmount: number;
  stationRevenuePct: number; stationAmount: number;
  franchiseOverridePct: number | null; franchiseShare: number;
  settledAt: string | null; createdAt: string | null;
  hasReconciliationMismatch: boolean;
}

interface Dispute {
  id: string; reason: string; description: string | null;
  status: string; adminNotes: string | null;
  resolvedBy: string | null; resolvedAt: string | null; createdAt: string | null;
}

interface Refund {
  fromBooking: { amount: number; amountCents: number | null; status: string | null; reason: string | null; requestedAt: string | null; processedAt: string | null; } | null;
  fromWallet: { transactionId: string; amountCents: number; creditType: string; description: string | null; createdAt: string | null; }[];
}

interface AuditEntry {
  actorUserId: string | null; actorRole: string | null;
  actionType: string; metadata: any; severity: string; createdAt: string | null;
}

interface Summary {
  grossAmount: number; settlementStatus: string; disputeStatus: string;
  refundStatus: string; hasMismatch: boolean;
  nextActionOwner: 'system' | 'platform' | 'franchise_owner' | 'none';
}

interface TraceResponse {
  callerRole: string;
  canTakeDisputeAction: boolean;
  booking: BookingCore;
  station: Station | null;
  customer: Customer;
  statusHistory: StatusHistoryEntry[];
  settlement: Settlement | null;
  dispute: Dispute | null;
  refund: Refund;
  auditTrail: AuditEntry[];
  summary: Summary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });
const fmt  = (n: number)       => ILS.format(n);
const dt   = (s: string | null) => s ? new Date(s).toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const dtShort = (s: string | null) => s ? new Date(s).toLocaleDateString('he-IL') : '—';

// ─── Status badge helpers ─────────────────────────────────────────────────────

function bookingStatusBadge(status: string) {
  const map: Record<string, string> = {
    completed:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    confirmed:   'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    in_progress: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    cancelled:   'bg-white text-gray-700 dark:bg-white dark:text-black',
    disputed:    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    draft:       'bg-white text-gray-600 dark:bg-white dark:text-gray-400',
  };
  return (
    <Badge className={cn('border-0 text-xs', map[status] ?? 'bg-white text-gray-600')}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

function settlementBadge(status: string) {
  if (status === 'settled')  return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-0 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Settled</Badge>;
  if (status === 'disputed') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-0 text-xs"><XCircle className="h-3 w-3 mr-1" />Disputed</Badge>;
  if (status === 'pending')  return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-0 text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  if (status === 'none')     return <Badge className="bg-white text-gray-600 border-0 text-xs">No settlement</Badge>;
  return <Badge className="bg-white text-gray-600 border-0 text-xs">{status}</Badge>;
}

function disputeBadge(status: string) {
  if (status === 'open')         return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-0 text-xs"><ShieldAlert className="h-3 w-3 mr-1" />Open</Badge>;
  if (status === 'under_review') return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-0 text-xs"><Clock className="h-3 w-3 mr-1" />Under Review</Badge>;
  if (status === 'resolved')     return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-0 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Resolved</Badge>;
  if (status === 'rejected')     return <Badge className="bg-white text-gray-700 border-0 text-xs"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  if (status === 'closed')       return <Badge className="bg-white text-gray-600 border-0 text-xs">Closed</Badge>;
  if (status === 'none')         return <Badge className="bg-white text-gray-500 border-0 text-xs">No dispute</Badge>;
  return <Badge className="bg-white text-gray-600 border-0 text-xs">{status}</Badge>;
}

function nextActionBadge(owner: string) {
  if (owner === 'platform')          return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-0 text-xs">Platform action needed</Badge>;
  if (owner === 'system')            return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-0 text-xs">Awaiting system</Badge>;
  if (owner === 'franchise_owner')   return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-0 text-xs">Owner action needed</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-0 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingTrace() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [actionNote, setActionNote]     = useState('');
  const [showNoteFor, setShowNoteFor]   = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<TraceResponse>({
    queryKey: [`/api/booking-trace/${bookingId}`],
  });

  const mutation = useMutation({
    mutationFn: ({ action, note }: { action: string; note?: string }) =>
      apiRequest('POST', `/api/booking-trace/${bookingId}/dispute/action`, { action, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/booking-trace/${bookingId}`] });
      setActionNote('');
      setShowNoteFor(null);
      toast({ title: 'Action recorded', description: 'Dispute status updated and audit trail written.' });
    },
    onError: () => {
      toast({ title: 'Action failed', description: 'Could not update dispute status. Please try again.', variant: 'destructive' });
    },
  });

  function handleAction(action: string) {
    mutation.mutate({ action, note: actionNote || undefined });
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <Card className="border-0 shadow-sm max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
            <p className="font-medium text-gray-800 dark:text-black">Booking not found</p>
            <p className="text-sm text-gray-500 mt-1">You may not have access to this booking.</p>
            <Button variant="outline" className="mt-4" onClick={() => window.history.back()}>
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { booking, station, customer, statusHistory, settlement, dispute, refund, auditTrail, summary, canTakeDisputeAction } = data;
  const hasDispute  = !!dispute && dispute.status !== 'closed' && dispute.status !== 'resolved';
  const hasRefund   = !!(refund.fromBooking || refund.fromWallet.length);

  // Determine available actions based on dispute status
  const availableActions: { label: string; action: string; variant: 'destructive' | 'outline' | 'default' }[] = [];
  if (dispute && canTakeDisputeAction) {
    if (dispute.status === 'open')         availableActions.push({ label: 'Mark Under Review', action: 'mark_under_review',  variant: 'outline' });
    if (dispute.status === 'under_review') availableActions.push({ label: 'Approve Resolution', action: 'approve_resolution', variant: 'default' });
    if (dispute.status === 'under_review') availableActions.push({ label: 'Reject Claim',       action: 'reject_claim',       variant: 'destructive' });
    if (!['resolved','rejected','closed'].includes(dispute.status)) {
      availableActions.push({ label: 'Close Case', action: 'close_case', variant: 'outline' });
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Back navigation */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          Back
        </button>

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-black">{booking.bookingNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {station ? `${station.name}${station.stationCode ? ` · ${station.stationCode}` : ''}` : 'No station'}
            {booking.serviceType && ` · ${booking.serviceType}`}
          </p>
        </div>

        {/* ── T37 Executive Summary ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Card className="border-0 shadow-sm col-span-2 sm:col-span-1">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Booking Amount</p>
              <p className="text-lg font-bold text-gray-900 dark:text-black">{fmt(booking.total)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Status</p>
              {bookingStatusBadge(booking.status)}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Settlement</p>
              {settlementBadge(summary.settlementStatus)}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Dispute</p>
              {disputeBadge(summary.disputeStatus)}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Mismatch</p>
              {summary.hasMismatch
                ? <span className="flex items-center gap-1 text-xs text-orange-600 font-medium"><TriangleAlert className="h-3.5 w-3.5" />Yes</span>
                : <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />None</span>
              }
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Next Action</p>
              {nextActionBadge(summary.nextActionOwner)}
            </CardContent>
          </Card>
        </div>

        {/* ── Booking core + station/customer ───────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Station */}
          {station && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  Station
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1 text-sm">
                <p><span className="text-gray-500">Name:</span> <span className="font-medium">{station.name}</span></p>
                {station.stationCode && <p><span className="text-gray-500">Code:</span> {station.stationCode}</p>}
                <p><span className="text-gray-500">Type:</span> <span className="capitalize">{station.ownershipType}</span></p>
              </CardContent>
            </Card>
          )}

          {/* Customer */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1 text-sm">
              {(customer.firstName || customer.lastName) && (
                <p><span className="text-gray-500">Name:</span> <span className="font-medium">{[customer.firstName, customer.lastName].filter(Boolean).join(' ')}</span></p>
              )}
              {customer.email && <p><span className="text-gray-500">Email:</span> {customer.email}</p>}
              {customer.phone && <p><span className="text-gray-500">Phone:</span> {customer.phone}</p>}
              <p className="text-xs text-gray-400 font-mono">{customer.id}</p>
            </CardContent>
          </Card>
        </div>

        {/* Booking details */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-gray-400" />
              Booking Details
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div><p className="text-gray-500 text-xs">Service</p><p>{booking.serviceType ?? '—'}</p></div>
              <div><p className="text-gray-500 text-xs">Payment</p><p>{booking.paymentMethod ?? '—'}</p></div>
              <div><p className="text-gray-500 text-xs">Payout Status</p><p className="capitalize">{booking.payoutStatus}</p></div>
              <div><p className="text-gray-500 text-xs">Subtotal</p><p>{fmt(booking.subtotal)}</p></div>
              <div><p className="text-gray-500 text-xs">Platform Fee</p><p>{fmt(booking.platformFee)}</p></div>
              <div><p className="text-gray-500 text-xs">Tax</p><p>{fmt(booking.taxAmount)}</p></div>
              <div><p className="text-gray-500 text-xs">Started</p><p>{dt(booking.startedAt)}</p></div>
              <div><p className="text-gray-500 text-xs">Completed</p><p>{dt(booking.completedAt)}</p></div>
              <div><p className="text-gray-500 text-xs">Created</p><p>{dt(booking.createdAt)}</p></div>
              {booking.cancellationReason && (
                <div className="col-span-3">
                  <p className="text-gray-500 text-xs">Cancellation Reason</p>
                  <p className="text-red-600">{booking.cancellationReason}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Settlement split ──────────────────────────────────────────────── */}
        {settlement && (
          <Card className={cn('border-0 shadow-sm', settlement.hasReconciliationMismatch && 'ring-1 ring-orange-400')}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4 text-gray-400" />
                Settlement Split
                {settlement.hasReconciliationMismatch && (
                  <Badge className="bg-orange-100 text-orange-700 border-0 text-xs ml-auto">
                    <TriangleAlert className="h-3 w-3 mr-1" />Mismatch
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Total</p>
                  <p className="font-bold text-base">{fmt(settlement.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Platform ({settlement.platformFeePct}%)</p>
                  <p>{fmt(settlement.platformAmount)}</p>
                </div>
                {settlement.franchiseShare > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs">Franchise{settlement.franchiseOverridePct != null ? ` (${settlement.franchiseOverridePct}%)` : ''}</p>
                    <p>{fmt(settlement.franchiseShare)}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500 text-xs">Station ({settlement.stationRevenuePct}%)</p>
                  <p>{fmt(settlement.stationAmount)}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-3 text-xs text-gray-500">
                <span>Status: {settlementBadge(settlement.status)}</span>
                {settlement.settledAt && <span>Settled: {dtShort(settlement.settledAt)}</span>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── T33 Dispute detail ────────────────────────────────────────────── */}
        {dispute && (
          <Card className={cn('border-0 shadow-sm', (dispute.status === 'open' || dispute.status === 'under_review') && 'ring-1 ring-red-400')}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  Dispute
                </CardTitle>
                <div className="flex items-center gap-2">
                  {disputeBadge(dispute.status)}
                  <Link
                    href="/case-queue"
                    className="text-xs text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                  >
                    Exception Queue →
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Reason</p>
                  <p className="font-medium capitalize">{dispute.reason.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Opened</p>
                  <p>{dt(dispute.createdAt)}</p>
                </div>
                {dispute.description && (
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs">Description</p>
                    <p className="bg-white dark:bg-white rounded p-2 text-sm">{dispute.description}</p>
                  </div>
                )}
                {dispute.adminNotes && (
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs">Notes</p>
                    <p className="bg-yellow-50 dark:bg-yellow-950/30 rounded p-2 text-sm whitespace-pre-wrap">{dispute.adminNotes}</p>
                  </div>
                )}
                {dispute.resolvedBy && (
                  <>
                    <div>
                      <p className="text-gray-500 text-xs">Resolved By</p>
                      <p className="font-mono text-xs">{dispute.resolvedBy}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Resolved At</p>
                      <p>{dt(dispute.resolvedAt)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* T34 Resolution actions */}
              {availableActions.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                  <p className="text-xs text-gray-500 font-medium">Resolution Actions</p>
                  <Textarea
                    placeholder="Optional note (will be appended to admin notes)..."
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    className="text-sm resize-none h-20"
                  />
                  <div className="flex flex-wrap gap-2">
                    {availableActions.map(({ label, action, variant }) => (
                      <Button
                        key={action}
                        variant={variant}
                        size="sm"
                        disabled={mutation.isPending}
                        onClick={() => {
                          if (showNoteFor === action) {
                            handleAction(action);
                          } else {
                            setShowNoteFor(action);
                          }
                        }}
                      >
                        {mutation.isPending && showNoteFor === action ? 'Saving…' : label}
                      </Button>
                    ))}
                  </div>
                  {showNoteFor && (
                    <p className="text-xs text-gray-400">Click the action again to confirm. Add a note above (optional).</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── T35 Refund ───────────────────────────────────────────────────── */}
        {hasRefund && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4 text-blue-500" />
                Refund
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {refund.fromBooking && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Amount</p>
                    <p className="font-medium">{fmt(refund.fromBooking.amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Status</p>
                    <p className="capitalize">{refund.fromBooking.status ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Method</p>
                    <p>Payment Reversal</p>
                  </div>
                  {refund.fromBooking.reason && (
                    <div className="col-span-3">
                      <p className="text-gray-500 text-xs">Reason</p>
                      <p>{refund.fromBooking.reason}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500 text-xs">Requested</p>
                    <p>{dt(refund.fromBooking.requestedAt)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Processed</p>
                    <p>{dt(refund.fromBooking.processedAt)}</p>
                  </div>
                </div>
              )}
              {refund.fromWallet.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">Wallet Credits</p>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white dark:bg-white">
                        <TableHead className="text-xs">Reference</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refund.fromWallet.map((w) => (
                        <TableRow key={w.transactionId} className="text-sm">
                          <TableCell className="font-mono text-xs">{w.transactionId}</TableCell>
                          <TableCell className="capitalize">{w.creditType.replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-right">{fmt(w.amountCents / 100)}</TableCell>
                          <TableCell>{dtShort(w.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Status timeline ───────────────────────────────────────────────── */}
        {statusHistory.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-gray-400" />
                Status Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {statusHistory.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-gray-500">{h.fromStatus ?? 'start'}</span>
                      <ArrowRight className="h-3 w-3 inline mx-1 text-gray-400" />
                      <span className="font-medium">{h.toStatus}</span>
                      <span className="text-xs text-gray-400 ml-2">by {h.changedByRole}</span>
                      {h.reason && <span className="text-xs text-gray-400 ml-1">· {h.reason}</span>}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{dtShort(h.changedAt)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Audit trail ───────────────────────────────────────────────────── */}
        {auditTrail.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-gray-400" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {auditTrail.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm border-b border-gray-50 dark:border-gray-800 pb-2 last:border-0 last:pb-0">
                    <div className={cn(
                      'mt-0.5 h-2 w-2 rounded-full flex-shrink-0',
                      a.severity === 'error' ? 'bg-red-400' :
                      a.severity === 'warn'  ? 'bg-orange-400' : 'bg-gray-300'
                    )} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{a.actionType}</span>
                      {a.actorRole && <span className="text-xs text-gray-400 ml-2">by {a.actorRole}</span>}
                      {a.metadata?.note && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">"{a.metadata.note}"</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{dtShort(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
