import { Lock, Sparkles } from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface PaymentMethodsProps {
  language?: Language;
  showNayax?: boolean;
  compact?: boolean;
  size?: string;
}

function PaymentIcons({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-4 sm:gap-5 flex-wrap ${className}`} role="region" aria-label="Payments accepted">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20" width="50" height="20" aria-label="Apple Pay" role="img">
        <path d="M10.15 4.54c-.54 0-1.39.31-1.85.86-.44.51-.77 1.25-.77 2.01 0 .07 0 .15.01.21.43-.02 1.22-.32 1.69-.88.42-.49.72-1.18.72-1.99 0-.08-.01-.15-.02-.21h.22zm-.25 3.01c-.16.03-.31.05-.46.05-.89 0-1.74-.52-2.22-1.37-.5-0.89-.5-1.97 0-2.86.48-.85 1.33-1.37 2.22-1.37.15 0 .3.02.46.05v-.27a2.53 2.53 0 0 0-3.32 1.37c-.66 1.17-.66 2.61 0 3.78a2.53 2.53 0 0 0 3.32 1.37v-.75z" fill="#000"/>
        <text x="14" y="15" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill="#000">Pay</text>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20" width="50" height="20" aria-label="Google Pay" role="img">
        <path d="M7.5 10.1v2.1h3.4c-.1 1.1-1.3 3.3-3.4 3.3-1.8 0-3.3-1.5-3.3-3.4s1.5-3.4 3.3-3.4c1 0 1.7.4 2.1.8l1.7-1.6C10.3 7 9 6.2 7.5 6.2 4.5 6.2 2 8.7 2 11.7s2.5 5.5 5.5 5.5c3.1 0 5.2-2.2 5.2-5.3 0-.4 0-.6-.1-.8H7.5z" fill="#4285F4"/>
        <text x="14" y="15" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill="#5F6368">Pay</text>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20" width="50" height="20" aria-label="Visa" role="img">
        <path d="M18.3 4.2l-2.9 11.6h-2.3l2.9-11.6h2.3zm8.9 0l-1.8 8.4-.2-1c-.4-1.4-1.6-3-3-3.8l1.9 8h-2.4l-3.6-11.6h2.4l.4.1c1.8.7 3 2.3 3.4 3.4l.8-4.5h2.5zm7.3 7.8c0 2.5-3.5 2.6-3.5 3.8 0 .4.4.7 1.2.7 1.5 0 2.1-.5 2.1-.5l.4 1.8s-.8.6-2.5.6c-2.3 0-3.6-1.2-3.6-3 0-2.4 3.4-2.7 3.4-3.9 0-.4-.3-.6-1-.6-1.1 0-1.8.4-1.8.4l-.4-1.8s.9-.6 2.3-.6c2.2 0 3.4 1.1 3.4 3.1z" fill="#1434CB"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20" width="50" height="20" aria-label="Mastercard" role="img">
        <circle cx="20" cy="10" r="7" fill="#EB001B" />
        <circle cx="30" cy="10" r="7" fill="#F79E1B" fillOpacity="0.8" />
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" aria-label="American Express" role="img">
        <rect width="20" height="20" rx="2" fill="#006FCF"/>
        <path d="M3 14l1.5-4h1l1.5 4H6l-.3-1h-1.4l-.3 1H3zm1.6-2.5h.8L5 10.4l-.4 1.1z" fill="#FFF"/>
        <text x="3" y="17" fontFamily="Arial" fontSize="3" fill="#FFF">AMEX</text>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20" width="50" height="20" aria-label="Diners Club" role="img">
        <path d="M25 3c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm-4.5 7c0-2.5 2-4.5 4.5-4.5V14.5c-2.5 0-4.5-2-4.5-4.5z" fill="#0079BE"/>
      </svg>
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
    return <PaymentIcons />;
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
        
        <PaymentIcons className="mb-8" />
        
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
