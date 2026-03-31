import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Wallet, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  ArrowRight, Building2, FileSearch, TrendingUp, Clock, Link2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreasuryStatus {
  totals: {
    total_batches: string;
    total_amount_cents: string;
    pending_cents: string;
    approved_cents: string;
    submitted_cents: string;
    paid_cents: string;
    failed_cents: string;
    reconciled_cents: string;
    pending_count: string;
    submitted_count: string;
    paid_count: string;
    failed_count: string;
    reconciled_count: string;
  };
  reconciliation: {
    matched: string;
    partial: string;
    unmatched: string;
    total: string;
    health_pct: number | null;
  };
  open_failures: number;
  unlinked_bank_transactions: number;
}

interface Batch {
  id: number;
  batch_id: string;
  total_net_cents: number;
  status: string;
  currency: string;
  owner_scope: string;
  item_count: number;
  recon_status: string;
  difference_cents: number | null;
  has_open_failure: boolean;
  created_at: string;
  paid_at: string | null;
  reconciled_at: string | null;
}

interface BankTx {
  id: number;
  reference_number: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
  description: string | null;
  currency: string;
  transaction_date: string | null;
  reconciliation_status: string | null;
  imported_at: string | null;
}

interface ReconResult {
  id: number;
  batch_id: number;
  batch_ref: string;
  batch_amount: number;
  status: string;
  amount_expected: number;
  amount_actual: number;
  difference_cents: number;
  reference_number: string | null;
  bank_description: string | null;
  created_at: string;
}

interface Failure {
  id: number;
  batch_id: number;
  batch_ref: string;
  reason: string;
  retry_count: number;
  resolved: boolean;
  last_retry_at: string | null;
  created_at: string;
}

interface TraceResult {
  settlement: any;
  batchItem: any | null;
  approvalLog: any | null;
  reconciliation: any | null;
  bankTransaction: any | null;
  traceComplete: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ils(cents: number | string | null | undefined) {
  const n = typeof cents === 'string' ? parseInt(cents) : (cents ?? 0);
  return `₪${(n / 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  submitted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  reconciled: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  matched: 'bg-emerald-100 text-emerald-800',
  partial: 'bg-amber-100 text-amber-800',
  unmatched: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}

function ReconHealthBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-sm text-muted-foreground">No data</span>;
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold ${pct >= 90 ? 'text-emerald-700' : pct >= 70 ? 'text-amber-700' : 'text-red-700'}`}>
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import modal
// ---------------------------------------------------------------------------

function ImportBankModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [raw, setRaw] = useState('');

  const importMut = useMutation({
    mutationFn: () => {
      const lines = raw.trim().split('\n').filter(Boolean);
      const transactions = lines.map(line => {
        const [direction, amount_cents, reference, description] = line.split(',').map(s => s.trim());
        return {
          direction: direction as 'outgoing' | 'incoming',
          amount_cents: parseInt(amount_cents),
          reference,
          raw_description: description,
          bank_ref: reference || undefined,
        };
      });
      return apiRequest('POST', '/api/treasury/import-bank-transactions', { transactions });
    },
    onSuccess: (data: any) => {
      toast({ title: 'Imported', description: `${data.imported} transactions imported, ${data.skipped} skipped` });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/status'] });
      onClose();
      setRaw('');
    },
    onError: (e: any) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Bank Transactions</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            One transaction per line: <code className="bg-gray-100 px-1 rounded text-xs">direction,amount_cents,reference,description</code>
          </p>
          <p className="text-xs text-muted-foreground">Example: <code className="bg-gray-100 px-1 rounded">outgoing,150000,BATCH-123,Payout to providers</code></p>
          <textarea
            className="w-full h-36 font-mono text-xs border rounded p-2 resize-none"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={"outgoing,50000,BATCH-001,Monthly payout\noutgoing,120000,BATCH-002,Station payout"}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => importMut.mutate()} disabled={!raw.trim() || importMut.isPending}>
            {importMut.isPending ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Trace drilldown dialog
// ---------------------------------------------------------------------------

function TraceDialog({ open, settlementId, onClose }: { open: boolean; settlementId: number | null; onClose: () => void }) {
  const { data, isLoading } = useQuery<TraceResult>({
    queryKey: [`/api/treasury/trace/${settlementId}`],
    enabled: open && !!settlementId,
  });

  const steps = [
    { label: 'Settlement', value: data?.settlement ? `id=${data.settlement.id} | ₪${((data.settlement.station_amount_cents ?? 0) / 100).toFixed(2)}` : null, done: !!data?.settlement },
    { label: 'Payout Batch', value: data?.batchItem ? `${data.batchItem.batch_ref} | ${data.batchItem.batch_status}` : null, done: !!data?.batchItem },
    { label: 'Approval Log', value: data?.approvalLog ? `status=${data.approvalLog.status} | by=${data.approvalLog.approved_by_uid ?? '—'}` : null, done: !!data?.approvalLog },
    { label: 'Bank Transaction', value: data?.bankTransaction ? `ref=${data.bankTransaction.reference_number ?? '—'} | ₪${parseFloat(data.bankTransaction.debit_amount ?? '0').toFixed(2)}` : null, done: !!data?.bankTransaction },
    { label: 'Reconciliation', value: data?.reconciliation ? `status=${data.reconciliation.status} | diff=${data.reconciliation.difference_cents ?? 0} cents` : null, done: !!data?.reconciliation },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="w-4 h-4" /> Settlement Trace — id={settlementId}
          </DialogTitle>
        </DialogHeader>
        {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Loading trace…</div>}
        {data && (
          <div className="space-y-2 py-2">
            <div className={`text-sm font-semibold px-3 py-2 rounded-lg mb-3 ${data.traceComplete ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              {data.traceComplete ? '✓ Full trace chain complete' : '⚠ Trace chain incomplete — some links missing'}
            </div>
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${step.done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {step.done ? '✓' : i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{step.label}</div>
                  {step.value
                    ? <div className="text-xs text-muted-foreground font-mono">{step.value}</div>
                    : <div className="text-xs text-red-500">Not found</div>}
                </div>
                {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 mt-1.5" />}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Treasury() {
  const { toast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [traceId, setTraceId] = useState<number | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<TreasuryStatus>({
    queryKey: ['/api/treasury/status'],
    refetchInterval: 30000,
  });

  const { data: batchData, isLoading: batchLoading } = useQuery<{ batches: Batch[] }>({
    queryKey: ['/api/treasury/batches'],
  });

  const { data: bankData } = useQuery<{ transactions: BankTx[] }>({
    queryKey: ['/api/treasury/bank-transactions'],
  });

  const { data: reconData } = useQuery<{ results: ReconResult[] }>({
    queryKey: ['/api/treasury/reconciliation-results'],
  });

  const { data: failureData } = useQuery<{ failures: Failure[] }>({
    queryKey: ['/api/treasury/failures'],
  });

  const sweepMut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/treasury/reconcile-sweep', {}),
    onSuccess: (d: any) => {
      toast({ title: 'Reconciliation sweep complete', description: `Processed ${d.processed} | Matched ${d.matched} | Unmatched ${d.unmatched}` });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/reconciliation-results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/batches'] });
    },
    onError: (e: any) => toast({ title: 'Sweep failed', description: e.message, variant: 'destructive' }),
  });

  const retryMut = useMutation({
    mutationFn: (failureId: number) => apiRequest('POST', `/api/treasury/failures/${failureId}/retry`, {}),
    onSuccess: () => {
      toast({ title: 'Retry queued', description: 'Batch reset to submitted — reconciliation will run next sweep' });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/failures'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/batches'] });
    },
  });

  const t = status?.totals;
  const r = status?.reconciliation;

  const kpis = [
    { label: 'Total Batched', value: ils(t?.total_amount_cents), sub: `${t?.total_batches ?? 0} batches`, color: 'border-gray-200', icon: <Wallet className="w-4 h-4 text-gray-600" /> },
    { label: 'Pending', value: ils(t?.pending_cents), sub: `${t?.pending_count ?? 0} batches`, color: 'border-yellow-200 bg-yellow-50', icon: <Clock className="w-4 h-4 text-yellow-600" /> },
    { label: 'Submitted', value: ils(t?.submitted_cents), sub: `${t?.submitted_count ?? 0} batches`, color: 'border-indigo-200 bg-indigo-50', icon: <ArrowRight className="w-4 h-4 text-indigo-600" /> },
    { label: 'Paid', value: ils(t?.paid_cents), sub: `${t?.paid_count ?? 0} batches`, color: 'border-green-200 bg-green-50', icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> },
    { label: 'Reconciled', value: ils(t?.reconciled_cents), sub: `${t?.reconciled_count ?? 0} batches`, color: 'border-emerald-200 bg-emerald-50', icon: <TrendingUp className="w-4 h-4 text-emerald-600" /> },
    { label: 'Failed', value: ils(t?.failed_cents), sub: `${status?.open_failures ?? 0} open failures`, color: 'border-red-200 bg-red-50', icon: <XCircle className="w-4 h-4 text-red-600" /> },
  ];

  const batches = batchData?.batches ?? [];
  const bankTxs = bankData?.transactions ?? [];
  const reconResults = reconData?.results ?? [];
  const failures = failureData?.failures ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Building2 className="w-7 h-7 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Treasury</h1>
            </div>
            <p className="text-muted-foreground text-sm">Cash reconciliation — every payout traced from approval to bank confirmation</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              Import Bank Feed
            </Button>
            <Button size="sm" onClick={() => sweepMut.mutate()} disabled={sweepMut.isPending}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${sweepMut.isPending ? 'animate-spin' : ''}`} />
              Reconcile Now
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map(k => (
            <Card key={k.label} className={`border ${k.color}`}>
              <CardContent className="pt-4 pb-3 px-3">
                <div className="flex items-center gap-1.5 mb-1">{k.icon}<span className="text-xs font-medium text-muted-foreground">{k.label}</span></div>
                <div className="text-lg font-bold leading-tight">{k.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Reconciliation health */}
        <Card>
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-sm">Reconciliation Health</span>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="text-emerald-700 font-medium">Matched: {r?.matched ?? 0}</span>
                <span className="text-amber-700 font-medium">Partial: {r?.partial ?? 0}</span>
                <span className="text-red-700 font-medium">Unmatched: {r?.unmatched ?? 0}</span>
                <span>Unlinked bank txs: {status?.unlinked_bank_transactions ?? 0}</span>
              </div>
            </div>
            <ReconHealthBar pct={r?.health_pct ?? null} />
          </CardContent>
        </Card>

        {/* Main tabs */}
        <Tabs defaultValue="batches">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="batches">
              Batches {batches.length > 0 && <span className="ml-1 text-xs bg-gray-200 rounded-full px-1.5">{batches.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
            <TabsTrigger value="bank">
              Bank Feed {bankTxs.length > 0 && <span className="ml-1 text-xs bg-gray-200 rounded-full px-1.5">{bankTxs.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="failures">
              Failures {failures.length > 0 && <span className="ml-1 bg-red-100 text-red-700 text-xs rounded-full px-1.5">{failures.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="trace">Trace</TabsTrigger>
          </TabsList>

          {/* Batches */}
          <TabsContent value="batches" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payout Batches</CardTitle>
                <CardDescription>All batches. Click a settlement count to drill down.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {batchLoading
                  ? <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
                  : batches.length === 0
                    ? <div className="py-10 text-center text-sm text-muted-foreground">No batches yet</div>
                    : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Batch Ref</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Items</TableHead>
                              <TableHead>Recon</TableHead>
                              <TableHead>Diff</TableHead>
                              <TableHead>Failure</TableHead>
                              <TableHead>Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batches.map(b => (
                              <TableRow key={b.id}>
                                <TableCell className="font-mono text-xs">{b.batch_id}</TableCell>
                                <TableCell><StatusBadge status={b.status} /></TableCell>
                                <TableCell className="text-right font-bold">{ils(b.total_net_cents)}</TableCell>
                                <TableCell className="text-sm">{b.item_count}</TableCell>
                                <TableCell><StatusBadge status={b.recon_status} /></TableCell>
                                <TableCell className={`text-xs ${(b.difference_cents ?? 0) !== 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                  {b.difference_cents != null ? `${(b.difference_cents / 100).toFixed(2)}` : '—'}
                                </TableCell>
                                <TableCell>
                                  {b.has_open_failure
                                    ? <AlertTriangle className="w-4 h-4 text-red-500" />
                                    : <span className="text-muted-foreground text-xs">—</span>}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {new Date(b.created_at).toLocaleDateString('he-IL')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reconciliation */}
          <TabsContent value="reconciliation" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Reconciliation Results</CardTitle>
                <CardDescription>
                  matched = exact. partial = within tolerance. unmatched = no bank transaction found.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {reconResults.length === 0
                  ? <div className="py-10 text-center text-sm text-muted-foreground">No reconciliation results yet — run a sweep</div>
                  : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Batch Ref</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Expected</TableHead>
                            <TableHead className="text-right">Actual</TableHead>
                            <TableHead className="text-right">Difference</TableHead>
                            <TableHead>Bank Ref</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reconResults.map(r => (
                            <TableRow key={r.id}>
                              <TableCell className="font-mono text-xs">{r.batch_ref}</TableCell>
                              <TableCell><StatusBadge status={r.status} /></TableCell>
                              <TableCell className="text-right">{ils(r.amount_expected)}</TableCell>
                              <TableCell className="text-right">{ils(r.amount_actual)}</TableCell>
                              <TableCell className={`text-right text-xs font-medium ${r.difference_cents !== 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {r.difference_cents !== 0 ? `${(r.difference_cents / 100).toFixed(2)}` : '✓'}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{r.reference_number ?? '—'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(r.created_at).toLocaleDateString('he-IL')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bank feed */}
          <TabsContent value="bank" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Bank Transaction Feed</CardTitle>
                    <CardDescription>Imported bank transactions. Green = matched to a payout batch.</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                    Import
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {bankTxs.length === 0
                  ? <div className="py-10 text-center text-sm text-muted-foreground">No bank transactions imported yet</div>
                  : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Reference</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit (ILS)</TableHead>
                            <TableHead className="text-right">Credit (ILS)</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Recon Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bankTxs.map(tx => (
                            <TableRow key={tx.id} className={tx.reconciliation_status === 'matched' ? 'bg-emerald-50' : ''}>
                              <TableCell className="font-mono text-xs">{tx.reference_number ?? '—'}</TableCell>
                              <TableCell className="text-xs max-w-[160px] truncate">{tx.description ?? '—'}</TableCell>
                              <TableCell className="text-right text-sm">{tx.debit_amount != null ? `₪${parseFloat(String(tx.debit_amount)).toFixed(2)}` : '—'}</TableCell>
                              <TableCell className="text-right text-sm">{tx.credit_amount != null ? `₪${parseFloat(String(tx.credit_amount)).toFixed(2)}` : '—'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{tx.transaction_date ?? '—'}</TableCell>
                              <TableCell>
                                <StatusBadge status={tx.reconciliation_status ?? 'pending'} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Failures */}
          <TabsContent value="failures" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Payout Failures
                </CardTitle>
                <CardDescription>
                  Failed batches must be explicitly retried. A failed batch cannot be re-released without resolving the failure first.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {failures.length === 0
                  ? <div className="py-10 text-center text-sm text-muted-foreground">No open failures</div>
                  : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Batch Ref</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Retries</TableHead>
                            <TableHead>Last Retry</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {failures.map(f => (
                            <TableRow key={f.id}>
                              <TableCell className="font-mono text-xs">{f.batch_ref}</TableCell>
                              <TableCell className="text-xs max-w-[200px]">{f.reason}</TableCell>
                              <TableCell className="text-center">{f.retry_count}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {f.last_retry_at ? new Date(f.last_retry_at).toLocaleString('he-IL') : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(f.created_at).toLocaleString('he-IL')}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => retryMut.mutate(f.id)}
                                  disabled={retryMut.isPending}
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" /> Retry
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trace */}
          <TabsContent value="trace" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Settlement Trace</CardTitle>
                <CardDescription>
                  Enter a settlement ID to trace: settlement → batch → approval log → bank transaction → reconciliation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 items-end max-w-xs">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Settlement ID</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 8"
                      className="h-9"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (val > 0) setTraceId(val);
                        }
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-9"
                    onClick={e => {
                      const input = (e.currentTarget.previousElementSibling?.querySelector('input') as HTMLInputElement);
                      const val = parseInt(input?.value ?? '0');
                      if (val > 0) setTraceId(val);
                    }}
                  >
                    <FileSearch className="w-3.5 h-3.5 mr-1.5" /> Trace
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Press Enter or click Trace to open the full chain</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <ImportBankModal open={importOpen} onClose={() => setImportOpen(false)} />
        <TraceDialog open={!!traceId} settlementId={traceId} onClose={() => setTraceId(null)} />
      </div>
    </div>
  );
}
