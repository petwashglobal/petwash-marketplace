import { SiVisa, SiMastercard, SiAmericanexpress, SiApplepay } from 'react-icons/si';
import { CreditCard, Smartphone } from 'lucide-react';

interface PaymentIconsProps {
  variant?: 'default' | 'compact';
  showTitle?: boolean;
}

export default function PaymentIcons({ variant = 'default', showTitle = false }: PaymentIconsProps) {
  const isCompact = variant === 'compact';

  return (
    <div className="w-full" data-testid="payment-icons-container">
      {/* Credit Cards */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
        {/* Visa */}
        <div 
          className={`bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex items-center justify-center ${
            isCompact ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
          }`}
          title="Visa"
          data-testid="payment-icon-visa"
        >
          <SiVisa 
            className={`${isCompact ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-16 h-16 sm:w-20 sm:h-20'}`}
            style={{ color: '#1A1F71' }}
            aria-label="Visa"
          />
        </div>

        {/* Mastercard */}
        <div 
          className={`bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex items-center justify-center ${
            isCompact ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
          }`}
          title="Mastercard"
          data-testid="payment-icon-mastercard"
        >
          <SiMastercard 
            className={`${isCompact ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-16 h-16 sm:w-20 sm:h-20'}`}
            style={{ color: '#EB001B' }}
            aria-label="Mastercard"
          />
        </div>

        {/* American Express */}
        <div 
          className={`bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex items-center justify-center ${
            isCompact ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
          }`}
          title="American Express"
          data-testid="payment-icon-amex"
        >
          <SiAmericanexpress 
            className={`${isCompact ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-16 h-16 sm:w-20 sm:h-20'}`}
            style={{ color: '#006FCF' }}
            aria-label="American Express"
          />
        </div>

        {/* Diners Club */}
        <div 
          className={`bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex items-center justify-center ${
            isCompact ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
          }`}
          title="Diners Club"
          data-testid="payment-icon-diners"
        >
          <svg
            className={`${isCompact ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-16 h-16 sm:w-20 sm:h-20'}`}
            viewBox="0 0 780 500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Diners Club"
          >
            <rect width="780" height="500" rx="40" fill="#0079BE"/>
            <circle cx="267" cy="250" r="150" fill="white"/>
            <circle cx="513" cy="250" r="150" fill="white"/>
            <path d="M267 100C183.203 100 117 166.203 117 250C117 333.797 183.203 400 267 400V100Z" fill="#0079BE"/>
            <path d="M513 100V400C596.797 400 663 333.797 663 250C663 166.203 596.797 100 513 100Z" fill="#0079BE"/>
          </svg>
        </div>

        {/* Apple Pay */}
        <div 
          className={`bg-black rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex items-center justify-center ${
            isCompact ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
          }`}
          title="Apple Pay"
          data-testid="payment-icon-applepay"
        >
          <SiApplepay 
            className={`${isCompact ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-16 h-16 sm:w-20 sm:h-20'}`}
            style={{ color: 'white' }}
            aria-label="Apple Pay"
          />
        </div>

        {/* Google Pay */}
        <div 
          className={`bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex items-center justify-center ${
            isCompact ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
          }`}
          title="Google Pay"
          data-testid="payment-icon-googlepay"
        >
          <svg
            className={`${isCompact ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-16 h-16 sm:w-20 sm:h-20'}`}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Google Pay"
          >
            <path d="M24 23.2V28h7.2c-0.6 1.8-2.4 5.2-7.2 5.2-4.4 0-7.9-3.6-7.9-8s3.5-8 7.9-8c2.5 0 4.2 1.1 5.1 2l3.7-3.6C30.6 13.4 27.6 12 24 12c-6.6 0-12 5.4-12 12s5.4 12 12 12c6.9 0 11.5-4.9 11.5-11.7 0-0.8-0.1-1.4-0.2-2.1H24z" fill="#4285F4"/>
            <path d="M11 24c0-1.4 0.3-2.7 0.8-3.9L7.7 16.5C6.6 18.2 6 20 6 22c0 2 0.6 3.8 1.7 5.5l4.1-3.6C11.3 26.7 11 25.4 11 24z" fill="#FBBC05"/>
            <path d="M24 12c2.5 0 4.2 1.1 5.1 2l3.7-3.6C30.6 8.2 27.6 6 24 6c-4.8 0-9.1 2.8-11.1 6.9l4.2 3.3C18.1 13.6 20.8 12 24 12z" fill="#EA4335"/>
            <path d="M24 36c3.6 0 6.6-1.2 8.8-3.3l-4.1-3.5c-1.1 0.8-2.6 1.3-4.7 1.3-3.6 0-6.6-2.4-7.7-5.7l-4.2 3.3C14.9 33.2 19.2 36 24 36z" fill="#34A853"/>
          </svg>
        </div>
      </div>

      {/* Nayax Badge */}
      <div className="mt-6 sm:mt-8 flex justify-center">
        <div className="group cursor-default transform hover:scale-105 transition-all duration-300" title="Nayax Mobile Payment Gateway" data-testid="payment-badge-nayax">
          <div className="relative bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-400/20 via-transparent to-teal-400/20"></div>
            <div className="relative flex items-center gap-2 sm:gap-3">
              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden="true" />
              <span className="text-white text-sm sm:text-base lg:text-lg font-bold tracking-wide uppercase">
                Nayax Payment Gateway
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
