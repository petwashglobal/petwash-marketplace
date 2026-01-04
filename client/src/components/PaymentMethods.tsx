import { type Language } from '@/lib/i18n';

interface PaymentMethodsProps {
  language?: Language;
  showNayax?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function PaymentMethods({ 
  language = 'en', 
  showNayax = true,
  size = 'md' 
}: PaymentMethodsProps) {
  const sizeClasses = {
    sm: 'h-5',
    md: 'h-7',
    lg: 'h-9'
  };

  const iconSize = sizeClasses[size];

  return (
    <div className="flex flex-col items-center gap-3" data-testid="payment-methods-container">
      <div 
        className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
        data-testid="payment-icons-container"
      >
        <img
          src="/assets/payments/visa.svg"
          alt="Visa"
          className={`${iconSize} w-auto transition-transform duration-200 hover:scale-110`}
          data-testid="icon-visa"
        />
        <img
          src="/assets/payments/mastercard.svg"
          alt="Mastercard"
          className={`${iconSize} w-auto transition-transform duration-200 hover:scale-110`}
          data-testid="icon-mastercard"
        />
        <img
          src="/assets/payments/amex.svg"
          alt="American Express"
          className={`${iconSize} w-auto transition-transform duration-200 hover:scale-110`}
          data-testid="icon-amex"
        />
        <img
          src="/assets/payments/diners.svg"
          alt="Diners Club"
          className={`${iconSize} w-auto transition-transform duration-200 hover:scale-110`}
          data-testid="icon-diners"
        />
        <img
          src="/assets/payments/apple-pay.svg"
          alt="Apple Pay"
          className={`${iconSize} w-auto transition-transform duration-200 hover:scale-110`}
          data-testid="icon-apple-pay"
        />
        <img
          src="/assets/payments/google-pay.svg"
          alt="Google Pay"
          className={`${iconSize} w-auto transition-transform duration-200 hover:scale-110`}
          data-testid="icon-google-pay"
        />
      </div>
      
      {showNayax && (
        <div className="flex flex-col items-center gap-1 mt-2" data-testid="nayax-branding">
          <img
            src="/assets/payments/nayax.svg"
            alt="Nayax Israel - Exclusive Payment Gateway"
            className="h-8 w-auto"
            data-testid="icon-nayax"
          />
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
