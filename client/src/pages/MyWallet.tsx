import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Plus,
  Ticket,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';
import { useLocation } from 'wouter';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
  unifiedVouchers?: {
    totalPlatformCreditRemainingCents: number;
    totalWashPackagesRemaining: number;
    activeVoucherCount: number;
  };
}

interface ActivityItem {
  id: string;
  type: 'wallet_credit' | 'voucher_ledger';
  event: string;
  description: string;
  amountCents: number | null;
  amountWashes: number | null;
  channel: string | null;
  platform: string | null;
  createdAt: string;
  referenceId: string | null;
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

const CHANNEL_COLORS: Record<string, string> = {
  STATION: 'bg-blue-500',
  WEB: 'bg-purple-500',
  APP: 'bg-green-500',
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
  const { toast } = useToast();
  const [showActivity, setShowActivity] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [nayaxTxId, setNayaxTxId] = useState('');
  const [topUpAmountIls, setTopUpAmountIls] = useState('');

  const { data: walletData, isLoading } = useQuery<{ success: boolean; wallet: WalletSummary }>({
    queryKey: ['/api/credit-wallet/summary'],
  });

  const { data: activityData, isLoading: activityLoading } = useQuery<{ success: boolean; activities: ActivityItem[]; total: number }>({
    queryKey: ['/api/credit-wallet/activity'],
    enabled: showActivity,
  });

  const topUpMutation = useMutation({
    mutationFn: async (body: { amountCents: number; nayaxTxId?: string }) =>
      apiRequest('POST', '/api/credit-wallet/topup', body),
    onSuccess: () => {
      toast({
        title: isHebrew ? 'הארנק נטען בהצלחה!' : 'Wallet topped up!',
        description: isHebrew ? 'היתרה עודכנה' : 'Your balance has been updated',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/credit-wallet/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credit-wallet/activity'] });
      setShowTopUp(false);
      setNayaxTxId('');
      setTopUpAmountIls('');
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'שגיאה' : 'Error',
        description: err?.message || (isHebrew ? 'אירעה שגיאה' : 'An error occurred'),
      });
    },
  });

  const wallet = walletData?.wallet;
  const activities = activityData?.activities || [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/credit-wallet/summary'] });
    if (showActivity) {
      await queryClient.invalidateQueries({ queryKey: ['/api/credit-wallet/activity'] });
    }
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleTopUpSubmit = () => {
    const amountCents = Math.round(parseFloat(topUpAmountIls) * 100);
    if (!topUpAmountIls || isNaN(amountCents) || amountCents < 100) {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'סכום לא תקין' : 'Invalid amount',
        description: isHebrew ? 'הסכום המינימלי הוא ₪1' : 'Minimum amount is ₪1',
      });
      return;
    }
    topUpMutation.mutate({ amountCents, nayaxTxId: nayaxTxId || undefined });
  };

  if (isLoading) return <WalletSkeleton />;

  const tier = wallet?.loyaltyTier || 'bronze';
  const tierInfo = TIER_LABELS[tier] || TIER_LABELS.bronze;
  const uv = wallet?.unifiedVouchers;

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

          {uv && uv.activeVoucherCount > 0 && (
            <Card className="luxury-glass-card mb-5 luxury-animate-slide-up border border-amber-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-gray-800">
                      {isHebrew ? 'שוברים פעילים' : 'Active Vouchers'}
                    </span>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs font-bold">
                    {uv.activeVoucherCount}
                  </Badge>
                </div>
                <div className="space-y-1.5 mb-3">
                  {uv.totalPlatformCreditRemainingCents > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                        {isHebrew ? 'קרדיט פלטפורמה' : 'Platform Credit'}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {formatCurrency(uv.totalPlatformCreditRemainingCents)}
                      </span>
                    </div>
                  )}
                  {uv.totalWashPackagesRemaining > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5 text-blue-500" />
                        {isHebrew ? 'חבילות שטיפה' : 'Wash Packages'}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {uv.totalWashPackagesRemaining} {isHebrew ? 'שטיפות' : 'washes'}
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation('/vouchers')}
                  className="w-full text-amber-700 border-amber-200 hover:bg-amber-50 text-xs h-8"
                >
                  {isHebrew ? 'צפייה בכל השוברים' : 'View All Vouchers'}
                </Button>
              </CardContent>
            </Card>
          )}

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
              onClick={() => setShowTopUp(true)}
              className="w-full h-12 rounded-xl border-2 border-green-300 text-green-700 hover:bg-green-50 font-semibold gap-2"
            >
              <Plus className="w-4 h-4" />
              {isHebrew ? 'טעינת ארנק' : 'Top Up Wallet'}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowActivity(!showActivity)}
              className="w-full h-12 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold gap-2"
            >
              <Clock className="w-4 h-4" />
              {isHebrew ? 'היסטוריית פעולות' : 'Transaction History'}
              {showActivity ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {showActivity && (
            <div className="luxury-animate-slide-up">
              <Card className="luxury-glass-card luxury-shadow-lg">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    {isHebrew ? 'פעולות אחרונות' : 'Recent Activity'}
                  </h3>
                  {activityLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{isHebrew ? 'אין פעולות עדיין' : 'No activity yet'}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activities.slice(0, 30).map((item) => {
                        const isPositive = ['issue', 'refund', 'ISSUED', 'LOAD'].includes(item.event);
                        const txTypeKey = item.event?.toLowerCase();
                        const txType = TX_TYPE_ICONS[txTypeKey] || (isPositive ? TX_TYPE_ICONS.issue : TX_TYPE_ICONS.redeem);
                        const TxIcon = txType.icon;
                        const channelKey = (item.channel || '').toUpperCase();
                        const channelDotColor = CHANNEL_COLORS[channelKey] || 'bg-gray-400';

                        return (
                          <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                                <TxIcon className={`w-4 h-4 ${txType.color}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium text-gray-900">
                                    {item.description || item.event}
                                  </p>
                                  {item.channel && (
                                    <span className={`inline-block w-2 h-2 rounded-full ${channelDotColor}`} title={item.channel} />
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-400">
                                  {item.type === 'voucher_ledger' ? (isHebrew ? 'שובר' : 'Voucher') : (isHebrew ? 'ארנק' : 'Wallet')}
                                  {' • '}
                                  {new Date(item.createdAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-IL')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {item.amountCents != null && (
                                <span className={`text-sm font-semibold block ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                                  {isPositive ? '+' : '-'}{formatCurrency(Math.abs(item.amountCents))}
                                </span>
                              )}
                              {item.amountWashes != null && item.amountWashes !== 0 && (
                                <span className="text-xs text-gray-400 block">
                                  {item.amountWashes > 0 ? '+' : ''}{item.amountWashes} {isHebrew ? 'שטיפות' : 'washes'}
                                </span>
                              )}
                            </div>
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

      <Dialog open={showTopUp} onOpenChange={setShowTopUp}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              {isHebrew ? 'טעינת ארנק' : 'Top Up Wallet'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-800 leading-relaxed">
              <p className="font-semibold mb-1">{isHebrew ? 'להטענה באמצעות Nayax:' : 'To top up via Nayax:'}</p>
              <p>{isHebrew
                ? 'גשו לתחנת K9000, בחרו "טעינת ארנק", שלמו והזינו את קוד האישור'
                : 'Visit a K9000 station, select "Wallet Top-Up", pay, then enter the confirmation code below'
              }</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nayax-tx-id" className="text-sm font-medium text-gray-700">
                {isHebrew ? 'קוד אישור Nayax' : 'Nayax Confirmation Code'}
              </Label>
              <Input
                id="nayax-tx-id"
                value={nayaxTxId}
                onChange={(e) => setNayaxTxId(e.target.value)}
                placeholder={isHebrew ? 'הזן קוד אישור' : 'Enter confirmation code'}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topup-amount" className="text-sm font-medium text-gray-700">
                {isHebrew ? 'סכום לטעינה ₪' : 'Top-Up Amount ₪'}
              </Label>
              <Input
                id="topup-amount"
                type="number"
                min="1"
                step="0.01"
                value={topUpAmountIls}
                onChange={(e) => setTopUpAmountIls(e.target.value)}
                placeholder={isHebrew ? 'לדוגמה: 50' : 'e.g. 50'}
                className="h-11"
              />
            </div>
            <Button
              onClick={handleTopUpSubmit}
              disabled={topUpMutation.isPending}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl gap-2"
            >
              {topUpMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {isHebrew ? 'טען ארנק' : 'Top Up'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
