import { CreditCard, Smartphone, Shield } from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface PaymentMethodsProps {
  language?: Language;
  showNayax?: boolean;
}

export default function PaymentMethods({ 
  language = 'en', 
  showNayax = true 
}: PaymentMethodsProps) {
  const isRTL = language === 'he' || language === 'ar';

  return (
    <div className="flex flex-col items-center gap-4" data-testid="payment-methods-container">
      <p className="text-sm font-medium text-gray-700">
        {language === 'he' ? 'אמצעי תשלום מקובלים' : 'Accepted Payment Methods'}
      </p>
      
      <div 
        className="flex flex-wrap items-center justify-center gap-3"
        data-testid="payment-icons-container"
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <CreditCard className="w-5 h-5 text-gray-700" />
          <span className="text-sm font-medium text-gray-700">Visa</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <CreditCard className="w-5 h-5 text-gray-700" />
          <span className="text-sm font-medium text-gray-700">Mastercard</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <CreditCard className="w-5 h-5 text-gray-700" />
          <span className="text-sm font-medium text-gray-700">Amex</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <CreditCard className="w-5 h-5 text-gray-700" />
          <span className="text-sm font-medium text-gray-700">Diners</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <Smartphone className="w-5 h-5 text-gray-700" />
          <span className="text-sm font-medium text-gray-700">Apple Pay</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <Smartphone className="w-5 h-5 text-gray-700" />
          <span className="text-sm font-medium text-gray-700">Google Pay</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-green-600">
        <Shield className="w-4 h-4" />
        <span className="text-xs font-medium">
          {language === 'he' ? 'תשלום מאובטח 100%' : '100% Secure Payment'}
        </span>
      </div>
      
      {showNayax && (
        <div className="flex flex-col items-center gap-1 mt-2 pt-3 border-t border-gray-200" data-testid="nayax-branding">
          <span className="text-sm font-bold text-gray-800">
            Powered by Nayax Israel
          </span>
          <span className="text-xs text-gray-500">
            {language === 'he' 
              ? 'שער תשלום בלעדי' 
              : 'Exclusive Payment Gateway'}
          </span>
        </div>
      )}
    </div>
  );
}
