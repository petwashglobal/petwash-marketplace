import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/apiConfig';
import { useLocation } from 'wouter';
import { CheckCircle, Download, Share2, Sparkles, Home, ArrowRight } from 'lucide-react';
import { trackPaymentSuccess } from '@/lib/analytics';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { logger } from "@/lib/logger";
import { t, type Language } from '@/lib/i18n';

interface PaymentSuccessProps {
  language: Language;
}

interface VoucherDetails {
  voucherCode: string;
  qrCode: string;
  packageName: string;
  amount: number;
  washCount: number;
  expiresAt: string;
  transactionId: string;
}

export default function PaymentSuccess({ language }: PaymentSuccessProps) {
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const [voucherDetails, setVoucherDetails] = useState<VoucherDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGoogleReview, setShowGoogleReview] = useState(true);
  const isRTL = language === 'he';

  useEffect(() => {
    // Extract transaction details from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const transactionId = urlParams.get('transaction_id');
    const status = urlParams.get('status');

    if (status === 'success' && transactionId) {
      // Fetch voucher details and track successful purchase
      fetchVoucherDetails(transactionId);
      // Show confetti on success
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchVoucherDetails = async (transactionId: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/payment-success/${transactionId}`));
      if (response.ok) {
        const data = await response.json();
        setVoucherDetails(data);
        
        // Track successful purchase for GA4 analytics
        trackPaymentSuccess(
          user?.uid || 'guest',
          data.amount,
          data.packageName,
          transactionId
        );
      }
    } catch (error) {
      logger.error('Error fetching voucher details', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = () => {
    if (voucherDetails?.qrCode) {
      const link = document.createElement('a');
      link.href = voucherDetails.qrCode;
      link.download = `petwash-voucher-${voucherDetails.voucherCode}.png`;
      link.click();
    }
  };

  const shareVoucher = () => {
    if (navigator.share && voucherDetails) {
      navigator.share({
        title: '⁦Pet Wash™⁩ Voucher',
        text: `Your ⁦Pet Wash™⁩ voucher: ${voucherDetails.voucherCode}`,
        url: window.location.href
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="luxury-spinner" />
      </div>
    );
  }

  if (!voucherDetails) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 luxury-glass-card luxury-shadow-lg luxury-animate-scale-in">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full" />
          </div>
          <h1 className="luxury-heading-lg mb-3">
            {t('payment.failed', language)}
          </h1>
          <p className="luxury-text-body">
            {t('payment.failedMessage', language)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen luxury-bg-mesh ${isRTL ? 'rtl' : 'ltr'} relative overflow-hidden`}>
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-10%`,
                animation: `fall ${2 + Math.random() * 2}s linear forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            >
              <Sparkles 
                className="text-purple-400" 
                size={16 + Math.random() * 16}
                style={{
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-12 relative z-10">
        {/* Success Header */}
        <div className="text-center mb-10 luxury-animate-scale-in">
          <div className="relative w-32 h-32 mx-auto mb-8">
            {/* Gradient circle background */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 rounded-full blur-xl opacity-60 animate-pulse" />
            <div className="relative w-32 h-32 bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-2xl">
              <CheckCircle className="w-20 h-20 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="luxury-heading-xl luxury-text-gradient mb-4">
            {t('payment.successTitle', language)}
          </h1>
          <p className="luxury-text-body text-xl">
            {t('payment.voucherReady', language)}
          </p>
        </div>

        {/* Voucher Card */}
        <div className="luxury-glass-card luxury-shadow-xl luxury-hover-glow mb-8 luxury-animate-slide-up luxury-delay-1">
          <div className="p-8">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* QR Code */}
              <div className="luxury-glass-panel p-6 rounded-2xl">
                <div className="w-40 h-40 bg-white rounded-xl flex items-center justify-center shadow-inner">
                  {voucherDetails.qrCode ? (
                    <img 
                      src={voucherDetails.qrCode} 
                      alt="QR Code"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="luxury-text-small text-center">
                      {t('payment.qrCode', language)}
                    </div>
                  )}
                </div>
              </div>

              {/* Voucher Details */}
              <div className="flex-1 text-center lg:text-left">
                <div className="luxury-badge luxury-badge-success mb-4">
                  <Sparkles className="w-4 h-4" />
                  {t('payment.active', language) || 'Active'}
                </div>
                <h2 className="luxury-heading-md mb-6">
                  {voucherDetails.packageName}
                </h2>
                
                {/* Transaction Details Panel */}
                <div className="luxury-glass-panel p-5 rounded-xl space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="luxury-text-small font-medium">
                      {t('payment.voucherCode', language)}
                    </span>
                    <span className="font-mono font-bold text-lg">
                      {voucherDetails.voucherCode}
                    </span>
                  </div>
                  <div className="luxury-divider my-2" />
                  <div className="flex justify-between items-center">
                    <span className="luxury-text-small font-medium">
                      {t('payment.washCount', language)}
                    </span>
                    <span className="font-semibold text-lg">
                      {voucherDetails.washCount} {t('payment.washes', language) || 'washes'}
                    </span>
                  </div>
                  <div className="luxury-divider my-2" />
                  <div className="flex justify-between items-center">
                    <span className="luxury-text-small font-medium">
                      {t('payment.amountPaid', language)}
                    </span>
                    <span className="luxury-heading-lg luxury-text-gradient">
                      ₪{voucherDetails.amount}
                    </span>
                  </div>
                  <div className="luxury-divider my-2" />
                  <div className="flex justify-between items-center">
                    <span className="luxury-text-small font-medium">
                      {t('payment.expires', language)}
                    </span>
                    <span className="font-semibold">
                      {new Date(voucherDetails.expiresAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-gray-200/50">
              <button
                onClick={downloadQRCode}
                className="luxury-btn-secondary flex items-center justify-center gap-2 flex-1"
                data-testid="button-download-qr"
              >
                <Download className="w-4 h-4" />
                {t('payment.downloadQR', language)}
              </button>
              <button
                onClick={shareVoucher}
                className="luxury-btn-secondary flex items-center justify-center gap-2 flex-1"
                data-testid="button-share-voucher"
              >
                <Share2 className="w-4 h-4" />
                {t('payment.shareVoucher', language)}
              </button>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="luxury-glass-panel p-6 rounded-2xl mb-8 luxury-animate-slide-up luxury-delay-2">
          <h3 className="luxury-heading-sm mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            {t('payment.howToUse', language)}
          </h3>
          <ol className={`luxury-text-body space-y-3 ${isRTL ? 'list-decimal list-inside' : 'list-decimal list-inside'}`}>
            <li className="pl-2">
              {t('payment.step1', language)}
            </li>
            <li className="pl-2">
              {t('payment.step2', language)}
            </li>
            <li className="pl-2">
              {t('payment.step3', language)}
            </li>
          </ol>
        </div>

        {/* Google Review — soft, dismissible, only shown once */}
        {showGoogleReview && (
          <div className="luxury-glass-panel p-5 rounded-2xl mb-6 luxury-animate-slide-up luxury-delay-2 border border-amber-100 bg-amber-50/60 text-center">
            <p className="text-sm font-semibold text-amber-900 mb-1">
              {isRTL ? '🌟 שמחנו שבחרת ב-PetWash!' : '🌟 Thanks for choosing PetWash!'}
            </p>
            <p className="text-xs text-amber-700 mb-3 leading-relaxed">
              {isRTL
                ? 'אם יש לך דקה — ביקורת ב-Google עוזרת לנו להגיע לעוד בעלי חיות אהובות ❤️'
                : 'A quick Google review helps other pet owners find us ❤️'}
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <a
                href="https://maps.app.goo.gl/yXgfzyiYTYwLwcNy9?g_st=ic"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition-colors shadow-sm"
              >
                ⭐ {isRTL ? 'בכיף, אכתוב ביקורת' : 'Leave a review'}
              </a>
              <button
                onClick={() => setShowGoogleReview(false)}
                className="text-xs px-4 py-2 rounded-xl bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
              >
                {isRTL ? 'לא עכשיו, תודה' : 'Not now, thanks'}
              </button>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <div className="text-center mb-8 luxury-animate-fade-in luxury-delay-3">
          <button
            onClick={() => setLocation('/')}
            className="luxury-btn-primary luxury-shadow-xl inline-flex items-center gap-2"
            data-testid="button-continue-home"
          >
            <Home className="w-5 h-5" />
            {t('payment.backToHome', language) || 'Back to Home'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Support Info */}
        <div className="text-center luxury-text-small luxury-animate-fade-in luxury-delay-4">
          <p className="mb-2">
            {t('payment.needHelp', language)}
          </p>
          <p className="font-semibold luxury-text-gradient text-base mb-4">
            Support@PetWash.co.il
          </p>
          <p className="opacity-60">
            {t('payment.transactionId', language)} {voucherDetails.transactionId}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
