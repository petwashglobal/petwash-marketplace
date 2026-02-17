import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wallet,
  CreditCard,
  Droplets,
  Star,
  Gift,
  QrCode,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';
import { useLocation } from 'wouter';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';

interface WalletSummary {
  walletId: string;
  userId: string;
  egiftBalanceCents: number;
  washPackageCredits: number;
  loyaltyPointsBalance: number;
  promoBalanceCents: number;
  referralBalanceCents: number;
  totalCreditsValueCents: number;
  loyaltyTier: string;
  tierPointsThisYear: number;
}

interface CreditTransaction {
  transactionId: string;
  creditType: string;
  transactionType: string;
  amountCents: number | null;
  amountUnits: number | null;
  description: string;
  platform: string;
  createdAt: string;
}

const formatCurrency = (cents: number) =>
  `₪${(cents / 100).toLocaleString('en-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TIER_LABELS: Record<string, { en: string; he: string; emoji: string }> = {
  bronze: { en: 'Bronze', he: 'ארד', emoji: '🥉' },
  silver: { en: 'Silver', he: 'כסף', emoji: '🥈' },
  gold: { en: 'Gold', he: 'זהב', emoji: '🥇' },
  platinum: { en: 'Platinum', he: 'פלטינה', emoji: '💎' },
  diamond: { en: 'Diamond', he: 'יהלום', emoji: '💠' },
  emerald: { en: 'Emerald', he: 'אמרלד', emoji: '💚' },
  royal: { en: 'Royal', he: 'מלכותי', emoji: '👑' },
};

const TX_TYPE_ICONS: Record<string, { icon: typeof ArrowUpRight; color: string }> = {
  issue: { icon: ArrowUpRight, color: 'text-green-600' },
  redeem: { icon: ArrowDownRight, color: 'text-red-500' },
  refund: { icon: ArrowUpRight, color: 'text-blue-600' },
  expire: { icon: Clock, color: 'text-gray-400' },
};

const CREDIT_TYPE_LABELS: Record<string, { en: string; he: string }> = {
  egift: { en: 'E-Gift', he: 'מתנה דיגיטלית' },
  wash_package: { en: 'Wash Package', he: 'חבילת שטיפה' },
  loyalty_points: { en: 'Loyalty Points', he: 'נקודות נאמנות' },
  promo_credit: { en: 'Promo Credit', he: 'קרדיט מבצע' },
  referral: { en: 'Referral', he: 'הפניה' },
};

function WalletSkeleton() {
  return (
    <Layout>
      <div className="min-h-screen bg-white py-6 px-4">
        <div className="max-w-lg mx-auto space-y-5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    </Layout>
  );
}

export default function MyWallet() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const [showTransactions, setShowTransactions] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: walletData, isLoading } = useQuery<{ success: boolean; wallet: WalletSummary }>({
    queryKey: ['/api/credit-wallet/summary'],
  });

  const { data: txData, isLoading: txLoading } = useQuery<{ success: boolean; transactions: CreditTransaction[] }>({
    queryKey: ['/api/credit-wallet/transactions'],
    enabled: showTransactions,
  });

  const wallet = walletData?.wallet;
  const transactions = txData?.transactions || [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/credit-wallet/summary'] });
    if (showTransactions) {
      await queryClient.invalidateQueries({ queryKey: ['/api/credit-wallet/transactions'] });
    }
    setTimeout(() => setIsRefreshing(false), 800);
  };

  if (isLoading) return <WalletSkeleton />;

  const tier = wallet?.loyaltyTier || 'bronze';
  const tierInfo = TIER_LABELS[tier] || TIER_LABELS.bronze;

  return (
    <Layout>
      <div className="min-h-screen bg-white py-6 px-4">
        <div className="max-w-lg mx-auto">

          <div className="flex items-center justify-between mb-6 luxury-animate-fade-in">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" />
                {isHebrew ? 'הארנק שלי' : 'My Wallet'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {isHebrew ? '⁦Pet Wash™⁩ • קרדיטים ויתרות' : '⁦Pet Wash™⁩ • Credits & Balances'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-full"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <Card className="luxury-glass-card luxury-shadow-lg mb-5 luxury-animate-slide-up overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">
                  {isHebrew ? 'סך הקרדיטים' : 'Total Credits Value'}
                </span>
                <Badge className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold">
                  {tierInfo.emoji} {isHebrew ? tierInfo.he : tierInfo.en}
                </Badge>
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-1">
                {formatCurrency(wallet?.totalCreditsValueCents || 0)}
              </div>
              <p className="text-xs text-gray-400">
                {isHebrew ? `${wallet?.tierPointsThisYear?.toLocaleString() || 0} נקודות השנה` : `${wallet?.tierPointsThisYear?.toLocaleString() || 0} points this year`}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 mb-5 luxury-animate-slide-up">
            <Card className="luxury-glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs text-gray-500">
                    {isHebrew ? 'מתנה דיגיטלית' : 'E-Gift'}
                  </span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(wallet?.egiftBalanceCents || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-xs text-gray-500">
                    {isHebrew ? 'חבילות שטיפה' : 'Wash Packages'}
                  </span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {wallet?.washPackageCredits || 0}
                  <span className="text-sm font-normal text-gray-400 ml-1">
                    {isHebrew ? 'שטיפות' : 'washes'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                    <Star className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-xs text-gray-500">
                    {isHebrew ? 'נקודות נאמנות' : 'Loyalty Points'}
                  </span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {(wallet?.loyaltyPointsBalance || 0).toLocaleString()}
                  <span className="text-sm font-normal text-gray-400 ml-1">pts</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  ≈ {formatCurrency((wallet?.loyaltyPointsBalance || 0) * 10)}
                </p>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Gift className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-xs text-gray-500">
                    {isHebrew ? 'קרדיט מבצע' : 'Promo Credits'}
                  </span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency((wallet?.promoBalanceCents || 0) + (wallet?.referralBalanceCents || 0))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3 mb-6 luxury-animate-slide-up">
            <Button
              onClick={() => setLocation('/wallet/redeem')}
              className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-base font-semibold gap-3"
            >
              <QrCode className="w-5 h-5" />
              {isHebrew ? 'מימוש בתחנת K9000' : 'Redeem at K9000 Station'}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowTransactions(!showTransactions)}
              className="w-full h-12 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold gap-2"
            >
              <Clock className="w-4 h-4" />
              {isHebrew ? 'היסטוריית פעולות' : 'Transaction History'}
              {showTransactions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {showTransactions && (
            <div className="luxury-animate-slide-up">
              <Card className="luxury-glass-card luxury-shadow-lg">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    {isHebrew ? 'פעולות אחרונות' : 'Recent Transactions'}
                  </h3>
                  {txLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{isHebrew ? 'אין פעולות עדיין' : 'No transactions yet'}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.slice(0, 20).map((tx) => {
                        const txType = TX_TYPE_ICONS[tx.transactionType] || TX_TYPE_ICONS.issue;
                        const TxIcon = txType.icon;
                        const creditLabel = CREDIT_TYPE_LABELS[tx.creditType] || { en: tx.creditType, he: tx.creditType };
                        const isPositive = tx.transactionType === 'issue' || tx.transactionType === 'refund';
                        const amount = tx.amountCents != null
                          ? `${isPositive ? '+' : '-'}${formatCurrency(Math.abs(tx.amountCents))}`
                          : tx.amountUnits != null
                            ? `${isPositive ? '+' : '-'}${Math.abs(tx.amountUnits)} ${isHebrew ? 'יחידות' : 'units'}`
                            : '';

                        return (
                          <div key={tx.transactionId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center`}>
                                <TxIcon className={`w-4 h-4 ${txType.color}`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {isHebrew ? creditLabel.he : creditLabel.en}
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  {tx.description || tx.platform} • {new Date(tx.createdAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-IL')}
                                </p>
                              </div>
                            </div>
                            <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                              {amount}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mt-8 text-center text-xs text-gray-400 pb-4">
            <p>⁦Pet Wash™⁩ Wallet • {isHebrew ? 'מאובטח ומוצפן' : 'Secured & Encrypted'}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
