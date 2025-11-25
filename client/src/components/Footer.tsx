import { t, type Language } from '@/lib/i18n';
import { Link } from 'wouter';
import { FaWhatsapp } from 'react-icons/fa';
import { Mail, Shield, Award, Leaf, CheckCircle2 } from 'lucide-react';

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
                alt="PetWash™ Official Logo"
                className="h-10 w-auto object-contain mx-auto md:mx-0 mb-4 cursor-pointer hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'transparent' }}
              />
            </Link>
            <p className="text-lg font-semibold text-black mb-2">
              {t('hero.slogan', language)}
            </p>
            <div className="text-sm text-gray-600 space-y-1">
              <p>PetWash™ Ltd</p>
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
                <Link href="/admin/login-v2" className="text-blue-600 hover:text-blue-800 transition-colors cursor-pointer text-sm font-semibold">
                  Admin Portal
                </Link>
              </div>
              <div>
                <Link href="/admin/guide" className="text-blue-600 hover:text-blue-800 transition-colors cursor-pointer text-sm">
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

        {/* Premium Trust & Payment Badges Section - 7-Star Luxury */}
        <div className="border-t border-gray-100 pt-8 pb-8">
          <div className="max-w-5xl mx-auto">
            {/* Payment Methods - Sharp SVG Icons */}
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-light mb-5">
                {t('footer.securePayment', language)}
              </p>
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-600 px-4 py-2 rounded-lg border border-white/20">
                <Shield className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-semibold">
                  {language === 'he' ? 'תשלום מאובטח' : 'Secure Payment'}
                </span>
              </div>
            </div>

            {/* Trust Badges - Minimalist Luxury */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-center">
              {/* SSL Security */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-green-50 to-emerald-50 rounded-full border border-green-200/50 group hover:border-green-300 transition-all duration-300">
                <Shield className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-green-800 tracking-wide">
                  {t('footer.sslEncryption', language)}
                </span>
              </div>

              {/* Israeli Business */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full border border-blue-200/50 group hover:border-blue-300 transition-all duration-300">
                <CheckCircle2 className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-blue-800 tracking-wide">
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
                  alt="PetWash™ Official Logo"
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
              <p className="font-semibold text-gray-900">&copy; 2025 PetWash™ Ltd</p>
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