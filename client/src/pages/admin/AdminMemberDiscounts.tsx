/**
 * Admin — Senior/Disability discount review (Smart Admin Panel §9, §19).
 *
 * Lists discount applications and lets an admin Approve (5/7/10% — K9000 washes
 * ONLY), Reject, Suspend, or ask for more info. Backed by the #1054 review API
 * (/api/admin/member-discount/applications). IDs are MASKED by default; a
 * super-admin can "Reveal" the full number (server decrypts + AUDITS every call).
 *
 * This is the page the discount support-email link and the Applications Dashboard
 * discount rows point at (/admin/member-discounts).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Eye, ShieldCheck, XCircle, HelpCircle, Ban } from 'lucide-react';

interface Application {
  id: number;
  userId: string;
  discountType: 'senior' | 'disability';
  status: string;
  idType: string | null;
  idMasked: string | null;
  idCountry: string | null;
  dateOfBirth: string | null;
  disabilityMasked: string | null;
  issuingAuthority: string | null;
  submittedAt: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  approvedPercent: number | null;
}

const STATUS_TABS = [
  { key: 'pending_review', label: 'Pending' },
  { key: 'needs_more_info', label: 'Needs info' },
  { key: 'approved', label: 'Approved' },
  { key: '', label: 'All' },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending_review: { bg: '#fef3c7', color: '#b45309' },
  needs_more_info: { bg: '#fef3c7', color: '#b45309' },
  approved: { bg: '#d1fae5', color: '#065f46' },
  rejected: { bg: '#fee2e2', color: '#991b1b' },
  suspended: { bg: '#fee2e2', color: '#991b1b' },
};

function age(dob: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return String(a);
}

export default function AdminMemberDiscounts() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending_review');
  const [revealed, setRevealed] = useState<Record<number, string>>({});

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ ok: boolean; applications: Application[] }>({
    queryKey: ['/api/admin/member-discount/applications', status],
    queryFn: async () => {
      const qs = status ? `?status=${status}` : '';
      const res = await apiRequest('GET', `/api/admin/member-discount/applications${qs}`);
      return res.json();
    },
  });
  const applications = data?.applications ?? [];

  const decide = useMutation({
    mutationFn: async (v: { id: number; decision: string; discountPercent?: number; note?: string }) => {
      const res = await apiRequest('POST', `/api/admin/member-discount/applications/${v.id}/decision`, {
        decision: v.decision,
        discountPercent: v.discountPercent,
        note: v.note,
      });
      return res.json();
    },
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast({ title: `Application ${res.status}${res.discountPercent ? ` · ${res.discountPercent}%` : ''}` });
        qc.invalidateQueries({ queryKey: ['/api/admin/member-discount/applications'] });
      } else {
        toast({ variant: 'destructive', title: res?.error || 'Action failed' });
      }
    },
    onError: () => toast({ variant: 'destructive', title: 'Action failed' }),
  });

  const reveal = async (id: number) => {
    try {
      const res = await apiRequest('GET', `/api/admin/member-discount/applications/${id}/reveal`);
      const d = await res.json();
      if (d?.ok) {
        setRevealed((p) => ({ ...p, [id]: `${d.idNumber ?? '—'}${d.disabilityRef ? ` · disability: ${d.disabilityRef}` : ''}` }));
      } else {
        toast({ variant: 'destructive', title: d?.error || 'Reveal failed (super-admin only)' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Reveal failed (super-admin only)' });
    }
  };

  const approve = (a: Application) => {
    const pct = window.prompt('Approve discount percent — 5, 7 or 10 (K9000 washes only):', '5');
    if (!pct) return;
    const n = Number(pct);
    if (![5, 7, 10].includes(n)) { toast({ variant: 'destructive', title: 'Percent must be 5, 7 or 10' }); return; }
    decide.mutate({ id: a.id, decision: 'approved', discountPercent: n });
  };
  const withNote = (a: Application, decision: string, label: string) => {
    const note = window.prompt(`${label} — internal note (optional):`, '') ?? undefined;
    decide.mutate({ id: a.id, decision, note });
  };

  return (
    <div className="min-h-screen bg-white p-5 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Senior / Disability Discounts</h1>
          <p className="text-sm text-gray-500">Manual review · approve up to 10% · <b>K9000 washes only</b> · no platform discount.</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-gray-300">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 my-4">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key || 'all'}
            onClick={() => setStatus(t.key)}
            className={`px-3 py-1.5 rounded-full text-sm border ${status === t.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isError && <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">Could not load applications. <button onClick={() => refetch()} className="underline">Retry</button></div>}

      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No applications in this view.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {applications.map((a) => {
              const ss = STATUS_STYLE[a.status] || { bg: '#f3f4f6', color: '#374151' };
              return (
                <div key={a.id} className="px-4 py-3.5" data-testid={`discount-app-${a.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">#{a.id} · {a.discountType === 'senior' ? 'Senior 65+' : 'Disability'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: ss.bg, color: ss.color }}>{a.status}</span>
                        {a.approvedPercent ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{a.approvedPercent}%</span> : null}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        user {a.userId.slice(0, 10)}… · {a.idType ?? 'id'}: <span className="font-mono">{revealed[a.id] ?? a.idMasked ?? '••••'}</span>
                        {a.idCountry ? ` (${a.idCountry})` : ''} · age {age(a.dateOfBirth)}
                        {a.submittedAt ? ` · ${new Date(a.submittedAt).toLocaleDateString()}` : ''}
                      </p>
                      {a.reviewNote && <p className="text-xs text-amber-700 mt-1">note: {a.reviewNote}</p>}
                    </div>
                    <button onClick={() => reveal(a.id)} title="Reveal full ID (super-admin, audited)" className="shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                      <Eye className="w-3.5 h-3.5" /> Reveal
                    </button>
                  </div>
                  {a.status !== 'approved' && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      <button onClick={() => approve(a)} disabled={decide.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
                        <ShieldCheck className="w-3.5 h-3.5" /> Approve…
                      </button>
                      <button onClick={() => withNote(a, 'needs_more_info', 'Ask for more info')} disabled={decide.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                        <HelpCircle className="w-3.5 h-3.5" /> More info
                      </button>
                      <button onClick={() => withNote(a, 'rejected', 'Reject')} disabled={decide.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-red-200 text-red-700 hover:bg-red-50">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                  {a.status === 'approved' && (
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={() => withNote(a, 'suspended', 'Suspend')} disabled={decide.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-red-200 text-red-700 hover:bg-red-50">
                        <Ban className="w-3.5 h-3.5" /> Suspend
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-4">
        Approved discount applies to K9000 washes only, capped at 10%. Reveal decrypts the ID server-side and is audit-logged. Every decision is audited.
      </p>
    </div>
  );
}
