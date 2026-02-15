import { Lock, Sparkles } from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface PaymentMethodsProps {
  language?: Language;
  showNayax?: boolean;
  compact?: boolean;
  size?: string;
}

const paymentLogos = [
  { name: 'Visa', src: '/assets/payments/visa-2025.svg', alt: 'Visa' },
  { name: 'Mastercard', src: '/assets/payments/mastercard-2025.svg', alt: 'Mastercard' },
  { name: 'American Express', src: '/assets/payments/amex-2025.svg', alt: 'American Express' },
  { name: 'Apple Pay', src: '/assets/payments/apple-pay-2025.svg', alt: 'Apple Pay' },
  { name: 'Google Pay', src: '/assets/payments/google-pay-2025.svg', alt: 'Google Pay' },
  { name: 'Diners Club', src: '/assets/payments/diners-2025.svg', alt: 'Diners Club' },
];

export default function PaymentMethods({ 
  language = 'en', 
  showNayax = true,
  compact = false,
}: PaymentMethodsProps) {
  const isHebrew = language === 'he';

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-2 flex-wrap" data-testid="payment-methods-compact" role="region" aria-label="Payments accepted">
        {paymentLogos.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-center w-14 h-9 bg-white rounded-lg border border-gray-200/60 shadow-sm overflow-hidden"
            data-testid={`payment-logo-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <img
              src={item.src}
              alt={item.alt}
              className="block h-full w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <section 
      className="py-12 px-4 bg-gradient-to-b from-white via-gray-50/50 to-white" 
      data-testid="payment-methods-container"
      role="region"
      aria-label="Payments accepted"
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
          {paymentLogos.map((item) => (
            <div
              key={item.name}
              className="group relative flex items-center justify-center w-16 h-10 sm:w-20 sm:h-12 md:w-24 md:h-14 lg:w-28 lg:h-16
                bg-gradient-to-br from-slate-50 via-white to-gray-100
                rounded-lg sm:rounded-xl 
                shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]
                border border-gray-200/60
                hover:shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_0_rgba(255,255,255,1)]
                hover:border-amber-300/50
                hover:scale-105
                transition-all duration-300 ease-out
                overflow-hidden"
              data-testid={`payment-logo-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <img
                src={item.src}
                alt={item.alt}
                className="block h-full w-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
        </div>
        
        {showNayax && (
          <div className="flex flex-col items-center gap-2 pt-4" data-testid="nayax-branding">
            <div className="flex items-center gap-3">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
              <div className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-full shadow-lg">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span className="text-sm font-bold text-white">
                  Powered by <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">Nayax</span> Israel
                </span>
              </div>
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
