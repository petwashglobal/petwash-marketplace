import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  GraduationCap,
  Wallet,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";

const GOLD = "#C5A55A";

function centsToILS(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}

interface FinanceBadgeProps { state: string | null }

const FINANCE_BADGE: Record<string, { label: string; cls: string }> = {
  hold_active: { label: "Wallet reserved",  cls: "bg-amber-100 text-amber-800 border-amber-300" },
  debited:     { label: "Wallet charged",   cls: "bg-green-100 text-green-800 border-green-300" },
  released:    { label: "Wallet released",  cls: "bg-blue-100 text-blue-800 border-blue-300" },
  refunded:    { label: "Wallet refunded",  cls: "bg-purple-100 text-purple-800 border-purple-300" },
  none:        { label: "No charge",        cls: "bg-gray-100 text-gray-600 border-gray-300" },
};

function FinanceBadge({ state }: FinanceBadgeProps) {
  const cfg = FINANCE_BADGE[state ?? "none"] ?? { label: state ?? "—", cls: "bg-gray-100 text-gray-600 border-gray-300" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.cls}`}>
      <Wallet className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function TrainerBookings() {
  const { toast } = useToast();

  const [cancelModal, setCancelModal] = useState<{ bookingId: string; financeState: string; amount: number } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [lastAction, setLastAction] = useState<Record<string, { type: string; at: string }>>({});

  const { data: bookings, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/academy/trainer-bookings"],
  });

  const { mutate: confirmBooking, isPending: confirmPending, variables: confirmVar } = useMutation<
    any, any, string
  >({
    mutationFn: (bookingId) =>
      apiRequest("POST", `/api/academy/bookings/${bookingId}/confirm`, {}),
    onSuccess: (_, bookingId) => {
      toast({ title: "Booking confirmed — wallet charged" });
      setLastAction((prev) => ({ ...prev, [bookingId]: { type: "confirmed", at: new Date().toLocaleString("he-IL") } }));
      queryClient.invalidateQueries({ queryKey: ["/api/academy/trainer-bookings"] });
    },
    onError: (err) => toast({ title: err?.message ?? "Confirm failed", variant: "destructive" }),
  });

  const { mutate: cancelBooking, isPending: cancelPending } = useMutation<
    any, any, { bookingId: string; reason: string }
  >({
    mutationFn: ({ bookingId, reason }) =>
      apiRequest("POST", `/api/academy/bookings/${bookingId}/cancel`, { reason }),
    onSuccess: (_, vars) => {
      toast({ title: "Booking cancelled — wallet updated" });
      setLastAction((prev) => ({ ...prev, [vars.bookingId]: { type: "cancelled", at: new Date().toLocaleString("he-IL") } }));
      setCancelModal(null);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/academy/trainer-bookings"] });
    },
    onError: (err) => toast({ title: err?.message ?? "Cancel failed", variant: "destructive" }),
  });

  const actionable = (b: any) =>
    b.bookingStatus !== "cancelled" && b.bookingStatus !== "completed";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: GOLD }}>
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">My Session Bookings</h1>
              <p className="text-sm text-gray-500">Confirm or cancel training session requests</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        {/* Rules callout */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>Confirm</strong> a booking to charge the customer's wallet. <strong>Cancel</strong> to release the reservation — no charge will be made.
            If the booking was already charged, the wallet will be fully refunded.
          </span>
        </div>

        {/* Bookings list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Incoming Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading bookings…
              </div>
            ) : !bookings?.length ? (
              <p className="text-sm text-gray-500 py-6 text-center">No bookings yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs">Booking ID</TableHead>
                    <TableHead className="text-xs">Date & Time</TableHead>
                    <TableHead className="text-xs">Customer ID</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Wallet</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b: any) => {
                    const acted = lastAction[b.bookingId];
                    const isConfirming = confirmPending && confirmVar === b.bookingId;
                    const isCancelling = cancelPending && cancelModal?.bookingId === b.bookingId;
                    const canConfirm = actionable(b) && b.bookingStatus === "pending";
                    const canCancel  = actionable(b);

                    return (
                      <TableRow key={b.bookingId}>
                        <TableCell className="text-xs font-mono text-gray-600">
                          {b.bookingId?.slice(0, 12)}…
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {b.sessionDate
                            ? new Date(b.sessionDate).toLocaleDateString("he-IL")
                            : new Date(b.createdAt).toLocaleDateString("he-IL")}
                          {b.sessionTime && (
                            <span className="text-gray-400 ml-1">{b.sessionTime}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-gray-500 max-w-[120px] truncate">
                          {b.userId}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium">
                          {centsToILS(Number(b.walletHoldCents ?? b.totalAmount * 100 ?? 0))}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUS_BADGE[b.bookingStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {b.bookingStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <FinanceBadge state={b.financeState} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            {canConfirm && (
                              <Button
                                size="sm"
                                className="text-white h-7 text-xs gap-1"
                                style={{ background: GOLD }}
                                disabled={isConfirming}
                                onClick={() => confirmBooking(b.bookingId)}
                              >
                                {isConfirming
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <CheckCircle2 className="w-3 h-3" />}
                                Confirm
                              </Button>
                            )}
                            {canCancel && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50"
                                disabled={isCancelling}
                                onClick={() => {
                                  setCancelModal({
                                    bookingId: b.bookingId,
                                    financeState: b.financeState,
                                    amount: Number(b.walletHoldCents ?? 0),
                                  });
                                  setCancelReason("");
                                }}
                              >
                                <XCircle className="w-3 h-3" /> Cancel
                              </Button>
                            )}
                            {acted && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {acted.type} {acted.at}
                              </span>
                            )}
                            {!actionable(b) && !acted && (
                              <span className="text-xs text-gray-400 capitalize">{b.bookingStatus}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/academy" className="text-sm text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline">
            ← Back to Academy
          </Link>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      <Dialog open={!!cancelModal} onOpenChange={(open) => !open && setCancelModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" /> Cancel Booking
            </DialogTitle>
          </DialogHeader>
          {cancelModal && (
            <div className="space-y-4 py-2">
              <div className={`p-3 rounded-lg border text-sm ${
                cancelModal.financeState === "hold_active"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : cancelModal.financeState === "debited"
                    ? "bg-blue-50 border-blue-200 text-blue-800"
                    : "bg-gray-50 border-gray-200 text-gray-700"
              }`}>
                {cancelModal.financeState === "hold_active" && (
                  <>Cancelling will <strong>release the wallet reservation</strong> of{" "}
                  <strong>{centsToILS(cancelModal.amount)}</strong> — funds return to the customer instantly.</>
                )}
                {cancelModal.financeState === "debited" && (
                  <>Cancelling will <strong>fully refund</strong>{" "}
                  <strong>{centsToILS(cancelModal.amount)}</strong> back to the customer's wallet.</>
                )}
                {cancelModal.financeState !== "hold_active" && cancelModal.financeState !== "debited" && (
                  <>Cancelling this booking will mark it as cancelled with no wallet impact.</>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">
                  Reason for cancellation (required)
                </label>
                <Textarea
                  placeholder="e.g. Schedule conflict, illness, customer request…"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="text-sm"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModal(null)}>Keep Booking</Button>
            <Button
              className="text-white bg-red-600 hover:bg-red-700"
              disabled={!cancelReason.trim() || cancelPending}
              onClick={() => cancelModal && cancelBooking({ bookingId: cancelModal.bookingId, reason: cancelReason.trim() })}
            >
              {cancelPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
