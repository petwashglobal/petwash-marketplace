/**
 * AdminNayaxEvents — Tower Control: Nayax / K9000 redemptions & reconciliation
 * Route: /admin/nayax-events
 *
 * Token-free view over nayax_transaction_events (webhook-ingested and/or
 * manually imported from a Nayax Core report export). Three sections:
 *   1. CPA monthly settlement summary (bay money books into SUMIT MONTHLY —
 *      per the 2026-07-12 CPA decision there is NO per-transaction invoice)
 *   2. Filterable event list with station/bay labels + channel chips
 *   3. Manual report import (CSV parsed in-browser → JSON rows). RECORD-ONLY:
 *      idempotent server-side, never awards points, never touches wallets.
 *
 * Hebrew-first, RTL. Brand: pure white / black / metallic gold (#D4AF37).
 */
import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, Upload, Loader2, AlertTriangle, CheckCircle2, Landmark, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { parseCsv } from '@/lib/csv';

const GOLD = '#D4AF37';

// ── Types (mirror admin-nayax-events.ts responses) ──────────────────────────
interface EventRow {
  id: number;
  externalTransactionId: string;
  machineId: string;
  terminalId: string | null;
  stationNameHe: string | null;
  bay: 'RIGHT' | 'LEFT' | null;
  bayNameHe: string | null;
  paymentChannel: string;
  eventType: string;
  approvalStatus: string;
  amountGross: string;
  currency: string | null;
  transactionTime: string;
  processingStatus: string | null;
  loyaltyAwarded: boolean | null;
  loyaltyPointsAwarded: number | null;
  refundReversed: boolean | null;
  linkedMember: boolean;
}
interface Terminal {
  machineId: string; deviceId: string; stationNameHe: string; bay: string; bayNameHe: string;
}
interface ListResponse { total: number; events: EventRow[]; terminals: Terminal[] }
interface SummaryRow {
  month: string; machineId: string; paymentChannel: string; currency: string | null;
  txCount: number; grossTotal: string; stationNameHe: string | null; bayNameHe: string | null;
}
interface SummaryResponse { months: SummaryRow[]; note: string }

// ── Labels ───────────────────────────────────────────────────────────────────
const CHANNEL_HE: Record<string, string> = {
  tap_card: 'כרטיס במסוף',
  monyx_qr: 'Monyx QR',
  petwash_wallet_qr: 'PetWash QR',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  loyalty_prepaid: 'מועדון / נטען',
  unknown: 'לא מזוהה',
};
const STATUS_HE: Record<string, string> = {
  approved: 'אושר',
  declined: 'נדחה',
  refunded: 'הוחזר',
};

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('he-IL'); } catch { return iso; }
}
function fmtAmount(v: string, currency: string | null) {
  const n = parseFloat(v);
  const sym = currency === 'ILS' || !currency ? '₪' : `${currency} `;
  return `${sym}${Number.isFinite(n) ? n.toFixed(2) : v}`;
}

export default function AdminNayaxEvents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [machineId, setMachineId] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');

  const listKey = useMemo(() => {
    const p = new URLSearchParams();
    if (machineId) p.set('machineId', machineId);
    if (channel) p.set('channel', channel);
    if (status) p.set('status', status);
    p.set('limit', '100');
    return `/api/admin/nayax-events?${p.toString()}`;
  }, [machineId, channel, status]);

  const { data: list, isLoading, refetch, isFetching } = useQuery<ListResponse>({ queryKey: [listKey] });
  const { data: summary } = useQuery<SummaryResponse>({ queryKey: ['/api/admin/nayax-events/summary'] });

  const importMutation = useMutation({
    mutationFn: async (rows: Record<string, string>[]) => {
      const res = await apiRequest('POST', '/api/admin/nayax-events/import', { rows });
      return res.json() as Promise<{ inserted: number; duplicates: number; skipped: unknown[]; warnings: { warnings: string[] }[] }>;
    },
    onSuccess: (r) => {
      toast({
        title: 'ייבוא הושלם',
        description: `נקלטו ${r.inserted} · כפולים ${r.duplicates} · דולגו ${r.skipped.length}${r.warnings.length ? ` · אזהרות ${r.warnings.length}` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: [listKey] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/nayax-events/summary'] });
    },
    onError: (e: Error) => toast({ title: 'הייבוא נכשל', description: e.message, variant: 'destructive' }),
  });

  async function onFileChosen(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      toast({ title: 'קובץ ריק או לא תקין', description: 'ה-CSV חייב שורת כותרות + שורות נתונים', variant: 'destructive' });
      return;
    }
    if (rows.length > 2000) {
      toast({ title: 'קובץ גדול מדי', description: 'עד 2,000 שורות בכל ייבוא — פצלו את הדוח', variant: 'destructive' });
      return;
    }
    importMutation.mutate(rows);
  }

  const monthGroups = useMemo(() => {
    const byMonth = new Map<string, SummaryRow[]>();
    for (const r of summary?.months ?? []) {
      if (!byMonth.has(r.month)) byMonth.set(r.month, []);
      byMonth.get(r.month)!.push(r);
    }
    return Array.from(byMonth.entries());
  }, [summary]);

  return (
    <div dir="rtl" className="min-h-screen bg-white text-[#0A0A0A] p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light" style={{ fontFamily: "'Didot','Bodoni MT',Georgia,serif" }}>
            Nayax / K9000 — עסקאות ופדיונות
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            אירועי מסוף (webhook + ייבוא ידני) · תצוגת התאמה חודשית לרו״ח
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          רענון
        </Button>
      </div>

      {/* 1 — CPA monthly settlement summary */}
      <section className="mb-8 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Landmark className="w-4 h-4" style={{ color: GOLD }} />
          <h2 className="font-semibold">סיכום חודשי — התחשבנות SUMIT</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          הכנסות המפרץ נרשמות ב-SUMIT פעם בחודש (החלטת רו״ח 12.07.2026) — אין חשבונית פר-עסקה.
        </p>
        {monthGroups.length === 0 ? (
          <p className="text-sm text-gray-400">אין עדיין עסקאות — ייבאו דוח Nayax Core למטה או המתינו ל-webhook.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-gray-500 border-b border-gray-100">
                  <th className="py-2 pl-4 font-normal">חודש</th>
                  <th className="py-2 pl-4 font-normal">תחנה — מפרץ</th>
                  <th className="py-2 pl-4 font-normal">ערוץ</th>
                  <th className="py-2 pl-4 font-normal">עסקאות</th>
                  <th className="py-2 pl-4 font-normal">סה״כ ברוטו</th>
                </tr>
              </thead>
              <tbody>
                {monthGroups.flatMap(([month, rows]) =>
                  rows.map((r, i) => (
                    <tr key={`${month}-${r.machineId}-${r.paymentChannel}-${r.currency}-${i}`} className="border-b border-gray-50">
                      <td className="py-2 pl-4 font-medium">{i === 0 ? month : ''}</td>
                      <td className="py-2 pl-4">
                        {r.stationNameHe ? `${r.stationNameHe} — ${r.bayNameHe}` : r.machineId}
                        {r.currency && r.currency !== 'ILS' && (
                          <span className="mr-2 text-xs text-red-600 font-medium">({r.currency}!)</span>
                        )}
                      </td>
                      <td className="py-2 pl-4">{CHANNEL_HE[r.paymentChannel] || r.paymentChannel}</td>
                      <td className="py-2 pl-4">{r.txCount}</td>
                      <td className="py-2 pl-4 font-medium">{fmtAmount(r.grossTotal, r.currency)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2 — Filters + events table */}
      <section className="mb-8 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4" style={{ color: GOLD }} />
          <h2 className="font-semibold">אירועים</h2>
          {list && <span className="text-xs text-gray-400">({list.total})</span>}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <select dir="rtl" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
            value={machineId} onChange={(e) => setMachineId(e.target.value)} aria-label="מכונה">
            <option value="">כל המכונות</option>
            {(list?.terminals ?? []).map((t) => (
              <option key={t.machineId} value={t.machineId}>
                {t.stationNameHe} — {t.bayNameHe} ({t.machineId})
              </option>
            ))}
          </select>
          <select dir="rtl" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
            value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="ערוץ תשלום">
            <option value="">כל הערוצים</option>
            {Object.entries(CHANNEL_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select dir="rtl" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
            value={status} onChange={(e) => setStatus(e.target.value)} aria-label="סטטוס">
            <option value="">כל הסטטוסים</option>
            {Object.entries(STATUS_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-300" /></div>
        ) : !list || list.events.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">אין אירועים תואמים.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-gray-500 border-b border-gray-100">
                  <th className="py-2 pl-4 font-normal">זמן</th>
                  <th className="py-2 pl-4 font-normal">תחנה — מפרץ</th>
                  <th className="py-2 pl-4 font-normal">ערוץ</th>
                  <th className="py-2 pl-4 font-normal">סטטוס</th>
                  <th className="py-2 pl-4 font-normal">סכום</th>
                  <th className="py-2 pl-4 font-normal">נקודות</th>
                  <th className="py-2 pl-4 font-normal">מקור</th>
                  <th className="py-2 pl-4 font-normal">מזהה עסקה</th>
                </tr>
              </thead>
              <tbody>
                {list.events.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50">
                    <td className="py-2 pl-4 whitespace-nowrap">{fmtTime(e.transactionTime)}</td>
                    <td className="py-2 pl-4 whitespace-nowrap">
                      {e.stationNameHe ? `${e.stationNameHe} — ${e.bayNameHe}` : e.machineId}
                    </td>
                    <td className="py-2 pl-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs border"
                        style={{ borderColor: GOLD, color: '#8a6d1f' }}>
                        {CHANNEL_HE[e.paymentChannel] || e.paymentChannel}
                      </span>
                    </td>
                    <td className="py-2 pl-4">
                      {e.approvalStatus === 'approved'
                        ? <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3.5 h-3.5" />{STATUS_HE.approved}</span>
                        : e.approvalStatus === 'refunded'
                          ? <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3.5 h-3.5" />{STATUS_HE.refunded}</span>
                          : <span className="text-gray-500">{STATUS_HE[e.approvalStatus] || e.approvalStatus}</span>}
                    </td>
                    <td className="py-2 pl-4 font-medium whitespace-nowrap">
                      {fmtAmount(e.amountGross, e.currency)}
                      {e.currency && e.currency !== 'ILS' && <span className="mr-1 text-xs text-red-600">!</span>}
                    </td>
                    <td className="py-2 pl-4">
                      {e.loyaltyAwarded ? `+${e.loyaltyPointsAwarded}${e.refundReversed ? ' (בוטל)' : ''}` : '—'}
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-500">
                      {e.processingStatus === 'imported_manual' ? 'ייבוא ידני' : 'webhook'}
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-400 font-mono" dir="ltr">{e.externalTransactionId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3 — Manual report import */}
      <section className="border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Upload className="w-4 h-4" style={{ color: GOLD }} />
          <h2 className="font-semibold">ייבוא דוח Nayax Core (CSV)</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          ייצאו דוח עסקאות מ-Nayax Core והעלו כאן. הייבוא רק רושם — לא מזכה נקודות, לא נוגע בארנקים,
          והעלאה חוזרת של אותו דוח בטוחה (כפולים מזוהים לפי מזהה עסקה).
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChosen(f); e.target.value = ''; }}
        />
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={importMutation.isPending}
          className="gap-2 text-[#0a0a0a]"
          style={{ background: `linear-gradient(135deg,${GOLD} 0%,#D9B84C 50%,${GOLD} 100%)` }}
        >
          {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          בחרו קובץ CSV
        </Button>
        {importMutation.data && importMutation.data.warnings.length > 0 && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="font-medium mb-1">אזהרות ייבוא:</div>
            {importMutation.data.warnings.slice(0, 5).map((w, i) => (
              <div key={i}>• {w.warnings.join(' · ')}</div>
            ))}
            {importMutation.data.warnings.length > 5 && <div>…ועוד {importMutation.data.warnings.length - 5}</div>}
          </div>
        )}
      </section>
    </div>
  );
}
