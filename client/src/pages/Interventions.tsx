import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle, CheckCircle2, XCircle, Clock, ArrowRight,
  RefreshCw, Plus, ArrowUpRight, Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InterventionCase {
  id: number;
  entityType: 'station' | 'network' | 'franchise';
  entityId: string;
  entityName: string;
  triggerSignal: string | null;
  triggerFlag: string | null;
  decision: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  notes: string | null;
  createdBy: string;
  createdAt: string;
  resolvedAt: string | null;
  updatedAt: string;
}

interface CaseListResponse {
  cases: InterventionCase[];
  counts: { open: number; inProgress: number; resolved: number; escalated: number; total: number };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CFG = {
  open:        { label: 'Open',        color: 'bg-amber-100 text-amber-800 border-amber-300',    icon: <Clock className="w-3 h-3" /> },
  in_progress: { label: 'In progress', color: 'bg-blue-100 text-blue-800 border-blue-300',       icon: <ArrowUpRight className="w-3 h-3" /> },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: <CheckCircle2 className="w-3 h-3" /> },
  escalated:   { label: 'Escalated',  color: 'bg-red-100 text-red-800 border-red-300',           icon: <XCircle className="w-3 h-3" /> },
};

const SIGNAL_LABELS: Record<string, string> = {
  expand_now: 'Expand now',
  expand_carefully: 'Expand carefully',
  fix_operations_first: 'Fix ops first',
  freeze_capex: 'Freeze capex',
  review_franchise: 'Review franchise',
  restructure: 'Restructure',
  maintain: 'Maintain',
};

const FLAG_LABELS: Record<string, string> = {
  treasury_critical: 'Treasury critical',
  margin_collapse: 'Margin collapse',
  cash_blocked: 'Cash blocked',
  reserve_aged_31plus: 'Reserve aged 31+d',
  approval_backlog: 'Approval backlog',
  payout_failure: 'Payout failure',
  network_health_low: 'Network health low',
};

const DECISION_OPTIONS = [
  { value: 'approve_expansion', label: 'Approve expansion' },
  { value: 'freeze_capex', label: 'Freeze capex' },
  { value: 'restructure', label: 'Restructure' },
  { value: 'review_franchise', label: 'Review franchise' },
  { value: 'monitor', label: 'Monitor — no action yet' },
  { value: 'no_action', label: 'No action required' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: InterventionCase['status'] }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.open;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric' });
}

function CountCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className={`border ${color}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Auto-generate mutation
// ---------------------------------------------------------------------------

function AutoGenerateButton() {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/expansion/interventions/auto-generate'),
    onSuccess: async (res: any) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/expansion/interventions'] });
      toast({
        title: `${data.generated} case(s) generated`,
        description: data.skippedDuplicates > 0
          ? `${data.skippedDuplicates} duplicate(s) skipped`
          : 'All current board flags converted to intervention cases',
      });
    },
    onError: () => toast({ title: 'Error', description: 'Could not auto-generate cases', variant: 'destructive' }),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      className="gap-1.5"
    >
      <Zap className="w-3.5 h-3.5" />
      {mutation.isPending ? 'Generating…' : 'Generate from board flags'}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Update case dialog
// ---------------------------------------------------------------------------

function UpdateDialog({
  caseItem,
  open,
  onClose,
}: {
  caseItem: InterventionCase;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState(caseItem.status);
  const [decision, setDecision] = useState(caseItem.decision ?? '');
  const [notes, setNotes] = useState(caseItem.notes ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest('PATCH', `/api/expansion/interventions/${caseItem.id}`, {
        status,
        decision: decision || null,
        notes: notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expansion/interventions'] });
      toast({ title: 'Case updated' });
      onClose();
    },
    onError: () => toast({ title: 'Error', description: 'Update failed', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Intervention Case #{caseItem.id}</DialogTitle>
          <DialogDescription>{caseItem.entityName} — {caseItem.triggerFlag ? FLAG_LABELS[caseItem.triggerFlag] ?? caseItem.triggerFlag : 'Manual case'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={v => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Decision recorded</Label>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger><SelectValue placeholder="Select decision…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— No decision yet —</SelectItem>
                {DECISION_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Leadership notes or resolution detail…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Create case dialog
// ---------------------------------------------------------------------------

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [entityName, setEntityName] = useState('');
  const [entityId, setEntityId] = useState('');
  const [entityType, setEntityType] = useState('station');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/expansion/interventions', { entityType, entityId, entityName, notes: notes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expansion/interventions'] });
      toast({ title: 'Case created' });
      onClose();
      setEntityName(''); setEntityId(''); setNotes('');
    },
    onError: () => toast({ title: 'Error', description: 'Could not create case', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Open Manual Intervention Case</DialogTitle>
          <DialogDescription>Create a case not tied to an automatic board flag</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Entity type</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="station">Station</SelectItem>
                <SelectItem value="network">Network</SelectItem>
                <SelectItem value="franchise">Franchise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Entity name</Label>
            <Input value={entityName} onChange={e => setEntityName(e.target.value)} placeholder="e.g. K9000 Malha Mall" />
          </div>
          <div>
            <Label>Entity ID</Label>
            <Input value={entityId} onChange={e => setEntityId(e.target.value)} placeholder="e.g. station ID or owner key" />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Reason for intervention…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !entityName || !entityId}>
              {mutation.isPending ? 'Creating…' : 'Create case'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Cases table
// ---------------------------------------------------------------------------

function CasesTable({ cases }: { cases: InterventionCase[] }) {
  const [selected, setSelected] = useState<InterventionCase | null>(null);

  if (!cases.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        <span>No intervention cases — generate from board flags to populate</span>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead>Resolved</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map(c => (
              <TableRow
                key={c.id}
                className={
                  c.status === 'escalated' ? 'bg-red-50' :
                  c.status === 'resolved'  ? 'bg-emerald-50 opacity-70' : ''
                }
              >
                <TableCell className="text-xs text-muted-foreground font-mono">{c.id}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{c.entityName}</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${c.entityType === 'station' ? 'bg-blue-50 text-blue-700 border-blue-200' : c.entityType === 'network' ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                    {c.entityType}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {c.triggerFlag && (
                      <div className="text-xs bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded inline-block">
                        {FLAG_LABELS[c.triggerFlag] ?? c.triggerFlag}
                      </div>
                    )}
                    {c.triggerSignal && (
                      <div className="text-xs text-muted-foreground">
                        Signal: {SIGNAL_LABELS[c.triggerSignal] ?? c.triggerSignal}
                      </div>
                    )}
                    {!c.triggerFlag && !c.triggerSignal && <span className="text-xs text-muted-foreground">Manual</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {c.decision
                    ? <span className="text-xs font-medium text-gray-700">{DECISION_OPTIONS.find(d => d.value === c.decision)?.label ?? c.decision}</span>
                    : <span className="text-xs text-muted-foreground italic">Pending decision</span>}
                </TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(c.createdAt)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(c.resolvedAt)}</TableCell>
                <TableCell>
                  {c.status !== 'resolved' && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelected(c)}>
                      Update
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {selected && (
        <UpdateDialog caseItem={selected} open={!!selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Interventions() {
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const queryKey = statusFilter === 'all'
    ? '/api/expansion/interventions'
    : `/api/expansion/interventions?status=${statusFilter}`;

  const { data, isLoading } = useQuery<CaseListResponse>({
    queryKey: [queryKey],
    refetchInterval: 30000,
  });

  const cases = data?.cases ?? [];
  const counts = data?.counts ?? { open: 0, inProgress: 0, resolved: 0, escalated: 0, total: 0 };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
              <h1 className="text-2xl font-bold text-gray-900">Intervention Cases</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Board flags become accountable cases — track what was decided, by whom, and whether it worked
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AutoGenerateButton />
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> New case
            </Button>
          </div>
        </div>

        {/* Escalated banner */}
        {counts.escalated > 0 && (
          <div className="bg-red-600 text-white rounded-lg px-4 py-3 flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">
              {counts.escalated} escalated case(s) require immediate executive attention
            </span>
          </div>
        )}

        {/* Count strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CountCard label="Open" value={counts.open} color={counts.open > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200'} />
          <CountCard label="In progress" value={counts.inProgress} color="border-blue-200 bg-blue-50" />
          <CountCard label="Escalated" value={counts.escalated} color={counts.escalated > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'} />
          <CountCard label="Resolved" value={counts.resolved} color="border-emerald-200 bg-emerald-50" />
        </div>

        {/* Case table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Intervention Case Queue</CardTitle>
                <CardDescription>
                  Cases are auto-generated from board flags or created manually by leadership
                </CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {isLoading
              ? <div className="h-40 bg-gray-100 mx-4 rounded animate-pulse" />
              : <CasesTable cases={cases} />}
          </CardContent>
        </Card>

        {/* Origin links */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center border-t pt-4">
          <span className="font-medium">Cases originate from:</span>
          {[
            ['/finance/board-pack', 'Board pack signals'],
            ['/finance/profitability', 'Unit economics'],
            ['/treasury', 'Treasury reconciliation'],
          ].map(([href, lbl]) => (
            <Link key={href} href={href}>
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                {lbl} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>

        <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      </div>
    </div>
  );
}
