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
              
              {/* Payment Icons - Inline SVG */}
              <div className="flex items-center justify-center gap-4 sm:gap-5 flex-wrap" role="region" aria-label="Payments accepted">
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