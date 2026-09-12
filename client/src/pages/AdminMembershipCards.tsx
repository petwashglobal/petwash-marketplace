/**
 * Admin — Membership cards (2026-09-12).
 *
 * The card system (MembershipCardService) had every admin action as an API
 * (freeze / unfreeze / regenerate QR / regenerate barcode / print PDF) and NO
 * screen that called any of them. Lost-card handling was therefore
 * member-only (report-lost) and support could not freeze a stolen card.
 *
 * One screen: find a member by e-mail, member id or uid → see the card →
 * act. Every action is a real POST to /api/admin/membership/:userId/… and
 * the result is re-read from the server (no optimistic lies).
 */
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Snowflake, Sun, QrCode, Barcode, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminCard {
  ok: boolean;
  userId: string;
  email: string | null;
  memberId: string;
  cardNumberDisplay: string;
  barcodeValue: string;
  qrUrl: string;
  tier: string;
  status: string;
  validFrom: string | null;
  validUntil: string | null;
  frozenReason: string | null;
  lastScanAt: string | null;
  lastUsedStationId: string | null;
  linkedNayaxCustomerId: string | null;
  linkedNayaxCardId: string | null;
}

export default function AdminMembershipCards() {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [lookup, setLookup] = useState('');
  const [reason, setReason] = useState('');

  const { data, isLoading, isError, error } = useQuery<AdminCard>({
    queryKey: ['/api/admin/membership/lookup', lookup],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/admin/membership/lookup?q=${encodeURIComponent(lookup)}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      return r.json();
    },
    enabled: lookup.trim().length > 2,
    retry: false,
  });

  const act = useMutation({
    mutationFn: async ({ action, body }: { action: string; body?: Record<string, unknown> }) => {
      if (!data?.userId) throw new Error('NO_USER');
      const r = await apiRequest('POST', `/api/admin/membership/${data.userId}/${action}`, body ?? {});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: (_r, v) => {
      toast({ title: `Done: ${v.action}` });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/membership/lookup', lookup] });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Action failed', description: String(e?.message ?? e) }),
  });

  const frozen = data?.status === 'frozen';

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6" dir="ltr">
      <div>
        <h1 className="text-2xl font-bold">Membership cards</h1>
        <p className="text-sm text-gray-500">Find a member, see the card, freeze / unfreeze / regenerate / print. Every action hits the server and re-reads the card.</p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); setLookup(q.trim()); }}
        data-testid="admin-card-lookup"
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e-mail, member id (PW-2026-000123) or uid" className="h-11" />
        <Button type="submit" className="h-11 gap-2" disabled={q.trim().length < 3}>
          <Search className="w-4 h-4" /> Find
        </Button>
      </form>

      {isLoading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Looking up…</div>}
      {isError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" data-testid="admin-card-error">{String((error as any)?.message ?? 'Not found')}</div>}

      {data?.ok && (
        <Card data-testid="admin-card-result">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg font-mono">{data.memberId}</CardTitle>
              <CardDescription>{data.email ?? data.userId} · tier {data.tier}</CardDescription>
            </div>
            <Badge className={frozen ? 'bg-sky-100 text-sky-800' : data.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-800'} data-testid="admin-card-status">
              {data.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <dt className="text-gray-500">Card number</dt><dd className="font-mono">{data.cardNumberDisplay}</dd>
              <dt className="text-gray-500">Barcode</dt><dd className="font-mono">{data.barcodeValue}</dd>
              <dt className="text-gray-500">QR</dt><dd className="font-mono break-all">{data.qrUrl}</dd>
              <dt className="text-gray-500">Valid</dt><dd>{data.validFrom?.slice(0, 10) ?? '—'} → {data.validUntil?.slice(0, 10) ?? '—'}</dd>
              <dt className="text-gray-500">Last scan</dt><dd>{data.lastScanAt ? `${data.lastScanAt.slice(0, 16).replace('T', ' ')} @ ${data.lastUsedStationId ?? '?'}` : 'never'}</dd>
              <dt className="text-gray-500">Nayax link</dt><dd>{data.linkedNayaxCustomerId || data.linkedNayaxCardId ? `${data.linkedNayaxCustomerId ?? ''} ${data.linkedNayaxCardId ?? ''}` : 'not linked'}</dd>
              {data.frozenReason && (<><dt className="text-gray-500">Frozen reason</dt><dd>{data.frozenReason}</dd></>)}
            </dl>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {!frozen ? (
                <>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="freeze reason (stolen / lost / fraud)" className="h-10 max-w-xs" />
                  <Button variant="outline" className="h-10 gap-2" disabled={act.isPending} onClick={() => act.mutate({ action: 'freeze', body: { reason } })} data-testid="admin-card-freeze">
                    <Snowflake className="w-4 h-4" /> Freeze
                  </Button>
                </>
              ) : (
                <Button variant="outline" className="h-10 gap-2" disabled={act.isPending} onClick={() => act.mutate({ action: 'unfreeze' })} data-testid="admin-card-unfreeze">
                  <Sun className="w-4 h-4" /> Unfreeze
                </Button>
              )}
              <Button variant="outline" className="h-10 gap-2" disabled={act.isPending} onClick={() => { if (confirm('Regenerate the QR? The old QR (and any printed card) stops working.')) act.mutate({ action: 'regenerate-qr' }); }} data-testid="admin-card-regen-qr">
                <QrCode className="w-4 h-4" /> Regenerate QR
              </Button>
              <Button variant="outline" className="h-10 gap-2" disabled={act.isPending} onClick={() => { if (confirm('Regenerate the barcode? The old barcode (and any printed card) stops working.')) act.mutate({ action: 'regenerate-barcode' }); }} data-testid="admin-card-regen-barcode">
                <Barcode className="w-4 h-4" /> Regenerate barcode
              </Button>
              <a href={`/api/admin/membership/${data.userId}/print.pdf`} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-gray-50" data-testid="admin-card-print">
                <Printer className="w-4 h-4" /> Print PDF
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
