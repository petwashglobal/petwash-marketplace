import { t, type Language } from '@/lib/i18n';
import { Link } from 'wouter';
import { FaWhatsapp } from 'react-icons/fa';
import { Mail, Shield, Award, Leaf, CheckCircle2, Lock, Sparkles } from 'lucide-react';

const PaymentLogo = ({ type }: { type: string }) => {
  const vb = "0 0 160 100";
  switch (type) {
    case 'visa':
      return (
        <svg viewBox={vb} xmlns="http://www.w3.org/2000/svg" className="block w-full h-full">
          <rect width="160" height="100" rx="6" fill="#1A1F71" />
          <text x="80" y="62" textAnchor="middle" fill="#fff" fontFamily="Arial,Helvetica,sans-serif" fontWeight="bold" fontSize="42" fontStyle="italic" letterSpacing="2">VISA</text>
          <rect x="10" y="82" width="140" height="6" rx="3" fill="#F7B600" />
        </svg>
      );
    case 'mastercard':
      return (
        <svg viewBox={vb} xmlns="http://www.w3.org/2000/svg" className="block w-full h-full">
          <rect width="160" height="100" rx="6" fill="#1A1F71" />
          <circle cx="60" cy="50" r="30" fill="#EB001B" />
          <circle cx="100" cy="50" r="30" fill="#F79E1B" />
          <path d="M80 26.2a29.9 29.9 0 0 0-11.2 23.8A29.9 29.9 0 0 0 80 73.8 29.9 29.9 0 0 0 91.2 50 29.9 29.9 0 0 0 80 26.2z" fill="#FF5F00" />
        </svg>
      );
    case 'amex':
      return (
        <svg viewBox={vb} xmlns="http://www.w3.org/2000/svg" className="block w-full h-full">
          <rect width="160" height="100" rx="6" fill="#006FCF" />
          <text x="80" y="45" textAnchor="middle" fill="#fff" fontFamily="Arial,Helvetica,sans-serif" fontWeight="bold" fontSize="18" letterSpacing="1">AMERICAN</text>
          <text x="80" y="70" textAnchor="middle" fill="#fff" fontFamily="Arial,Helvetica,sans-serif" fontWeight="bold" fontSize="18" letterSpacing="1">EXPRESS</text>
        </svg>
      );
    case 'applepay':
      return (
        <svg viewBox={vb} xmlns="http://www.w3.org/2000/svg" className="block w-full h-full">
          <rect width="160" height="100" rx="6" fill="#000" />
          <g transform="translate(24, 20) scale(0.65)" fill="#fff">
            <path d="M33.6 16.26c-1.5 1.77-3.9 3.14-6.32 2.94-.3-2.4.88-4.97 2.26-6.55 1.5-1.86 4.1-3.24 6.22-3.33.26 2.5-.73 4.97-2.16 6.94zm2.12 3.53c-3.48-.21-6.45 1.98-8.1 1.98s-4.21-1.87-6.95-1.83c-3.58.06-6.9 2.08-8.74 5.3-3.74 6.45-.96 16.01 2.67 21.26 1.78 2.61 3.9 5.51 6.69 5.4 2.67-.1 3.69-1.72 6.91-1.72s4.13 1.72 6.95 1.67c2.9-.05 4.73-2.61 6.51-5.24 2.03-3.01 2.86-5.93 2.9-6.08-.05-.05-5.57-2.14-5.63-8.49-.05-5.3 4.32-7.85 4.52-8-2.48-3.64-6.32-4.05-7.7-4.25h-.03z" />
          </g>
          <text x="105" y="62" textAnchor="middle" fill="#fff" fontFamily="Arial,Helvetica,sans-serif" fontWeight="600" fontSize="28">Pay</text>
        </svg>
      );
    case 'googlepay':
      return (
        <svg viewBox={vb} xmlns="http://www.w3.org/2000/svg" className="block w-full h-full">
          <rect width="160" height="100" rx="6" fill="#f5f5f5" stroke="#dadce0" strokeWidth="1" />
          <g transform="translate(20, 28)">
            <path d="M24.38 23.35c0-1.15-.1-2.26-.29-3.32H12.5v6.28h6.67c-.29 1.56-1.16 2.88-2.48 3.76v3.13h4.01c2.35-2.16 3.68-5.35 3.68-9.85z" fill="#4285F4"/>
            <path d="M12.5 29.6c3.36 0 6.17-1.12 8.22-3.02l-4.01-3.13c-1.11.75-2.53 1.2-4.21 1.2-3.23 0-5.97-2.19-6.95-5.14H1.38v3.23c2.04 4.06 6.24 6.86 11.12 6.86z" fill="#34A853"/>
            <path d="M5.55 19.51a10.65 10.65 0 0 1 0-6.82V9.46H1.38a17.73 17.73 0 0 0 0 13.28l4.17-3.23z" fill="#FBBC04"/>
            <path d="M12.5 5.55c1.82 0 3.46.63 4.75 1.87l3.56-3.56C18.64 1.79 15.83.6 12.5.6 7.62.6 3.42 3.4 1.38 7.46l4.17 3.23c.98-2.95 3.72-5.14 6.95-5.14z" fill="#EA4335"/>
          </g>
          <text x="108" y="60" textAnchor="middle" fill="#3C4043" fontFamily="Arial,Helvetica,sans-serif" fontWeight="500" fontSize="22">Pay</text>
        </svg>
      );
    case 'diners':
      return (
        <svg viewBox={vb} xmlns="http://www.w3.org/2000/svg" className="block w-full h-full">
          <rect width="160" height="100" rx="6" fill="#fff" stroke="#dadce0" strokeWidth="1" />
          <g transform="translate(80, 46)">
            <circle cx="5" cy="0" r="34" fill="#0079BE" />
            <circle cx="-3" cy="0" r="30" fill="#fff" />
            <path d="M-21 -21 A30 30 0 0 0 -21 21" stroke="#0079BE" strokeWidth="6" fill="none" strokeLinecap="round" />
            <path d="M15 -21 A30 30 0 0 1 15 21" stroke="#0079BE" strokeWidth="6" fill="none" strokeLinecap="round" />
          </g>
        </svg>
      );
    default:
      return null;
  }
};

interface FooterProps {
  language: Language;
}

export function Footer({ language }: FooterProps) {
  return (
    <footer className="footer bg-white border-t border-gray-200 py-12 px-4" role="contentinfo">
      <div className="max-w-6xl mx-auto">
        {/* Main Footer Content */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          
          {/* Company Information */}
          <div className="text-center md:text-left">
            <Link href="/" aria-label={t('footer.backToHome', language)}>
              <img 
                src="/brand/petwash-logo-official.png" 
                alt="⁦Pet Wash™⁩ Official Logo"
                className="h-10 w-auto object-contain mx-auto md:mx-0 mb-4 cursor-pointer hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'transparent' }}
              />
            </Link>
            <p className="text-lg font-semibold text-black mb-2">
              {t('hero.slogan', language)}
            </p>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="brand-petwash">⁦Pet Wash™⁩</span> Ltd</p>
              <p>{t('footer.companyNumber', language)}: 517145033</p>
            </div>
          </div>

          {/* Legal Links */}
          <div className="text-center">
            <h4 className="font-bold text-black mb-4">
              {t('footer.legal', language)}
            </h4>
            <nav className="space-y-2">
              <div>
                <Link href="/signin" className="text-gray-600 hover:text-black transition-colors font-medium cursor-pointer">
                  {t('footer.login', language)}
                </Link>
              </div>
              <div>
                <Link href="/privacy" className="text-gray-600 hover:text-black transition-colors cursor-pointer">
                  {t('footer.privacy', language)}
                </Link>
              </div>
              <div>
                <Link href="/terms" className="text-gray-600 hover:text-black transition-colors cursor-pointer">
                  {t('footer.terms', language)}
                </Link>
              </div>
              <div>
                <Link href="/accessibility" className="text-gray-600 hover:text-black transition-colors cursor-pointer">
                  {t('footer.accessibility', language)}
                </Link>
              </div>
              <div>
                <Link href="/admin/login-v2" className="text-black hover:text-gray-600 transition-colors cursor-pointer text-sm font-semibold">
                  Admin Portal
                </Link>
              </div>
              <div>
                <Link href="/admin/guide" className="text-black hover:text-gray-600 transition-colors cursor-pointer text-sm">
                  {t('footer.adminGuide', language)}
                </Link>
              </div>
              <div className="pt-3 border-t border-gray-200 mt-3">
                <Link 
                  href="/admin/help"
                  className="text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer text-sm font-semibold flex items-center justify-center gap-1.5"
                >
                  <span>🔧</span>
                  <span>{t('footer.maintenanceGuide', language)}</span>
                </Link>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  {t('footer.techStack', language)}
                </p>
              </div>
            </nav>
          </div>

          {/* Contact Links */}
          <div className="text-center md:text-right">
            <h4 className="font-bold text-black mb-4">
              {t('footer.contact', language)}
            </h4>
            <div className="space-y-4">
              {/* Contact Links Row */}
              <div className="flex justify-center md:justify-end items-center space-x-6">
                <a 
                  href="mailto:Support@PetWash.co.il" 
                  className="text-gray-600 hover:text-black transition-colors flex items-center space-x-2"
                  aria-label="Email"
                  data-testid="link-email-footer"
                >
                  <Mail className="h-5 w-5" />
                  <span className="text-sm">Email</span>
                </a>
                <a 
                  href="https://wa.me/972549833355" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-black transition-colors flex items-center space-x-2"
                  aria-label="WhatsApp"
                  data-testid="link-whatsapp-footer"
                >
                  <FaWhatsapp className="h-5 w-5" />
                  <span className="text-sm">WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Trust & Payment Section - 7-Star Luxury */}
        <div className="border-t border-gray-100 pt-8 pb-8">
          <div className="max-w-5xl mx-auto">
            
            {/* Luxury Payment Methods - Metallic HD */}
            <div className="mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Lock className="w-4 h-4 text-amber-600" />
                <span className="text-xs uppercase tracking-[0.25em] font-bold bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-700 bg-clip-text text-transparent">
                  {t('footer.securePayment', language)}
                </span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              
              {/* Payment Icons Grid - Full Width */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2 max-w-2xl mx-auto">
                {(['visa', 'mastercard', 'amex', 'applepay', 'googlepay', 'diners'] as const).map((type) => (
                  <div
                    key={type}
                    className="group overflow-hidden aspect-[1.6/1]
                      rounded-md sm:rounded-lg
                      shadow-[0_1px_4px_rgba(0,0,0,0.1)]
                      hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)]
                      hover:scale-105
                      transition-all duration-300 ease-out"
                    data-testid={`payment-logo-${type}`}
                  >
                    <PaymentLogo type={type} />
                  </div>
                ))}
              </div>
              
              {/* Nayax Powered Badge */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="h-px w-12 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
                <div className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-full shadow-lg">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <span className="text-[10px] sm:text-xs font-bold tracking-wide text-white">
                    Powered by <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">Nayax</span> Israel
                  </span>
                </div>
                <div className="h-px w-12 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
              </div>
            </div>

            {/* Trust Badges - Minimalist Luxury */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-center">
              {/* SSL Security */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-green-50 to-emerald-50 rounded-full border border-green-200/50 group hover:border-green-300 transition-all duration-300">
                <Shield className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-green-800 tracking-wide">
                  {t('footer.sslEncryption', language)}
                </span>
              </div>

              {/* Israeli Business */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full border border-gray-200/50 group hover:border-gray-300 transition-all duration-300">
                <CheckCircle2 className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-800 tracking-wide">
                  {t('footer.israeliRegistered', language)}
                </span>
              </div>

              {/* Organic Products */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-lime-50 to-green-50 rounded-full border border-lime-200/50 group hover:border-lime-300 transition-all duration-300">
                <Leaf className="w-4 h-4 text-lime-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-lime-800 tracking-wide">
                  {t('footer.organicProducts', language)}
                </span>
              </div>

              {/* Premium Quality */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-full border border-amber-200/50 group hover:border-amber-300 transition-all duration-300">
                <Award className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-amber-800 tracking-wide">
                  {t('footer.premiumQuality', language)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section with Official Logo */}
        <div className="border-t border-gray-200 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <Link href="/" aria-label={t('footer.backToHome', language)}>
                <img 
                  src="/brand/petwash-logo-official.png" 
                  alt="⁦Pet Wash™⁩ Official Logo"
                  width="160"
                  height="32"
                  className="h-8 md:h-10 w-auto object-contain mx-auto md:mx-0 mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'transparent' }}
                />
              </Link>
              <p className="text-gray-600 text-sm">
                {t('footer.madeWithLove', language)}
              </p>
              <p className="text-gray-600 text-sm font-semibold">
                {t('footer.quickEasy247', language)}
              </p>
            </div>
            <div className="text-center md:text-right text-sm text-gray-600">
              <p className="font-semibold text-gray-900">&copy; 2025 <span className="brand-petwash">⁦Pet Wash™⁩</span> Ltd</p>
              <p className="text-xs mt-1">{t('footer.allRightsReserved', language)}</p>
              <p className="flex items-center justify-center md:justify-end gap-1 mt-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-xs text-green-600 font-medium">
                  {t('footer.passkeyEnabled', language)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}