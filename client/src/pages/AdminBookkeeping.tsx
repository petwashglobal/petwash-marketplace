/**
 * הנהלת חשבונות — עמדות (Station Bookkeeping).
 *
 * Per-station + per-bay K9000 financials (gross / VAT / net / washes) from the
 * live Nayax bay ledger, plus station id + maps. CEO 2026-07-24. All Hebrew,
 * canon white/black/gold. Real numbers only; a station awaiting its bay ids
 * says so instead of showing a fake total.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ArrowRight, MapPin, Navigation, Droplets, RefreshCw, Users } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const GOLD = '#D4AF37';
const INK = '#0a0a0a';
const nis = (c: number) => `₪${Math.round((c ?? 0) / 100).toLocaleString('he-IL')}`;

interface Bay { machineId: string; terminalId?: string; label: string; grossCents: number; netCents: number; vatCents: number; washes: number; lastAt: string | null }
interface StationBk {
  code: string; nameHe: string; address: string; city: string; lat: number; lng: number; hoursHe: string; open: boolean;
  maps: { google: string; waze: string }; awaitingBayIds: boolean;
  bays: Bay[]; totals: { grossCents: number; netCents: number; vatCents: number; washes: number };
}
interface Bk {
  ok: boolean; period: string; generatedAt: string; vatNote: string;
  stations: StationBk[];
  orphanMachines: Array<{ machineId: string; grossCents: number; washes: number }>;
  staff: { built: boolean; note: string };
}

const PERIODS = [['today', 'היום'], ['week', '7 ימים'], ['month', '30 יום']] as const;

export default function AdminBookkeeping() {
  const [, go] = useLocation();
  const [period, setPeriod] = useState<string>('month');
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['octopus-bookkeeping', period],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/admin/octopus/bookkeeping?period=${period}`);
      if (!res.ok) throw new Error('bk_failed');
      return res.json() as Promise<Bk>;
    },
    refetchInterval: 120_000,
  });

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#FAFAF7]" data-testid="admin-bookkeeping">
      <div className="border-b bg-white" style={{ borderColor: '#EDE6D2' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => go('/admin/octopus')} className="text-sm text-neutral-500">
              <ArrowRight className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold" style={{ color: INK }}>הנהלת חשבונות — עמדות</h1>
              <p className="text-xs text-neutral-500">נתוני תאים חיים מ־Nayax · ברוטו · מע״מ · נטו</p>
            </div>
          </div>
          <button type="button" onClick={() => refetch()} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: '#E4DCC4', color: INK }}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} style={{ color: GOLD }} /> רענון
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Period toggle */}
        <div className="mb-5 inline-flex rounded-2xl border bg-white p-1" style={{ borderColor: '#EDE6D2' }}>
          {PERIODS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setPeriod(k)}
              className="rounded-xl px-4 py-2 text-sm font-semibold transition"
              style={period === k ? { background: INK, color: 'white' } : { color: '#666' }}
              data-testid={`bk-period-${k}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {(data?.stations ?? []).map((s) => (
            <section key={s.code} className="rounded-3xl border bg-white p-5" style={{ borderColor: '#EDE6D2' }} data-testid={`bk-station-${s.code}`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.open ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                    <h2 className="text-lg font-extrabold" style={{ color: INK }}>{s.nameHe}</h2>
                  </div>
                  <p className="text-xs text-neutral-500">{s.address}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-neutral-400" dir="ltr">{s.code} · {s.hoursHe}</p>
                </div>
                <div className="flex gap-2">
                  <a href={s.maps.google} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#E4DCC4', color: INK }}>
                    <MapPin className="h-3.5 w-3.5" style={{ color: GOLD }} /> מפה
                  </a>
                  <a href={s.maps.waze} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#E4DCC4', color: INK }}>
                    <Navigation className="h-3.5 w-3.5" style={{ color: GOLD }} /> Waze
                  </a>
                </div>
              </div>

              {/* Station totals */}
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tot label="ברוטו" value={nis(s.totals.grossCents)} strong />
                <Tot label="מע״מ" value={nis(s.totals.vatCents)} />
                <Tot label="נטו" value={nis(s.totals.netCents)} />
                <Tot label="שטיפות" value={String(s.totals.washes)} icon />
              </div>

              {/* Per-bay */}
              {s.awaitingBayIds ? (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-neutral-500">
                  עמדה דו-תאית — מזהי המכונות של Nayax יתווספו אוטומטית עם קליטת האירוע הראשון.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <thead>
                      <tr className="text-xs text-neutral-400">
                        <th className="pb-2 font-medium">תא</th>
                        <th className="pb-2 font-medium">מכונה</th>
                        <th className="pb-2 font-medium">ברוטו</th>
                        <th className="pb-2 font-medium">מע״מ</th>
                        <th className="pb-2 font-medium">נטו</th>
                        <th className="pb-2 font-medium">שטיפות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.bays.map((b) => (
                        <tr key={b.machineId} className="border-t" style={{ borderColor: '#F3EEDF' }}>
                          <td className="py-2 font-semibold" style={{ color: INK }}>{b.label}</td>
                          <td className="py-2 font-mono text-[11px] text-neutral-400" dir="ltr">{b.machineId}</td>
                          <td className="py-2 font-semibold" style={{ color: INK }}>{nis(b.grossCents)}</td>
                          <td className="py-2 text-neutral-600">{nis(b.vatCents)}</td>
                          <td className="py-2 text-neutral-600">{nis(b.netCents)}</td>
                          <td className="py-2 text-neutral-600">{b.washes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Orphan machines (reported events, not in registry yet) */}
        {data?.orphanMachines && data.orphanMachines.length > 0 && (
          <section className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">מכונות שדיווחו אך טרם משויכות לעמדה:</p>
            <ul className="mt-1 text-sm text-amber-700">
              {data.orphanMachines.map((m) => (
                <li key={m.machineId} dir="ltr">machine {m.machineId} — {nis(m.grossCents)} · {m.washes} washes</li>
              ))}
            </ul>
          </section>
        )}

        {data?.vatNote && <p className="mt-4 text-xs text-neutral-400">{data.vatNote}</p>}

        {/* HR / staff — honest not-built flag */}
        <section className="mt-4 rounded-3xl border bg-white p-5" style={{ borderColor: '#EDE6D2' }}>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: GOLD }} />
            <h2 className="text-sm font-bold" style={{ color: INK }}>HR / צוות</h2>
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            {data?.staff?.note || 'מודול HR/צוות טרם נבנה — יתווסף עם רשומות עובדים אמיתיות.'}
          </p>
        </section>
      </div>
    </div>
  );
}

function Tot({ label, value, strong, icon }: { label: string; value: string; strong?: boolean; icon?: boolean }) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: '#F0EAD8', background: strong ? '#FFFDF5' : '#fff' }}>
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className={`mt-0.5 flex items-center gap-1 ${strong ? 'text-lg font-extrabold' : 'text-base font-bold'}`} style={{ color: INK }}>
        {icon && <Droplets className="h-4 w-4" style={{ color: GOLD }} />}{value}
      </p>
    </div>
  );
}
