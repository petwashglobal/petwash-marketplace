import { Shield, Lock } from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface PaymentMethodsProps {
  language?: Language;
  showNayax?: boolean;
  compact?: boolean;
}

const paymentLogos = [
  { name: 'Visa', src: '/assets/payments/visa-color.svg' },
  { name: 'Mastercard', src: '/assets/payments/mastercard-color.svg' },
  { name: 'American Express', src: '/assets/payments/amex-color.svg' },
  { name: 'Apple Pay', src: '/assets/payments/apple-pay-color.svg' },
  { name: 'Google Pay', src: '/assets/payments/google-pay-color.svg' },
  { name: 'Diners Club', src: '/assets/payments/diners-color.svg' },
];

export default function PaymentMethods({ 
  language = 'en', 
  showNayax = true,
  compact = false
}: PaymentMethodsProps) {
  const isHebrew = language === 'he';

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-3" data-testid="payment-methods-compact">
        {paymentLogos.map((logo) => (
          <div
            key={logo.name}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            data-testid={`payment-logo-${logo.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <img 
              src={logo.src} 
              alt={logo.name}
              className="h-6 w-auto object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6" data-testid="payment-methods-container">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-green-600" />
        <p className="text-sm font-semibold text-gray-800">
          {isHebrew ? 'עיבוד תשלומים מאובטח עם מותגים עולמיים מהימנים' : 'Secure payment processing with trusted global brands'}
        </p>
      </div>
      
      <div 
        className="flex flex-wrap items-center justify-center gap-4"
        data-testid="payment-icons-container"
      >
        {paymentLogos.map((logo) => (
          <div
            key={logo.name}
            className="flex items-center justify-center p-3 bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-lg hover:scale-105 transition-all duration-200"
            data-testid={`payment-logo-${logo.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <img 
              src={logo.src} 
              alt={logo.name}
              className="h-8 w-auto object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border border-green-200">
        <Shield className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-green-700">
          {isHebrew ? 'תשלום מאובטח 100% עם הצפנת SSL' : '100% Secure Payment with SSL Encryption'}
        </span>
      </div>
      
      {showNayax && (
        <div className="flex flex-col items-center gap-1 mt-3 pt-4 border-t border-gray-200 w-full" data-testid="nayax-branding">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-gray-800">
              Powered by Nayax Israel
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {isHebrew 
              ? 'שער תשלום בלעדי לישראל' 
              : 'Exclusive Payment Gateway for Israel'}
          </span>
        </div>
      )}
    </div>
  );
}
