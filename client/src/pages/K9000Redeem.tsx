import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  Clock,
  Droplets,
  CreditCard,
  Star,
  ArrowLeft,
  AlertCircle,
  Loader2,
  XCircle,
  RefreshCcw,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';
import { ProgressCircle } from '@/components/LuxuryWidgets';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { apiRequest } from '@/lib/queryClient';
import QRCode from 'qrcode';

const WASH_PRICE_CENTS = 5500;

interface WalletSummary {
  walletId: string;
  egiftBalanceCents: number;
  washPackageCredits: number;
  loyaltyPointsBalance: number;
  promoBalanceCents: number;
  referralBalanceCents: number;
  totalCreditsValueCents: number;
  loyaltyTier: string;
}

interface RedemptionResult {
  sessionId: string;
  redemptionCode: string;
  qrData: string;
  expiresAt: string;
  creditsApplied: {
    egiftCents: number;
    washPackages: number;
    loyaltyPoints: number;
    promoCents: number;
  };
  cashDueCents: number;
}

type RedeemOption = 'wash_package' | 'egift' | 'loyalty';
type Step = 'select' | 'qr' | 'confirmed' | 'failed';

const WALLET_FUNDED_SOURCES: RedeemOption[] = ['wash_package', 'egift', 'loyalty'];

const formatCurrency = (cents: number) =>
  `₪${(cents / 100).toLocaleString('en-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function K9000Redeem() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('select');
  const [selectedOption, setSelectedOption] = useState<RedeemOption | ''>('');
  const [redemption, setRedemption] = useState<RedemptionResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState('');
  const [failureReason, setFailureReason] = useState('');

  // DEMO MODE GUARD (item 21): Query machine status so the confirmation screen can warn
  // the customer if the physical machine was NOT commanded (MACHINE_ACTIVATION_URL not set).
  // BEFORE: Confirmation screen always showed "Enjoy the wash!" — even if the machine
  //         received no command and would not physically start.
  // AFTER:  Demo-mode banner shown prominently so user knows to contact staff.
  const { data: systemModeData } = useQuery<{ machineMode: 'live' | 'demo'; messageHe: string; messageEn: string }>({
    queryKey: ['/api/k9000/system-mode'],
    enabled: step === 'confirmed',
    staleTime: 30_000,
  });
  const machineIsDemo = systemModeData?.machineMode === 'demo';

  const { data: walletData, isLoading: walletLoading } = useQuery<{ success: boolean; wallet: WalletSummary }>({
    queryKey: ['/api/credit-wallet/summary'],
  });

  const wallet = walletData?.wallet;

  const { data: statusData } = useQuery<{ success: boolean; status: string }>({
    queryKey: ['/api/credit-wallet/redemptions', redemption?.sessionId, 'status'],
    enabled: step === 'qr' && !!redemption?.sessionId && secondsLeft > 0,
    refetchInterval: secondsLeft > 0 ? 3000 : false,
    queryFn: async () => {
      const res = await fetch(`/api/credit-wallet/redemptions/${redemption!.sessionId}/status`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
  });

  useEffect(() => {
    const st = statusData?.status;
    if (st === 'completed') {
      setStep('confirmed');
      queryClient.invalidateQueries({ queryKey: ['/api/credit-wallet/summary'] });
    } else if (st === 'failed' || st === 'compensation_required') {
      const reason = (statusData as any)?.failureReason ?? (statusData as any)?.reason ?? '';
      setFailureReason(reason);
      setStep('failed');
      queryClient.invalidateQueries({ queryKey: ['/api/credit-wallet/summary'] });
    }
  }, [statusData?.status, queryClient]);

  useEffect(() => {
    if (step !== 'qr' || !redemption) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setError(isHebrew ? 'הקוד פג תוקף' : 'Code expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, redemption, isHebrew]);

  const generateQrCode = useCallback(async (data: string) => {
    try {
      const url = await QRCode.toDataURL(data, { width: 280, margin: 2 });
      setQrDataUrl(url);
    } catch (err) {
      console.error('QR generation failed', err);
    }
  }, []);

  const maxLoyaltyCents = Math.floor(WASH_PRICE_CENTS * 0.2);
  const loyaltyValueCents = (wallet?.loyaltyPointsBalance || 0) * 10;
  const loyaltyApplicableCents = Math.min(loyaltyValueCents, maxLoyaltyCents);

  const getDeduction = () => {
    if (!wallet) return { deducted: 0, cashDue: WASH_PRICE_CENTS };
    switch (selectedOption) {
      case 'wash_package':
        return { deducted: WASH_PRICE_CENTS, cashDue: 0 };
      case 'egift': {
        const applied = Math.min(wallet.egiftBalanceCents, WASH_PRICE_CENTS);
        return { deducted: applied, cashDue: WASH_PRICE_CENTS - applied };
      }
      case 'loyalty':
        return { deducted: loyaltyApplicableCents, cashDue: WASH_PRICE_CENTS - loyaltyApplicableCents };
      default:
        return { deducted: 0, cashDue: WASH_PRICE_CENTS };
    }
  };

  const handleGenerate = async () => {
    if (!selectedOption) return;
    setIsGenerating(true);
    setError('');
    try {
      const res = await apiRequest('POST', '/api/credit-wallet/redemptions', {
        platform: 'k9000',
        requestedAmountCents: WASH_PRICE_CENTS,
        stationId: 'any',
        serviceType: selectedOption,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');
      const r = data.redemption as RedemptionResult;
      setRedemption(r);
      const expMs = new Date(r.expiresAt).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(expMs / 1000)));
      await generateQrCode(r.qrData);
      setStep('qr');
    } catch (err: any) {
      setError(err.message || (isHebrew ? 'שגיאה' : 'Error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancel = async () => {
    if (!redemption) return;
    setIsCancelling(true);
    try {
      await apiRequest('POST', `/api/credit-wallet/redemptions/${redemption.sessionId}/cancel`);
      setStep('select');
      setRedemption(null);
      setQrDataUrl('');
      setSecondsLeft(600);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerProgress = (secondsLeft / 600) * 100;
  const { deducted, cashDue } = getDeduction();

  if (walletLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white py-6 px-4">
        <div className="max-w-lg mx-auto">

          <div className="flex items-center gap-3 mb-6 luxury-animate-fade-in">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => step === 'select' ? setLocation('/my-wallet') : setStep('select')}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {isHebrew ? '🐾 מימוש בתחנת K9000' : '🐾 K9000 Station Redeem'}
              </h1>
              <p className="text-sm text-gray-500">
                {isHebrew ? 'שטיפה עצמית לחיית המחמד שלך' : 'Self-service pet wash station'}
              </p>
            </div>
          </div>

          {error && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <CardContent className="p-3 flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </CardContent>
            </Card>
          )}

          {step === 'select' && (
            <div className="space-y-5 luxury-animate-slide-up">

              <Card className="luxury-glass-card luxury-shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-500">
                      {isHebrew ? 'מחיר שטיפה סטנדרטי' : 'Standard K9000 Wash'}
                    </span>
                    <Badge className="bg-blue-100 text-blue-700 border-0">K9000</Badge>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{formatCurrency(WASH_PRICE_CENTS)}</div>
                </CardContent>
              </Card>

              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  {isHebrew ? 'בחר אמצעי תשלום' : 'Select Payment Method'}
                </h2>

                <RadioGroup
                  value={selectedOption}
                  onValueChange={(v) => setSelectedOption(v as RedeemOption)}
                  className="space-y-3"
                >
                  {(wallet?.washPackageCredits || 0) > 0 && (
                    <label
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedOption === 'wash_package'
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <RadioGroupItem value="wash_package" />
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <Droplets className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {isHebrew ? 'שימוש בחבילת שטיפה' : 'Use Wash Package'}
                        </div>
                        <div className="text-sm text-emerald-600 font-medium">
                          {wallet!.washPackageCredits} {isHebrew ? 'שטיפות נותרו' : 'washes remaining'}
                        </div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                        {isHebrew ? 'חינם' : 'FREE'}
                      </Badge>
                    </label>
                  )}

                  {(wallet?.egiftBalanceCents || 0) > 0 && (
                    <label
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedOption === 'egift'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <RadioGroupItem value="egift" />
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {isHebrew ? 'שימוש ביתרת מתנה' : 'Use E-Gift Balance'}
                        </div>
                        <div className="text-sm text-blue-600 font-medium">
                          {formatCurrency(wallet!.egiftBalanceCents)} {isHebrew ? 'זמין' : 'available'}
                        </div>
                      </div>
                    </label>
                  )}

                  {(wallet?.loyaltyPointsBalance || 0) > 0 && (
                    <label
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedOption === 'loyalty'
                          ? 'border-amber-500 bg-white'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <RadioGroupItem value="loyalty" />
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                        <Star className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {isHebrew ? 'שימוש בנקודות נאמנות' : 'Use Loyalty Points'}
                        </div>
                        <div className="text-sm text-amber-600 font-medium">
                          {wallet!.loyaltyPointsBalance.toLocaleString()} {isHebrew ? 'נקודות' : 'points'}
                          <span className="text-gray-400 ml-1">
                            ({isHebrew ? 'עד 20% מהמחיר' : 'max 20% of price'})
                          </span>
                        </div>
                      </div>
                    </label>
                  )}

                  {!wallet?.washPackageCredits && !wallet?.egiftBalanceCents && !wallet?.loyaltyPointsBalance && (
                    <div className="text-center py-8 text-gray-400">
                      <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">{isHebrew ? 'אין קרדיטים זמינים' : 'No credits available'}</p>
                    </div>
                  )}
                </RadioGroup>
              </div>

              {selectedOption && (
                <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-slide-up">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{isHebrew ? 'מחיר שטיפה' : 'Wash Price'}</span>
                      <span className="font-medium">{formatCurrency(WASH_PRICE_CENTS)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{isHebrew ? 'קרדיט מנוכה' : 'Credits Applied'}</span>
                      <span className="font-medium text-green-600">-{formatCurrency(deducted)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold text-gray-900">{isHebrew ? 'לתשלום במזומן' : 'Cash Due'}</span>
                      <span className="font-bold text-lg text-gray-900">{formatCurrency(cashDue)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!selectedOption || isGenerating}
                className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-base font-semibold gap-3 disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <QrCode className="w-5 h-5" />
                )}
                {isHebrew ? 'הפק קוד QR' : 'Generate QR Code'}
              </Button>
            </div>
          )}

          {step === 'qr' && redemption && (
            <div className="space-y-5 luxury-animate-slide-up">

              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-4 py-2 text-sm font-medium mb-4">
                  <Smartphone className="w-4 h-4" />
                  {isHebrew ? 'הצג את הקוד לסורק בתחנה' : 'Show this QR to the K9000 scanner'}
                </div>
              </div>

              <Card className="luxury-glass-card luxury-shadow-lg">
                <CardContent className="p-6 flex flex-col items-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" className="w-64 h-64 rounded-xl shadow-md mb-4" />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center bg-white rounded-xl mb-4">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <p className="text-xs text-gray-400 mb-1">
                      {isHebrew ? 'או הזן ידנית:' : 'Or enter manually:'}
                    </p>
                    <div className="text-3xl font-mono font-bold tracking-[0.3em] text-gray-900">
                      {redemption.redemptionCode}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <ProgressCircle
                      progress={timerProgress}
                      size={72}
                      strokeWidth={6}
                      color={secondsLeft < 60 ? '#ef4444' : secondsLeft < 180 ? '#f59e0b' : '#3b82f6'}
                    >
                      <div className="text-center">
                        <Clock className={`w-3 h-3 mx-auto mb-0.5 ${secondsLeft < 60 ? 'text-red-500' : 'text-blue-600'}`} />
                        <div className={`text-xs font-bold ${secondsLeft < 60 ? 'text-red-500' : 'text-gray-700'}`}>
                          {minutes}:{seconds.toString().padStart(2, '0')}
                        </div>
                      </div>
                    </ProgressCircle>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {isHebrew ? 'זמן שנותר' : 'Time Remaining'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {isHebrew ? 'הקוד בתוקף ל-10 דקות' : 'Code valid for 10 minutes'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="luxury-glass-card">
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    {isHebrew ? 'פירוט ניכוי' : 'Deduction Summary'}
                  </h3>
                  {redemption.creditsApplied.washPackages > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Droplets className="w-3 h-3" /> {isHebrew ? 'חבילת שטיפה' : 'Wash Package'}
                      </span>
                      <span className="text-green-600 font-medium">
                        {redemption.creditsApplied.washPackages} {isHebrew ? 'שטיפה' : 'wash'}
                      </span>
                    </div>
                  )}
                  {redemption.creditsApplied.egiftCents > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> {isHebrew ? 'מתנה דיגיטלית' : 'E-Gift'}
                      </span>
                      <span className="text-green-600 font-medium">
                        -{formatCurrency(redemption.creditsApplied.egiftCents)}
                      </span>
                    </div>
                  )}
                  {redemption.creditsApplied.loyaltyPoints > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Star className="w-3 h-3" /> {isHebrew ? 'נקודות נאמנות' : 'Loyalty Points'}
                      </span>
                      <span className="text-green-600 font-medium">
                        -{formatCurrency(redemption.creditsApplied.loyaltyPoints)}
                      </span>
                    </div>
                  )}
                  {redemption.creditsApplied.promoCents > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{isHebrew ? 'קרדיט מבצע' : 'Promo Credit'}</span>
                      <span className="text-green-600 font-medium">
                        -{formatCurrency(redemption.creditsApplied.promoCents)}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">{isHebrew ? 'לתשלום במזומן' : 'Cash Due at Station'}</span>
                    <span className="font-bold text-lg">{formatCurrency(redemption.cashDueCents)}</span>
                  </div>
                </CardContent>
              </Card>

              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isCancelling}
                className="w-full h-12 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-semibold"
              >
                {isCancelling ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {isHebrew ? 'ביטול' : 'Cancel Redemption'}
              </Button>
            </div>
          )}

          {step === 'confirmed' && redemption && (
            <div className="space-y-5 luxury-animate-slide-up">

              {/* DEMO MODE WARNING (item 21): Shown when MACHINE_ACTIVATION_URL is not set.
                  Customer paid / redeemed credits but the physical machine was not commanded.
                  This is a legal and consumer-protection requirement — must be visible. */}
              {machineIsDemo && (
                <div className="rounded-lg border border-amber-400 bg-amber-50 p-4 flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {isHebrew
                        ? 'המכונה במצב הדגמה — השטיפה הפיזית לא הופעלה'
                        : 'Machine in Demo Mode — Physical Wash Not Started'}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {isHebrew
                        ? 'הזיכוי נרשם בחשבונך. אם המכונה לא מתחילה תוך 30 שניות, יש לפנות לצוות. מס׳ שיחה: תמיכה PetWash.'
                        : 'Your credit has been recorded. If the machine does not start within 30 seconds, please contact staff. Ref: PetWash Support.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="text-center py-6">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 luxury-animate-fade-in ${machineIsDemo ? 'bg-amber-100' : 'bg-green-100'}`}>
                  <CheckCircle2 className={`w-10 h-10 ${machineIsDemo ? 'text-amber-600' : 'text-green-600'}`} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {isHebrew ? 'המימוש אושר!' : 'Redemption Confirmed!'}
                </h2>
                <p className="text-sm text-gray-500">
                  {machineIsDemo
                    ? (isHebrew ? 'פנה/י לצוות לסיוע' : 'Please contact staff for assistance')
                    : (isHebrew ? 'תהנה מהשטיפה 🐾' : 'Enjoy the wash 🐾')}
                </p>
              </div>

              <Card className="luxury-glass-card luxury-shadow-lg">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    {isHebrew ? 'קבלה' : 'Receipt'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{isHebrew ? 'מזהה הפעלה' : 'Session ID'}</span>
                      <span className="font-mono text-xs text-gray-700">{redemption.sessionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{isHebrew ? 'פלטפורמה' : 'Platform'}</span>
                      <span className="font-medium">K9000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{isHebrew ? 'סכום שטיפה' : 'Wash Amount'}</span>
                      <span className="font-medium">{formatCurrency(WASH_PRICE_CENTS)}</span>
                    </div>
                    {redemption.creditsApplied.washPackages > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{isHebrew ? 'חבילת שטיפה' : 'Wash Package'}</span>
                        <span className="text-green-600 font-medium">
                          {redemption.creditsApplied.washPackages} {isHebrew ? 'שטיפה' : 'wash'}
                        </span>
                      </div>
                    )}
                    {redemption.creditsApplied.egiftCents > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{isHebrew ? 'מתנה דיגיטלית' : 'E-Gift Applied'}</span>
                        <span className="text-green-600 font-medium">
                          -{formatCurrency(redemption.creditsApplied.egiftCents)}
                        </span>
                      </div>
                    )}
                    {redemption.creditsApplied.loyaltyPoints > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{isHebrew ? 'נקודות נאמנות' : 'Loyalty Points'}</span>
                        <span className="text-green-600 font-medium">
                          -{formatCurrency(redemption.creditsApplied.loyaltyPoints)}
                        </span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold">{isHebrew ? 'שולם במזומן' : 'Cash Paid'}</span>
                      <span className="font-bold">{formatCurrency(redemption.cashDueCents)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {wallet && (
                <Card className="luxury-glass-card">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      {isHebrew ? 'יתרות מעודכנות' : 'Updated Balances'}
                    </h3>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <Droplets className="w-4 h-4 mx-auto text-emerald-600 mb-1" />
                        <div className="text-lg font-bold text-gray-900">{wallet.washPackageCredits}</div>
                        <div className="text-[10px] text-gray-400">{isHebrew ? 'שטיפות' : 'Washes'}</div>
                      </div>
                      <div>
                        <CreditCard className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                        <div className="text-lg font-bold text-gray-900">{formatCurrency(wallet.egiftBalanceCents)}</div>
                        <div className="text-[10px] text-gray-400">{isHebrew ? 'מתנה' : 'E-Gift'}</div>
                      </div>
                      <div>
                        <Star className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                        <div className="text-lg font-bold text-gray-900">{wallet.loyaltyPointsBalance.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-400">{isHebrew ? 'נקודות' : 'Points'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={() => setLocation('/my-wallet')}
                className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-base font-semibold gap-3"
              >
                <ArrowLeft className="w-5 h-5" />
                {isHebrew ? 'חזרה לארנק' : 'Back to Wallet'}
              </Button>
            </div>
          )}

          {step === 'failed' && redemption && (
            <div className="space-y-5 luxury-animate-slide-up">
              <div className="text-center py-6">
                <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {isHebrew ? 'השטיפה נכשלה' : 'Wash Failed'}
                </h2>
                <p className="text-sm text-gray-500">
                  {failureReason || (isHebrew ? 'המשאבה לא הופעלה לאחר כל הניסיונות' : 'Pump could not be activated after all retries')}
                </p>
              </div>

              {selectedOption && WALLET_FUNDED_SOURCES.includes(selectedOption as RedeemOption) && (
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <RefreshCcw className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        {isHebrew ? 'הכסף מוחזר לארנקך' : 'Refund Issued to Your Wallet'}
                      </p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        {isHebrew
                          ? `${formatCurrency(redemption.cashDueCents > 0 ? WASH_PRICE_CENTS - redemption.cashDueCents : WASH_PRICE_CENTS)} יוחזרו לארנק תוך דקות ספורות`
                          : `${formatCurrency(WASH_PRICE_CENTS)} will be returned to your wallet shortly`
                        }
                      </p>
                      <p className="text-[10px] text-emerald-600 mt-1 font-mono">
                        {isHebrew ? 'סשן:' : 'Session:'} {redemption.sessionId}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-red-100">
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    {isHebrew ? 'מה קרה?' : 'What happened?'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {isHebrew
                      ? 'התחנה לא הגיבה לפקודת הפעלת המשאבה. הצוות שלנו יקבל התראה ויטפל בתקלה. אם שילמת מהארנק — הסכום מוחזר אוטומטית.'
                      : 'The station did not respond to the pump start command. Our team has been alerted and will address the issue. If you paid from your wallet, the amount will be refunded automatically.'
                    }
                  </p>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setStep('select'); setRedemption(null); setQrDataUrl(''); setSecondsLeft(600); setFailureReason(''); }}
                  className="flex-1 h-12 rounded-xl"
                >
                  {isHebrew ? 'נסה שוב' : 'Try Again'}
                </Button>
                <Button
                  onClick={() => setLocation('/my-wallet')}
                  className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  {isHebrew ? 'הארנק שלי' : 'My Wallet'}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-8 text-center text-xs text-gray-400 pb-4">
            <p>⁦Pet Wash™⁩ K9000 • {isHebrew ? 'מאובטח ומוצפן' : 'Secured & Encrypted'}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}