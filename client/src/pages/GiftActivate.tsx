/**
 * GiftActivate — T001 Phase 7
 * The page a gift recipient opens from their SMS/WhatsApp/email link.
 * URL: /gift/activate/:voucherId
 *
 * Flow:
 *   1. Fetch gift info (public endpoint — no auth required)
 *   2. If not signed in → prompt sign-in (redirect back after)
 *   3. Tap "Activate" → POST /api/gift-cards/:id/activate-wallet
 *   4. Success screen → CTA to /marketplace
 */
import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Gift, CheckCircle2, Sparkles, ArrowRight, Wallet } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

const GOLD = '#C5A55A';

interface GiftInfo {
  id: string;
  codeLast4: string;
  amountIls: number;
  status: string;
  expired: boolean;
  recipientEmail: string | null;
}

interface VerificationStatus {
  enabled: boolean;
  flowFlags?: {
    egiftRedeem?: {
      enabled: boolean;
    };
  };
}

export default function GiftActivate() {
  const { voucherId } = useParams<{ voucherId: string }>();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const isHe = language === 'he';

  const [activated, setActivated] = useState(false);
  const [creditedAmount, setCreditedAmount] = useState(0);
  const [verificationChallengeId, setVerificationChallengeId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  const { data: gift, isLoading, isError } = useQuery<GiftInfo>({
    queryKey: ['/api/gift-cards', voucherId, 'info'],
    queryFn: async () => {
      const res = await fetch(`/api/gift-cards/${voucherId}/info`);
      if (!res.ok) throw new Error('Gift not found');
      return res.json();
    },
    enabled: !!voucherId,
    retry: false,
  });

  const { data: verificationStatus } = useQuery<VerificationStatus>({
    queryKey: ['/api/verification/status'],
    queryFn: async () => {
      const res = await fetch('/api/verification/status');
      if (!res.ok) throw new Error('Verification status unavailable');
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  const egiftVerificationEnabled = !!verificationStatus?.enabled
    && !!verificationStatus.flowFlags?.egiftRedeem?.enabled;

  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in');
      const token = await user.getIdToken();

      if (egiftVerificationEnabled && !verificationChallengeId) {
        const phoneNumber = user.phoneNumber;
        if (!phoneNumber) {
          throw new Error(
            isHe
              ? 'כדי להפעיל מתנה נדרש מספר טלפון מאומת בחשבון.'
              : 'A verified phone number is required to activate this gift.',
          );
        }

        const verificationRes = await fetch('/api/verification/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            purpose: 'egift_redeem',
            channel: 'sms',
            destination: phoneNumber,
            payload: { voucherId },
            traceId: `gift-${voucherId}`,
          }),
        });
        const verificationBody = await verificationRes.json();
        if (!verificationRes.ok) {
          throw new Error(verificationBody.error || 'Verification failed');
        }
        return {
          challengeSent: true,
          challengeId: verificationBody.challenge.challengeId as string,
        };
      }

      if (egiftVerificationEnabled && verificationCode.trim().length < 4) {
        throw new Error(isHe ? 'יש להזין קוד אימות.' : 'Enter the verification code.');
      }

      const res = await fetch(`/api/gift-cards/${voucherId}/activate-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(egiftVerificationEnabled ? {
          verificationChallengeId,
          verificationCode: verificationCode.trim(),
        } : {}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Activation failed');
      return body as { success: boolean; amountIls: number; amountCents: number };
    },
    onSuccess: (data: any) => {
      if (data.challengeSent) {
        setVerificationChallengeId(data.challengeId);
        setVerificationSent(true);
        toast({
          title: isHe ? 'קוד נשלח' : 'Code sent',
          description: isHe ? 'הזן את הקוד שקיבלת במסרון.' : 'Enter the SMS code to activate the gift.',
        });
        return;
      }
      setCreditedAmount(data.amountIls);
      setActivated(true);
      queryClient.invalidateQueries({ queryKey: ['/api/credit-wallet/summary'] });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: isHe ? 'שגיאה' : 'Error',
        description: err.message,
      });
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLD }} />
        </div>
      </Layout>
    );
  }

  if (isError || !gift) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
          <div className="text-5xl mb-4">🎁</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {isHe ? 'כרטיס המתנה לא נמצא' : 'Gift card not found'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isHe
              ? 'יתכן שהקישור פג תוקף או שהכרטיס כבר מומש.'
              : 'The link may have expired or the card was already redeemed.'}
          </p>
        </div>
      </Layout>
    );
  }

  if (gift.expired || gift.status === 'EXPIRED') {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {isHe ? 'כרטיס המתנה פג תוקף' : 'Gift card expired'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isHe ? 'אנא פנה לשולח המתנה.' : 'Please contact the gift sender.'}
          </p>
        </div>
      </Layout>
    );
  }

  if (gift.status === 'REDEEMED' && !activated) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {isHe ? 'כרטיס המתנה כבר הופעל' : 'Gift card already activated'}
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            {isHe ? 'הכרטיס כבר שויך לארנק.' : 'This gift has already been added to a wallet.'}
          </p>
          <Button onClick={() => navigate('/my-wallet')} style={{ backgroundColor: GOLD, color: '#fff' }}>
            <Wallet className="w-4 h-4 mr-2" />
            {isHe ? 'לארנק שלי' : 'My Wallet'}
          </Button>
        </div>
      </Layout>
    );
  }

  if (activated) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
            style={{ background: `${GOLD}15` }}
          >
            <CheckCircle2 className="w-12 h-12" style={{ color: GOLD }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isHe ? '🎉 הכרטיס הופעל!' : '🎉 Gift activated!'}
          </h1>
          <p className="text-gray-500 text-sm mb-2">
            {isHe
              ? `₪${creditedAmount.toFixed(2)} נוסף לארנק ה-E-Gift שלך`
              : `₪${creditedAmount.toFixed(2)} has been credited to your e-gift wallet`}
          </p>
          <p className="text-xs text-gray-400 mb-8">
            {isHe
              ? 'תוכלו להשתמש ביתרה בהזמנתך הבאה'
              : 'You can use the balance on your next booking'}
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button
              onClick={() => navigate('/marketplace')}
              className="w-full h-12 font-semibold text-white rounded-xl"
              style={{ background: GOLD }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isHe ? 'הזמן שירות עכשיו' : 'Book a Service Now'}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/my-wallet')}
              className="w-full h-12 font-semibold rounded-xl"
            >
              <Wallet className="w-4 h-4 mr-2" />
              {isHe ? 'צפה בארנק שלי' : 'View My Wallet'}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white" dir={isHe ? 'rtl' : 'ltr'}>
        <div
          className="py-16 px-6 text-center text-white"
          style={{ background: `linear-gradient(135deg, #1a0a00 0%, #3d2200 50%, #1a0a00 100%)` }}
        >
          <div
            className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: `${GOLD}25`, border: `2px solid ${GOLD}55` }}
          >
            <Gift className="w-10 h-10" style={{ color: GOLD }} />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {isHe ? 'קיבלת מתנה! 🎁' : 'You received a gift! 🎁'}
          </h1>
          <p className="text-sm" style={{ color: `${GOLD}CC` }}>
            {isHe ? 'כרטיס מתנה דיגיטלי — Pet Wash™' : 'Digital gift card — Pet Wash™'}
          </p>
        </div>

        <div className="max-w-sm mx-auto px-6 -mt-6">
          <Card className="shadow-xl border-0 mb-6 overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: GOLD }} />
            <CardContent className="p-6 text-center">
              <p className="text-sm text-gray-500 mb-1">
                {isHe ? 'שווי הכרטיס' : 'Gift value'}
              </p>
              <div className="text-5xl font-bold mb-1" style={{ color: GOLD }}>
                ₪{gift.amountIls.toFixed(0)}
              </div>
              <p className="text-xs text-gray-400 mb-4">
                {isHe ? `קוד: ...${gift.codeLast4}` : `Code: ...${gift.codeLast4}`}
              </p>
              <div className="text-xs text-gray-500 space-y-1 bg-white rounded-lg p-3">
                <p>{isHe ? '✓ שמפו טבעי' : '✓ natural shampoo'}</p>
                <p>{isHe ? '✓ שטיפה K9000 / שירותי ספקים' : '✓ K9000 wash / provider services'}</p>
                <p>{isHe ? '✓ ניתן לשימוש בכל השירותים' : '✓ Valid for all services'}</p>
              </div>
            </CardContent>
          </Card>

          {!user ? (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                {isHe
                  ? 'כדי לקבל את המתנה לארנק שלך, יש להתחבר תחילה.'
                  : 'To claim this gift to your wallet, please sign in first.'}
              </p>
              <Button
                onClick={() => navigate(`/login?redirect=/gift/activate/${voucherId}`)}
                className="w-full h-12 font-semibold rounded-xl"
                style={{ background: GOLD, color: '#fff' }}
              >
                {isHe ? 'התחבר / הירשם' : 'Sign In / Register'}
                <ArrowRight className={`w-4 h-4 ${isHe ? 'mr-2' : 'ml-2'} ${isHe ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          ) : (
            <div>
              {egiftVerificationEnabled && verificationSent && (
                <div className="mb-3">
                  <Input
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={isHe ? 'קוד אימות' : 'Verification code'}
                    className="h-12 text-center font-mono text-lg rounded-xl"
                  />
                </div>
              )}
              <Button
                onClick={() => activateMutation.mutate()}
                disabled={activateMutation.isPending || (egiftVerificationEnabled && verificationSent && verificationCode.trim().length < 4)}
                className="w-full h-14 font-bold text-lg rounded-xl mb-3 text-white"
                style={{ background: GOLD }}
              >
                {activateMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Wallet className={`w-5 h-5 ${isHe ? 'ml-2' : 'mr-2'}`} />
                    {egiftVerificationEnabled && !verificationSent
                      ? (isHe ? 'שלח קוד אימות' : 'Send Verification Code')
                      : (isHe ? 'הפעל לארנק שלי' : 'Add to My Wallet')}
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-gray-400">
                {isHe
                  ? `מחובר כ: ${user.email || user.displayName || user.uid}`
                  : `Signed in as: ${user.email || user.displayName || user.uid}`}
              </p>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6 pb-8">
            {isHe
              ? 'כרטיסי מתנה אינם ניתנים להמרה למזומן. שימוש חד-פעמי.'
              : 'Gift cards are non-refundable. Single use only.'}
          </p>
        </div>
      </div>
    </Layout>
  );
}
