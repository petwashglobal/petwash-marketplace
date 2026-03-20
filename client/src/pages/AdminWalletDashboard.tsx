import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck,
  Loader2,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  BarChart3,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

const GOLD = "#C5A55A";

function centsToILS(cents: number): string {
  return (cents / 100).toLocaleString("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 2 });
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "PASS") return <Badge className="bg-green-600 text-white text-sm px-3 py-1">PASS</Badge>;
  if (verdict === "WARN") return <Badge className="bg-yellow-500 text-white text-sm px-3 py-1">WARN</Badge>;
  return <Badge className="bg-red-600 text-white text-sm px-3 py-1">FAIL</Badge>;
}

function FinanceStateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    none: "bg-gray-100 text-gray-600",
    hold_active: "bg-yellow-100 text-yellow-800",
    debited: "bg-blue-100 text-blue-800",
    released: "bg-green-100 text-green-800",
    refunded: "bg-purple-100 text-purple-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[state] ?? "bg-gray-100 text-gray-600"}`}>
      {state}
    </span>
  );
}

const DIVISION_LABELS: Record<string, string> = {
  station_k9000: "K9000",
  petsitter: "Sitter Suite",
  walkers: "Walk My Pet",
  academy: "Academy",
  pettrek: "PetTrek",
  general: "General",
};

export default function AdminWalletDashboard() {
  const { toast } = useToast();
  const [auditId, setAuditId] = useState("");
  const [auditSearch, setAuditSearch] = useState("");

  // ── Division Report ─────────────────────────────────────────────────────────
  const { data: divisionReport, isLoading: divLoading } = useQuery<any[]>({
    queryKey: ["/api/prestige-pass/admin/wallet/division-report"],
  });

  // ── Booking Audit ───────────────────────────────────────────────────────────
  const {
    data: auditData,
    isLoading: auditLoading,
    refetch: refetchAudit,
  } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/booking-audit", auditSearch],
    enabled: !!auditSearch,
  });

  // ── Proof Pass ──────────────────────────────────────────────────────────────
  const {
    data: proofPass,
    isPending: proofPending,
    mutate: runProofPass,
  } = useMutation<any>({
    mutationFn: () =>
      apiRequest("POST", "/api/prestige-pass/admin/wallet/proof-pass", {}),
    onError: () => toast({ title: "Proof pass failed", variant: "destructive" }),
  });

  function handleAuditSearch() {
    if (!auditId.trim()) return;
    setAuditSearch(auditId.trim());
  }

  // Group division report by division_code
  const divisionGroups: Record<string, any[]> = {};
  if (divisionReport) {
    for (const row of divisionReport) {
      const key = row.division_code ?? row.divisionCode ?? "general";
      if (!divisionGroups[key]) divisionGroups[key] = [];
      divisionGroups[key].push(row);
    }
  }

  return (
    <div className="min-h-screen bg-white" dir="ltr">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
        <Link href="/admin/finance">
          <span className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <ChevronRight className="w-4 h-4 rotate-180 inline" />
          </span>
        </Link>
        <Wallet className="w-5 h-5" style={{ color: GOLD }} />
        <h1 className="text-xl font-semibold text-gray-900">Wallet Finance Dashboard</h1>
      </div>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Tabs defaultValue="proof">
          <TabsList className="bg-gray-100">
            <TabsTrigger value="proof">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Proof Pass
            </TabsTrigger>
            <TabsTrigger value="divisions">
              <BarChart3 className="w-4 h-4 mr-2" />
              Division Report
            </TabsTrigger>
            <TabsTrigger value="audit">
              <BookOpen className="w-4 h-4 mr-2" />
              Booking Audit
            </TabsTrigger>
          </TabsList>

          {/* ── PROOF PASS ── */}
          <TabsContent value="proof" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Wallet Integrity Proof Pass</CardTitle>
                  {proofPass && <VerdictBadge verdict={proofPass.verdict} />}
                </div>
                <p className="text-sm text-gray-500">
                  Runs 6 audit steps: reconciliation, finance-state distribution, negative balance,
                  pending drift, idempotency coverage, and final verdict.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => runProofPass()}
                  disabled={proofPending}
                  style={{ backgroundColor: GOLD, color: "#fff" }}
                  className="hover:opacity-90"
                >
                  {proofPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running…</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-2" /> Run Proof Pass</>
                  )}
                </Button>

                {proofPass && (
                  <div className="space-y-2 mt-2">
                    {proofPass.steps?.map((step: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50"
                      >
                        {step.status === "PASS" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        ) : step.status === "WARN" ? (
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{step.name}</span>
                            <Badge
                              className={
                                step.status === "PASS"
                                  ? "bg-green-100 text-green-700 text-xs"
                                  : step.status === "WARN"
                                  ? "bg-yellow-100 text-yellow-700 text-xs"
                                  : "bg-red-100 text-red-700 text-xs"
                              }
                            >
                              {step.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                        </div>
                      </div>
                    ))}

                    <div className="mt-3 p-3 rounded-lg border border-gray-200 text-sm text-gray-600">
                      <span className="font-medium">Run at:</span>{" "}
                      {new Date(proofPass.runAt).toLocaleString("he-IL")}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DIVISION REPORT ── */}
          <TabsContent value="divisions" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Wallet Volume by Division</CardTitle>
                <p className="text-sm text-gray-500">
                  Aggregated hold / debit / release / refund totals per division from the wallet ledger.
                </p>
              </CardHeader>
              <CardContent>
                {divLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : !divisionReport || divisionReport.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No data yet.</p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(divisionGroups).map(([divCode, rows]) => (
                      <div key={divCode}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                          {DIVISION_LABELS[divCode] ?? divCode}
                        </h3>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs">Event Type</TableHead>
                              <TableHead className="text-xs text-right">Count</TableHead>
                              <TableHead className="text-xs text-right">Total (ILS)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-sm capitalize">
                                  {(row.event_type ?? row.eventType ?? "—").replace(/_/g, " ")}
                                </TableCell>
                                <TableCell className="text-sm text-right">
                                  {Number(row.count ?? row.txnCount ?? 0).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-sm text-right font-mono">
                                  {centsToILS(Number(row.total_cents ?? row.totalCents ?? 0))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BOOKING AUDIT ── */}
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Booking Wallet Audit</CardTitle>
                <p className="text-sm text-gray-500">
                  Enter a booking ID (e.g. REQ-2024-XXXX or TRN-2024-XXXX) to view the full
                  wallet ledger timeline for that booking.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Booking ID…"
                    value={auditId}
                    onChange={(e) => setAuditId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuditSearch()}
                    className="max-w-xs"
                  />
                  <Button
                    onClick={handleAuditSearch}
                    style={{ backgroundColor: GOLD, color: "#fff" }}
                    className="hover:opacity-90"
                  >
                    {auditLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {auditSearch && !auditLoading && !auditData && (
                  <p className="text-sm text-gray-500">No ledger entries found for <strong>{auditSearch}</strong>.</p>
                )}

                {auditData && (
                  <div className="space-y-4">
                    {/* Booking summary */}
                    <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Booking ID</p>
                        <p className="text-sm font-mono font-medium">{auditData.bookingId ?? auditSearch}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Finance State</p>
                        <FinanceStateBadge state={auditData.financeState ?? "—"} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Hold</p>
                        <p className="text-sm font-mono">{centsToILS(Number(auditData.holdCents ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Debited</p>
                        <p className="text-sm font-mono">{centsToILS(Number(auditData.debitedCents ?? 0))}</p>
                      </div>
                    </div>

                    {/* Ledger entries */}
                    {auditData.entries && auditData.entries.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-xs">Time</TableHead>
                            <TableHead className="text-xs">Event</TableHead>
                            <TableHead className="text-xs">Bucket</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs">Idempotent Key</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditData.entries.map((e: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                                {new Date(e.createdAt ?? e.created_at).toLocaleString("he-IL")}
                              </TableCell>
                              <TableCell className="text-xs capitalize">
                                {(e.eventType ?? e.event_type ?? "—").replace(/_/g, " ")}
                              </TableCell>
                              <TableCell className="text-xs">
                                {e.bucketType ?? e.bucket_type ?? "—"}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {centsToILS(Number(e.amountCents ?? e.amount_cents ?? 0))}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-gray-400 max-w-[180px] truncate">
                                {e.idempotencyKey ?? e.idempotency_key ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
