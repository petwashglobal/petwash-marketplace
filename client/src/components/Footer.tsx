import { t, type Language } from '@/lib/i18n';
import { Link } from 'wouter';
import { FaWhatsapp } from 'react-icons/fa';
import { SiVisa, SiAmericanexpress } from 'react-icons/si';
import { Mail, Shield, Award, Leaf, CheckCircle2, Lock, Sparkles } from 'lucide-react';

const PaymentLogo = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case 'mastercard':
      return (
        <svg viewBox="0 0 131.39 86.9" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <rect width="131.39" height="86.9" rx="8" fill="#1A1F71" />
          <circle cx="48.37" cy="43.45" r="27.5" fill="#EB001B" />
          <circle cx="83.02" cy="43.45" r="27.5" fill="#F79E1B" />
          <path d="M65.7 21.27a27.42 27.42 0 0 0-10.14 21.18 27.42 27.42 0 0 0 10.14 21.18A27.42 27.42 0 0 0 75.83 42.45a27.42 27.42 0 0 0-10.13-21.18z" fill="#FF5F00" />
        </svg>
      );
    case 'applepay':
      return (
        <svg viewBox="0 0 165.52 105.97" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <rect width="165.52" height="105.97" rx="10" fill="#000" />
          <g fill="#fff" transform="translate(20, 22) scale(0.78)">
            <path d="M33.6 16.26c-1.5 1.77-3.9 3.14-6.32 2.94-.3-2.4.88-4.97 2.26-6.55 1.5-1.86 4.1-3.24 6.22-3.33.26 2.5-.73 4.97-2.16 6.94zm2.12 3.53c-3.48-.21-6.45 1.98-8.1 1.98s-4.21-1.87-6.95-1.83c-3.58.06-6.9 2.08-8.74 5.3-3.74 6.45-.96 16.01 2.67 21.26 1.78 2.61 3.9 5.51 6.69 5.4 2.67-.1 3.69-1.72 6.91-1.72s4.13 1.72 6.95 1.67c2.9-.05 4.73-2.61 6.51-5.24 2.03-3.01 2.86-5.93 2.9-6.08-.05-.05-5.57-2.14-5.63-8.49-.05-5.3 4.32-7.85 4.52-8-2.48-3.64-6.32-4.05-7.7-4.25h-.03z"/>
            <path d="M65.09 10.94c7.33 0 12.43 5.05 12.43 12.41 0 7.4-5.19 12.48-12.59 12.48h-8.12v12.95h-5.88V10.94h14.16zm-8.28 19.97h6.74c5.1 0 8-2.74 8-7.52s-2.9-7.52-7.98-7.52h-6.76v15.04z"/>
            <path d="M79.61 39.1c0-4.82 3.7-7.79 10.25-8.14l7.52-.44v-2.14c0-3.06-2.06-4.9-5.51-4.9-3.26 0-5.32 1.57-5.81 3.99h-5.41c.28-5.01 4.46-8.69 11.41-8.69 6.71 0 11 3.54 11 9.08v18.98h-5.44v-4.52h-.12c-1.6 3.04-5.1 4.93-8.74 4.93-5.41 0-9.15-3.35-9.15-8.15zm17.77-2.46v-2.18l-6.76.4c-3.39.22-5.29 1.72-5.29 4.09 0 2.4 1.97 3.99 4.98 3.99 3.91 0 7.07-2.7 7.07-6.3z"/>
            <path d="M108.02 57.86v-4.59c.44.1 1.41.1 1.9.1 2.72 0 4.18-1.14 5.1-4.06l.55-1.76-9.91-27.47h6.15l6.89 22.1h.1l6.89-22.1h6l-10.29 28.99c-2.36 6.68-5.1 8.83-10.82 8.83-.49 0-2.12-.07-2.56-.12z"/>
          </g>
        </svg>
      );
    case 'googlepay':
      return (
        <svg viewBox="0 0 165.52 105.97" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <rect width="165.52" height="105.97" rx="10" fill="#f5f5f5" />
          <g transform="translate(18, 25)">
            <path d="M62.27 28.07V43.2h-4.8V2.5h12.72c3.24 0 5.99 1.06 8.27 3.19 2.33 2.13 3.49 4.72 3.49 7.78 0 3.12-1.16 5.72-3.49 7.82-2.24 2.1-4.99 3.15-8.27 3.15h-7.92v3.63zm0-21.3v13.43h8.05c1.91 0 3.51-.66 4.77-1.98 1.29-1.32 1.94-2.93 1.94-4.72 0-1.76-.65-3.35-1.94-4.72-1.26-1.34-2.86-2.01-4.77-2.01h-8.05z" fill="#3C4043"/>
            <path d="M92.51 15.56c3.56 0 6.36 1.06 8.41 3.19 2.05 2.13 3.07 5.04 3.07 8.72v17.73h-4.59v-3.99h-.21c-1.99 3.19-4.63 4.78-7.92 4.78-2.81 0-5.16-.87-7.07-2.62-1.91-1.75-2.86-3.95-2.86-6.59 0-2.78.97-5 2.93-6.63 1.95-1.63 4.56-2.44 7.82-2.44 2.78 0 5.07.53 6.87 1.58v-1.11c0-1.67-.67-3.09-2.01-4.26-1.34-1.17-2.9-1.75-4.7-1.75-2.72 0-4.87 1.18-6.45 3.53l-4.24-2.71c2.35-3.49 5.85-5.23 10.51-5.23v-.2h.44zm-6.17 22.13c0 1.27.56 2.33 1.67 3.19 1.11.86 2.39 1.29 3.84 1.29 2.08 0 3.95-.81 5.63-2.44 1.67-1.63 2.51-3.51 2.51-5.65-1.48-1.2-3.54-1.8-6.17-1.8-1.91 0-3.51.49-4.8 1.48-1.12.99-1.68 2.27-1.68 3.93z" fill="#3C4043"/>
            <path d="M123.03 16.35l-15.96 37.57h-4.94l5.93-13.08-10.51-24.49h5.22l7.57 18.72h.1l7.36-18.72h5.23z" fill="#3C4043"/>
          </g>
          <g transform="translate(18, 25)">
            <path d="M46.48 28.31c0-1.4-.12-2.75-.35-4.03H24.1v7.63h12.57c-.54 2.93-2.19 5.41-4.67 7.07v5.88h7.56c4.42-4.16 6.92-10.29 6.92-16.55z" fill="#4285F4"/>
            <path d="M24.1 45.48c6.31 0 11.6-2.1 15.47-5.67l-7.56-5.88c-2.09 1.42-4.77 2.26-7.91 2.26-6.08 0-11.23-4.18-13.07-9.8H3.27v6.06C7.12 41.02 15.07 45.48 24.1 45.48z" fill="#34A853"/>
            <path d="M11.03 26.39a13.1 13.1 0 0 1 0-8.28v-6.06H3.27a22.13 22.13 0 0 0 0 20.4l7.76-6.06z" fill="#FBBC04"/>
            <path d="M24.1 8.31c3.43 0 6.51 1.2 8.93 3.56l6.7-6.84C35.66 1.2 30.38-1.1 24.1-1.1 15.07-1.1 7.12 3.36 3.27 11.93l7.76 6.06c1.84-5.62 6.99-9.68 13.07-9.68z" fill="#EA4335"/>
          </g>
        </svg>
      );
    case 'diners':
      return (
        <svg viewBox="0 0 131.39 86.9" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <rect width="131.39" height="86.9" rx="8" fill="#fff" />
          <g transform="translate(65.7, 43.45)">
            <ellipse cx="6" cy="0" rx="32" ry="32" fill="#0079BE" />
            <ellipse cx="-4" cy="0" rx="28" ry="28" fill="#fff" />
            <path d="M-18 -18 C-28 -8, -28 8, -18 18" stroke="#0079BE" strokeWidth="3" fill="none" />
            <path d="M10 -18 C20 -8, 20 8, 10 18" stroke="#0079BE" strokeWidth="3" fill="none" />
            <line x1="-4" y1="-22" x2="-4" y2="22" stroke="#0079BE" strokeWidth="2" />
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
                {[
                  { name: 'Visa', type: 'icon', icon: SiVisa, color: '#1A1F71' },
                  { name: 'Mastercard', type: 'svg', svgType: 'mastercard' },
                  { name: 'American Express', type: 'icon', icon: SiAmericanexpress, color: '#006FCF' },
                  { name: 'Apple Pay', type: 'svg', svgType: 'applepay' },
                  { name: 'Google Pay', type: 'svg', svgType: 'googlepay' },
                  { name: 'Diners Club', type: 'svg', svgType: 'diners' },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="group relative overflow-hidden
                      aspect-[1.6/1]
                      rounded-md sm:rounded-lg
                      shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]
                      border border-gray-200/60
                      hover:shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]
                      hover:border-amber-300/50
                      hover:scale-105
                      transition-all duration-300 ease-out"
                    data-testid={`payment-logo-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {item.type === 'svg' ? (
                      <PaymentLogo type={item.svgType!} className="w-full h-full" />
                    ) : item.icon ? (
                      <div className="w-full h-full flex items-center justify-center bg-white">
                        <item.icon
                          className="w-[85%] h-[85%]"
                          style={{ color: item.color }}
                        />
                      </div>
                    ) : null}
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