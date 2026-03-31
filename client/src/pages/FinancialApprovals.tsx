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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Clock, DollarSign,
  Lock, Unlock, ChevronRight, Info, Users, TrendingUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueItem {
  id: number;
  caseType: string;
  caseRefId: string;
  actionType: string;
  amountCents: number;
  amountILS: number;
  requestedBy: string | null;
  currentStatus: string;
  ownerScope: string;
  ownerId: string | null;
  ageHours: number;
  bookingId: string | null;
  logId: number | null;
  requiredRole: string;
  secondApprovalRequired: boolean;
  secondApprovalRole: string | null;
}

interface LogEntry {
  id: number;
  case_type: string;
  case_ref_id: string;
  action_type: string;
  amount_cents: number;
  status: string;
  requested_by_uid: string | null;
  approved_by_uid: string | null;
  second_approved_by_uid: string | null;
  required_role: string | null;
  second_approval_role: string | null;
  note: string | null;
  created_at: string;
  approved_at: string | null;
  executed_at: string | null;
}

interface ApprovalMatrix {
  id: number;
  case_type: string;
  action_type: string;
  owner_scope: string;
  min_amount_cents: number;
  max_amount_cents: number | null;
  required_role: string;
  second_approval_role: string | null;
  is_active: boolean;
}

interface ReserveSummary {
  gross_payable_cents: number;
  held_in_reserve_cents: number;
  blocked_by_hold_cents: number;
  released_cents: number;
  reserve_count: number;
  hold_count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_COLOR: Record<string, string> = {
  agent: 'bg-gray-100 text-gray-700',
  manager: 'bg-blue-100 text-blue-700',
  franchise_owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-orange-100 text-orange-700',
  executive: 'bg-red-100 text-red-700',
};

const CASE_LABEL: Record<string, string> = {
  refund: 'Refund',
  payout_release: 'Payout Release',
  dispute_close: 'Dispute Close',
  manual_adjustment: 'Manual Adjustment',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  executed: 'bg-blue-100 text-blue-800',
};

function ils(cents: number | null | undefined) {
  if (cents == null) return '—';
  return `₪${(cents / 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function RoleChip({ role }: { role: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action dialog
// ---------------------------------------------------------------------------

function ActionDialog({
  open,
  item,
  action,
  onClose,
  onConfirm,
  isPending,
}: {
  open: boolean;
  item: QueueItem | null;
  action: 'approve' | 'reject';
  onClose: () => void;
  onConfirm: (note: string) => void;
  isPending: boolean;
}) {
  const [note, setNote] = useState('');

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'approve'
              ? <CheckCircle2 className="w-5 h-5 text-green-600" />
              : <XCircle className="w-5 h-5 text-red-600" />}
            {action === 'approve' ? 'Approve' : 'Reject'} Financial Action
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{CASE_LABEL[item.caseType] ?? item.caseType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono text-xs">{item.caseRefId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold text-base">{ils(item.amountCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Required role</span>
              <RoleChip role={item.requiredRole} />
            </div>
            {item.secondApprovalRequired && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200 text-amber-800 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Second approval required from <RoleChip role={item.secondApprovalRole ?? ''} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note for the audit log..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button
            variant={action === 'approve' ? 'default' : 'destructive'}
            onClick={() => onConfirm(note)}
            disabled={isPending}
          >
            {isPending ? 'Processing…' : action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Queue table
// ---------------------------------------------------------------------------

function QueueTable({
  items,
  onApprove,
  onReject,
}: {
  items: QueueItem[];
  onApprove: (item: QueueItem) => void;
  onReject: (item: QueueItem) => void;
}) {
  if (!items.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
        No items in queue
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Amount (ILS)</TableHead>
            <TableHead>Required Role</TableHead>
            <TableHead>2nd Approval</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={`${item.caseType}-${item.caseRefId}`}>
              <TableCell>
                <Badge variant="outline" className="whitespace-nowrap">
                  {CASE_LABEL[item.caseType] ?? item.caseType}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs max-w-[120px] truncate">
                {item.caseRefId}
              </TableCell>
              <TableCell className="text-right font-bold">{ils(item.amountCents)}</TableCell>
              <TableCell><RoleChip role={item.requiredRole} /></TableCell>
              <TableCell>
                {item.secondApprovalRequired
                  ? <span className="flex items-center gap-1 text-amber-700 text-xs font-medium">
                      <Lock className="w-3 h-3" />
                      <RoleChip role={item.secondApprovalRole ?? ''} />
                    </span>
                  : <span className="text-green-600 text-xs">None</span>}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {item.ageHours != null ? `${item.ageHours}h` : '—'}
              </TableCell>
              <TableCell>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[item.currentStatus] ?? ''}`}>
                  {item.currentStatus}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => onApprove(item)}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => onReject(item)}
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Log table
// ---------------------------------------------------------------------------

function LogTable({ entries }: { entries: LogEntry[] }) {
  if (!entries.length) {
    return <div className="text-center py-10 text-muted-foreground text-sm">No entries</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Approved By</TableHead>
            <TableHead>2nd Approved By</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(e => (
            <TableRow key={e.id}>
              <TableCell>
                <Badge variant="outline">{CASE_LABEL[e.case_type] ?? e.case_type}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs max-w-[120px] truncate">{e.case_ref_id}</TableCell>
              <TableCell className="text-right font-medium">{ils(e.amount_cents)}</TableCell>
              <TableCell>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[e.status] ?? ''}`}>
                  {e.status}
                </span>
              </TableCell>
              <TableCell className="text-xs">{e.approved_by_uid?.slice(0, 10) ?? '—'}</TableCell>
              <TableCell className="text-xs">{e.second_approved_by_uid?.slice(0, 10) ?? '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{e.note ?? '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {e.created_at ? new Date(e.created_at).toLocaleString('he-IL') : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matrix view
// ---------------------------------------------------------------------------

function MatrixView({ rules }: { rules: ApprovalMatrix[] }) {
  const grouped: Record<string, ApprovalMatrix[]> = {};
  for (const r of rules) {
    if (!grouped[r.case_type]) grouped[r.case_type] = [];
    grouped[r.case_type].push(r);
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([caseType, rows]) => (
        <Card key={caseType}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{CASE_LABEL[caseType] ?? caseType}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Min Amount</TableHead>
                  <TableHead>Max Amount</TableHead>
                  <TableHead>Required Role</TableHead>
                  <TableHead>2nd Approval</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className={r.is_active ? '' : 'opacity-40'}>
                    <TableCell className="font-medium">{r.action_type}</TableCell>
                    <TableCell className="text-xs">{r.owner_scope}</TableCell>
                    <TableCell>{ils(r.min_amount_cents)}</TableCell>
                    <TableCell>{r.max_amount_cents != null ? ils(r.max_amount_cents) : '∞'}</TableCell>
                    <TableCell><RoleChip role={r.required_role} /></TableCell>
                    <TableCell>
                      {r.second_approval_role
                        ? <RoleChip role={r.second_approval_role} />
                        : <span className="text-xs text-muted-foreground">None</span>}
                    </TableCell>
                    <TableCell>
                      {r.is_active
                        ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reserve summary panel
// ---------------------------------------------------------------------------

function ReservePanel({ summary }: { summary: ReserveSummary | undefined }) {
  if (!summary) return null;

  const cards = [
    {
      label: 'Gross Payable',
      value: ils(summary.gross_payable_cents),
      icon: <TrendingUp className="w-4 h-4 text-green-600" />,
      color: 'border-green-200 bg-green-50',
    },
    {
      label: 'Held in Reserve',
      value: ils(summary.held_in_reserve_cents),
      icon: <Lock className="w-4 h-4 text-amber-600" />,
      color: 'border-amber-200 bg-amber-50',
      sub: `${summary.reserve_count} settlement(s)`,
    },
    {
      label: 'Blocked by Hold',
      value: ils(summary.blocked_by_hold_cents),
      icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
      color: 'border-red-200 bg-red-50',
      sub: `${summary.hold_count} hold(s)`,
    },
    {
      label: 'Released',
      value: ils(summary.released_cents),
      icon: <Unlock className="w-4 h-4 text-blue-600" />,
      color: 'border-blue-200 bg-blue-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <Card key={c.label} className={`border ${c.color}`}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              {c.icon}
              <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
            </div>
            <div className="text-xl font-bold">{c.value}</div>
            {c.sub && <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FinancialApprovals() {
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject'>('approve');
  const [dialogItem, setDialogItem] = useState<QueueItem | null>(null);

  // Queries
  const { data: queueData, isLoading: queueLoading } = useQuery<{
    pending: QueueItem[];
    approvedToday: LogEntry[];
    rejectedToday: LogEntry[];
    executedToday: LogEntry[];
  }>({
    queryKey: ['/api/financial-approvals/queue?status=pending'],
    refetchInterval: 30000,
  });

  const { data: logData, isLoading: logLoading } = useQuery<{ log: LogEntry[] }>({
    queryKey: ['/api/financial-approvals/log'],
  });

  const { data: matrixData } = useQuery<{ rules: ApprovalMatrix[] }>({
    queryKey: ['/api/financial-approvals/matrix'],
  });

  const { data: reserveData } = useQuery<ReserveSummary>({
    queryKey: ['/api/financial-approvals/reserve-summary'],
  });

  // Approve mutation
  const approveMut = useMutation({
    mutationFn: async ({ item, note }: { item: QueueItem; note: string }) => {
      return apiRequest('POST', '/api/financial-approvals/approve', {
        case_type: item.caseType,
        case_ref_id: item.caseRefId,
        action_type: item.actionType,
        amount_cents: item.amountCents,
        owner_scope: item.ownerScope,
        owner_id: item.ownerId,
        note: note || null,
      });
    },
    onSuccess: (data: any) => {
      setDialogOpen(false);
      toast({ title: 'Action approved', description: data?.message ?? 'Done' });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-approvals/queue?status=pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-approvals/log'] });
    },
    onError: (e: any) => {
      toast({ title: 'Approval blocked', description: e?.message ?? 'Insufficient authority', variant: 'destructive' });
    },
  });

  // Reject mutation
  const rejectMut = useMutation({
    mutationFn: async ({ item, note }: { item: QueueItem; note: string }) => {
      return apiRequest('POST', '/api/financial-approvals/reject', {
        case_type: item.caseType,
        case_ref_id: item.caseRefId,
        action_type: item.actionType,
        amount_cents: item.amountCents,
        owner_scope: item.ownerScope,
        owner_id: item.ownerId,
        note: note || null,
      });
    },
    onSuccess: () => {
      setDialogOpen(false);
      toast({ title: 'Rejected', description: 'Action recorded in audit log' });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-approvals/queue?status=pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-approvals/log'] });
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    },
  });

  const openDialog = (item: QueueItem, action: 'approve' | 'reject') => {
    setDialogItem(item);
    setDialogAction(action);
    setDialogOpen(true);
  };

  const handleConfirm = (note: string) => {
    if (!dialogItem) return;
    if (dialogAction === 'approve') {
      approveMut.mutate({ item: dialogItem, note });
    } else {
      rejectMut.mutate({ item: dialogItem, note });
    }
  };

  const pendingItems = queueData?.pending ?? [];
  const approvedToday = queueData?.approvedToday ?? [];
  const rejectedToday = queueData?.rejectedToday ?? [];
  const executedToday = queueData?.executedToday ?? [];
  const allLog = logData?.log ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-7 h-7 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">Financial Approvals</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Financial authority queue — refunds, payout releases, dispute closures, and manual adjustments
          </p>
        </div>

        {/* Reserve summary */}
        <ReservePanel summary={reserveData} />

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pending', value: pendingItems.length, icon: <Clock className="w-4 h-4 text-yellow-600" />, color: 'bg-yellow-50 border-yellow-200' },
            { label: 'Approved Today', value: approvedToday.length, icon: <CheckCircle2 className="w-4 h-4 text-green-600" />, color: 'bg-green-50 border-green-200' },
            { label: 'Rejected Today', value: rejectedToday.length, icon: <XCircle className="w-4 h-4 text-red-600" />, color: 'bg-red-50 border-red-200' },
            { label: 'Executed Today', value: executedToday.length, icon: <DollarSign className="w-4 h-4 text-blue-600" />, color: 'bg-blue-50 border-blue-200' },
          ].map(k => (
            <Card key={k.label} className={`border ${k.color}`}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  {k.icon}
                  <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                </div>
                <div className="text-2xl font-bold">{k.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main tabs */}
        <Tabs defaultValue="pending">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="pending">
              Pending {pendingItems.length > 0 && <span className="ml-1 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingItems.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="executed">Executed</TabsTrigger>
            <TabsTrigger value="matrix">Rules Matrix</TabsTrigger>
          </TabsList>

          {/* Pending */}
          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  Pending Financial Approvals
                </CardTitle>
                <CardDescription>
                  High-value actions waiting for role-authorized approval. No action executes without passing the approval matrix.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {queueLoading
                  ? <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
                  : <QueueTable items={pendingItems} onApprove={i => openDialog(i, 'approve')} onReject={i => openDialog(i, 'reject')} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Approved */}
          <TabsContent value="approved" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Approved Today
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <LogTable entries={approvedToday} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rejected */}
          <TabsContent value="rejected" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Rejected Today
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <LogTable entries={rejectedToday} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Executed — full log */}
          <TabsContent value="executed" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  Full Audit Log
                </CardTitle>
                <CardDescription>
                  Every financial approval decision — who requested it, who approved it, which rule allowed it.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {logLoading
                  ? <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
                  : <LogTable entries={allLog} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules matrix */}
          <TabsContent value="matrix" className="mt-4">
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <span>These rules are the financial authority table. Every financial action must match one rule. No match = action blocked. Owner-specific rules override global defaults.</span>
              </div>
            </div>
            {matrixData ? <MatrixView rules={matrixData.rules} /> : <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>}
          </TabsContent>
        </Tabs>

        {/* Action dialog */}
        <ActionDialog
          open={dialogOpen}
          item={dialogItem}
          action={dialogAction}
          onClose={() => setDialogOpen(false)}
          onConfirm={handleConfirm}
          isPending={approveMut.isPending || rejectMut.isPending}
        />
      </div>
    </div>
  );
}
