import { Lock, Sparkles } from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface PaymentMethodsProps {
  language?: Language;
  compact?: boolean;
  size?: string;
}

function PaymentLogos({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 sm:gap-3 py-3 px-2 sm:px-4 flex-wrap ${className}`} role="region" aria-label="Payments accepted">
      <img 
        className="h-[30px] sm:h-[36px] md:h-[46px] lg:h-[52px] max-w-[85%] sm:max-w-none w-auto object-contain" 
        src="/pay/payment-methods.jpg" 
        alt="We accept Visa, Mastercard, American Express, Apple Pay, Google Pay" 
        loading="lazy" 
      />
      <img 
        className="h-[18px] sm:h-[22px] md:h-[28px] lg:h-[32px] w-auto object-contain" 
        src="/pay/diners.jpg" 
        alt="Diners Club International" 
        loading="lazy" 
      />
    </div>
  );
}

export default function PaymentMethods({
  language = 'en',
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
      </div>
    </section>
  );
}
