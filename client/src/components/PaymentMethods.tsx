import { Shield, Lock } from 'lucide-react';
import { 
  SiVisa, 
  SiMastercard, 
  SiAmericanexpress,
  SiApplepay, 
  SiGooglepay,
  SiPaypal
} from 'react-icons/si';
import { type Language } from '@/lib/i18n';

interface PaymentMethodsProps {
  language?: Language;
  showNayax?: boolean;
  compact?: boolean;
}

export default function PaymentMethods({ 
  language = 'en', 
  showNayax = true,
  compact = false
}: PaymentMethodsProps) {
  const isHebrew = language === 'he';

  const paymentBrands = [
    { 
      name: 'Visa', 
      icon: SiVisa, 
      color: '#1A1F71',
      bg: 'bg-white'
    },
    { 
      name: 'Mastercard', 
      icon: SiMastercard, 
      color: '#EB001B',
      bg: 'bg-white'
    },
    { 
      name: 'Amex', 
      icon: SiAmericanexpress, 
      color: '#006FCF',
      bg: 'bg-white'
    },
    { 
      name: 'Apple Pay', 
      icon: SiApplepay, 
      color: '#000000',
      bg: 'bg-white'
    },
    { 
      name: 'Google Pay', 
      icon: SiGooglepay, 
      color: '#4285F4',
      bg: 'bg-white'
    },
    { 
      name: 'PayPal', 
      icon: SiPaypal, 
      color: '#003087',
      bg: 'bg-white'
    },
  ];

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-3" data-testid="payment-methods-compact">
        {paymentBrands.map((brand) => (
          <div
            key={brand.name}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            title={brand.name}
            data-testid={`payment-logo-${brand.name.toLowerCase().replace(' ', '-')}`}
          >
            <brand.icon 
              className="w-8 h-5" 
              style={{ color: brand.color }}
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
        {paymentBrands.map((brand) => (
          <div
            key={brand.name}
            className="flex items-center justify-center p-3 bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-lg hover:scale-105 transition-all duration-200 min-w-[80px]"
            title={brand.name}
            data-testid={`payment-logo-${brand.name.toLowerCase().replace(' ', '-')}`}
          >
            <brand.icon 
              className="w-12 h-8" 
              style={{ color: brand.color }}
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
