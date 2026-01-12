import { Shield, Lock } from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface PaymentMethodsProps {
  language?: Language;
  showNayax?: boolean;
  compact?: boolean;
}

const VisaIcon = () => (
  <svg viewBox="0 0 48 32" className="h-8 w-auto">
    <rect width="48" height="32" rx="4" fill="#1A1F71"/>
    <path d="M19.5 21h-2.8l1.8-11h2.8l-1.8 11zm11.7-10.7c-.6-.2-1.4-.4-2.5-.4-2.8 0-4.7 1.5-4.7 3.6 0 1.6 1.4 2.4 2.5 2.9 1.1.5 1.5.9 1.5 1.4 0 .7-.9 1.1-1.7 1.1-1.1 0-1.7-.2-2.7-.6l-.4-.2-.4 2.5c.7.3 1.9.6 3.2.6 2.9 0 4.9-1.5 4.9-3.7 0-1.2-.7-2.2-2.4-3-.9-.5-1.5-.8-1.5-1.3 0-.4.5-.9 1.5-.9.9 0 1.5.2 2 .4l.2.1.4-2.5zm7.1-.3h-2.2c-.7 0-1.2.2-1.5.9l-4.2 10.1h2.9l.6-1.6h3.6l.3 1.6h2.6l-2.1-11zm-3.5 7.1l1.1-3.1.3-.9.2.8.6 3.2h-2.2zm-20.3-7.1l-2.7 7.5-.3-1.5c-.5-1.7-2-3.5-3.7-4.4l2.5 9.4h3l4.4-11h-3.2z" fill="#fff"/>
    <path d="M10 10h4.5l-4.2 11H6.8L4.5 12.5c-.1-.4-.4-.7-.8-.9C2.7 11 1.4 10.6 0 10.3l.1-.3H6c.8 0 1.5.5 1.7 1.3l1 5.2L10 10z" fill="#F7B600"/>
  </svg>
);

const MastercardIcon = () => (
  <svg viewBox="0 0 48 32" className="h-8 w-auto">
    <rect width="48" height="32" rx="4" fill="#000"/>
    <circle cx="18" cy="16" r="8" fill="#EB001B"/>
    <circle cx="30" cy="16" r="8" fill="#F79E1B"/>
    <path d="M24 9.8a8 8 0 0 0-3 6.2 8 8 0 0 0 3 6.2 8 8 0 0 0 3-6.2 8 8 0 0 0-3-6.2z" fill="#FF5F00"/>
  </svg>
);

const AmexIcon = () => (
  <svg viewBox="0 0 48 32" className="h-8 w-auto">
    <rect width="48" height="32" rx="4" fill="#006FCF"/>
    <path d="M7 16l-2-5h-2l3.5 8h1l3.5-8h-2l-2 5zm8-5h-5v8h5v-1.5h-3.5v-1.5h3.5v-1.5h-3.5v-1.5h3.5V11zm4 8h2v-6h2.5v-2h-7v2h2.5v6zm7-8l-2.5 4-2.5-4h-2l3.5 5v3h2v-3l3.5-5h-2zm10 0h-2l-1.5 4-1.5-4h-2v8h1.5v-5.5l1.5 4h1l1.5-4V19H36v-8z" fill="#fff"/>
  </svg>
);

const ApplePayIcon = () => (
  <svg viewBox="0 0 48 32" className="h-8 w-auto">
    <rect width="48" height="32" rx="4" fill="#000"/>
    <path d="M12.7 10.8c.6-.8 1-1.8.9-2.8-.9 0-2 .6-2.6 1.4-.6.7-1 1.7-.9 2.7.9.1 1.9-.5 2.6-1.3zm.9 1.4c-1.4-.1-2.6.8-3.3.8s-1.7-.8-2.8-.7c-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1 2.6-2.1.8-1.2 1.2-2.3 1.2-2.4 0 0-2.3-.9-2.3-3.5 0-2.2 1.8-3.2 1.9-3.3-.9-1.5-2.6-1.6-3.2-1.6zm9.3.3v12h2v-4.1h2.8c2.5 0 4.3-1.7 4.3-4s-1.7-3.9-4.2-3.9h-4.9zm2 1.7h2.3c1.7 0 2.7.9 2.7 2.3s-1 2.3-2.7 2.3h-2.3v-4.6zm11.2 10.4c1.3 0 2.4-.6 3-1.7h0v1.6h1.9v-6.2c0-1.9-1.5-3.1-3.8-3.1-2.1 0-3.7 1.2-3.8 2.9h1.8c.2-.8.9-1.3 2-1.3 1.2 0 1.9.6 1.9 1.7v.7l-2.5.2c-2.3.1-3.5 1.1-3.5 2.7 0 1.6 1.3 2.7 3 2.7zm.5-1.5c-1.1 0-1.8-.5-1.8-1.3 0-.9.6-1.4 1.9-1.5l2.3-.1v.8c0 1.2-1 2.1-2.4 2.1zm6.9 4.3c1.9 0 2.8-.7 3.6-2.9l3.4-9.5h-2l-2.3 7.3h0l-2.3-7.3h-2.1l3.3 9.1-.2.5c-.3.9-.8 1.3-1.7 1.3h-.6v1.5h.9z" fill="#fff"/>
  </svg>
);

const GooglePayIcon = () => (
  <svg viewBox="0 0 48 32" className="h-8 w-auto">
    <rect width="48" height="32" rx="4" fill="#fff" stroke="#e0e0e0"/>
    <path d="M22.7 15.8v4.6h-1.5v-11h3.9c.9 0 1.8.3 2.5.9.7.6 1 1.4 1 2.3 0 .9-.3 1.7-1 2.3-.7.6-1.5.9-2.5.9h-2.4zm0-5v3.7h2.4c.5 0 1-.2 1.4-.5.4-.4.6-.8.6-1.3s-.2-1-.6-1.3c-.4-.4-.8-.5-1.4-.5h-2.4zm8.5 1.6c1.1 0 2 .3 2.6.9.6.6.9 1.4.9 2.5v5.1h-1.4v-1.1h-.1c-.6.9-1.4 1.4-2.4 1.4-.9 0-1.6-.3-2.2-.8-.6-.5-.9-1.2-.9-2 0-.8.3-1.5.9-2 .6-.5 1.4-.7 2.4-.7.8 0 1.5.1 2 .4v-.3c0-.6-.2-1-.6-1.4-.4-.4-.9-.6-1.5-.6-.9 0-1.5.4-2 1.1l-1.3-.8c.7-1 1.7-1.5 3-1.5h-.4zm-1.9 5.6c0 .4.2.8.5 1.1.3.3.7.4 1.2.4.6 0 1.2-.2 1.7-.7.5-.5.7-1 .7-1.6-.4-.3-1-.5-1.8-.5-.6 0-1.1.1-1.5.4-.5.3-.8.6-.8 1v-.1zm10.5-5.4l-4.9 11.3h-1.5l1.8-4-3.2-7.4h1.6l2.3 5.6h0l2.2-5.6h1.7z" fill="#5F6368"/>
    <path d="M17.2 15.6c0-.5-.1-1-.1-1.5h-6.7v2.8h3.8c-.2.9-.7 1.7-1.4 2.2v1.8h2.3c1.3-1.2 2.1-3 2.1-5.3z" fill="#4285F4"/>
    <path d="M10.4 21.7c1.9 0 3.5-.6 4.7-1.7l-2.3-1.8c-.6.4-1.4.7-2.4.7-1.8 0-3.4-1.2-4-2.9H4v1.9c1.2 2.3 3.6 3.8 6.4 3.8z" fill="#34A853"/>
    <path d="M6.4 16c-.1-.4-.2-.9-.2-1.4s.1-1 .2-1.4V11.3H4c-.5 1-.8 2.1-.8 3.3s.3 2.3.8 3.3l2.4-1.6z" fill="#FBBC05"/>
    <path d="M10.4 10.3c1 0 1.9.4 2.7 1l2-2c-1.2-1.1-2.8-1.8-4.7-1.8-2.8 0-5.2 1.5-6.4 3.8l2.4 1.9c.6-1.7 2.2-2.9 4-2.9z" fill="#EA4335"/>
  </svg>
);

const DinersIcon = () => (
  <svg viewBox="0 0 48 32" className="h-8 w-auto">
    <rect width="48" height="32" rx="4" fill="#0079BE"/>
    <circle cx="24" cy="16" r="10" fill="#fff"/>
    <path d="M20 10.5v11c-2.2-1-3.8-3.3-3.8-5.5s1.6-4.5 3.8-5.5zm8 0c2.2 1 3.8 3.3 3.8 5.5s-1.6 4.5-3.8 5.5v-11z" fill="#0079BE"/>
  </svg>
);

const paymentMethods = [
  { name: 'Visa', Icon: VisaIcon },
  { name: 'Mastercard', Icon: MastercardIcon },
  { name: 'American Express', Icon: AmexIcon },
  { name: 'Apple Pay', Icon: ApplePayIcon },
  { name: 'Google Pay', Icon: GooglePayIcon },
  { name: 'Diners Club', Icon: DinersIcon },
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
        {paymentMethods.map(({ name, Icon }) => (
          <div
            key={name}
            className="p-2 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100/80 hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] transition-all duration-300 hover:scale-105"
            data-testid={`payment-logo-${name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Icon />
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
            <Lock className="w-5 h-5 text-[#0a2540]" />
            <h3 className="text-lg font-semibold text-gray-900 tracking-tight">
              {isHebrew ? 'אמצעי תשלום מקובלים' : 'Accepted Payment Methods'}
            </h3>
          </div>
          <p className="text-sm text-gray-600">
            {isHebrew 
              ? 'עיבוד תשלומים מאובטח עם מותגים עולמיים מהימנים' 
              : 'Secure payment processing with trusted global brands'}
          </p>
        </div>
        
        <div 
          className="flex flex-wrap items-center justify-center gap-4 mb-8"
          data-testid="payment-icons-container"
        >
          {paymentMethods.map(({ name, Icon }) => (
            <div
              key={name}
              className="flex items-center justify-center p-4 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:scale-105 transition-all duration-300"
              data-testid={`payment-logo-${name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Icon />
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-center gap-2.5 px-6 py-3 bg-gradient-to-r from-emerald-50 to-green-50 rounded-full border border-emerald-200/60 mx-auto w-fit shadow-[0_2px_12px_rgba(16,185,129,0.1)]">
          <Shield className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">
            {isHebrew ? 'תשלום מאובטח 100%' : '100% Secure Payment'}
          </span>
          <Lock className="w-4 h-4 text-emerald-500" />
        </div>
        
        {showNayax && (
          <div className="flex flex-col items-center gap-2 mt-8 pt-6 border-t border-gray-100" data-testid="nayax-branding">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
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
    </section>
  );
}
