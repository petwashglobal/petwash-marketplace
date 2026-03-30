/**
 * GovernancePolicies.tsx
 * Phase 12.13 — Governance & Automation Layer
 *
 * Route: /governance
 * Auth: franchise_owner / admin
 *
 * Policy management surface: list, create, edit, deactivate, test policies.
 * Not a dashboard. This is the control surface for the rule engine.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge }    from '@/components/ui/badge';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ShieldCheck, Plus, Pencil, Trash2, Loader2, Play, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle, Zap, Route, TrendingDown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type PolicyType = 'approval_threshold' | 'auto_routing' | 'escalation_rule' | 'playbook';

interface Policy {
  id:          number;
  policyType:  PolicyType;
  name:        string;
  description: string | null;
  caseTypes:   string[];
  conditions:  Record<string, unknown>;
  actions:     Array<Record<string, unknown>>;
  priority:    number;
  isActive:    boolean;
  scopeType:   string;
  scopeId:     string | null;
  createdAt:   string;
  updatedAt:   string;
}

interface EvalResult {
  matchedCount: number;
  autoApproved: boolean;
  requireLevel: number;
  message?:     string;
  matched:      Array<{ policyId: number; policyType: string; name: string; actions: unknown[] }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<PolicyType, { label: string; icon: React.ReactNode; color: string }> = {
  approval_threshold: {
    label: 'Approval Threshold',
    icon:  <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  },
  auto_routing: {
    label: 'Auto Routing',
    icon:  <Route className="h-3.5 w-3.5" />,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  escalation_rule: {
    label: 'Escalation Rule',
    icon:  <AlertTriangle className="h-3.5 w-3.5" />,
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  },
  playbook: {
    label: 'Playbook',
    icon:  <Zap className="h-3.5 w-3.5" />,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  },
};

function TypeBadge({ type }: { type: PolicyType }) {
  const meta = TYPE_META[type] ?? { label: type, icon: null, color: 'bg-gray-100 text-gray-600' };
  return (
    <Badge className={cn('border-0 text-xs gap-1 flex items-center', meta.color)}>
      {meta.icon}{meta.label}
    </Badge>
  );
}

function ScopeBadge({ scopeType }: { scopeType: string }) {
  const color = scopeType === 'global'
    ? 'bg-gray-100 text-gray-600'
    : scopeType === 'franchise'
      ? 'bg-indigo-100 text-indigo-700'
      : 'bg-teal-100 text-teal-700';
  return <Badge className={cn('border-0 text-xs', color)}>{scopeType}</Badge>;
}

// ─── Policy Form Modal ────────────────────────────────────────────────────────

interface PolicyFormProps {
  policy?: Policy;
  open:    boolean;
  onClose: () => void;
  onSaved: () => void;
}

function PolicyForm({ policy, open, onClose, onSaved }: PolicyFormProps) {
  const { toast } = useToast();
  const isEdit = Boolean(policy);

  const [form, setForm] = useState({
    policy_type: policy?.policyType ?? 'approval_threshold',
    name:        policy?.name ?? '',
    description: policy?.description ?? '',
    case_types:  (policy?.caseTypes ?? []).join(', '),
    conditions:  JSON.stringify(policy?.conditions ?? {}, null, 2),
    actions:     JSON.stringify(policy?.actions ?? [], null, 2),
    priority:    String(policy?.priority ?? '100'),
    scope_type:  policy?.scopeType ?? 'global',
  });

  const [jsonError, setJsonError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      isEdit
        ? apiRequest('PUT',  `/api/governance/policies/${policy!.id}`, body)
        : apiRequest('POST', '/api/governance/policies', body),
    onSuccess: () => {
      toast({ title: isEdit ? 'Policy updated' : 'Policy created', description: form.name });
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    let conditions: Record<string, unknown>;
    let actions: unknown[];
    try {
      conditions = JSON.parse(form.conditions);
      actions    = JSON.parse(form.actions);
      if (!Array.isArray(actions)) throw new Error('actions must be an array');
      setJsonError(null);
    } catch (e: any) {
      setJsonError(`JSON error: ${e.message}`);
      return;
    }

    const caseTypes = form.case_types
      .split(',').map(s => s.trim()).filter(Boolean);

    saveMut.mutate({
      policy_type: form.policy_type,
      name:        form.name.trim(),
      description: form.description.trim() || null,
      case_types:  caseTypes,
      conditions,
      actions,
      priority:    Math.max(1, Math.min(999, parseInt(form.priority, 10) || 100)),
      scope_type:  form.scope_type,
    });
  };

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            {isEdit ? 'Edit Policy' : 'New Governance Policy'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Policy Type</Label>
              <Select value={form.policy_type} onValueChange={set('policy_type')}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approval_threshold">Approval Threshold</SelectItem>
                  <SelectItem value="auto_routing">Auto Routing</SelectItem>
                  <SelectItem value="escalation_rule">Escalation Rule</SelectItem>
                  <SelectItem value="playbook">Playbook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Priority (1 = highest)</Label>
              <Input
                className="h-9 text-sm"
                type="number" min={1} max={999}
                value={form.priority}
                onChange={e => set('priority')(e.target.value)}
              />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input
              className="h-9 text-sm"
              placeholder="e.g. Auto-approve low-risk disputes"
              value={form.name}
              onChange={e => set('name')(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description (optional)</Label>
            <Input
              className="h-9 text-sm"
              placeholder="What does this policy do and when does it fire?"
              value={form.description}
              onChange={e => set('description')(e.target.value)}
            />
          </div>

          {/* Case types + scope */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Case Types (comma-separated, blank = all)</Label>
              <Input
                className="h-9 text-sm"
                placeholder="dispute, refund, mismatch"
                value={form.case_types}
                onChange={e => set('case_types')(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Scope</Label>
              <Select value={form.scope_type} onValueChange={set('scope_type')}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="franchise">Franchise</SelectItem>
                  <SelectItem value="station">Station</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Conditions (JSON) —{' '}
              <span className="font-normal text-gray-500">
                keys: closure_codes[], sla_status, amount_gte, amount_lt, handler_role, reopen_count_gte
              </span>
            </Label>
            <Textarea
              className="font-mono text-xs min-h-[90px] resize-y"
              value={form.conditions}
              onChange={e => set('conditions')(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Actions (JSON array) —{' '}
              <span className="font-normal text-gray-500">
                types: auto_approve, require_approval(level), add_note, escalate(to_role), route_to_role, route_to_team(team_id)
              </span>
            </Label>
            <Textarea
              className="font-mono text-xs min-h-[120px] resize-y"
              value={form.actions}
              onChange={e => set('actions')(e.target.value)}
            />
          </div>

          {jsonError && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-md">
              {jsonError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saveMut.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMut.isPending || !form.name.trim()}>
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEdit ? 'Save Changes' : 'Create Policy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Test Evaluator ───────────────────────────────────────────────────────────

function EvaluatePanel() {
  const { toast } = useToast();
  const [ctx, setCtx] = useState(`{
  "caseType":    "dispute",
  "caseRefId":   "test-001",
  "closureCode": "goodwill_refund",
  "amountCents": 150000
}`);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    try {
      JSON.parse(ctx); // validate
    } catch {
      toast({ title: 'Invalid JSON', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const r = await apiRequest('POST', '/api/governance/evaluate', { context: JSON.parse(ctx) });
      setResult(r);
    } catch (err: any) {
      toast({ title: 'Evaluation failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Policy Evaluator
        </h3>
        <p className="text-xs text-gray-500">
          Test which policies would fire against a case context — no side-effects.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Case Context (JSON)</Label>
        <Textarea
          className="font-mono text-xs min-h-[140px] resize-y"
          value={ctx}
          onChange={e => setCtx(e.target.value)}
        />
      </div>

      <Button size="sm" onClick={run} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Evaluate
      </Button>

      {result && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2.5 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-4 text-xs">
              <span><strong>{result.matchedCount}</strong> policies matched</span>
              <span className={cn(result.autoApproved ? 'text-green-600 font-semibold' : 'text-gray-500')}>
                {result.autoApproved ? '✓ Auto-approve' : 'No auto-approve'}
              </span>
              {result.requireLevel > 0 && (
                <span className="text-amber-600 font-semibold">
                  Level-{result.requireLevel} approval required
                </span>
              )}
            </div>
            {result.message && <p className="text-xs text-gray-500 mt-0.5">{result.message}</p>}
          </div>
          {result.matched.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {result.matched.map((m, i) => (
                <div key={i} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={m.policyType as PolicyType} />
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-gray-400">#{m.policyId}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-gray-500">
                    {JSON.stringify(m.actions)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Execution Log ────────────────────────────────────────────────────────────

function ExecutionLog() {
  const q = useQuery<{ executions: Array<{
    id: number; policyName: string; policyType: string;
    caseType: string; caseRefId: string; triggerEvent: string;
    actionsTaken: string[]; executedAt: string;
  }> }>({
    queryKey: ['/api/governance/executions?limit=30'],
    staleTime: 60_000,
  });

  if (q.isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;

  const items = q.data?.executions ?? [];

  if (!items.length) return (
    <div className="text-center py-12 text-gray-400 text-sm">
      No policy executions yet. Policies fire automatically as cases move through the system.
    </div>
  );

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 dark:bg-gray-900">
            <TableHead className="text-xs">Policy</TableHead>
            <TableHead className="text-xs">Case</TableHead>
            <TableHead className="text-xs">Trigger</TableHead>
            <TableHead className="text-xs">Actions Taken</TableHead>
            <TableHead className="text-xs">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(e => (
            <TableRow key={e.id}>
              <TableCell className="py-2.5">
                <TypeBadge type={e.policyType as PolicyType} />
                <div className="text-xs text-gray-700 mt-0.5">{e.policyName}</div>
              </TableCell>
              <TableCell className="py-2.5 font-mono text-xs text-gray-500">
                {e.caseType}:{e.caseRefId.slice(0, 10)}
              </TableCell>
              <TableCell className="py-2.5 text-xs">
                <Badge className="border-0 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-xs">
                  {e.triggerEvent}
                </Badge>
              </TableCell>
              <TableCell className="py-2.5">
                <div className="flex flex-wrap gap-1">
                  {e.actionsTaken.map((a, i) => (
                    <Badge key={i} className="border-0 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="py-2.5 text-xs text-gray-500 whitespace-nowrap">
                {new Date(e.executedAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GovernancePolicies() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'policies' | 'evaluate' | 'log'>('policies');
  const [formOpen, setFormOpen]   = useState(false);
  const [editPolicy, setEditPolicy] = useState<Policy | undefined>();
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const policiesQ = useQuery<{ policies: Policy[]; total: number }>({
    queryKey: [`/api/governance/policies${showInactive ? '?active=false' : ''}`],
    staleTime: 30_000,
  });

  const deactivateMut = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/governance/policies/${id}`),
    onSuccess: () => {
      toast({ title: 'Policy deactivated' });
      qc.invalidateQueries({ queryKey: ['/api/governance/policies'] });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/governance/policies/${id}/activate`),
    onSuccess: () => {
      toast({ title: 'Policy activated' });
      qc.invalidateQueries({ queryKey: ['/api/governance/policies'] });
    },
  });

  const policies = policiesQ.data?.policies ?? [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
              Governance & Automation
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Rules stored as data · Enforced automatically · Audited on every execution
            </p>
          </div>
          {activeTab === 'policies' && (
            <Button size="sm" className="gap-1.5" onClick={() => { setEditPolicy(undefined); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />New Policy
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6 gap-1">
          {(['policies', 'evaluate', 'log'] as const).map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              )}
            >
              {tab === 'log' ? 'Execution Log' : tab === 'evaluate' ? 'Test Evaluator' : 'Policies'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">

          {/* ── Policies Tab ─────────────────────────────────────────── */}
          {activeTab === 'policies' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {policies.length} {showInactive ? 'total' : 'active'} policies
                  </span>
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setShowInactive(v => !v)}
                  >
                    {showInactive ? 'Show active only' : 'Show all including inactive'}
                  </button>
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="h-7 gap-1.5 text-xs text-gray-500"
                  onClick={() => qc.invalidateQueries({ queryKey: ['/api/governance/policies'] })}
                >
                  <RefreshCw className="h-3.5 w-3.5" />Refresh
                </Button>
              </div>

              {policiesQ.isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : policies.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">No policies yet.</div>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-900">
                        <TableHead className="text-xs w-6">Pri</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Case Types</TableHead>
                        <TableHead className="text-xs">Scope</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map(p => (
                        <TableRow
                          key={p.id}
                          className={!p.isActive ? 'opacity-50' : ''}
                        >
                          <TableCell className="py-2.5 text-xs font-mono text-gray-500 text-center">
                            {p.priority}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <TypeBadge type={p.policyType} />
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                            {p.description && (
                              <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{p.description}</div>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {p.caseTypes.length === 0 ? (
                              <span className="text-xs text-gray-400">all types</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {p.caseTypes.map(t => (
                                  <Badge key={t} className="border-0 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-xs">{t}</Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <ScopeBadge scopeType={p.scopeType} />
                          </TableCell>
                          <TableCell className="py-2.5">
                            {p.isActive
                              ? <Badge className="border-0 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 text-xs">Active</Badge>
                              : <Badge className="border-0 bg-gray-100 text-gray-500 text-xs">Inactive</Badge>}
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 w-7 p-0 text-gray-400 hover:text-gray-900"
                                onClick={() => { setEditPolicy(p); setFormOpen(true); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {p.isActive ? (
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                  onClick={() => setDeleteId(p.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-7 text-xs px-2 text-green-600 hover:bg-green-50"
                                  disabled={activateMut.isPending}
                                  onClick={() => activateMut.mutate(p.id)}
                                >
                                  Activate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* ── Evaluate Tab ─────────────────────────────────────────── */}
          {activeTab === 'evaluate' && <EvaluatePanel />}

          {/* ── Execution Log Tab ─────────────────────────────────────── */}
          {activeTab === 'log' && <ExecutionLog />}

        </div>
      </div>

      {/* Policy Form Modal */}
      {formOpen && (
        <PolicyForm
          policy={editPolicy}
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditPolicy(undefined); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['/api/governance/policies'] })}
        />
      )}

      {/* Deactivate confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this policy?</AlertDialogTitle>
            <AlertDialogDescription>
              The policy will stop firing immediately. It can be reactivated at any time.
              No rules or execution history will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId !== null && deactivateMut.mutate(deleteId)}
            >
              {deactivateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
