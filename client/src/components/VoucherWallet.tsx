import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Gift, Plus, Loader2, Calendar, Coins, History, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { trackVoucherClaimed } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';

interface Voucher {
  id: string;
  codeLast4: string;
  type: 'FIXED' | 'STORED_VALUE';
  currency: string;
  remainingAmount: string;
  initialAmount: string;
  status: 'ACTIVE' | 'PARTIALLY_REDEEMED' | 'FULLY_REDEEMED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string | null;
  createdAt: string;
  activatedAt: string | null;
}

interface Redemption {
  id: string;
  amount: string;
  redeemedAt: string;
  locationId?: string;
}

export function VoucherWallet() {
  const { t, language, dir } = useLanguage();
  const isRTL = dir === 'rtl';
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [quickClaimCode, setQuickClaimCode] = useState('');
  const [expandedVoucher, setExpandedVoucher] = useState<string | null>(null);

  const { data: vouchersData, isLoading } = useQuery({
    queryKey: ['/api/vouchers/my-vouchers'],
    retry: 1
  });

  const { data: redemptionsData } = useQuery({
    queryKey: ['/api/vouchers', expandedVoucher],
    enabled: !!expandedVoucher,
    retry: 1
  });

  const claimMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch('/api/vouchers/claim', {
        method: 'POST',
        body: JSON.stringify({ code }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Claim failed');
      }
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers/my-vouchers'] });
      setQuickClaimCode('');
      
      // Track GA4 event
      if (user?.uid && data.voucherId && data.initialAmount) {
        trackVoucherClaimed(
          user.uid,
          data.voucherId,
          parseFloat(data.initialAmount),
          'ILS'
        );
      }
      
      toast({
        title: isRTL ? '✅ השובר נקלט בהצלחה' : '✅ Voucher Claimed',
        description: isRTL ? 'השובר הוסף לארנק שלך' : 'Voucher added to your wallet'
      });
    },
    onError: (error: any) => {
      toast({
        title: isRTL ? '❌ שגיאה' : '❌ Error',
        description: error.message || (isRTL ? 'לא ניתן לממש שובר' : 'Could not claim voucher'),
        variant: 'destructive'
      });
    }
  });

  const getStatusBadge = (status: Voucher['status']) => {
    const variants: Record<Voucher['status'], { label: string; className: string }> = {
      ACTIVE: {
        label: isRTL ? 'פעיל' : 'Active',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      },
      PARTIALLY_REDEEMED: {
        label: isRTL ? 'נוצל חלקית' : 'Partially Redeemed',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      },
      FULLY_REDEEMED: {
        label: isRTL ? 'נוצל במלואו' : 'Fully Redeemed',
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      },
      EXPIRED: {
        label: isRTL ? 'פג תוקף' : 'Expired',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      },
      CANCELLED: {
        label: isRTL ? 'מבוטל' : 'Cancelled',
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      }
    };
    const variant = variants[status];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const vouchers: Voucher[] = (vouchersData as any)?.vouchers || [];
  const redemptions: Redemption[] = (redemptionsData as any)?.redemptions || [];

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Gift className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          {isRTL ? '💳 הארנק שלי' : '💳 My Wallet'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Claim Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-sm text-purple-900 dark:text-purple-100 mb-3">
            {isRTL ? '⚡ מימוש מהיר' : '⚡ Quick Claim'}
          </h3>
          <div className="flex gap-2">
            <Input
              type="text"
              value={quickClaimCode}
              onChange={(e) => setQuickClaimCode(e.target.value.toUpperCase())}
              placeholder={isRTL ? 'הזן קוד שובר' : 'Enter voucher code'}
              className="flex-1 font-mono uppercase"
              maxLength={20}
              disabled={claimMutation.isPending}
              data-testid="input-quick-claim"
            />
            <Button
              onClick={() => claimMutation.mutate(quickClaimCode.trim())}
              disabled={!quickClaimCode.trim() || claimMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              data-testid="button-quick-claim"
            >
              {claimMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>
          <Button
            variant="link"
            size="sm"
            onClick={() => setLocation('/claim')}
            className="text-purple-600 dark:text-purple-400 mt-2 px-0"
            data-testid="link-full-claim-page"
          >
            {isRTL ? 'או עבור לעמוד מימוש מלא ←' : 'Or go to full claim page →'}
          </Button>
        </div>

        <Separator />

        {/* Vouchers List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {isRTL ? `השוברים שלי (${vouchers.length})` : `My Vouchers (${vouchers.length})`}
          </h3>

          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600" />
              <p className="text-sm text-gray-500 mt-2">{isRTL ? 'טוען...' : 'Loading...'}</p>
            </div>
          ) : vouchers.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
              <Gift className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {isRTL ? 'אין לך שוברים עדיין' : 'No vouchers yet'}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {isRTL ? 'הזן קוד למעלה או בקר את דף מימוש השוברים' : 'Enter a code above or visit the claim page'}
              </p>
            </div>
          ) : (
            vouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                        ****{voucher.codeLast4}
                      </span>
                      {getStatusBadge(voucher.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {isRTL ? 'יתרה:' : 'Balance:'} ₪{voucher.remainingAmount}
                      </span>
                      {voucher.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(voucher.expiresAt).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedVoucher(expandedVoucher === voucher.id ? null : voucher.id)}
                    data-testid={`button-expand-${voucher.id}`}
                  >
                    <ChevronRight className={`w-4 h-4 transition-transform ${expandedVoucher === voucher.id ? 'rotate-90' : ''}`} />
                  </Button>
                </div>

                {/* Expanded Details */}
                {expandedVoucher === voucher.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">{isRTL ? 'סכום ראשוני:' : 'Initial Amount:'}</p>
                        <p className="font-semibold">₪{voucher.initialAmount}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">{isRTL ? 'סוג:' : 'Type:'}</p>
                        <p className="font-semibold">{voucher.type === 'FIXED' ? (isRTL ? 'קבוע' : 'Fixed') : (isRTL ? 'ערך מאוחסן' : 'Stored Value')}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">{isRTL ? 'נוצר:' : 'Created:'}</p>
                        <p className="font-semibold text-xs">{new Date(voucher.createdAt).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}</p>
                      </div>
                      {voucher.activatedAt && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">{isRTL ? 'הופעל:' : 'Activated:'}</p>
                          <p className="font-semibold text-xs">{new Date(voucher.activatedAt).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}</p>
                        </div>
                      )}
                    </div>

                    {/* Redemption History */}
                    {redemptions.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                          <History className="w-3 h-3" />
                          {isRTL ? 'היסטוריית פדיון' : 'Redemption History'}
                        </h4>
                        <div className="space-y-2">
                          {redemptions.map((redemption) => (
                            <div key={redemption.id} className="flex justify-between items-center text-xs">
                              <span className="text-gray-600 dark:text-gray-400">
                                {new Date(redemption.redeemedAt).toLocaleString(isRTL ? 'he-IL' : 'en-US')}
                              </span>
                              <span className="font-semibold text-red-600 dark:text-red-400">-₪{redemption.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
