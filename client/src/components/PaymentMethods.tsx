import { Lock, Sparkles } from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface PaymentMethodsProps {
  language?: Language;
  showNayax?: boolean;
  compact?: boolean;
  size?: string;
}

const payLogos = [
  { src: '/pay/apple-pay.svg', alt: 'Apple Pay' },
  { src: '/pay/google-pay.svg', alt: 'Google Pay' },
  { src: '/pay/visa.svg', alt: 'Visa' },
  { src: '/pay/mastercard.svg', alt: 'Mastercard' },
  { src: '/pay/amex.svg', alt: 'American Express' },
  { src: '/pay/diners.svg', alt: 'Diners Club' },
];

function PaymentLogos({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-[14px] flex-wrap py-2.5 px-3 ${className}`} role="region" aria-label="Payments accepted">
      {payLogos.map((logo) => (
        <img
          key={logo.alt}
          className="h-[28px] sm:h-[32px] w-auto max-w-[140px] block object-contain"
          src={logo.src}
          alt={logo.alt}
        />
      ))}
    </div>
  );
}

export default function PaymentMethods({ 
  language = 'en', 
  showNayax = true,
  compact = false,
}: PaymentMethodsProps) {
  const isHebrew = language === 'he';

  if (compact) {
    return <PaymentLogos />;
  }

  return (
    <section 
      className="py-12 px-4 bg-gradient-to-b from-white via-gray-50/50 to-white" 
      data-testid="payment-methods-container"
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#c6a664]" />
            <h3 className="text-lg font-semibold text-gray-900 tracking-tight">
              {isHebrew ? 'אמצעי תשלום מאובטחים' : 'Secure Payment Methods'}
            </h3>
            <Lock className="w-4 h-4 text-[#c6a664]" />
          </div>
        </div>
        
        <PaymentLogos className="mb-8" />
        
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
