import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet, ArrowDownRight, ArrowUpRight, Clock, CheckCircle2,
  XCircle, AlertTriangle, Download, Building2, ChevronRight,
  TrendingUp, FileText, Info,
} from 'lucide-react';

type Platform = 'all' | 'petsitter' | 'walkpet' | 'petwash' | 'academy';

const TX_STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  released: { label: 'Released', color: '#065f46', bg: '#d1fae5' },
  pending: { label: 'Pending', color: '#92400e', bg: '#fef3c7' },
  processing: { label: 'Processing', color: '#1e40af', bg: '#dbeafe' },
  refunded: { label: 'Refunded', color: '#991b1b', bg: '#fee2e2' },
  disputed: { label: 'Disputed', color: '#7c3aed', bg: '#f5f3ff' },
};

function fetchWithAuth(url: string) {
  return fetch(url, { credentials: 'include' }).then(r => r.json());
}

export default function POSWallet({ activePlatform }: { activePlatform: Platform }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'payout' | 'reports'>('overview');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const { data: earnings } = useQuery({
    queryKey: ['/api/provider-dashboard/earnings'],
    queryFn: () => fetchWithAuth('/api/provider-dashboard/earnings'),
  });

  const { data: bookingsData } = useQuery({
    queryKey: ['/api/provider-dashboard/bookings', 'completed', activePlatform, 1],
    queryFn: () => fetchWithAuth('/api/provider-dashboard/bookings?status=completed&page=1&limit=20'),
  });

  const available = (earnings as any)?.availableBalance ?? 0;
  const pending = (earnings as any)?.pendingBalance ?? 0;
  const processing = (earnings as any)?.processing ?? 0;
  const monthTotal = (earnings as any)?.monthTotal ?? 0;
  const platformFeeRate = 0.18;
  const vatRate = 0.18;
  const bookings: any[] = (bookingsData as any)?.bookings || [];

  const handleRequestPayout = async () => {
    if (!payoutAmount || !iban) { toast({ title: 'Fill in all payout fields', variant: 'destructive' }); return; }
    setPayoutLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setPayoutLoading(false);
    toast({ title: 'Payout requested', description: `₪${payoutAmount} will be transferred within 3 business days.` });
    setPayoutAmount('');
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-5">
      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 opacity-80" />
            <span className="text-xs font-medium opacity-80">Available Balance</span>
          </div>
          <p className="text-3xl font-bold mb-3">₪{(available / 100).toFixed(2)}</p>
          <button onClick={() => setActiveTab('payout')}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
            Request Payout →
          </button>
        </div>
        {[
          { label: 'Pending (Escrow)', value: pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', sub: '48h hold after job' },
          { label: 'This Month', value: monthTotal, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'Gross earnings' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-lg font-bold text-gray-900">₪{(card.value / 100).toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'transactions', label: 'Transactions' },
          { id: 'payout', label: 'Payout' },
          { id: 'reports', label: 'Reports' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
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
                  <li>• Platform fee ({(platformFeeRate * 100).toFixed(0)}%) deducted + VAT 18% on fee only</li>
                  <li>• Remaining → your available balance</li>
                  <li>• Request payout → 3 business days to bank</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Fee breakdown example</p>
            <div className="space-y-2">
              {[
                { label: 'Client pays', value: '₪100.00', color: 'text-gray-900' },
                { label: 'Platform fee (18%)', value: '-₪18.00', color: 'text-red-600' },
                { label: 'VAT on fee (18%)', value: '-₪3.24', color: 'text-red-600' },
                { label: 'Your payout', value: '₪78.76', color: 'text-green-700', bold: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-none">
                  <span className="text-gray-600">{row.label}</span>
                  <span className={`${row.color} ${row.bold ? 'font-bold' : 'font-medium'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">Your tax obligations</p>
            <p className="text-xs text-amber-700">As an independent provider (Osek Patur/Murshe), you are responsible for reporting your income to Israeli Tax Authority. The platform provides monthly summaries to assist you.</p>
          </div>
        </div>
      )}

      {/* Transactions */}
      {activeTab === 'transactions' && (
        <div className="space-y-2">
          {bookings.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No completed transactions yet</p>
            </div>
          ) : bookings.map((b: any, i: number) => {
            const gross = b.amount || 0;
            const fee = Math.round(gross * platformFeeRate);
            const vat = Math.round(fee * vatRate);
            const net = gross - fee - vat;
            const status = TX_STATUS_STYLES[b.paymentStatus || 'released'] || TX_STATUS_STYLES.released;
            return (
              <div key={b.id || i} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{b.clientName || 'Client'}</p>
                    <p className="text-xs text-gray-500">{b.serviceName || 'Service'} · {b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) : 'לא נקבע'}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500">Gross</p>
                    <p className="font-semibold text-gray-900">₪{(gross / 100).toFixed(2)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-red-500">Fee+VAT</p>
                    <p className="font-semibold text-red-700">-₪{((fee + vat) / 100).toFixed(2)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-green-600">Net</p>
                    <p className="font-bold text-green-800">₪{(net / 100).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payout request */}
      {activeTab === 'payout' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" /> Bank Account Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Bank Name</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. Bank Hapoalim"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">IBAN / Account Number</label>
                <input type="text" value={iban} onChange={e => setIban(e.target.value)}
                  placeholder="IL00 0000 0000 0000 0000 000"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400 font-mono" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Request Payout</h3>
            <p className="text-xs text-gray-500 mb-3">Available: <strong className="text-green-700">₪{(available / 100).toFixed(2)}</strong></p>
            <div className="flex gap-3">
              <input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)}
                placeholder="Amount ₪"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
              <button onClick={() => setPayoutAmount(String((available / 100).toFixed(2)))}
                className="px-3 py-2.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-200 transition-colors">
                Max
              </button>
            </div>
            <button onClick={handleRequestPayout} disabled={payoutLoading}
              className="w-full mt-3 py-3 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
              {payoutLoading ? 'Processing...' : '💸 Request Payout'}
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-2">Transfers take 3 business days</p>
          </div>
        </div>
      )}

      {/* Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Monthly Report</h3>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => setSelectedMonth(i)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedMonth === i ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Total jobs', value: `${bookings.length}` },
                { label: 'Gross earnings', value: `₪${(monthTotal / 100).toFixed(0)}` },
                { label: 'Platform fees', value: `₪${(monthTotal * platformFeeRate / 100).toFixed(0)}` },
                { label: 'Net payout', value: `₪${(monthTotal * (1 - platformFeeRate * (1 + vatRate)) / 100).toFixed(0)}` },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => toast({ title: 'CSV report downloaded' })}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => toast({ title: 'Excel report downloaded' })}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
