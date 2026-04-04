import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck, Layers, AlertTriangle, CheckCircle2, Clock,
  RotateCcw, PlayCircle, PlusCircle, Activity, ArrowRight,
  TrendingUp, TrendingDown, Minus, Info, XCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PolicyKeyMeta {
  label: string;
  description: string;
  defaultConfig: Record<string, unknown>;
}

interface PolicyConfig {
  id: number;
  policy_key: string;
  version: number;
  config: Record<string, unknown>;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  activated_at: string | null;
  created_by: string | null;
}

interface Rollout {
  id: number;
  policy_key: string;
  version: number;
  scope_type: 'global' | 'franchise' | 'station' | 'ownership';
  scope_key: string | null;
  rollout_status: 'planned' | 'active' | 'paused' | 'rolled_back' | 'completed';
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  created_by: string | null;
}

interface RolloutEvaluation {
  successRate: number | null;
  avgMarginDelta: number | null;
  avgFrictionDelta: number | null;
  sampleSize: number;
  resolvedCount: number;
  hasBaseline: boolean;
  note: string;
}

// ---------------------------------------------------------------------------
// Badges & helpers
// ---------------------------------------------------------------------------

const STATUS_CFG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft:       { color: 'text-gray-700 bg-white border-gray-300',       icon: <Clock className="w-3 h-3" />,        label: 'Draft' },
  active:      { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Active' },
  archived:    { color: 'text-gray-500 bg-white border-gray-200',         icon: <Layers className="w-3 h-3" />,       label: 'Archived' },
  planned:     { color: 'text-blue-700 bg-blue-50 border-blue-200',         icon: <Clock className="w-3 h-3" />,        label: 'Planned' },
  paused:      { color: 'text-amber-700 bg-amber-50 border-amber-200',      icon: <Minus className="w-3 h-3" />,        label: 'Paused' },
  rolled_back: { color: 'text-red-700 bg-red-50 border-red-200',            icon: <RotateCcw className="w-3 h-3" />,    label: 'Rolled back' },
  completed:   { color: 'text-indigo-700 bg-indigo-50 border-indigo-200',   icon: <CheckCircle2 className="w-3 h-3" />, label: 'Completed' },
};

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global (all entities)',
  franchise: 'Franchise networks',
  station: 'Specific station',
  ownership: 'By ownership type',
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function DeltaValue({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const improved = invert ? value < 0 : value > 0;
  return (
    <span className={`text-sm font-mono flex items-center gap-1 ${improved ? 'text-emerald-700' : value === 0 ? 'text-muted-foreground' : 'text-red-700'}`}>
      {improved ? <TrendingUp className="w-3 h-3" /> : value === 0 ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Create Policy Config Dialog
// ---------------------------------------------------------------------------

function CreateConfigDialog({
  open, onClose, policyKeys,
}: { open: boolean; onClose: () => void; policyKeys: Record<string, PolicyKeyMeta> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [policyKey, setPolicyKey] = useState('');
  const [configText, setConfigText] = useState('');
  const [customKey, setCustomKey] = useState('');

  const mutation = useMutation({
    mutationFn: (body: object) => apiRequest('POST', '/api/expansion/policy-rollout/configs', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expansion/policy-rollout/configs'] });
      toast({ title: 'Draft created', description: 'Policy config saved as draft. Activate it when ready.' });
      onClose();
      setPolicyKey(''); setConfigText(''); setCustomKey('');
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const selectedMeta = policyKeys[policyKey];

  const handleKeyChange = (k: string) => {
    setPolicyKey(k);
    if (policyKeys[k]) setConfigText(JSON.stringify(policyKeys[k].defaultConfig, null, 2));
  };

  const handleSubmit = () => {
    let config: object;
    try { config = JSON.parse(configText); }
    catch { toast({ title: 'Invalid JSON', description: 'Config must be valid JSON', variant: 'destructive' }); return; }
    const key = policyKey === '__custom__' ? customKey : policyKey;
    if (!key) { toast({ title: 'Missing key', variant: 'destructive' }); return; }
    mutation.mutate({ policyKey: key, config });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Policy Draft</DialogTitle>
          <DialogDescription>
            A new draft version will be created. It must be activated before it can be rolled out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Policy key</Label>
            <Select value={policyKey} onValueChange={handleKeyChange}>
              <SelectTrigger><SelectValue placeholder="Select a policy..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(policyKeys).map(([k, meta]) => (
                  <SelectItem key={k} value={k}>{meta.label}</SelectItem>
                ))}
                <SelectItem value="__custom__">Custom key...</SelectItem>
              </SelectContent>
            </Select>
            {policyKey === '__custom__' && (
              <Input className="mt-2" placeholder="custom_policy_key" value={customKey} onChange={e => setCustomKey(e.target.value)} />
            )}
            {selectedMeta && <p className="text-xs text-muted-foreground mt-1">{selectedMeta.description}</p>}
          </div>
          <div>
            <Label>Config (JSON)</Label>
            <Textarea
              className="font-mono text-xs h-40"
              placeholder='{"key": "value"}'
              value={configText}
              onChange={e => setConfigText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This config will be versioned. You cannot edit it after creation — create a new draft to change it.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save as draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Create Rollout Dialog
// ---------------------------------------------------------------------------

function CreateRolloutDialog({
  open, onClose, activeConfigs,
}: { open: boolean; onClose: () => void; activeConfigs: PolicyConfig[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [policyKey, setPolicyKey] = useState('');
  const [version, setVersion] = useState('');
  const [scopeType, setScopeType] = useState('');
  const [scopeKey, setScopeKey] = useState('');

  const mutation = useMutation({
    mutationFn: (body: object) => apiRequest('POST', '/api/expansion/policy-rollout/rollouts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expansion/policy-rollout/rollouts'] });
      toast({ title: 'Rollout created', description: 'Rollout is now active for the selected scope.' });
      onClose();
      setPolicyKey(''); setVersion(''); setScopeType(''); setScopeKey('');
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const matchingVersions = activeConfigs.filter(c => c.policy_key === policyKey && c.status === 'active');

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Rollout</DialogTitle>
          <DialogDescription>
            Scope a policy change to a subset of operations. Only active policy configs can be rolled out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Policy key</Label>
            <Select value={policyKey} onValueChange={k => { setPolicyKey(k); setVersion(''); }}>
              <SelectTrigger><SelectValue placeholder="Select policy..." /></SelectTrigger>
              <SelectContent>
                {[...new Set(activeConfigs.filter(c => c.status === 'active').map(c => c.policy_key))].map(k => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Version (must be active)</Label>
            <Select value={version} onValueChange={setVersion}>
              <SelectTrigger><SelectValue placeholder="Select version..." /></SelectTrigger>
              <SelectContent>
                {matchingVersions.map(c => (
                  <SelectItem key={c.version} value={String(c.version)}>v{c.version}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {policyKey && matchingVersions.length === 0 && (
              <p className="text-xs text-red-600 mt-1">No active version found. Activate a draft first.</p>
            )}
          </div>
          <div>
            <Label>Rollout scope</Label>
            <Select value={scopeType} onValueChange={setScopeType}>
              <SelectTrigger><SelectValue placeholder="Select scope..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(SCOPE_LABELS).map(([k, lbl]) => <SelectItem key={k} value={k}>{lbl}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(scopeType === 'station' || scopeType === 'ownership') && (
            <div>
              <Label>{scopeType === 'station' ? 'Station ID' : 'Ownership type (company_owned / franchise_owned)'}</Label>
              <Input value={scopeKey} onChange={e => setScopeKey(e.target.value)} placeholder={scopeType === 'station' ? 'e.g. 1' : 'company_owned'} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate({ policyKey, version: parseInt(version), scopeType, scopeKey: scopeKey || undefined })}
            disabled={mutation.isPending || !policyKey || !version || !scopeType}>
            {mutation.isPending ? 'Creating...' : 'Start rollout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Rollout evaluation panel
// ---------------------------------------------------------------------------

function EvaluationPanel({ rolloutId }: { rolloutId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ rollout: Rollout; evaluation: RolloutEvaluation }>({
    queryKey: ['/api/expansion/policy-rollout/rollouts', rolloutId, 'evaluate'],
    enabled: false,
  });

  const evalMutation = useMutation({
    mutationFn: () => fetch(`/api/expansion/policy-rollout/rollouts/${rolloutId}/evaluate`, {
      headers: { 'x-admin-secret': '' },
    }).then(r => r.json()),
    onSuccess: (d) => {
      queryClient.setQueryData(['/api/expansion/policy-rollout/rollouts', rolloutId, 'evaluate'], d);
    },
    onError: () => toast({ title: 'Evaluation failed', variant: 'destructive' }),
  });

  const ev = data?.evaluation;

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <Button size="sm" variant="outline" onClick={() => evalMutation.mutate()} disabled={evalMutation.isPending}>
        <Activity className="w-3 h-3 mr-1" />
        {evalMutation.isPending ? 'Evaluating...' : ev ? 'Re-evaluate' : 'Evaluate outcome'}
      </Button>
      {ev && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          <div className="bg-white border rounded p-2">
            <div className="text-xs text-muted-foreground">Sample</div>
            <div className="font-bold">{ev.sampleSize} cases</div>
          </div>
          <div className="bg-white border rounded p-2">
            <div className="text-xs text-muted-foreground">Resolved</div>
            <div className="font-bold">{ev.resolvedCount}</div>
          </div>
          <div className="bg-white border rounded p-2">
            <div className="text-xs text-muted-foreground">Success rate</div>
            <div className="font-bold">{ev.successRate !== null ? `${ev.successRate}%` : '—'}</div>
          </div>
          <div className="bg-white border rounded p-2">
            <div className="text-xs text-muted-foreground">Avg margin Δ</div>
            <DeltaValue value={ev.avgMarginDelta} />
          </div>
          <div className="col-span-2 sm:col-span-4 text-xs text-muted-foreground italic bg-white border rounded p-2">
            {ev.note}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Policy configs section
// ---------------------------------------------------------------------------

function PolicyConfigsSection({ policyKeys }: { policyKeys: Record<string, PolicyKeyMeta> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery<{ configs: PolicyConfig[] }>({
    queryKey: ['/api/expansion/policy-rollout/configs'],
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/expansion/policy-rollout/configs/${id}/activate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expansion/policy-rollout/configs'] });
      toast({ title: 'Policy activated', description: 'Previous active version archived.' });
    },
    onError: (err: any) => toast({ title: 'Activation failed', description: err.message, variant: 'destructive' }),
  });

  const configs = data?.configs ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" /> Policy Versions
            </CardTitle>
            <CardDescription>
              Each change creates a new draft. Drafts must be activated before rollout. Activation archives the previous active version.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> New draft
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-white rounded animate-pulse" />)}</div>
        ) : configs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No policy configs yet. Create a draft to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy key</TableHead>
                  <TableHead className="text-right">Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Config</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Activated</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{policyKeys[c.policy_key]?.label ?? c.policy_key}</div>
                      <div className="text-xs text-muted-foreground font-mono">{c.policy_key}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">v{c.version}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell>
                      <code className="text-xs bg-white border rounded px-1.5 py-0.5 max-w-[180px] block truncate">
                        {JSON.stringify(c.config)}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs">{c.created_by ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {c.activated_at ? new Date(c.activated_at).toLocaleDateString('he-IL') : '—'}
                    </TableCell>
                    <TableCell>
                      {c.status === 'draft' && (
                        <Button size="sm" variant="outline"
                          onClick={() => activateMutation.mutate(c.id)}
                          disabled={activateMutation.isPending}>
                          <PlayCircle className="w-3 h-3 mr-1" /> Activate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CreateConfigDialog open={showCreate} onClose={() => setShowCreate(false)} policyKeys={policyKeys} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Rollouts section
// ---------------------------------------------------------------------------

function RolloutsSection({ configs }: { configs: PolicyConfig[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ rollouts: Rollout[]; counts: Record<string, number> }>({
    queryKey: ['/api/expansion/policy-rollout/rollouts'],
  });

  const rollbackMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/expansion/policy-rollout/rollouts/${id}/rollback`, { reason: 'Manual rollback via UI' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expansion/policy-rollout/rollouts'] });
      toast({ title: 'Rolled back', description: 'Rollout has been stopped and reversed.' });
    },
    onError: (err: any) => toast({ title: 'Rollback failed', description: err.message, variant: 'destructive' }),
  });

  const rollouts = data?.rollouts ?? [];
  const counts   = data?.counts ?? {};

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Rollouts
            </CardTitle>
            <CardDescription>
              Controlled deployment of active policies to specific scopes. Each rollout is independently reversible.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> New rollout
          </Button>
        </div>
        {Object.keys(counts).length > 0 && (
          <div className="flex gap-4 text-xs mt-2">
            {[['active','bg-emerald-500'],['planned','bg-blue-500'],['paused','bg-amber-500'],['rolled_back','bg-red-500'],['completed','bg-indigo-500']] .map(([s, col]) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${col}`} /> {counts[s] ?? 0} {s.replace('_',' ')}
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0 pb-2">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-white rounded animate-pulse" />)}</div>
        ) : rollouts.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No rollouts yet. Create one from an active policy config.
          </div>
        ) : (
          <div className="divide-y">
            {rollouts.map(r => (
              <div key={r.id} className={`px-4 py-3 ${r.rollout_status === 'rolled_back' ? 'bg-red-50' : r.rollout_status === 'active' ? 'bg-emerald-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge status={r.rollout_status} />
                      <span className="font-medium text-sm">{r.policy_key}</span>
                      <span className="text-xs text-muted-foreground font-mono">v{r.version}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Scope: <span className="font-medium">{SCOPE_LABELS[r.scope_type] ?? r.scope_type}</span>
                      {r.scope_key && <> — <span className="font-mono">{r.scope_key}</span></>}
                      {r.start_date && <> · Started {new Date(r.start_date).toLocaleDateString('he-IL')}</>}
                      {r.end_date && <> · Ended {new Date(r.end_date).toLocaleDateString('he-IL')}</>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                      <Activity className="w-3 h-3 mr-1" />
                      {expandedId === r.id ? 'Hide' : 'Evaluate'}
                    </Button>
                    {(r.rollout_status === 'active' || r.rollout_status === 'planned') && (
                      <Button size="sm" variant="destructive"
                        onClick={() => rollbackMutation.mutate(r.id)}
                        disabled={rollbackMutation.isPending}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Rollback
                      </Button>
                    )}
                  </div>
                </div>
                {expandedId === r.id && <EvaluationPanel rolloutId={r.id} />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CreateRolloutDialog open={showCreate} onClose={() => setShowCreate(false)} activeConfigs={configs} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PolicyRollout() {
  const { data: keysData, isLoading: keysLoading } = useQuery<{ policyKeys: Record<string, PolicyKeyMeta> }>({
    queryKey: ['/api/expansion/policy-rollout/keys'],
  });

  const { data: configsData } = useQuery<{ configs: PolicyConfig[] }>({
    queryKey: ['/api/expansion/policy-rollout/configs'],
  });

  const policyKeys = keysData?.policyKeys ?? {};
  const configs    = configsData?.configs ?? [];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
              <h1 className="text-2xl font-bold text-gray-900">Policy Rollout Control</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Controlled activation of policy changes. Draft → Activate → Scope rollout → Measure → Rollback if needed.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground">
            <Link href="/finance/policy">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                <ArrowRight className="w-3 h-3" /> Policy recommendations
              </span>
            </Link>
            <Link href="/finance/outcomes">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                <ArrowRight className="w-3 h-3" /> Outcome measurement
              </span>
            </Link>
          </div>
        </div>

        {/* Workflow diagram */}
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 flex-wrap text-xs font-medium text-indigo-700">
              {[
                ['Create draft', 'Define config values'],
                ['Activate', 'Archive previous active'],
                ['Scope rollout', 'Station / franchise / global'],
                ['Measure', 'Hooks into 12.22 outcomes'],
                ['Rollback', 'Kill switch if harm detected'],
              ].map(([step, sub], i) => (
                <span key={step} className="flex items-center gap-1">
                  {i > 0 && <ArrowRight className="w-3 h-3 text-indigo-400" />}
                  <span className="bg-white border border-indigo-200 rounded px-2 py-1">
                    <span className="font-semibold">{step}</span>
                    <span className="text-indigo-400 ml-1 font-normal">{sub}</span>
                  </span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Phase 12.24 tables */}
        {keysLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => <div key={i} className="h-40 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            <PolicyConfigsSection policyKeys={policyKeys} />
            <RolloutsSection configs={configs} />
          </>
        )}

        {/* Safety rules */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-amber-700 space-y-1">
              <div className="font-semibold mb-1">Governing safety rules</div>
              <div><span className="font-medium">Immutable history:</span> Policy configs are never edited. Every change creates a new versioned draft.</div>
              <div><span className="font-medium">Draft → Active:</span> A draft must be explicitly activated. Activation archives the previous active version.</div>
              <div><span className="font-medium">Scoped rollout:</span> Changes can be applied to a single station, franchise type, ownership type, or globally. Not all-or-nothing.</div>
              <div><span className="font-medium">Kill switch:</span> Any active rollout can be rolled back in one click. Sets end_date and marks rolled_back.</div>
              <div><span className="font-medium">Measurement:</span> Rollout evaluation reads from Phase 12.22 outcome engine. No new scoring introduced.</div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center border-t pt-4">
          <span className="font-medium">Chain source:</span>
          {[
            ['/finance/policy', 'Policy recommendations (12.23)'],
            ['/finance/outcomes', 'Outcome measurement (12.22)'],
            ['/finance/interventions', 'Intervention cases (12.21)'],
            ['/finance/board-pack', 'Board pack (12.20)'],
          ].map(([href, lbl]) => (
            <Link key={href} href={href}>
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                {lbl} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
