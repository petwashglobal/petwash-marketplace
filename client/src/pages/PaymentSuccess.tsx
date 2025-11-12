import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { CheckCircle, Download, Share2 } from 'lucide-react';
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
  const [location] = useLocation();
  const { user } = useFirebaseAuth();
  const [voucherDetails, setVoucherDetails] = useState<VoucherDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const isRTL = language === 'he';

  useEffect(() => {
    // Extract transaction details from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const transactionId = urlParams.get('transaction_id');
    const status = urlParams.get('status');

    if (status === 'success' && transactionId) {
      // Fetch voucher details and track successful purchase
      fetchVoucherDetails(transactionId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchVoucherDetails = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/payment-success/${transactionId}`);
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
        title: 'Pet Wash™ Voucher',
        text: `Your Pet Wash™ voucher: ${voucherDetails.voucherCode}`,
        url: window.location.href
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!voucherDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-red-500 rounded-full" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('payment.failed', language)}
          </h1>
          <p className="text-gray-600">
            {t('payment.failedMessage', language)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-white ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('payment.successTitle', language)}
          </h1>
          <p className="text-gray-600 text-lg">
            {t('payment.voucherReady', language)}
          </p>
        </div>

        {/* Voucher Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-6 mb-6 border-2 border-blue-200">
          <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                {voucherDetails.qrCode ? (
                  <img 
                    src={voucherDetails.qrCode} 
                    alt="QR Code"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-gray-400 text-sm text-center">
                    {t('payment.qrCode', language)}
                  </div>
                )}
              </div>
            </div>

            {/* Voucher Details */}
            <div className="flex-1 text-center lg:text-left">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {voucherDetails.packageName}
              </h2>
              <div className="space-y-2 text-gray-700">
                <p>
                  <span className="font-medium">
                    {t('payment.voucherCode', language)}
                  </span> {voucherDetails.voucherCode}
                </p>
                <p>
                  <span className="font-medium">
                    {t('payment.washCount', language)}
                  </span> {voucherDetails.washCount}
                </p>
                <p>
                  <span className="font-medium">
                    {t('payment.amountPaid', language)}
                  </span> ₪{voucherDetails.amount}
                </p>
                <p>
                  <span className="font-medium">
                    {t('payment.expires', language)}
                  </span> {new Date(voucherDetails.expiresAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={downloadQRCode}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              {t('payment.downloadQR', language)}
            </button>
            <button
              onClick={shareVoucher}
              className="flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {t('payment.shareVoucher', language)}
            </button>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-800 mb-2">
            {t('payment.howToUse', language)}
          </h3>
          <ol className={`text-yellow-700 space-y-1 ${isRTL ? 'list-decimal list-inside' : 'list-decimal list-inside'}`}>
            <li>
              {t('payment.step1', language)}
            </li>
            <li>
              {t('payment.step2', language)}
            </li>
            <li>
              {t('payment.step3', language)}
            </li>
          </ol>
        </div>

        {/* Support Info */}
        <div className="text-center text-gray-600">
          <p className="mb-2">
            {t('payment.needHelp', language)}
          </p>
          <p className="font-medium">Support@PetWash.co.il</p>
          <p className="text-sm mt-4">
            {t('payment.transactionId', language)} {voucherDetails.transactionId}
          </p>
        </div>
      </div>
    </div>
  );
}