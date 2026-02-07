import { t, type Language } from '@/lib/i18n';
import { Link } from 'wouter';
import { FaWhatsapp } from 'react-icons/fa';
import { Mail, Shield, Award, Leaf, CheckCircle2, Lock, Sparkles } from 'lucide-react';

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
                alt="Pet Wash™ Official Logo"
                className="h-10 w-auto object-contain mx-auto md:mx-0 mb-4 cursor-pointer hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'transparent' }}
              />
            </Link>
            <p className="text-lg font-semibold text-black mb-2">
              {t('hero.slogan', language)}
            </p>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="brand-petwash">Pet Wash™</span> Ltd</p>
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
              
              {/* Metallic Payment Icons Grid */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                {[
                  { name: 'Visa', src: '/assets/payments/visa-color.svg' },
                  { name: 'Mastercard', src: '/assets/payments/mastercard-color.svg' },
                  { name: 'American Express', src: '/assets/payments/amex-color.svg' },
                  { name: 'Apple Pay', src: '/assets/payments/apple-pay-color.svg' },
                  { name: 'Google Pay', src: '/assets/payments/google-pay-color.svg' },
                  { name: 'Diners Club', src: '/assets/payments/diners-color.svg' },
                ].map((logo) => (
                  <div
                    key={logo.name}
                    className="group relative flex items-center justify-center w-16 h-10 sm:w-20 sm:h-12 md:w-24 md:h-14 lg:w-28 lg:h-16
                      bg-gradient-to-br from-slate-50 via-white to-gray-100
                      rounded-lg sm:rounded-xl 
                      shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]
                      border border-gray-200/60
                      hover:shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_0_rgba(255,255,255,1)]
                      hover:border-amber-300/50
                      hover:scale-105
                      transition-all duration-300 ease-out
                      before:absolute before:inset-0 before:rounded-lg sm:before:rounded-xl
                      before:bg-gradient-to-b before:from-white/40 before:to-transparent before:pointer-events-none"
                    data-testid={`payment-logo-${logo.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <img 
                      src={logo.src} 
                      alt={logo.name}
                      className="h-5 sm:h-6 md:h-7 lg:h-8 w-auto object-contain drop-shadow-sm group-hover:drop-shadow-md transition-all duration-300"
                      loading="lazy"
                    />
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
                  alt="Pet Wash™ Official Logo"
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
              <p className="font-semibold text-gray-900">&copy; 2025 <span className="brand-petwash">Pet Wash™</span> Ltd</p>
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