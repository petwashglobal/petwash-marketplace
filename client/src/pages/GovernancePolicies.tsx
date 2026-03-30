/**
 * GovernancePolicies.tsx
 * Phase 12.13 — Governance & Automation Layer
 * Phase 12.14 — Trust, Explainability & Safety
 *
 * Route: /governance
 * Auth: franchise_owner / admin
 *
 * Tabs:
 *   Policies     — list, create, edit, deactivate/activate
 *   Simulate     — dry-run with per-condition breakdown (Phase 12.14)
 *   Trace        — full decision chain per case (Phase 12.14)
 *   Versions     — policy version history + rollback (Phase 12.14)
 *   Execution Log— all recent executions with why_matched
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
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ShieldCheck, Plus, Pencil, Trash2, Loader2, Play, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle, Zap, Route, ChevronDown,
  ChevronRight, History, GitBranch, Search, RotateCcw, Info,
  ArrowRight, Clock, TrendingDown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type PolicyType = 'approval_threshold' | 'auto_routing' | 'escalation_rule' | 'playbook';
type TabId = 'policies' | 'simulate' | 'trace' | 'versions' | 'log';

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

interface ConditionResult {
  key:      string;
  expected: unknown;
  actual:   unknown;
  passed:   boolean;
  note?:    string;
}

interface SimPolicy {
  policyId:   number;
  policyType: string;
  name:       string;
  priority:   number;
  wouldMatch: boolean;
  conditions: ConditionResult[];
  actions:    Array<Record<string, unknown>>;
  verdict:    string;
}

interface SimResult {
  context: Record<string, unknown>;
  summary: {
    totalEvaluated: number;
    matched:        number;
    notMatched:     number;
    outcome:        string;
  };
  matchedPolicies:   SimPolicy[];
  unmatchedPolicies: SimPolicy[];
}

interface TraceStep {
  step:         number;
  executionId:  number;
  policyId:     number;
  policyName:   string;
  policyType:   string;
  priority:     number;
  triggerEvent: string;
  actionsTaken: string[];
  whyMatched:   ConditionResult[];
  executedAt:   string;
}

interface PolicyVersion {
  versionId:     number;
  versionNumber: number;
  changeType:    string;
  changeNote:    string | null;
  changedBy:     string;
  changedAt:     string;
  snapshot:      Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  approval_threshold: { label: 'Approval', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  auto_routing:       { label: 'Routing',  icon: <Route className="h-3.5 w-3.5" />,       color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  escalation_rule:    { label: 'Escalation', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  playbook:           { label: 'Playbook', icon: <Zap className="h-3.5 w-3.5" />,         color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
};

const OUTCOME_META: Record<string, { label: string; color: string }> = {
  auto_approve:       { label: 'AUTO-APPROVED',      color: 'bg-green-100 text-green-700 border-green-200' },
  level_2_required:   { label: 'LEVEL-2 REQUIRED',   color: 'bg-red-100 text-red-700 border-red-200' },
  level_1_required:   { label: 'MANAGER REVIEW',     color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  actions_queued:     { label: 'ACTIONS QUEUED',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
  no_match:           { label: 'NO POLICIES MATCHED', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const CHANGE_TYPE_META: Record<string, { label: string; color: string }> = {
  created:      { label: 'Created',      color: 'bg-green-100 text-green-700' },
  updated:      { label: 'Updated',      color: 'bg-blue-100 text-blue-700' },
  deactivated:  { label: 'Deactivated',  color: 'bg-red-100 text-red-700' },
  activated:    { label: 'Activated',    color: 'bg-green-100 text-green-700' },
  rolled_back:  { label: 'Rolled Back',  color: 'bg-purple-100 text-purple-700' },
};

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { label: type, icon: null, color: 'bg-gray-100 text-gray-600' };
  return (
    <Badge className={cn('border-0 text-xs gap-1 flex items-center w-fit', meta.color)}>
      {meta.icon}{meta.label}
    </Badge>
  );
}

function ConditionRow({ c }: { c: ConditionResult }) {
  return (
    <div className={cn(
      'flex items-start gap-2 px-3 py-1.5 rounded-md text-xs',
      c.passed ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20',
    )}>
      {c.passed
        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
        : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{c.key}</span>
        {c.note && <span className="ml-2 text-gray-500">{c.note}</span>}
      </div>
    </div>
  );
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

  const [jsonError, setJsonError]   = useState<string | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; errors: any[]; warnings: any[] } | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const validateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest('POST', '/api/governance/validate', body),
    onSuccess: (data: any) => setValidation(data),
    onError: () => setValidation(null),
  });

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
    onError: (err: any) => toast({ title: 'Save failed', description: err.message, variant: 'destructive' }),
  });

  const buildBody = () => {
    let conditions: Record<string, unknown>;
    let actions: unknown[];
    try {
      conditions = JSON.parse(form.conditions);
      actions    = JSON.parse(form.actions);
      if (!Array.isArray(actions)) throw new Error('actions must be an array');
      setJsonError(null);
      return {
        policy_type: form.policy_type,
        name:        form.name.trim(),
        description: form.description.trim() || null,
        case_types:  form.case_types.split(',').map(s => s.trim()).filter(Boolean),
        conditions, actions,
        priority:    Math.max(1, Math.min(999, parseInt(form.priority, 10) || 100)),
        scope_type:  form.scope_type,
      };
    } catch (e: any) {
      setJsonError(`JSON error: ${e.message}`);
      return null;
    }
  };

  const handleValidate = () => {
    const body = buildBody();
    if (body) validateMut.mutate(body);
  };

  const handleSave = () => {
    const body = buildBody();
    if (body) saveMut.mutate(body);
  };

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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Policy Type</Label>
              <Select value={form.policy_type} onValueChange={set('policy_type')}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
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
              <Input className="h-9 text-sm" type="number" min={1} max={999}
                value={form.priority} onChange={e => set('priority')(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input className="h-9 text-sm" placeholder="e.g. Auto-approve low-risk disputes"
              value={form.name} onChange={e => set('name')(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description (optional)</Label>
            <Input className="h-9 text-sm" value={form.description}
              onChange={e => set('description')(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Case Types (comma-sep, blank = all)</Label>
              <Input className="h-9 text-sm" placeholder="dispute, refund, mismatch"
                value={form.case_types} onChange={e => set('case_types')(e.target.value)} />
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

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Conditions (JSON)</Label>
            <Textarea className="font-mono text-xs min-h-[90px] resize-y"
              value={form.conditions} onChange={e => set('conditions')(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Actions (JSON array)</Label>
            <Textarea className="font-mono text-xs min-h-[120px] resize-y"
              value={form.actions} onChange={e => set('actions')(e.target.value)} />
          </div>

          {jsonError && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-md">{jsonError}</div>
          )}

          {/* Validation results */}
          {validation && (
            <div className={cn(
              'rounded-lg border px-3 py-2.5 space-y-1.5',
              validation.valid ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'
            )}>
              <div className="flex items-center gap-2 text-xs font-semibold">
                {validation.valid
                  ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" />Policy is valid</>
                  : <><XCircle className="h-3.5 w-3.5 text-red-600" />{validation.errors.length} error(s)</>}
              </div>
              {validation.errors.map((e: any, i: number) => (
                <div key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                  <XCircle className="h-3 w-3 mt-0.5 shrink-0" />{e.message}
                </div>
              ))}
              {validation.warnings.map((w: any, i: number) => (
                <div key={i} className="text-xs text-yellow-700 flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{w.message}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleValidate} disabled={validateMut.isPending || saveMut.isPending} className="gap-1.5">
            {validateMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Validate
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saveMut.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveMut.isPending || !form.name.trim()}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Save Changes' : 'Create Policy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Simulate Tab ─────────────────────────────────────────────────────────────

function SimulateTab() {
  const { toast } = useToast();
  const [ctx, setCtx] = useState(`{
  "caseType":    "dispute",
  "caseRefId":   "test-001",
  "closureCode": "goodwill_refund",
  "amountCents": 150000
}`);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const run = async () => {
    let parsed: unknown;
    try { parsed = JSON.parse(ctx); }
    catch { toast({ title: 'Invalid JSON', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const r = await apiRequest('POST', '/api/governance/simulate', { context: parsed });
      setResult(r);
    } catch (err: any) {
      toast({ title: 'Simulation failed', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const outcomeInfo = result ? (OUTCOME_META[result.summary.outcome] ?? { label: result.summary.outcome, color: 'bg-gray-100 text-gray-600 border-gray-200' }) : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Policy Simulation</h3>
        <p className="text-xs text-gray-500">
          See exactly which policies would fire — and WHY each condition passed or failed. No side-effects, no writes.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Case Context (JSON)</Label>
        <Textarea className="font-mono text-xs min-h-[150px] resize-y"
          value={ctx} onChange={e => setCtx(e.target.value)} />
      </div>

      <Button size="sm" onClick={run} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Run Simulation
      </Button>

      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={cn('rounded-lg border px-4 py-3 flex items-center gap-4', outcomeInfo?.color)}>
            <div>
              <div className="text-sm font-bold">{outcomeInfo?.label}</div>
              <div className="text-xs mt-0.5 opacity-80">
                {result.summary.matched} of {result.summary.totalEvaluated} policies matched
              </div>
            </div>
          </div>

          {/* Matched policies */}
          {result.matchedPolicies.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />Matched Policies ({result.matchedPolicies.length})
              </div>
              <div className="space-y-2">
                {result.matchedPolicies.map(p => (
                  <Collapsible key={p.policyId} open={expanded.has(p.policyId)} onOpenChange={() => toggleExpand(p.policyId)}>
                    <div className="rounded-lg border border-green-200 dark:border-green-900 overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors">
                          <div className="flex items-center gap-2">
                            <TypeBadge type={p.policyType} />
                            <span className="text-sm font-medium">{p.name}</span>
                            <span className="text-xs text-gray-400">p{p.priority}</span>
                          </div>
                          {expanded.has(p.policyId) ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-3 pt-1 space-y-1.5">
                          <div className="text-xs font-medium text-gray-500 mb-1">Conditions</div>
                          {p.conditions.length === 0
                            ? <div className="text-xs text-gray-400 italic">No conditions — matches all cases</div>
                            : p.conditions.map((c, i) => <ConditionRow key={i} c={c} />)}
                          <div className="text-xs font-medium text-gray-500 mt-2 mb-1">Actions</div>
                          <div className="flex flex-wrap gap-1">
                            {p.actions.map((a: any, i: number) => (
                              <Badge key={i} className="border-0 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs">
                                {a.type}{a.level ? `:L${a.level}` : ''}{a.role ? `:${a.role}` : ''}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched policies */}
          {result.unmatchedPolicies.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" />Policies that did not match ({result.unmatchedPolicies.length})
              </div>
              <div className="space-y-2">
                {result.unmatchedPolicies.map(p => (
                  <Collapsible key={p.policyId} open={expanded.has(p.policyId + 10000)} onOpenChange={() => toggleExpand(p.policyId + 10000)}>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden opacity-70 hover:opacity-100 transition-opacity">
                      <CollapsibleTrigger asChild>
                        <button className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <div className="flex items-center gap-2">
                            <TypeBadge type={p.policyType} />
                            <span className="text-sm">{p.name}</span>
                            <span className="text-xs text-gray-400">p{p.priority}</span>
                          </div>
                          {expanded.has(p.policyId + 10000) ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-3 pt-1 space-y-1.5">
                          {p.conditions.length === 0
                            ? <div className="text-xs text-gray-400 italic">No conditions (no conditions to fail)</div>
                            : p.conditions.map((c, i) => <ConditionRow key={i} c={c} />)}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Trace Tab ────────────────────────────────────────────────────────────────

function TraceTab() {
  const { toast } = useToast();
  const [caseType, setCaseType]   = useState('dispute');
  const [caseRefId, setCaseRefId] = useState('');
  const [trace, setTrace]         = useState<{ caseType: string; caseRefId: string; totalSteps: number; trace: TraceStep[] } | null>(null);
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const search = async () => {
    if (!caseRefId.trim()) { toast({ title: 'Case ID is required', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const r = await apiRequest('GET', `/api/governance/trace/${encodeURIComponent(caseType)}/${encodeURIComponent(caseRefId.trim())}`);
      setTrace(r);
    } catch (err: any) {
      toast({ title: 'Trace failed', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Decision Trace</h3>
        <p className="text-xs text-gray-500">Full policy decision chain for any case — from trigger to actions taken, with per-condition breakdown.</p>
      </div>

      <div className="flex gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Case Type</Label>
          <Select value={caseType} onValueChange={setCaseType}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dispute">Dispute</SelectItem>
              <SelectItem value="mismatch">Mismatch</SelectItem>
              <SelectItem value="refund">Refund</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs font-medium">Case ID</Label>
          <Input className="h-9 text-sm font-mono" placeholder="e.g. abc-123..."
            value={caseRefId} onChange={e => setCaseRefId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()} />
        </div>
        <Button size="sm" onClick={search} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Trace
        </Button>
      </div>

      {trace && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500 font-mono">{trace.caseType}:{trace.caseRefId}</div>
            <Badge className="border-0 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-xs">
              {trace.totalSteps} decision{trace.totalSteps !== 1 ? 's' : ''}
            </Badge>
          </div>

          {trace.totalSteps === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              No governance policies have fired for this case yet.
            </div>
          )}

          {/* Timeline */}
          <div className="relative">
            {trace.trace.length > 1 && (
              <div className="absolute left-[19px] top-7 bottom-7 w-0.5 bg-gray-200 dark:bg-gray-700" />
            )}
            <div className="space-y-3">
              {trace.trace.map((step) => (
                <Collapsible key={step.executionId} open={expanded.has(step.executionId)} onOpenChange={() => toggleExpand(step.executionId)}>
                  <div className="flex gap-3">
                    {/* Step number */}
                    <div className="h-10 w-10 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 z-10">
                      {step.step}
                    </div>

                    <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <TypeBadge type={step.policyType} />
                              <span className="text-sm font-medium truncate">{step.policyName}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" />{step.triggerEvent}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />{new Date(step.executedAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {expanded.has(step.executionId) ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 pb-3 pt-1 space-y-3 border-t border-gray-100 dark:border-gray-800">
                          {/* Actions taken */}
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Actions taken</div>
                            <div className="flex flex-wrap gap-1">
                              {step.actionsTaken.map((a, i) => (
                                <Badge key={i} className="border-0 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs">{a}</Badge>
                              ))}
                            </div>
                          </div>
                          {/* Why matched */}
                          {step.whyMatched.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-gray-500 mb-1">Why this policy matched</div>
                              <div className="space-y-1">
                                {step.whyMatched.map((c, i) => <ConditionRow key={i} c={c} />)}
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </div>
                </Collapsible>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Versions Tab ─────────────────────────────────────────────────────────────

function VersionsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedPolicy, setSelectedPolicy] = useState<string>('');
  const [rollbackId, setRollbackId]         = useState<{ versionId: number; versionNumber: number } | null>(null);

  const policiesQ = useQuery<{ policies: Policy[] }>({
    queryKey: ['/api/governance/policies?active=false'],
    staleTime: 60_000,
  });

  const versionsQ = useQuery<{ policyId: number; versions: PolicyVersion[] }>({
    queryKey: [`/api/governance/policies/${selectedPolicy}/versions`],
    enabled:  Boolean(selectedPolicy),
    staleTime: 30_000,
  });

  const rollbackMut = useMutation({
    mutationFn: ({ versionId }: { versionId: number }) =>
      apiRequest('POST', `/api/governance/policies/${selectedPolicy}/rollback/${versionId}`),
    onSuccess: (data: any) => {
      toast({ title: 'Rolled back', description: data.message });
      qc.invalidateQueries({ queryKey: ['/api/governance/policies'] });
      versionsQ.refetch();
      setRollbackId(null);
    },
    onError: (err: any) => toast({ title: 'Rollback failed', description: err.message, variant: 'destructive' }),
  });

  const allPolicies = policiesQ.data?.policies ?? [];
  const versions    = versionsQ.data?.versions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Policy Version History</h3>
        <p className="text-xs text-gray-500">Every policy change is snapshotted. Select a policy to view its full history and roll back to any previous version.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Select Policy</Label>
        <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose a policy..." /></SelectTrigger>
          <SelectContent>
            {allPolicies.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>
                <span className="flex items-center gap-2">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded', !p.isActive ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700')}>
                    {p.isActive ? 'active' : 'inactive'}
                  </span>
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPolicy && (
        <div>
          {versionsQ.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : versions.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No version history for this policy.</div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-900">
                    <TableHead className="text-xs">Version</TableHead>
                    <TableHead className="text-xs">Change</TableHead>
                    <TableHead className="text-xs">Changed By</TableHead>
                    <TableHead className="text-xs">When</TableHead>
                    <TableHead className="text-xs">Note</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v, idx) => {
                    const meta = CHANGE_TYPE_META[v.changeType] ?? { label: v.changeType, color: 'bg-gray-100 text-gray-600' };
                    const isCurrent = idx === 0;
                    return (
                      <TableRow key={v.versionId} className={isCurrent ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}>
                        <TableCell className="py-2.5 font-mono text-sm font-semibold">
                          v{v.versionNumber}
                          {isCurrent && <Badge className="border-0 ml-1.5 text-xs bg-blue-100 text-blue-700">current</Badge>}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge className={cn('border-0 text-xs', meta.color)}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs font-mono text-gray-500">{v.changedBy}</TableCell>
                        <TableCell className="py-2.5 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(v.changedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-gray-400">{v.changeNote ?? '—'}</TableCell>
                        <TableCell className="py-2.5 text-right">
                          {!isCurrent && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 gap-1 text-xs text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                              onClick={() => setRollbackId({ versionId: v.versionId, versionNumber: v.versionNumber })}
                            >
                              <RotateCcw className="h-3 w-3" />Rollback
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Rollback confirmation */}
      <AlertDialog open={rollbackId !== null} onOpenChange={open => !open && setRollbackId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback to v{rollbackId?.versionNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              The policy will be immediately restored to this version's conditions and actions.
              A new version snapshot will be created. The current state is preserved in version history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => rollbackId && rollbackMut.mutate({ versionId: rollbackId.versionId })}
            >
              {rollbackMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rollback'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Execution Log Tab ────────────────────────────────────────────────────────

function ExecutionLog() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const q = useQuery<{ executions: Array<{
    id: number; policyName: string; policyType: string;
    caseType: string; caseRefId: string; triggerEvent: string;
    actionsTaken: string[]; whyMatched: ConditionResult[] | null; executedAt: string;
  }> }>({
    queryKey: ['/api/governance/executions?limit=50'],
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
            <TableHead className="text-xs w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(e => (
            <>
              <TableRow key={e.id} className={expandedId === e.id ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}>
                <TableCell className="py-2.5">
                  <TypeBadge type={e.policyType} />
                  <div className="text-xs text-gray-700 mt-0.5">{e.policyName}</div>
                </TableCell>
                <TableCell className="py-2.5 font-mono text-xs text-gray-500">{e.caseType}:{e.caseRefId.slice(0, 10)}…</TableCell>
                <TableCell className="py-2.5 text-xs">
                  <Badge className="border-0 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-xs">{e.triggerEvent}</Badge>
                </TableCell>
                <TableCell className="py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {e.actionsTaken.map((a, i) => (
                      <Badge key={i} className="border-0 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs">{a}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="py-2.5 text-xs text-gray-500 whitespace-nowrap">{new Date(e.executedAt).toLocaleString()}</TableCell>
                <TableCell className="py-2.5">
                  {e.whyMatched && e.whyMatched.length > 0 && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                      {expandedId === e.id ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              {expandedId === e.id && e.whyMatched && (
                <TableRow key={`${e.id}-why`}>
                  <TableCell colSpan={6} className="py-2 px-4 bg-blue-50/30 dark:bg-blue-950/10">
                    <div className="text-xs font-medium text-gray-500 mb-1.5">Why this policy matched</div>
                    <div className="space-y-1">
                      {e.whyMatched.map((c, i) => <ConditionRow key={i} c={c} />)}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Policies Tab ─────────────────────────────────────────────────────────────

function PoliciesTab({ onEdit, onCreate }: { onEdit: (p: Policy) => void; onCreate: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const policiesQ = useQuery<{ policies: Policy[] }>({
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{policies.length} {showInactive ? 'total' : 'active'} policies</span>
          <button className="text-xs text-blue-600 hover:underline" onClick={() => setShowInactive(v => !v)}>
            {showInactive ? 'Show active only' : 'Show all including inactive'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-gray-500"
            onClick={() => qc.invalidateQueries({ queryKey: ['/api/governance/policies'] })}>
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={onCreate}>
            <Plus className="h-4 w-4" />New Policy
          </Button>
        </div>
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
                <TableHead className="text-xs w-8">Pri</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Case Types</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map(p => (
                <TableRow key={p.id} className={!p.isActive ? 'opacity-50' : ''}>
                  <TableCell className="py-2.5 text-xs font-mono text-gray-500 text-center">{p.priority}</TableCell>
                  <TableCell className="py-2.5"><TypeBadge type={p.policyType} /></TableCell>
                  <TableCell className="py-2.5">
                    <div className="text-sm font-medium">{p.name}</div>
                    {p.description && <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{p.description}</div>}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {p.caseTypes.length === 0
                      ? <span className="text-xs text-gray-400">all types</span>
                      : <div className="flex flex-wrap gap-1">
                          {p.caseTypes.map(t => <Badge key={t} className="border-0 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-xs">{t}</Badge>)}
                        </div>}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {p.isActive
                      ? <Badge className="border-0 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 text-xs">Active</Badge>
                      : <Badge className="border-0 bg-gray-100 text-gray-500 text-xs">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-900"
                        onClick={() => onEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {p.isActive
                        ? <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                            onClick={() => setDeleteId(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        : <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-green-600 hover:bg-green-50"
                            disabled={activateMut.isPending} onClick={() => activateMut.mutate(p.id)}>
                            Activate
                          </Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this policy?</AlertDialogTitle>
            <AlertDialogDescription>
              The policy will stop firing immediately. It can be reactivated at any time. No rules or execution history will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId !== null && deactivateMut.mutate(deleteId)}>
              {deactivateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'policies', label: 'Policies',      icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { id: 'simulate', label: 'Simulate',      icon: <Play className="h-3.5 w-3.5" /> },
  { id: 'trace',    label: 'Trace',         icon: <GitBranch className="h-3.5 w-3.5" /> },
  { id: 'versions', label: 'Versions',      icon: <History className="h-3.5 w-3.5" /> },
  { id: 'log',      label: 'Execution Log', icon: <TrendingDown className="h-3.5 w-3.5" /> },
];

export default function GovernancePolicies() {
  const [activeTab, setActiveTab] = useState<TabId>('policies');
  const [formOpen, setFormOpen]   = useState(false);
  const [editPolicy, setEditPolicy] = useState<Policy | undefined>();
  const qc = useQueryClient();

  const handleEdit   = (p: Policy) => { setEditPolicy(p); setFormOpen(true); };
  const handleCreate = ()           => { setEditPolicy(undefined); setFormOpen(true); };
  const handleSaved  = ()           => qc.invalidateQueries({ queryKey: ['/api/governance/policies'] });

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
              Rules stored as data · Decisions traced & explainable · Changes versioned
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6 gap-0.5">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              )}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          {activeTab === 'policies' && <PoliciesTab onEdit={handleEdit} onCreate={handleCreate} />}
          {activeTab === 'simulate' && <SimulateTab />}
          {activeTab === 'trace'    && <TraceTab />}
          {activeTab === 'versions' && <VersionsTab />}
          {activeTab === 'log'      && <ExecutionLog />}
        </div>
      </div>

      {/* Policy Form Modal */}
      {formOpen && (
        <PolicyForm
          policy={editPolicy}
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditPolicy(undefined); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
