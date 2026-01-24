import { Shield, Lock, Sparkles } from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface PaymentMethodsProps {
  language?: Language;
  showNayax?: boolean;
  compact?: boolean;
}

const paymentMethods = [
  { name: 'Visa', color: '#1A1F71', textColor: '#fff' },
  { name: 'Mastercard', color: '#EB001B', textColor: '#fff' },
  { name: 'American Express', shortName: 'AMEX', color: '#006FCF', textColor: '#fff' },
  { name: 'Apple Pay', color: '#000', textColor: '#fff' },
  { name: 'Google Pay', color: '#4285F4', textColor: '#fff' },
];

export default function PaymentMethods({ 
  language = 'en', 
  showNayax = true,
  compact = false
}: PaymentMethodsProps) {
  const isHebrew = language === 'he';

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-3 flex-wrap" data-testid="payment-methods-compact">
        {paymentMethods.map((method) => (
          <div
            key={method.name}
            className="px-3 py-2 rounded-lg font-bold text-xs tracking-wide"
            style={{ backgroundColor: method.color, color: method.textColor }}
            data-testid={`payment-logo-${method.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {method.shortName || method.name}
          </div>
        ))}
      </div>
    );
  }

  return (
    <section 
      className="py-12 px-4 bg-gradient-to-b from-white via-gray-50/50 to-white" 
      data-testid="payment-methods-container"
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#c6a664]" />
            <h3 className="text-lg font-semibold text-gray-900 tracking-tight">
              {isHebrew ? 'אמצעי תשלום מאובטחים' : 'Secure Payment Methods'}
            </h3>
            <Lock className="w-4 h-4 text-[#c6a664]" />
          </div>
        </div>
        
        <div 
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-8"
          data-testid="payment-icons-container"
        >
          {paymentMethods.map((method) => (
            <div
              key={method.name}
              className="flex items-center justify-center px-4 py-3 sm:px-5 sm:py-3 rounded-xl font-bold text-sm sm:text-base tracking-wide shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300"
              style={{ backgroundColor: method.color, color: method.textColor }}
              data-testid={`payment-logo-${method.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {method.shortName || method.name}
            </div>
          ))}
        </div>
        
        {showNayax && (
          <div className="flex flex-col items-center gap-2 pt-4" data-testid="nayax-branding">
            <div className="flex items-center gap-2 px-5 py-2 bg-slate-900 rounded-full">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-white">
                Powered by <span className="text-[#c6a664]">Nayax</span> Israel
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
