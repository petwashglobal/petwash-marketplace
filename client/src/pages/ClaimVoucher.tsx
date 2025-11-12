import { useState } from 'react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/lib/languageStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Gift, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { trackVoucherClaimed } from '@/lib/analytics';

export default function ClaimVoucher() {
  const { t, language, dir } = useLanguage();
  const isRTL = dir === 'rtl';
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [voucherCode, setVoucherCode] = useState('');
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimedVoucher, setClaimedVoucher] = useState<any>(null);

  const claimMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!user) {
        throw new Error('Please sign in to claim vouchers');
      }
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
    onSuccess: (data) => {
      setClaimedVoucher(data);
      setClaimSuccess(true);
      
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
        title: t('claim.success'),
        description: t('claim.successMessage'),
        variant: 'default'
      });
    },
    onError: (error: any) => {
      toast({
        title: t('claim.error'),
        description: error.message || t('claim.errorMessage'),
        variant: 'destructive'
      });
    }
  });

  const handleClaim = () => {
    if (!user) {
      toast({
        title: t('claim.signInRequired'),
        description: t('claim.signInMessage'),
        variant: 'destructive'
      });
      setLocation('/signin');
      return;
    }

    if (!voucherCode.trim()) {
      toast({
        title: t('claim.invalidCode'),
        description: t('claim.enterCode'),
        variant: 'destructive'
      });
      return;
    }

    claimMutation.mutate(voucherCode.trim());
  };

  if (claimSuccess && claimedVoucher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 md:p-12 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-2 border-green-200 dark:border-green-800">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mb-4">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                {isRTL ? '✅ השובר נקלט בהצלחה!' : '✅ Voucher Claimed Successfully!'}
              </h1>
              
              <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6 space-y-3">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  {isRTL ? 'פרטי השובר' : 'Voucher Details'}
                </p>
                <div className="space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">
                      {isRTL ? 'קוד (4 ספרות אחרונות):' : 'Code (Last 4 digits):'}
                    </span>
                    <span className="font-mono font-bold text-green-700 dark:text-green-400">
                      ****{claimedVoucher.codeLast4}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">
                      {isRTL ? 'יתרה:' : 'Balance:'}
                    </span>
                    <span className="font-bold text-green-700 dark:text-green-400">
                      ₪{claimedVoucher.remainingAmount}
                    </span>
                  </div>
                  {claimedVoucher.expiresAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">
                        {isRTL ? 'תוקף:' : 'Valid Until:'}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(claimedVoucher.expiresAt).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-400">
                {isRTL 
                  ? 'השובר הוסף לארנק הדיגיטלי שלך ומוכן לשימוש'
                  : 'Your voucher has been added to your digital wallet and is ready to use'}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button 
                  onClick={() => setLocation('/dashboard')}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  data-testid="button-view-wallet"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  {isRTL ? 'צפייה בארנק שלי' : 'View My Wallet'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setClaimSuccess(false);
                    setClaimedVoucher(null);
                    setVoucherCode('');
                  }}
                  data-testid="button-claim-another"
                >
                  {isRTL ? 'מימוש שובר נוסף' : 'Claim Another Voucher'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 py-20 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 md:p-12 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
                <Gift className="w-12 h-12 text-white" />
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                {isRTL ? '🎁 מימוש שובר מתנה' : '🎁 Claim Gift Voucher'}
              </h1>
              
              <p className="text-gray-600 dark:text-gray-400 text-lg max-w-md mx-auto">
                {isRTL 
                  ? 'הזינו את קוד השובר שקיבלתם כדי להוסיף אותו לארנק הדיגיטלי שלכם'
                  : 'Enter your voucher code to add it to your digital wallet'}
              </p>
            </div>

            {/* Sign In Notice for Non-Authenticated Users */}
            {!user && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                    {isRTL ? 'נדרשת התחברות' : 'Sign In Required'}
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {isRTL 
                      ? 'יש להתחבר לחשבון כדי לממש שובר מתנה'
                      : 'You need to sign in to claim a gift voucher'}
                  </p>
                  <Button 
                    size="sm" 
                    onClick={() => setLocation('/signin')}
                    className="bg-yellow-600 hover:bg-yellow-700 mt-2"
                    data-testid="button-signin"
                  >
                    {isRTL ? 'התחברו עכשיו' : 'Sign In Now'}
                  </Button>
                </div>
              </div>
            )}

            {/* Voucher Code Input */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {isRTL ? 'קוד השובר' : 'Voucher Code'}
              </label>
              <Input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder={isRTL ? 'הזינו את קוד השובר שלכם' : 'Enter your voucher code'}
                className="text-center text-lg font-mono tracking-wider uppercase"
                maxLength={20}
                disabled={claimMutation.isPending}
                data-testid="input-voucher-code"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {isRTL 
                  ? 'הקוד מורכב מאותיות ומספרים ונמצא באימייל שקיבלתם'
                  : 'The code consists of letters and numbers and can be found in the email you received'}
              </p>
            </div>

            {/* Claim Button */}
            <Button
              onClick={handleClaim}
              disabled={claimMutation.isPending || !voucherCode.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6"
              data-testid="button-claim-voucher"
            >
              {claimMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {isRTL ? 'ממש שובר...' : 'Claiming...'}
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5 mr-2" />
                  {isRTL ? 'מימוש שובר' : 'Claim Voucher'}
                </>
              )}
            </Button>

            {/* Help Section */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 text-center">
                {isRTL ? '❓ שאלות נפוצות' : '❓ Frequently Asked Questions'}
              </h3>
              <div className="space-y-3 text-sm text-purple-800 dark:text-purple-200">
                <div>
                  <p className="font-medium">{isRTL ? 'איפה אמצא את קוד השובר?' : 'Where can I find my voucher code?'}</p>
                  <p className="text-purple-700 dark:text-purple-300 mt-1">
                    {isRTL 
                      ? 'קוד השובר נשלח אליכם באימייל לאחר הרכישה'
                      : 'The voucher code was sent to you via email after purchase'}
                  </p>
                </div>
                <div>
                  <p className="font-medium">{isRTL ? 'האם ניתן למחוק או להעביר שובר?' : 'Can I delete or transfer a voucher?'}</p>
                  <p className="text-purple-700 dark:text-purple-300 mt-1">
                    {isRTL 
                      ? 'לאחר מימוש השובר, הוא משויך לחשבון שלכם ולא ניתן להעביר אותו'
                      : 'Once claimed, the voucher is linked to your account and cannot be transferred'}
                  </p>
                </div>
                <div>
                  <p className="font-medium">{isRTL ? 'צריכים עזרה?' : 'Need Help?'}</p>
                  <p className="text-purple-700 dark:text-purple-300 mt-1">
                    {isRTL ? 'צרו קשר' : 'Contact us'}: 
                    <a href="mailto:Support@PetWash.co.il" className="underline mx-1">Support@PetWash.co.il</a>
                    {isRTL ? 'או' : 'or'}
                    <a href="tel:+972549833355" className="underline mx-1">+972-54-983-3355</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
