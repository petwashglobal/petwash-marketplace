/**
 * AdminTreasurySettings — Finance Admin View for Company Treasury Configuration
 * ==============================================================================
 * SECURITY:
 *  ▸ This page displays MASKED values only (IL41 **** … 526, ***526, MIZB****).
 *  ▸ Full IBAN, account number, and SWIFT codes are NEVER sent in the API response
 *    and therefore NEVER available in the browser.
 *  ▸ No sensitive values are stored in component state, localStorage, or sessionStorage.
 *  ▸ All data is fetched fresh on every page load — no persistent caching of bank details.
 *  ▸ Accessible only to users with super_admin, finance, or ceo role
 *    (enforced both in the backend route and by AdminRouteGuard on this client route).
 *
 * Regulatory note:
 *  Israeli Privacy Protection Law and the Bank of Israel Cyber Directive require that
 *  access to account details is logged. All API calls to /api/admin/finance/treasury/*
 *  automatically create an entry in treasury_access_log on the backend.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ShieldCheck,
  Ban,
  ClipboardList,
  Building2,
  Lock,
} from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";

// ── Auth header helper ────────────────────────────────────────────────────────

function useAdminHeaders() {
  const { user } = useFirebaseAuth();
  const [token, setToken] = useState<string | null>(null);
  if (user && !token) {
    user.getIdToken().then(setToken);
  }
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {} as Record<string, string>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MaskedTreasury {
  id: number;
  legalEntityName: string;
  legalEntityNameHe: string | null;
  companyNumber: string;
  bankName: string;
  bankCode: string;
  branchNumber: string;
  accountNumberMasked: string;
  ibanMasked: string;
  swiftMasked: string;
  accountHolderName: string;
  accountOpenedAt: string | null;
  sourceDocumentDate: string | null;
  verificationStatus: string;
  verifiedByName: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
  isActivePayoutSource: boolean;
  isActiveForReconciliation: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TreasuryHealth {
  treasuryConfigured: boolean;
  treasuryVerified: boolean;
  treasuryCertificateFresh: boolean;
  payoutSourceReady: boolean;
  detail: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Verified
      </Badge>
    );
  }
  if (status === "suspended") {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1">
        <Ban className="w-3 h-3" />
        Suspended
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />
      Pending
    </Badge>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-mono text-slate-800">{value ?? "—"}</span>
    </div>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("he-IL", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminTreasurySettings() {
  const headers = useAdminHeaders();
  const qc = useQueryClient();
  const [verifyNote, setVerifyNote] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const enabled = Object.keys(headers).length > 0;

  // ── Fetch treasury (masked) ───────────────────────────────────────────────
  const { data: treasuryData, isLoading, refetch, isRefetching } = useQuery<{ treasury: MaskedTreasury | null }>({
    queryKey: ["/api/admin/finance/treasury"],
    queryFn: async () => {
      const res = await fetch("/api/admin/finance/treasury", { headers });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
    enabled,
    staleTime: 0,    // always fresh — no caching of bank details
    gcTime: 0,       // discard immediately when unmounted
  });

  // ── Fetch health ─────────────────────────────────────────────────────────
  const { data: healthData } = useQuery<{ health: TreasuryHealth }>({
    queryKey: ["/api/admin/finance/treasury/health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/finance/treasury/health", { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled,
    refetchInterval: 60_000,
    staleTime: 0,
    gcTime: 0,
  });

  const health = healthData?.health;
  const treasury = treasuryData?.treasury;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/finance/treasury/verify", {
        method: "POST",
        headers,
        body: JSON.stringify({ note: verifyNote || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccess("Treasury account verified and activated as payout source.");
      setVerifyNote("");
      qc.invalidateQueries({ queryKey: ["/api/admin/finance/treasury"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/finance/treasury/health"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const suspendMutation = useMutation({
    mutationFn: async () => {
      if (!suspendReason || suspendReason.trim().length < 10) {
        throw new Error("Please provide a reason of at least 10 characters.");
      }
      const res = await fetch("/api/admin/finance/treasury/suspend", {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: suspendReason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccess("Treasury account suspended. All outgoing payouts are now blocked.");
      setSuspendReason("");
      setShowSuspendForm(false);
      qc.invalidateQueries({ queryKey: ["/api/admin/finance/treasury"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/finance/treasury/health"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Building2 className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Treasury Settings</h1>
          <p className="text-sm text-slate-500">
            Company bank account identity — finance/admin use only
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => { refetch(); setError(null); setSuccess(null); }}
          disabled={isRefetching}
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Health summary */}
      {health && (
        <Card className={`border-2 ${health.payoutSourceReady ? "border-green-200 bg-green-50/30" : "border-yellow-200 bg-yellow-50/30"}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap gap-3">
              <HealthChip label="Configured" ok={health.treasuryConfigured} />
              <HealthChip label="Verified" ok={health.treasuryVerified} />
              <HealthChip label="Certificate fresh" ok={health.treasuryCertificateFresh} />
              <HealthChip label="Payout ready" ok={health.payoutSourceReady} />
            </div>
            {!health.payoutSourceReady && (
              <p className="text-xs text-yellow-700 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {health.detail}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Not configured */}
      {!isLoading && !treasury && (
        <Card className="border-red-200 bg-red-50/20">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Treasury settings not configured. Set{" "}
              <code className="font-mono bg-red-100 px-1 rounded text-xs">COMPANY_BANK_*</code>{" "}
              environment variables in secrets manager and restart the server.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Treasury details card */}
      {treasury && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                Company Bank Identity
              </CardTitle>
              <VerificationBadge status={treasury.verificationStatus} />
            </div>
            <CardDescription className="text-xs text-slate-400">
              All sensitive values are masked. Full details are encrypted server-side
              and never transmitted to the browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="Legal entity" value={treasury.legalEntityName} />
            {treasury.legalEntityNameHe && (
              <InfoRow label="שם עברי" value={treasury.legalEntityNameHe} />
            )}
            <InfoRow label="Company No. (ח.פ)" value={treasury.companyNumber} />
            <InfoRow label="Bank" value={treasury.bankName} />
            <InfoRow label="Branch" value={treasury.branchNumber} />
            <InfoRow label="Account holder" value={treasury.accountHolderName} />
            <InfoRow
              label="Account number"
              value={
                <span className="font-mono text-slate-600">{treasury.accountNumberMasked}</span>
              }
            />
            <InfoRow
              label="IBAN"
              value={
                <span className="font-mono text-slate-600">{treasury.ibanMasked}</span>
              }
            />
            <InfoRow
              label="SWIFT"
              value={
                <span className="font-mono text-slate-600">{treasury.swiftMasked}</span>
              }
            />
            <InfoRow label="Account opened" value={fmtDate(treasury.accountOpenedAt)} />
            <InfoRow label="Certificate date" value={fmtDate(treasury.sourceDocumentDate)} />
            <InfoRow label="Payout source active" value={treasury.isActivePayoutSource ? "✅ Yes" : "❌ No"} />
            <InfoRow label="Reconciliation active" value={treasury.isActiveForReconciliation ? "✅ Yes" : "❌ No"} />
            {treasury.verifiedByName && (
              <InfoRow label="Verified by" value={treasury.verifiedByName} />
            )}
            {treasury.verifiedAt && (
              <InfoRow label="Verified at" value={fmtDate(treasury.verifiedAt)} />
            )}
            {treasury.verificationNote && (
              <InfoRow label="Verification note" value={
                <span className="text-xs text-slate-500 max-w-xs truncate">
                  {treasury.verificationNote}
                </span>
              } />
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {treasury && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Finance Officer Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Verify */}
            {treasury.verificationStatus !== "verified" && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Verify this treasury configuration after reviewing the bank certificate.
                </p>
                <Textarea
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  placeholder="Optional: verification note (e.g. 'Reviewed against original PDF 2025-11-02')"
                  className="text-sm h-16 resize-none"
                />
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => { setError(null); setSuccess(null); verifyMutation.mutate(); }}
                  disabled={verifyMutation.isPending}
                >
                  {verifyMutation.isPending ? "Verifying…" : "Mark Verified & Activate"}
                </Button>
              </div>
            )}

            {/* Suspend */}
            {treasury.verificationStatus === "verified" && !showSuspendForm && (
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setShowSuspendForm(true)}
              >
                <Ban className="w-3.5 h-3.5 mr-1.5" />
                Suspend Treasury Account
              </Button>
            )}
            {showSuspendForm && (
              <div className="space-y-2 border border-red-200 rounded-lg p-3 bg-red-50/20">
                <p className="text-xs text-red-700 font-medium">
                  ⚠️ Suspending will immediately block ALL outgoing provider payouts.
                </p>
                <Textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Required: reason for suspension (min 10 characters)"
                  className="text-sm h-16 resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setError(null); setSuccess(null); suspendMutation.mutate(); }}
                    disabled={suspendMutation.isPending}
                  >
                    {suspendMutation.isPending ? "Suspending…" : "Confirm Suspend"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowSuspendForm(false); setSuspendReason(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Audit log link */}
            <div className="pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 text-xs"
                onClick={() => window.open("/api/admin/finance/treasury/log", "_blank")}
              >
                <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                View access audit log (JSON)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Health chip sub-component ─────────────────────────────────────────────────

function HealthChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
      ok
        ? "bg-green-100 text-green-700"
        : "bg-yellow-100 text-yellow-700"
    }`}>
      {ok
        ? <CheckCircle className="w-3 h-3" />
        : <AlertTriangle className="w-3 h-3" />}
      {label}
    </div>
  );
}
