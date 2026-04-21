import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet, Clock, TrendingUp, TrendingDown, CheckCircle2,
  Download, Building2, FileText, Info, Loader2, BadgeCheck,
} from 'lucide-react';

type Platform = 'all' | 'petsitter' | 'walkpet' | 'petwash' | 'academy';

const PAYOUT_STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  paid:     { label: 'Paid',       color: '#065f46', bg: '#d1fae5' },
  pending:  { label: 'Pending',    color: '#92400e', bg: '#fef3c7' },
  processing: { label: 'Processing', color: '#1e40af', bg: '#dbeafe' },
  refunded: { label: 'Refunded',   color: '#991b1b', bg: '#fee2e2' },
};

const PLATFORM_LABELS: Record<string, string> = {
  petsitter: 'PetSitter', walkpet: 'Walk My Pet', petwash: 'PetWash', academy: 'Academy',
};

const FMT_ILS = (n: number) => `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fetchWithAuth(url: string) {
  return fetch(url, { credentials: 'include' }).then(r => r.json());
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyEarnings() {
  return (
    <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
      <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-500">No completed jobs yet</p>
      <p className="text-xs text-gray-400 mt-1">Earnings appear here once your first booking is marked complete</p>
    </div>
  );
}

// ─── Single Payout Row ────────────────────────────────────────────────────────
function PayoutRow({ p }: { p: any }) {
  const status = PAYOUT_STATUS_STYLES[p.payoutStatus] || PAYOUT_STATUS_STYLES.pending;
  const date = p.date ? new Date(p.date).toLocaleDateString('en-IL', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {p.serviceType ? p.serviceType.replace(/_/g, ' ') : 'Service'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {p.bookingNumber && <span className="font-mono">{p.bookingNumber}</span>}
            {p.platformId && <span className="ml-2 text-gray-400">{PLATFORM_LABELS[p.platformId] || p.platformId}</span>}
            <span className="ml-2">{date}</span>
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0" style={{ background: status.bg, color: status.color }}>
          {status.label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg p-2 text-xs">
          <p className="text-gray-500">Gross</p>
          <p className="font-semibold text-gray-900">{FMT_ILS(p.gross ?? p.amount ?? 0)}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-xs">
          <p className="text-red-500">Platform fee</p>
          <p className="font-semibold text-red-700">-{FMT_ILS(p.platformFee ?? 0)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2 text-xs">
          <p className="text-green-600">Your net</p>
          <p className="font-bold text-green-800">{FMT_ILS(p.amount ?? 0)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function POSWallet({ activePlatform }: { activePlatform: Platform }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'payout' | 'reports'>('overview');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  // Real earnings data from API
  const { data: earningsData, isLoading: earningsLoading } = useQuery({
    queryKey: ['/api/provider-dashboard/v2/earnings'],
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/earnings'),
  });

  // Correct field access — API returns { success, earnings: { ... } }
  const e = (earningsData as any)?.earnings;
  const thisWeek   = e?.thisWeekEarnings  ?? null;
  const thisMonth  = e?.thisMonthEarnings ?? null;
  const pending    = e?.pendingPayouts    ?? null;
  const paid       = e?.paidPayouts       ?? null;
  const total      = e?.totalEarnings     ?? null;
  const lastMonth  = e?.lastMonthEarnings ?? null;
  const totalJobs  = e?.totalJobs         ?? 0;
  const recentPayouts: any[] = e?.recentPayouts ?? [];

  const hasAnyEarnings = total !== null && total > 0;

  const handleRequestPayout = async () => {
    if (!payoutAmount || !iban) { toast({ title: 'Fill in all payout fields', variant: 'destructive' }); return; }
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: 'Enter a valid payout amount', variant: 'destructive' }); return; }
    setPayoutLoading(true);
    try {
      const res = await fetch('/api/provider-dashboard/v2/payout-request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountIls: amount, iban, bankName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Payout request failed');
      toast({ title: 'Payout request submitted', description: `₪${payoutAmount} request received. Processing within 3 business days.` });
      setPayoutAmount('');
      setIban('');
      setBankName('');
    } catch (err: any) {
      toast({ title: 'Payout request failed', description: err.message || 'Please try again', variant: 'destructive' });
    } finally {
      setPayoutLoading(false);
    }
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-4">

      {/* ── Summary strip — 4 real tiles ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Hero tile — paid out (money actually released) */}
        <div className="col-span-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 opacity-80" />
            <span className="text-xs font-medium opacity-80">Released to You (All Time)</span>
          </div>
          {earningsLoading ? (
            <div className="h-10 flex items-center"><Loader2 className="w-5 h-5 animate-spin opacity-60" /></div>
          ) : (
            <p className="text-3xl font-bold mb-3">{paid !== null ? FMT_ILS(paid) : '—'}</p>
          )}
          <button onClick={() => setActiveTab('payout')}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
            Request Payout →
          </button>
        </div>

        {/* This week */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          {earningsLoading ? <div className="h-7 bg-white rounded animate-pulse mb-1" /> : (
            <p className="text-xl font-bold text-gray-900">{thisWeek !== null ? FMT_ILS(thisWeek) : '—'}</p>
          )}
          <p className="text-xs text-gray-500">This week</p>
        </div>

        {/* This month */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mb-2">
            <BadgeCheck className="w-4 h-4 text-green-600" />
          </div>
          {earningsLoading ? <div className="h-7 bg-white rounded animate-pulse mb-1" /> : (
            <p className="text-xl font-bold text-gray-900">{thisMonth !== null ? FMT_ILS(thisMonth) : '—'}</p>
          )}
          <p className="text-xs text-gray-500">This month</p>
        </div>

        {/* Pending (in escrow) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center mb-2">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          {earningsLoading ? <div className="h-7 bg-white rounded animate-pulse mb-1" /> : (
            <p className="text-xl font-bold text-gray-900">{pending !== null ? FMT_ILS(pending) : '—'}</p>
          )}
          <p className="text-xs text-gray-500">Pending (48h hold)</p>
        </div>

        {/* Last month */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mb-2">
            <TrendingDown className="w-4 h-4 text-gray-500" />
          </div>
          {earningsLoading ? <div className="h-7 bg-white rounded animate-pulse mb-1" /> : (
            <p className="text-xl font-bold text-gray-900">{lastMonth !== null ? FMT_ILS(lastMonth) : '—'}</p>
          )}
          <p className="text-xs text-gray-500">Last month</p>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex bg-white rounded-xl p-1 gap-1">
        {[
          { id: 'overview',      label: 'Overview' },
          { id: 'transactions',  label: 'Earnings' },
          { id: 'payout',        label: 'Payout' },
          { id: 'reports',       label: 'Reports' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-900">How your wallet works</p>
                <ul className="text-xs text-blue-800 mt-1 space-y-1">
                  <li>• Client pays → funds enter escrow</li>
                  <li>• Job completed → 48h review period</li>
                  <li>• Platform commission (15%) deducted + VAT 18% on commission only</li>
                  <li>• Remaining → released to your balance</li>
                  <li>• Request payout → 3 business days to bank</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Fee breakdown example</p>
            <div className="space-y-2">
              {[
                { label: 'Client pays',           value: '₪100.00', color: 'text-gray-900', bold: false },
                { label: 'Platform commission (15%)', value: '-₪15.00', color: 'text-red-600', bold: false },
                { label: 'VAT on commission (18%)', value: '-₪2.70', color: 'text-red-600', bold: false },
                { label: 'Your net payout',        value: '₪82.30', color: 'text-green-700', bold: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-none">
                  <span className="text-gray-600 text-xs">{row.label}</span>
                  <span className={`text-xs ${row.color} ${row.bold ? 'font-bold' : 'font-medium'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {hasAnyEarnings && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Your all-time summary</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total jobs',     value: `${totalJobs}` },
                  { label: 'Total earned',   value: total !== null ? FMT_ILS(total) : '—' },
                  { label: 'Pending payout', value: pending !== null ? FMT_ILS(pending) : '—' },
                  { label: 'Total paid out', value: paid !== null ? FMT_ILS(paid) : '—' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">{stat.label}</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">Your tax obligations</p>
            <p className="text-xs text-amber-700">As an independent provider (Osek Patur/Murshe), you are responsible for reporting income to Israeli Tax Authority. Monthly summaries are available in the Reports tab.</p>
          </div>
        </div>
      )}

      {/* ── Earnings (Transactions) tab ───────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div className="space-y-2">
          {earningsLoading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-28 bg-white rounded-xl animate-pulse" />)
          ) : !hasAnyEarnings ? (
            <EmptyEarnings />
          ) : recentPayouts.length === 0 ? (
            <EmptyEarnings />
          ) : (
            <>
              <p className="text-xs text-gray-400 font-medium px-1">Last {recentPayouts.length} completed jobs</p>
              {recentPayouts.map((p: any, i: number) => (
                <PayoutRow key={p.bookingNumber || i} p={p} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Payout request ────────────────────────────────────────────── */}
      {activeTab === 'payout' && (
        <div className="space-y-4">
          {!hasAnyEarnings && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
              <Wallet className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No balance to withdraw yet</p>
              <p className="text-xs text-gray-400 mt-1">Complete your first job to earn your first payout</p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" /> Bank Account Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Bank Name</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. Bank Hapoalim, Leumi, Discount"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Account Number</label>
                <input type="text" value={iban} onChange={e => setIban(e.target.value)}
                  placeholder="Branch-Account number"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400 font-mono" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Request Payout</h3>
            <p className="text-xs text-gray-500 mb-3">
              Available to withdraw: <strong className="text-green-700">{paid !== null ? FMT_ILS(paid) : '₪0.00'}</strong>
            </p>
            <div className="flex gap-3 mb-3">
              <input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)}
                placeholder="Amount ₪"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
              <button onClick={() => setPayoutAmount(String(paid ?? 0))}
                className="px-3 py-2.5 bg-white text-gray-700 text-xs font-medium rounded-xl hover:bg-white transition-colors">
                Max
              </button>
            </div>
            <button onClick={handleRequestPayout} disabled={payoutLoading || !hasAnyEarnings}
              className="w-full py-3 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {payoutLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : 'Request Payout'}
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-2">Transfers take 1–3 business days · Minimum ₪100</p>
          </div>
        </div>
      )}

      {/* ── Reports tab ──────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Monthly Summary</h3>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => setSelectedMonth(i)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedMonth === i ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-white'
                  }`}>
                  {m}
                </button>
              ))}
            </div>

            {!hasAnyEarnings ? (
              <div className="bg-white rounded-xl p-5 text-center">
                <p className="text-xs text-gray-400">No data for {MONTHS[selectedMonth]} yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Total jobs',    value: `${totalJobs}` },
                  { label: 'Gross revenue', value: thisMonth !== null ? FMT_ILS(thisMonth) : '—' },
                  { label: 'Pending payout', value: pending !== null ? FMT_ILS(pending) : '—' },
                  { label: 'Paid out',      value: paid !== null ? FMT_ILS(paid) : '—' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">{stat.label}</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => toast({ title: 'Report exported', description: `${MONTHS[selectedMonth]} CSV ready` })}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-white transition-colors">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => toast({ title: 'Report exported', description: `${MONTHS[selectedMonth]} Excel ready` })}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-white transition-colors">
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
