import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Receipt, 
  MapPin, 
  Clock, 
  CreditCard, 
  Gift, 
  Star, 
  QrCode,
  ExternalLink,
  Calendar,
  User,
  Award
} from 'lucide-react';
import { format } from 'date-fns';
import type { SmartWashReceipt } from '@shared/schema';
import { useLanguage } from '@/lib/languageStore';

export function SmartReceiptViewer() {
  const { transactionId } = useParams<{ transactionId: string }>();
  // HE-parity per §71 — every customer-visible string on the receipt
  // renders in the viewer's chosen language. Was English-only; a HE
  // customer landed on 24 unlocalised strings.
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);

  const { data: receipt, isLoading, error } = useQuery<SmartWashReceipt>({
    // param must be IN the URL (queryKey[0]) — the default queryFn fetches queryKey[0]
    // and drops extra elements, so ['/api/receipts', id] hit a bare /api/receipts (404).
    queryKey: [`/api/receipts/${transactionId}`],
    enabled: !!transactionId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="text-center luxury-animate-scale-in">
          <div className="luxury-spinner"></div>
          <p className="luxury-text-small mt-4">{tr('Loading receipt…', 'טוען קבלה…')}</p>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="text-center luxury-glass-card luxury-shadow-lg p-12 rounded-2xl luxury-animate-slide-up">
          <Receipt className="h-16 w-16 text-amber-300 mx-auto mb-4" />
          <h2 className="luxury-heading-md mb-2">{tr('Receipt Not Found', 'הקבלה לא נמצאה')}</h2>
          <p className="luxury-text-small">
            {tr(
              "The receipt you're looking for doesn't exist or has been removed.",
              'הקבלה שחיפשת אינה קיימת או הוסרה.',
            )}
          </p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'platinum':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'gold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'silver':
        return 'bg-white text-gray-800 border-gray-200';
      default:
        return 'bg-[#D4AF37] text-black border-[#D4AF37]';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'platinum':
        return <Award className="h-4 w-4" />;
      case 'gold':
        return <Award className="h-4 w-4" />;
      case 'silver':
        return <Star className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const progressPercentage = (receipt.nextTierPoints ?? 0) > 0
    ? Math.min(100, ((receipt.currentTierPoints ?? 0) / (receipt.nextTierPoints ?? 1)) * 100)
    : 100;

  return (
    <div className="min-h-screen luxury-bg-mesh py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 luxury-animate-fade-in">
          <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8932F] flex items-center justify-center mr-3">
                <Receipt className="h-6 w-6 text-white" />
              </div>
              <h1 className="luxury-heading-lg">{tr('⁦PetWash™⁩ Receipt', '⁦PetWash™⁩ · קבלה')}</h1>
            </div>
            <p className="text-lg font-mono luxury-text-gradient">#{receipt.transactionId}</p>
          </div>
        </div>

        {/* Receipt Details */}
        <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden mb-6 luxury-animate-slide-up luxury-delay-1">
          <div className="luxury-glass-panel px-6 py-4">
            <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {tr('Transaction Details', 'פרטי העסקה')}
            </h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="luxury-text-small">{tr('Date & Time', 'תאריך ושעה')}</p>
                <p className="font-semibold flex items-center gap-2 text-gray-900">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  {format(new Date(receipt.washDateTime), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
              <div>
                <p className="luxury-text-small">{tr('Location', 'מיקום')}</p>
                <p className="font-semibold flex items-center gap-2 text-gray-900">
                  <MapPin className="h-4 w-4 text-amber-500" />
                  {receipt.locationName}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="luxury-text-small">{tr('Wash Type', 'סוג שטיפה')}</p>
                <p className="font-semibold text-gray-900">{receipt.washType}</p>
              </div>
              <div>
                <p className="luxury-text-small">{tr('Duration', 'משך')}</p>
                <p className="font-semibold flex items-center gap-2 text-gray-900">
                  <Clock className="h-4 w-4 text-amber-500" />
                  {receipt.washDuration} {tr(
                    receipt.washDuration === 1 ? 'minute' : 'minutes',
                    receipt.washDuration === 1 ? 'דקה' : 'דקות',
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="luxury-text-small">{tr('Customer ID', 'מזהה לקוח')}</p>
                <p className="font-semibold text-gray-900">{receipt.customerIdMasked}</p>
              </div>
              <div>
                <p className="luxury-text-small">{tr('Payment Method', 'אמצעי תשלום')}</p>
                <p className="font-semibold flex items-center gap-2 text-gray-900">
                  <CreditCard className="h-4 w-4 text-amber-500" />
                  {receipt.paymentMethod}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden mb-6 luxury-animate-slide-up luxury-delay-2">
          <div className="luxury-glass-panel px-6 py-4">
            <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {tr('Payment Summary', 'סיכום תשלום')}
            </h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex justify-between">
              <span className="luxury-text-small">{tr('Original Amount:', 'סכום מקורי:')}</span>
              <span className="font-semibold text-gray-900">{formatCurrency(receipt.originalAmount)}</span>
            </div>

            {parseFloat(receipt.discountApplied) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>{tr('Discount Applied:', 'הנחה:')}</span>
                <span className="font-semibold">-{formatCurrency(receipt.discountApplied)}</span>
              </div>
            )}

            <div className="border-t border-amber-100 pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span className="text-gray-900">{tr('Final Total:', 'סה״כ לתשלום:')}</span>
                <span className="luxury-text-gradient">{formatCurrency(receipt.finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Loyalty Program */}
        <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden mb-6 luxury-animate-slide-up luxury-delay-3">
          <div className="luxury-glass-panel px-6 py-4">
            <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
              <Star className="h-5 w-5" />
              {tr('Loyalty Program', 'תכנית נאמנות')}
            </h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="luxury-text-small">{tr('Points Earned:', 'נקודות שנצברו:')}</span>
              <span className="luxury-badge bg-green-100 text-green-700">
                +{receipt.loyaltyPointsEarned} {tr(
                  receipt.loyaltyPointsEarned === 1 ? 'point' : 'points',
                  receipt.loyaltyPointsEarned === 1 ? 'נקודה' : 'נקודות',
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="luxury-text-small">{tr('Current Tier:', 'דרג נוכחי:')}</span>
              <span className={`luxury-badge ${getTierColor(receipt.currentTier)}`}>
                {getTierIcon(receipt.currentTier)}
                <span className="ml-1">{receipt.currentTier}</span>
              </span>
            </div>

            {receipt.currentTier !== receipt.nextTier && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="luxury-text-small">
                    {tr(`Progress to ${receipt.nextTier}:`, `התקדמות ל-${receipt.nextTier}:`)}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {receipt.currentTierPoints} / {receipt.nextTierPoints} {tr('pts', 'נק׳')}
                  </span>
                </div>
                <div className="w-full luxury-glass-minimal rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#D4AF37] to-[#B8932F] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                <p className="luxury-text-small text-center">
                  {tr(
                    `${(receipt.nextTierPoints ?? 0) - (receipt.currentTierPoints ?? 0)} points to ${receipt.nextTier}`,
                    `${(receipt.nextTierPoints ?? 0) - (receipt.currentTierPoints ?? 0)} נקודות ל-${receipt.nextTier}`,
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* QR Code */}
        <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden mb-6 luxury-animate-slide-up luxury-delay-4">
          <div className="luxury-glass-panel px-6 py-4">
            <h2 className="font-bold luxury-text-gradient flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              {tr('Receipt QR Code', 'קוד QR לקבלה')}
            </h2>
          </div>
          <div className="px-6 py-6 text-center">
            <div className="luxury-glass-minimal p-4 rounded-xl inline-block">
              <img
                src={receipt.receiptQrCode}
                alt={tr('Receipt QR Code', 'קוד QR לקבלה')}
                className="w-32 h-32 mx-auto"
              />
            </div>
            <p className="luxury-text-small mt-2">
              {tr('Scan to view this receipt or share with friends', 'סרקו כדי לראות את הקבלה או לשתף עם חברים')}
            </p>
          </div>
        </div>

        {/* Action Buttons.
            The "Rate Your Experience" button used to open /rate/${transactionId} —
            no such Route exists in App.tsx, so the button was a dead nav.
            Removed until the rate-a-wash surface is wired.
            "Wash Now" previously opened /k9000 (the hub); pointed at
            /k9000/booking (the actual redeem surface) so the label matches. */}
        <div className="space-y-3 luxury-animate-slide-up luxury-delay-5">
          <Button
            className="luxury-btn-primary w-full"
            onClick={() => window.open(`/k9000/booking`, '_blank')}
          >
            <Gift className="h-4 w-4 mr-2" />
            {tr('Wash Now', 'לשטיפה עכשיו')}
          </Button>

          {receipt.userId && (
            <Button
              className="luxury-btn-secondary w-full"
              onClick={() => window.open(`/?ref=${receipt.userId}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {tr('Share & Earn Rewards', 'שתפו והרוויחו הטבות')}
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 luxury-text-small luxury-animate-fade-in luxury-delay-6">
          <p>
            {tr(
              'Thank you for choosing ⁦PetWash™⁩ Premium Services',
              'תודה שבחרתם ב-⁦PetWash™⁩ Premium',
            )}
          </p>
          <p className="mt-2">
            {tr('Questions?', 'שאלות?')}{' '}
            {tr('Contact us at', 'צרו קשר ב-')}{' '}
            <a href="mailto:Support@PetWash.co.il" className="luxury-text-gradient font-semibold">Support@PetWash.co.il</a>
          </p>
        </div>
      </div>
    </div>
  );
}