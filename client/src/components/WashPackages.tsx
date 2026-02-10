import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Sparkles, Crown, Shield, Star, ShoppingCart } from 'lucide-react';
import { ExpressCheckoutModal } from '@/components/ExpressCheckoutModal';
import { CustomerSignupModal } from '@/components/CustomerSignupModal';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useAnalytics } from '@/hooks/useAnalytics';
import { t, type Language } from '@/lib/i18n';
import { logger } from "@/lib/logger";
import type { WashPackage } from '@shared/schema';

interface WashPackagesProps {
  language: Language;
}

const FALLBACK_PACKAGES: WashPackage[] = [
  {
    id: '1',
    name: 'Single Wash',
    nameHe: 'רחיצה בודדת',
    description: 'One premium organic wash',
    price: '55',
    washCount: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    name: '3-Wash Package',
    nameHe: 'חבילת 3 רחיצות',
    description: 'Three premium organic washes',
    price: '150',
    washCount: 3,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    name: '5-Wash Package',
    nameHe: 'חבילת 5 רחיצות',
    description: 'Five premium organic washes',
    price: '220',
    washCount: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    name: '10-Wash Package',
    nameHe: 'חבילת 10 רחיצות',
    description: 'Ten premium organic washes - Family Pack',
    price: '440',
    washCount: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const tierLabels: Record<string, Record<string, string>> = {
  CLASSIC: { en: 'CLASSIC', he: 'קלאסי', ar: 'كلاسيك', ru: 'КЛАССИК', fr: 'CLASSIQUE', es: 'CLÁSICO' },
  POPULAR: { en: 'MOST POPULAR', he: 'הכי פופולרי', ar: 'الأكثر شعبية', ru: 'ПОПУЛЯРНЫЙ', fr: 'POPULAIRE', es: 'POPULAR' },
  PREMIUM: { en: 'PREMIUM', he: 'פרימיום', ar: 'بريميوم', ru: 'ПРЕМИУМ', fr: 'PREMIUM', es: 'PREMIUM' },
  ELITE: { en: 'ELITE', he: 'אליט', ar: 'إيليت', ru: 'ЭЛИТ', fr: 'ÉLITE', es: 'ÉLITE' },
};

const washText: Record<string, string> = {
  en: 'wash', he: 'רחיצה', ar: 'غسلة', ru: 'мойка', fr: 'lavage', es: 'lavado',
};

const washesText: Record<string, string> = {
  en: 'washes', he: 'רחיצות', ar: 'غسلات', ru: 'моек', fr: 'lavages', es: 'lavados',
};

const buyNowText: Record<string, string> = {
  en: 'Buy Now', he: 'רכישה מיידית', ar: 'اشترِ الآن', ru: 'Купить', fr: 'Acheter', es: 'Comprar',
};

const perWashText: Record<string, string> = {
  en: 'per wash', he: 'לרחיצה', ar: 'لكل غسلة', ru: 'за мойку', fr: 'par lavage', es: 'por lavado',
};

const organicText: Record<string, string> = {
  en: '100% Organic Tea Tree Oil', he: 'שמן עץ התה האוסטרלי 100% אורגני', ar: 'زيت شجرة الشاي العضوي 100%', ru: '100% органическое масло чайного дерева', fr: '100% huile bio arbre à thé', es: '100% aceite orgánico árbol de té',
};

export function WashPackages({ language }: WashPackagesProps) {
  const [selectedPackage, setSelectedPackage] = useState<WashPackage | null>(null);
  const [isExpressCheckoutOpen, setIsExpressCheckoutOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const { user } = useFirebaseAuth();
  const { trackPackageSelection } = useAnalytics();

  const { data: packages, isLoading, isError, error } = useQuery<WashPackage[]>({
    queryKey: ['/api/packages'],
  });
  
  const displayPackages = packages || (isError ? FALLBACK_PACKAGES : []);

  const handleExpressCheckout = (pkg: WashPackage) => {
    logger.debug('Express checkout clicked', { packageName: pkg.name });
    trackPackageSelection(pkg.name, Number(pkg.price), language);
    setSelectedPackage(pkg);
    setIsExpressCheckoutOpen(true);
  };

  const handleCloseExpressCheckout = () => {
    setIsExpressCheckoutOpen(false);
    setSelectedPackage(null);
  };

  if (isLoading) {
    return (
      <section className="py-8 sm:py-12 lg:py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 sm:w-10 sm:h-10 border-3 border-black border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-black">
              {t('common.loading', language)}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const getLuxuryTheme = (index: number) => {
    const themes = [
      {
        bg: 'linear-gradient(165deg, #2C2C3E 0%, #1A1A2E 40%, #0D0D1A 100%)',
        accent: '#C9A96E',
        accentLight: 'rgba(201,169,110,0.15)',
        badge: 'CLASSIC',
        chipBg: 'linear-gradient(135deg, #C9A96E 0%, #A8884A 50%, #D4B87A 100%)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(255,255,255,0.7)',
        shadow: 'rgba(0,0,0,0.5)',
        borderGlow: 'rgba(201,169,110,0.3)',
      },
      {
        bg: 'linear-gradient(165deg, #1A3A2A 0%, #0F2E1C 40%, #0A1F14 100%)',
        accent: '#7FD4A0',
        accentLight: 'rgba(127,212,160,0.12)',
        badge: 'POPULAR',
        chipBg: 'linear-gradient(135deg, #C9A96E 0%, #A8884A 50%, #D4B87A 100%)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(255,255,255,0.7)',
        shadow: 'rgba(0,0,0,0.5)',
        borderGlow: 'rgba(127,212,160,0.3)',
      },
      {
        bg: 'linear-gradient(165deg, #2A2A35 0%, #1C1C28 40%, #14141E 100%)',
        accent: '#B8C5D6',
        accentLight: 'rgba(184,197,214,0.12)',
        badge: 'PREMIUM',
        chipBg: 'linear-gradient(135deg, #C9A96E 0%, #A8884A 50%, #D4B87A 100%)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(255,255,255,0.7)',
        shadow: 'rgba(0,0,0,0.5)',
        borderGlow: 'rgba(184,197,214,0.3)',
      },
      {
        bg: 'linear-gradient(165deg, #3A2D1A 0%, #2A1F0F 40%, #1A1408 100%)',
        accent: '#E8C964',
        accentLight: 'rgba(232,201,100,0.15)',
        badge: 'ELITE',
        chipBg: 'linear-gradient(135deg, #E8C964 0%, #C9A96E 50%, #F0D888 100%)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(255,255,255,0.7)',
        shadow: 'rgba(0,0,0,0.5)',
        borderGlow: 'rgba(232,201,100,0.4)',
      },
    ];
    return themes[index] || themes[0];
  };

  return (
    <section 
      id="packages"
      className="py-8 sm:py-12 lg:py-16 bg-[#0A0A0F] relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-30" style={{
        background: 'radial-gradient(ellipse at 30% 20%, rgba(201,169,110,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(201,169,110,0.05) 0%, transparent 50%)',
      }} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <div className="inline-flex items-center justify-center mb-4 sm:mb-6">
            <span className="px-5 py-2 rounded-full text-xs sm:text-sm font-semibold tracking-[0.15em] uppercase"
              style={{ 
                background: 'linear-gradient(135deg, rgba(201,169,110,0.15) 0%, rgba(201,169,110,0.05) 100%)',
                color: '#C9A96E',
                border: '1px solid rgba(201,169,110,0.3)',
              }}>
              {t('packages.premiumBadge', language)}
            </span>
          </div>

          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 px-4"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', serif" }}
          >
            {t('packages.title', language)}
          </h2>
          
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed mb-2 px-4">
            {t('packages.subtitle', language)}
          </p>
          
          <p className="text-base sm:text-lg max-w-2xl mx-auto italic px-4" style={{ color: '#C9A96E' }}>
            {organicText[language] || organicText.en}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 max-w-7xl mx-auto">
          {displayPackages.map((pkg, index) => {
            const theme = getLuxuryTheme(index);
            const pricePerWash = pkg.washCount > 1 
              ? Math.round(Number(pkg.price) / pkg.washCount) 
              : Number(pkg.price);
            const badgeLabel = tierLabels[theme.badge]?.[language] || tierLabels[theme.badge]?.en || theme.badge;
            const wText = pkg.washCount === 1 ? (washText[language] || washText.en) : (washesText[language] || washesText.en);
            const buyText = buyNowText[language] || buyNowText.en;
            const perWash = perWashText[language] || perWashText.en;
            
            return (
              <div
                key={pkg.id}
                className="group relative transform transition-all duration-500 hover:scale-[1.03] hover:-translate-y-2"
                style={{ perspective: '1000px' }}
              >
                {pkg.washCount === 3 && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, #C9A96E 0%, #E8C964 50%, #C9A96E 100%)',
                        color: '#1A1A1A',
                      }}>
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-[10px] sm:text-xs font-bold tracking-wide whitespace-nowrap">
                        {badgeLabel}
                      </span>
                      <Star className="w-3 h-3 fill-current" />
                    </div>
                  </div>
                )}

                <div
                  className="relative overflow-hidden transition-all duration-500 cursor-pointer"
                  onClick={() => handleExpressCheckout(pkg)}
                  style={{
                    background: theme.bg,
                    borderRadius: '20px',
                    boxShadow: `0 20px 60px -15px ${theme.shadow}, 0 0 0 1px ${theme.borderGlow}`,
                    minHeight: '380px',
                  }}
                >
                  <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)',
                  }} />

                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{
                    background: `linear-gradient(125deg, transparent 0%, ${theme.accentLight} 30%, transparent 60%)`,
                  }} />

                  <div className="absolute top-0 left-0 right-0 h-[1px]" style={{
                    background: `linear-gradient(90deg, transparent, ${theme.borderGlow}, transparent)`,
                  }} />

                  <div className="relative p-5 sm:p-6 h-full flex flex-col justify-between" style={{ minHeight: '380px' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <img 
                          src="/brand/petwash-logo-official.png" 
                          alt="Pet Wash™" 
                          className="h-5 w-auto object-contain opacity-90"
                          style={{ filter: 'brightness(1.5)' }}
                        />
                      </div>
                      
                      <div className="px-3 py-1 rounded-full" style={{ 
                        background: theme.accentLight,
                        border: `1px solid ${theme.borderGlow}`,
                      }}>
                        <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: theme.accent }}>
                          {badgeLabel}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-4">
                      <div 
                        className="w-12 h-9 sm:w-14 sm:h-10 rounded-md overflow-hidden flex-shrink-0"
                        style={{
                          background: theme.chipBg,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
                        }}
                      >
                        <div className="w-full h-full p-1.5 flex flex-col justify-center gap-0.5">
                          <div className="flex gap-0.5">
                            <div className="flex-1 h-1 rounded-[1px]" style={{ background: 'rgba(0,0,0,0.15)' }} />
                            <div className="flex-1 h-1 rounded-[1px]" style={{ background: 'rgba(0,0,0,0.15)' }} />
                          </div>
                          <div className="h-1.5 rounded-[1px] mx-0.5" style={{ background: 'rgba(0,0,0,0.12)' }} />
                          <div className="flex gap-0.5">
                            <div className="flex-1 h-1 rounded-[1px]" style={{ background: 'rgba(0,0,0,0.15)' }} />
                            <div className="flex-1 h-1 rounded-[1px]" style={{ background: 'rgba(0,0,0,0.15)' }} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center -space-x-2">
                        <div className="w-6 h-6 rounded-full" style={{ background: 'rgba(235, 0, 27, 0.9)' }} />
                        <div className="w-6 h-6 rounded-full" style={{ background: 'rgba(255, 95, 0, 0.9)' }} />
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-bold" style={{ color: theme.textPrimary }}>
                          ₪{pkg.price}
                        </span>
                      </div>
                      <p className="text-sm mt-1 font-medium" style={{ color: theme.textSecondary }}>
                        {pkg.washCount} {wText}
                        {pkg.washCount > 1 && (
                          <span className="mx-1.5 text-xs opacity-60">•</span>
                        )}
                        {pkg.washCount > 1 && (
                          <span className="text-xs" style={{ color: theme.accent }}>
                            ₪{pricePerWash} {perWash}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="mt-3 mb-1">
                      <p className="text-[11px] font-mono tracking-[0.2em]" style={{ color: theme.textSecondary }}>
                        •••• •••• •••• {String(pkg.washCount).padStart(4, '0')}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExpressCheckout(pkg);
                      }}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}dd)`,
                        color: '#1A1A1A',
                        boxShadow: `0 4px 15px ${theme.borderGlow}`,
                      }}
                      data-testid={`button-express-checkout-${pkg.id}`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {buyText}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 sm:mt-14 flex justify-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl"
            style={{ 
              background: 'rgba(201,169,110,0.08)',
              border: '1px solid rgba(201,169,110,0.2)',
            }}>
            <Shield className="w-5 h-5" style={{ color: '#C9A96E' }} />
            <span className="text-sm font-medium" style={{ color: '#C9A96E' }}>
              {language === 'he' ? 'תשלום מאובטח' : 'Secure Payment'}
            </span>
          </div>
        </div>

        <div className="mt-10 sm:mt-14 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto px-4">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" 
                style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)' }}>
                <Check className="w-6 h-6" style={{ color: '#C9A96E' }} strokeWidth={3} />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                {t('packages.trust1Title', language)}
              </h4>
              <p className="text-sm text-gray-400">
                {t('packages.trust1Desc', language)}
              </p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)' }}>
                <Crown className="w-6 h-6" style={{ color: '#C9A96E' }} strokeWidth={2.5} />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                {t('packages.trust2Title', language)}
              </h4>
              <p className="text-sm text-gray-400">
                {t('packages.trust2Desc', language)}
              </p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)' }}>
                <Sparkles className="w-6 h-6" style={{ color: '#C9A96E' }} strokeWidth={2.5} />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                {t('packages.trust3Title', language)}
              </h4>
              <p className="text-sm text-gray-400">
                {t('packages.trust3Desc', language)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {selectedPackage && (
        <ExpressCheckoutModal
          isOpen={isExpressCheckoutOpen}
          onClose={handleCloseExpressCheckout}
          package={selectedPackage}
          language={language}
        />
      )}

      <CustomerSignupModal
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        language={language}
      />
    </section>
  );
}
