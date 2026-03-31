import * as React from 'react';
import { Link } from 'wouter';

type Proposal = {
  id: number;
  proposal_key: string;
  policy_key: string;
  proposal_type: string;
  current_config: Record<string, unknown>;
  proposed_config: Record<string, unknown>;
  rationale: {
    summary?: string;
    findingIds?: string[];
    detail?: string[];
  };
  confidence: 'low' | 'medium' | 'high';
  evidence_count: number;
  status: 'proposed' | 'accepted' | 'rejected' | 'promoted';
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function statusClass(status: Proposal['status']) {
  switch (status) {
    case 'proposed': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'accepted': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
    case 'promoted': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    default:         return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

function confidenceClass(c: Proposal['confidence']) {
  switch (c) {
    case 'high':   return 'bg-emerald-100 text-emerald-800';
    case 'medium': return 'bg-amber-100 text-amber-800';
    default:       return 'bg-slate-100 text-slate-800';
  }
}

const API_BASE = '/api/expansion/optimizer';

export default function Optimizer() {
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const [loading, setLoading]     = React.useState(false);
  const [busyId, setBusyId]       = React.useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = React.useState<Record<number, string>>({});
  const [lastGenerated, setLastGenerated] = React.useState<{ generated: number; skipped: number; readiness: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/proposals`, { credentials: 'include' });
      const json = await res.json();
      setProposals(json.proposals ?? []);
    } catch {
      setError('Failed to load proposals.');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/proposals/generate`, { method: 'POST', credentials: 'include' });
      const json = await res.json();
      setLastGenerated({
        generated: json.generated ?? 0,
        skipped:   json.skippedDuplicates ?? 0,
        readiness: json.measurementReadiness ?? 'unknown',
      });
      await load();
    } catch {
      setError('Failed to generate proposals.');
    } finally {
      setLoading(false);
    }
  }

  async function act(id: number, action: 'accept' | 'reject' | 'promote-to-draft') {
    setBusyId(id);
    setError(null);
    try {
      const body = action !== 'promote-to-draft'
        ? JSON.stringify({ reviewNote: reviewNotes[id] ?? '' })
        : undefined;

      const res  = await fetch(`${API_BASE}/proposals/${id}/${action}`, {
        method:  'POST',
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });
      const json = await res.json();
      if (!res.ok) setError(json.message ?? json.error ?? 'Action failed.');
      await load();
    } catch {
      setError('Request failed.');
    } finally {
      setBusyId(null);
    }
  }

  const counts = {
    proposed: proposals.filter(p => p.status === 'proposed').length,
    accepted:  proposals.filter(p => p.status === 'accepted').length,
    promoted:  proposals.filter(p => p.status === 'promoted').length,
    rejected:  proposals.filter(p => p.status === 'rejected').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Autonomous Optimization Review
          </h1>
          <p className="text-slate-600 mt-1 max-w-3xl text-sm">
            System-generated proposals only. Nothing here changes live policy directly.
            Accepted proposals must still become draft configs under the 12.24 rollout discipline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate proposals'}
          </button>
          <Link href="/finance/policy-rollout">
            <span className="rounded-lg border px-4 py-2 text-sm font-medium cursor-pointer hover:bg-slate-50 inline-block">
              Go to rollout control
            </span>
          </Link>
        </div>
      </div>

      {/* Generation result banner */}
      {lastGenerated && (
        <div className="rounded-lg bg-slate-50 border px-4 py-2 text-sm flex items-center gap-4 flex-wrap">
          <span>Generated: <strong>{lastGenerated.generated}</strong></span>
          <span>Skipped duplicates: <strong>{lastGenerated.skipped}</strong></span>
          <span>Measurement readiness: <strong>{lastGenerated.readiness}</strong></span>
          {lastGenerated.generated === 0 && lastGenerated.readiness === 'accumulating' && (
            <span className="text-amber-700">Not enough resolved cases with baselines to generate proposals.</span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Status summary */}
      {proposals.length > 0 && (
        <div className="flex gap-5 text-sm">
          {([['Pending', counts.proposed, 'text-amber-700'], ['Accepted', counts.accepted, 'text-blue-700'],
             ['Promoted', counts.promoted, 'text-emerald-700'], ['Rejected', counts.rejected, 'text-slate-500']] as const).map(
            ([lbl, n, color]) => (
              <div key={lbl} className="text-center">
                <div className={`text-2xl font-bold ${color}`}>{n}</div>
                <div className="text-xs text-muted-foreground">{lbl}</div>
              </div>
            )
          )}
        </div>
      )}

      {/* Operating discipline */}
      <div className="rounded-xl border bg-white p-4">
        <div className="font-semibold text-slate-900">Operating discipline</div>
        <ul className="mt-3 space-y-1 text-sm text-slate-700 list-disc pl-5">
          <li>Optimizer can propose only. No direct activation of live policy.</li>
          <li>Accepted proposal must be promoted to a draft config in Policy Control (12.24).</li>
          <li>Draft must still go through: activation → rollout → evaluation → rollback path.</li>
          <li>Confidence is based on measured outcomes only. Hard gate: &lt;3 resolved cases = no proposals.</li>
          <li>proposal_key is stable — same conditions produce the same key, preventing duplicate proposals.</li>
        </ul>
      </div>

      {/* Proposals */}
      <div className="grid gap-4">
        {proposals.map(p => (
          <div key={p.id} className="rounded-xl border bg-white overflow-hidden">

            {/* Card header */}
            <div className="border-b px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(p.status)}`}>
                    {p.status.toUpperCase()}
                  </span>
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${confidenceClass(p.confidence)}`}>
                    {p.confidence} confidence
                  </span>
                  <span className="text-sm font-semibold text-slate-900 font-mono">{p.proposal_key}</span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {p.policy_key} · <span className="capitalize">{p.proposal_type}</span>
                </div>
              </div>
              <div className="text-sm text-slate-500">
                Evidence: <strong>{p.evidence_count}</strong>
              </div>
            </div>

            {/* Card body */}
            <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* Left: rationale + actions */}
              <div className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Rationale</div>
                  <div className="text-sm text-slate-800 font-medium leading-relaxed">
                    {p.rationale?.summary ?? 'No summary'}
                  </div>

                  {(p.rationale?.findingIds ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.rationale.findingIds!.map(f => (
                        <span key={f} className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 font-mono">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {(p.rationale?.detail ?? []).length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 space-y-0.5">
                      {p.rationale.detail!.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}

                  {p.review_note && (
                    <div className="mt-2 rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800 italic">
                      Review note: {p.review_note}
                    </div>
                  )}
                </div>

                {/* Review note input — only for pending proposals */}
                {p.status === 'proposed' && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Review note (optional)</div>
                    <textarea
                      value={reviewNotes[p.id] ?? ''}
                      onChange={e => setReviewNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-full rounded-lg border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                      rows={2}
                      placeholder="Reason for accepting or rejecting…"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {p.status === 'proposed' && (
                    <>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => act(p.id, 'accept')}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
                      >
                        Accept
                      </button>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => act(p.id, 'reject')}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {p.status === 'accepted' && (
                    <button
                      disabled={busyId === p.id}
                      onClick={() => act(p.id, 'promote-to-draft')}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-emerald-700"
                    >
                      {busyId === p.id ? 'Creating draft...' : 'Promote to 12.24 draft'}
                    </button>
                  )}

                  {p.status === 'promoted' && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      ✓ Draft created in Policy Control
                      <Link href="/finance/policy-rollout">
                        <span className="underline cursor-pointer">Go to rollout control →</span>
                      </Link>
                    </div>
                  )}

                  {p.status === 'rejected' && (
                    <div className="text-sm text-slate-500">
                      Rejected {p.reviewed_at ? new Date(p.reviewed_at).toLocaleDateString('he-IL') : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: config diff */}
              <div className="grid gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Current config</div>
                  <pre className="rounded-lg bg-slate-50 p-3 text-xs overflow-x-auto border font-mono leading-relaxed">
                    {pretty(p.current_config)}
                  </pre>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Proposed config</div>
                  <pre className="rounded-lg bg-emerald-50 p-3 text-xs overflow-x-auto border border-emerald-200 font-mono leading-relaxed">
                    {pretty(p.proposed_config)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && proposals.length === 0 && (
          <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
            No optimizer proposals yet. Click "Generate proposals" to run the analyzer.
          </div>
        )}
      </div>

      {/* Footer chain */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center border-t pt-4">
        <span className="font-medium text-slate-700">Chain:</span>
        {[
          ['/finance/policy-rollout', 'Policy Control (12.24)'],
          ['/finance/policy', 'Policy Learning (12.23)'],
          ['/finance/outcomes', 'Outcome Measurement (12.22)'],
          ['/finance/interventions', 'Interventions (12.21)'],
        ].map(([href, lbl]) => (
          <Link key={href} href={href}>
            <span className="cursor-pointer hover:underline hover:text-slate-700">{lbl} →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
