import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Cpu, CheckCircle2, XCircle, ArrowUpRight, Clock, ArrowRight,
  TrendingUp, TrendingDown, Minus, Info, AlertTriangle, Layers,
  ShieldCheck, Zap, Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Proposal {
  id: number;
  policy_key: string;
  proposal_type: 'relax' | 'tighten' | 'reduce' | 'raise' | 'calibrate';
  current_config: Record<string, unknown>;
  proposed_config: Record<string, unknown>;
  rationale: { summary: string; signal?: string; metric?: string; finding?: string };
  confidence: 'low' | 'medium' | 'high';
  evidence_count: number;
  status: 'proposed' | 'accepted' | 'rejected' | 'promoted';
  created_at: string;
  reviewed_at: string | null;
}

interface ProposalListResponse {
  proposals: Proposal[];
  counts: Record<string, number>;
}

interface GenerateResponse {
  proposals: Proposal[];
  skipped: number;
  skippedKeys: string[];
  message: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROPOSAL_TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  relax:     { label: 'Relax',     color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <TrendingUp className="w-3 h-3" /> },
  tighten:   { label: 'Tighten',   color: 'text-amber-700 bg-amber-50 border-amber-200',       icon: <TrendingDown className="w-3 h-3" /> },
  reduce:    { label: 'Reduce',    color: 'text-blue-700 bg-blue-50 border-blue-200',           icon: <TrendingDown className="w-3 h-3" /> },
  raise:     { label: 'Raise',     color: 'text-indigo-700 bg-indigo-50 border-indigo-200',    icon: <TrendingUp className="w-3 h-3" /> },
  calibrate: { label: 'Calibrate', color: 'text-violet-700 bg-violet-50 border-violet-200',    icon: <Minus className="w-3 h-3" /> },
};

const CONFIDENCE_CFG: Record<string, { label: string; color: string; dot: string }> = {
  high:   { label: 'High confidence',   color: 'text-emerald-700 bg-emerald-50 border-emerald-300', dot: 'bg-emerald-500' },
  medium: { label: 'Medium confidence', color: 'text-amber-700 bg-amber-50 border-amber-300',       dot: 'bg-amber-500'   },
  low:    { label: 'Low confidence',    color: 'text-gray-600 bg-gray-50 border-gray-300',           dot: 'bg-gray-400'    },
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  proposed: { label: 'Pending review', color: 'text-blue-700 bg-blue-50 border-blue-200',     icon: <Clock className="w-3 h-3" /> },
  accepted: { label: 'Accepted',       color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: 'Rejected',       color: 'text-red-700 bg-red-50 border-red-200',         icon: <XCircle className="w-3 h-3" /> },
  promoted: { label: 'Promoted →12.24',color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: <ArrowUpRight className="w-3 h-3" /> },
};

function Badge({ type, value }: { type: 'status' | 'confidence' | 'proposal_type'; value: string }) {
  if (type === 'status') {
    const c = STATUS_CFG[value] ?? STATUS_CFG.proposed;
    return <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${c.color}`}>{c.icon} {c.label}</span>;
  }
  if (type === 'confidence') {
    const c = CONFIDENCE_CFG[value] ?? CONFIDENCE_CFG.low;
    return <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${c.color}`}><span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label}</span>;
  }
  const c = PROPOSAL_TYPE_LABELS[value] ?? PROPOSAL_TYPE_LABELS.calibrate;
  return <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${c.color}`}>{c.icon} {c.label}</span>;
}

// ---------------------------------------------------------------------------
// Config diff: show old value → new value
// ---------------------------------------------------------------------------

function ConfigDiff({ current, proposed }: { current: Record<string, unknown>; proposed: Record<string, unknown> }) {
  const keys = [...new Set([...Object.keys(current), ...Object.keys(proposed)])];
  return (
    <div className="grid grid-cols-2 gap-2 text-xs mt-2">
      <div>
        <div className="font-medium text-muted-foreground mb-1">Current</div>
        <div className="bg-gray-50 border rounded p-2 space-y-0.5 font-mono">
          {keys.map(k => (
            <div key={k} className={proposed[k] !== current[k] ? 'text-red-700' : 'text-gray-600'}>
              {k}: {JSON.stringify(current[k])}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="font-medium text-muted-foreground mb-1">Proposed</div>
        <div className="bg-gray-50 border rounded p-2 space-y-0.5 font-mono">
          {keys.map(k => (
            <div key={k} className={proposed[k] !== current[k] ? 'text-emerald-700 font-semibold' : 'text-gray-600'}>
              {k}: {JSON.stringify(proposed[k])}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proposal card
// ---------------------------------------------------------------------------

function ProposalCard({ proposal, onAction }: { proposal: Proposal; onAction: () => void }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/expansion/optimizer/proposals/${proposal.id}/accept`, {}),
    onSuccess: () => { onAction(); toast({ title: 'Accepted', description: 'Proposal accepted. Promote it to create a draft in Policy Control.' }); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/expansion/optimizer/proposals/${proposal.id}/reject`, {}),
    onSuccess: () => { onAction(); toast({ title: 'Rejected', description: 'Proposal rejected and logged.' }); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const promoteMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/expansion/optimizer/proposals/${proposal.id}/promote`, {}),
    onSuccess: (data: any) => {
      onAction();
      toast({ title: 'Promoted to Policy Control', description: data.message ?? 'Draft created in 12.24. Activate it to proceed.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const isPending = acceptMutation.isPending || rejectMutation.isPending || promoteMutation.isPending;
  const r = proposal.rationale;

  return (
    <Card className={`border ${proposal.status === 'proposed' ? 'border-blue-200 bg-blue-50/30' : proposal.status === 'promoted' ? 'border-indigo-200 bg-indigo-50/20' : proposal.status === 'rejected' ? 'border-gray-200 bg-gray-50' : 'border-emerald-200 bg-emerald-50/20'}`}>
      <CardContent className="pt-4 pb-3">

        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{proposal.policy_key}</span>
            <Badge type="proposal_type" value={proposal.proposal_type} />
            <Badge type="confidence" value={proposal.confidence} />
            <Badge type="status" value={proposal.status} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{proposal.evidence_count} evidence case{proposal.evidence_count !== 1 ? 's' : ''}</span>
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-0.5 text-blue-600 hover:underline">
              <Eye className="w-3 h-3" /> {expanded ? 'less' : 'details'}
            </button>
          </div>
        </div>

        {/* Rationale summary */}
        <p className="text-sm text-gray-700 leading-relaxed mb-2">{r.summary}</p>

        {/* Supporting evidence chips */}
        {(r.signal || r.metric || r.finding) && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {r.metric  && <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded px-2 py-0.5">{r.metric}</span>}
            {r.signal  && <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded px-2 py-0.5">{r.signal}</span>}
            {r.finding && <span className="text-xs bg-gray-50 border rounded px-2 py-0.5 text-gray-600 italic">{r.finding}</span>}
          </div>
        )}

        {/* Config diff (expanded) */}
        {expanded && (
          <ConfigDiff current={proposal.current_config} proposed={proposal.proposed_config} />
        )}

        {/* Action buttons */}
        {proposal.status === 'proposed' && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Button size="sm" variant="outline"
              onClick={() => acceptMutation.mutate()} disabled={isPending}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> Accept
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => rejectMutation.mutate()} disabled={isPending}>
              <XCircle className="w-3 h-3 mr-1" /> Reject
            </Button>
          </div>
        )}

        {proposal.status === 'accepted' && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t">
            <Button size="sm"
              onClick={() => promoteMutation.mutate()} disabled={isPending}>
              <ArrowUpRight className="w-3 h-3 mr-1.5" />
              {promoteMutation.isPending ? 'Creating draft...' : 'Promote → Policy Control'}
            </Button>
            <span className="text-xs text-muted-foreground">
              Creates a draft in 12.24. You still activate it and create a rollout.
            </span>
          </div>
        )}

        {proposal.status === 'promoted' && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-indigo-700">
            <ShieldCheck className="w-3.5 h-3.5" />
            Draft created in Policy Control. Reviewed {proposal.reviewed_at ? new Date(proposal.reviewed_at).toLocaleDateString('he-IL') : '—'}.
            <Link href="/finance/policy-rollout">
              <span className="underline cursor-pointer hover:no-underline">Go to Policy Control →</span>
            </Link>
          </div>
        )}

        {proposal.status === 'rejected' && (
          <div className="mt-2 text-xs text-muted-foreground">
            Rejected {proposal.reviewed_at ? new Date(proposal.reviewed_at).toLocaleDateString('he-IL') : '—'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page — executive decision panel
// ---------------------------------------------------------------------------

export default function Optimizer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ProposalListResponse>({
    queryKey: ['/api/expansion/optimizer/proposals'],
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/expansion/optimizer/generate', {}),
    onSuccess: (result: GenerateResponse) => {
      queryClient.invalidateQueries({ queryKey: ['/api/expansion/optimizer/proposals'] });
      if (result.proposals.length === 0) {
        toast({
          title: result.skipped > 0 ? 'Proposals already pending' : 'No proposals generated',
          description: result.message ?? 'No improvement opportunities detected.',
        });
      } else {
        toast({
          title: `${result.proposals.length} proposal${result.proposals.length !== 1 ? 's' : ''} generated`,
          description: result.skipped > 0 ? `${result.skipped} key(s) already pending review were skipped.` : 'Review and accept to proceed.',
        });
      }
    },
    onError: (err: any) => toast({ title: 'Generation failed', description: err.message, variant: 'destructive' }),
  });

  const proposals  = data?.proposals ?? [];
  const counts     = data?.counts ?? {};
  const pending    = counts.proposed  ?? 0;
  const accepted   = counts.accepted  ?? 0;
  const rejected   = counts.rejected  ?? 0;
  const promoted   = counts.promoted  ?? 0;

  // Group: pending review first, then accepted, then rest
  const byStatus = (s: string) => proposals.filter(p => p.status === s);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Cpu className="w-7 h-7 text-violet-600" />
              <h1 className="text-2xl font-bold text-gray-900">Autonomous Optimization</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              System proposes improvements from measured outcomes. All changes go through Policy Control (12.24). Nothing executes automatically.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground">
            <Link href="/finance/policy-rollout">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                <ShieldCheck className="w-3 h-3" /> Policy Control (12.24)
              </span>
            </Link>
            <Link href="/finance/policy">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                <ArrowRight className="w-3 h-3" /> Policy Recommendations (12.23)
              </span>
            </Link>
          </div>
        </div>

        {/* Flow diagram */}
        <Card className="border-violet-200 bg-violet-50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 flex-wrap text-xs font-medium text-violet-700">
              {[
                ['Measure', '12.22 outcomes'],
                ['Learn', '12.23 patterns'],
                ['Propose', '12.25 this page'],
                ['Control', '12.24 draft + activate'],
                ['Rollout', 'scoped deployment'],
              ].map(([step, sub], i) => (
                <span key={step} className="flex items-center gap-1">
                  {i > 0 && <ArrowRight className="w-3 h-3 text-violet-400" />}
                  <span className={`border rounded px-2 py-1 ${i === 2 ? 'bg-violet-200 border-violet-400 font-bold' : 'bg-white border-violet-200'}`}>
                    {step} <span className="text-violet-400 font-normal">{sub}</span>
                  </span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary + generate */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-5 text-sm">
            {[
              ['Pending', pending, 'text-blue-700'],
              ['Accepted', accepted, 'text-emerald-700'],
              ['Promoted', promoted, 'text-indigo-700'],
              ['Rejected', rejected, 'text-red-600'],
            ].map(([label, n, color]) => (
              <div key={label as string} className="text-center">
                <div className={`text-2xl font-bold ${color}`}>{n as number}</div>
                <div className="text-xs text-muted-foreground">{label as string}</div>
              </div>
            ))}
          </div>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {generateMutation.isPending ? 'Analyzing outcomes...' : 'Generate proposals'}
          </Button>
        </div>

        {/* Proposals */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />)}
          </div>
        ) : proposals.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Cpu className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <div className="text-sm text-muted-foreground mb-1">No proposals yet.</div>
              <div className="text-xs text-muted-foreground">
                Click "Generate proposals" to run the optimizer. Requires at least 3 resolved intervention cases with economic baselines.
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Pending review section */}
            {byStatus('proposed').length > 0 && (
              <div>
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Pending review ({byStatus('proposed').length})
                </div>
                <div className="space-y-3">
                  {byStatus('proposed').map(p => (
                    <ProposalCard key={p.id} proposal={p}
                      onAction={() => queryClient.invalidateQueries({ queryKey: ['/api/expansion/optimizer/proposals'] })} />
                  ))}
                </div>
              </div>
            )}

            {/* Accepted (awaiting promote) */}
            {byStatus('accepted').length > 0 && (
              <div>
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accepted — promote to Policy Control ({byStatus('accepted').length})
                </div>
                <div className="space-y-3">
                  {byStatus('accepted').map(p => (
                    <ProposalCard key={p.id} proposal={p}
                      onAction={() => queryClient.invalidateQueries({ queryKey: ['/api/expansion/optimizer/proposals'] })} />
                  ))}
                </div>
              </div>
            )}

            {/* Promoted */}
            {byStatus('promoted').length > 0 && (
              <div>
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Promoted to Policy Control ({byStatus('promoted').length})
                </div>
                <div className="space-y-3">
                  {byStatus('promoted').map(p => (
                    <ProposalCard key={p.id} proposal={p}
                      onAction={() => queryClient.invalidateQueries({ queryKey: ['/api/expansion/optimizer/proposals'] })} />
                  ))}
                </div>
              </div>
            )}

            {/* Rejected */}
            {byStatus('rejected').length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Rejected ({byStatus('rejected').length})
                </div>
                <div className="space-y-3">
                  {byStatus('rejected').map(p => (
                    <ProposalCard key={p.id} proposal={p}
                      onAction={() => queryClient.invalidateQueries({ queryKey: ['/api/expansion/optimizer/proposals'] })} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Governing constraint */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-amber-800 space-y-1">
              <div className="font-semibold mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> What this system does and does NOT do</div>
              <div><span className="font-medium">Does:</span> observe outcomes (12.22), learn patterns (12.23), suggest improvements with evidence</div>
              <div><span className="font-medium">Does NOT:</span> activate policies, bypass approvals, modify finance logic, execute changes autonomously</div>
              <div><span className="font-medium">Hard gate:</span> Zero proposals are generated if resolvedWithBaseline &lt; 3. The system does not speculate.</div>
              <div><span className="font-medium">Promote path:</span> Promote creates a DRAFT in Policy Control (12.24). You still must: activate it → create a rollout → measure → rollback if needed.</div>
            </div>
          </CardContent>
        </Card>

        {/* Footer chain */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center border-t pt-4">
          <span className="font-medium">Source chain:</span>
          {[
            ['/finance/policy-rollout', 'Policy Control (12.24)'],
            ['/finance/policy', 'Policy Learning (12.23)'],
            ['/finance/outcomes', 'Outcome Measurement (12.22)'],
            ['/finance/interventions', 'Interventions (12.21)'],
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
