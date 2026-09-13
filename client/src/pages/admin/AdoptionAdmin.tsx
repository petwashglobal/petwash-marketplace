/**
 * Adopt a Pet — support review queue (/admin/adoption).
 * Separate from /admin/paw-finder: adoption listings are not lost/found notices.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface AdminListing {
  id: number; listing_key: string; user_id: string; lister_type: string; pet_type: string; pet_name: string | null;
  breed: string | null; age_group: string; city: string; area: string | null; description: string;
  temperament: string | null; health_notes: string | null; special_needs: string | null;
  status: string; moderation_status: string; moderation_reason: string | null; created_at: string; primary_media: string | null;
}

const STATUSES = ['', 'pending_review', 'available', 'pending', 'adopted', 'rejected', 'archived'];

export default function AdoptionAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState('pending_review');
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const listQ = useQuery<{ rows: AdminListing[] }>({
    queryKey: ['/api/admin/adoption/listings', status],
    refetchInterval: 30_000,
    queryFn: async () => {
      const r = await apiRequest(status === 'pending_review' ? '/api/admin/adoption/queue' : `/api/admin/adoption/listings?status=${status}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['/api/admin/adoption/listings'] });
  const act = useMutation({
    mutationFn: ({ id, action, body }: { id: number; action: 'approve' | 'reject' | 'archive'; body?: unknown }) =>
      apiRequest('POST', `/api/admin/adoption/listings/${id}/${action}`, body ?? {}),
    onSuccess: (_d, v) => {
      refresh();
      setRejecting(null);
      setReason('');
      toast({ title: v.action === 'approve' ? 'Listing approved — now public' : v.action === 'reject' ? 'Listing rejected' : 'Listing archived' });
    },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  });

  const rows = listQ.data?.rows ?? [];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Adopt a Pet — review</h1>
          <p className="text-sm text-slate-500">Adoption listings only. Lost &amp; found notices are reviewed in PawFinder admin.</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-base" data-testid="admin-adoption-status">
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'all'}</option>)}
        </select>
      </div>

      {listQ.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : listQ.isError ? <p className="text-sm text-red-600">Could not load listings.</p> :
        !rows.length ? <p className="text-sm text-slate-500">Nothing here.</p> : (
          <div className="grid gap-4">
            {rows.map((l) => (
              <Card key={l.id} data-testid={`admin-adoption-${l.id}`}>
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
                  <div className="h-40 w-full sm:w-40 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {l.primary_media && <img src={l.primary_media} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{l.pet_name || '—'}</span>
                      <span className="text-xs rounded bg-slate-100 px-2 py-0.5">{l.status}</span>
                      <span className="text-xs text-slate-500">{l.pet_type} · {l.breed || '—'} · {l.age_group} · {l.city}{l.area ? ` / ${l.area}` : ''} · {l.lister_type}</span>
                    </div>
                    <p className="text-sm whitespace-pre-line">{l.description}</p>
                    {l.temperament && <p className="text-xs text-slate-600 whitespace-pre-line">Temperament: {l.temperament}</p>}
                    {l.health_notes && <p className="text-xs text-slate-600 whitespace-pre-line">Health: {l.health_notes}</p>}
                    {l.special_needs && <p className="text-xs text-slate-600 whitespace-pre-line">Special needs: {l.special_needs}</p>}
                    <p className="text-xs text-slate-500">AI scan: {l.moderation_status}{l.moderation_reason ? ` — ${l.moderation_reason}` : ''} · {l.listing_key} · {new Date(l.created_at).toLocaleString()}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {(l.status === 'pending_review' || l.status === 'rejected') && (
                        <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: l.id, action: 'approve' })}>Approve</Button>
                      )}
                      {['pending_review', 'available', 'pending'].includes(l.status) && (
                        <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => setRejecting(l.id)}>Reject</Button>
                      )}
                      {l.status !== 'archived' && (
                        <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ id: l.id, action: 'archive' })}>Archive</Button>
                      )}
                    </div>
                    {rejecting === l.id && (
                      <div className="space-y-2 pt-2">
                        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Internal reason (the lister gets a neutral message)" className="text-base" />
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" disabled={act.isPending} onClick={() => act.mutate({ id: l.id, action: 'reject', body: { reason } })}>Confirm reject</Button>
                          <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
