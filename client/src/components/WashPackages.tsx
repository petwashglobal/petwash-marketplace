import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Sparkles, Crown, Shield, ShoppingCart } from 'lucide-react';
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
  CLASSIC: { en: 'Classic', he: 'קלאסי', ar: 'كلاسيك', ru: 'Классик', fr: 'Classique', es: 'Clásico' },
  POPULAR: { en: 'Most Popular', he: 'הכי פופולרי', ar: 'الأكثر شعبية', ru: 'Популярный', fr: 'Populaire', es: 'Popular' },
  PREMIUM: { en: 'Premium', he: 'פרימיום', ar: 'بريميوم', ru: 'Премиум', fr: 'Premium', es: 'Premium' },
  ELITE: { en: 'Elite', he: 'אליט', ar: 'إيليت', ru: 'Элит', fr: 'Élite', es: 'Élite' },
};

const washText: Record<string, string> = {
  en: 'wash', he: 'רחיצה', ar: 'غسلة', ru: 'мойка', fr: 'lavage', es: 'lavado',
};

const washesText: Record<string, string> = {
  en: 'washes', he: 'רחיצות', ar: 'غسلات', ru: 'моек', fr: 'lavages', es: 'lavados',
};

const buyNowText: Record<string, string> = {
  en: 'Purchase', he: 'רכישה', ar: 'شراء', ru: 'Купить', fr: 'Acheter', es: 'Comprar',
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
      <section className="py-8 sm:py-12 lg:py-16 bg-[#0A0A0F]">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 sm:w-10 sm:h-10 border-2 border-[#C9A96E] border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-400">
              {t('common.loading', language)}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const getTierBadge = (index: number) => {
    const badges = ['CLASSIC', 'POPULAR', 'PREMIUM', 'ELITE'];
    return badges[index] || badges[0];
  };

  return (
    <section 
      id="packages"
      className="py-16 sm:py-20 lg:py-28 bg-[#0A0A0F] relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-20" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(201,169,110,0.06) 0%, transparent 70%)',
      }} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <div className="inline-flex items-center justify-center mb-6">
            <span className="px-6 py-2 rounded-full text-[11px] sm:text-xs font-medium tracking-[0.25em] uppercase"
              style={{ 
                color: '#C9A96E',
                border: '1px solid rgba(201,169,110,0.25)',
              }}>
              {t('packages.premiumBadge', language)}
            </span>
          </div>

          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl font-light text-white mb-5 px-4 tracking-tight"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', serif" }}
          >
            {t('packages.title', language)}
          </h2>
          
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed mb-3 px-4">
            {t('packages.subtitle', language)}
          </p>
          
          <p className="text-sm sm:text-base max-w-xl mx-auto px-4 tracking-wide" style={{ color: 'rgba(201,169,110,0.7)' }}>
            {organicText[language] || organicText.en}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7 lg:gap-8 max-w-6xl mx-auto">
          {displayPackages.map((pkg, index) => {
            const badge = getTierBadge(index);
            const pricePerWash = pkg.washCount > 1 
              ? Math.round(Number(pkg.price) / pkg.washCount) 
              : Number(pkg.price);
            const badgeLabel = tierLabels[badge]?.[language] || tierLabels[badge]?.en || badge;
            const wText = pkg.washCount === 1 ? (washText[language] || washText.en) : (washesText[language] || washesText.en);
            const buyText = buyNowText[language] || buyNowText.en;
            const perWash = perWashText[language] || perWashText.en;
            const isPopular = pkg.washCount === 3;
            const isElite = pkg.washCount === 10;
            
            return (
              <div
                key={pkg.id}
                className="group relative"
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                    <div className="px-5 py-1.5 rounded-full text-[10px] font-medium tracking-[0.2em] uppercase"
                      style={{
                        background: 'linear-gradient(135deg, #C9A96E 0%, #D4B87A 100%)',
                        color: '#0A0A0F',
                      }}>
                      {badgeLabel}
                    </div>
                  </div>
                )}

                <div
                  className="relative overflow-hidden transition-all duration-500 cursor-pointer group-hover:-translate-y-1"
                  onClick={() => handleExpressCheckout(pkg)}
                  style={{
                    background: isElite 
                      ? 'linear-gradient(180deg, #161616 0%, #0E0E0E 100%)'
                      : 'linear-gradient(180deg, #141414 0%, #0C0C0C 100%)',
                    borderRadius: '16px',
                    border: isElite 
                      ? '1px solid rgba(201,169,110,0.25)' 
                      : isPopular 
                        ? '1px solid rgba(201,169,110,0.2)' 
                        : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: isElite 
                      ? '0 0 40px rgba(201,169,110,0.08)' 
                      : '0 4px 30px rgba(0,0,0,0.3)',
                  }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{
                    background: 'radial-gradient(ellipse at 50% 0%, rgba(201,169,110,0.04) 0%, transparent 70%)',
                  }} />

                  <div className="relative p-7 sm:p-8 flex flex-col" style={{ minHeight: '340px' }}>
                    <div className="mb-8">
                      <p className="text-[11px] font-medium tracking-[0.2em] uppercase mb-1" 
                        style={{ color: isElite ? '#C9A96E' : 'rgba(255,255,255,0.35)' }}>
                        {badgeLabel}
                      </p>
                      <div className="w-8 h-[1px] mt-3" style={{ 
                        background: isElite 
                          ? 'linear-gradient(90deg, #C9A96E, transparent)' 
                          : 'linear-gradient(90deg, rgba(255,255,255,0.15), transparent)' 
                      }} />
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      <div className="mb-1">
                        <span className="text-4xl sm:text-5xl font-light tracking-tight text-white"
                          style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', serif" }}>
                          ₪{pkg.price}
                        </span>
                      </div>
                      <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {pkg.washCount} {wText}
                        {pkg.washCount > 1 && (
                          <>
                            <span className="mx-2">·</span>
                            <span style={{ color: 'rgba(201,169,110,0.7)' }}>
                              ₪{pricePerWash} {perWash}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExpressCheckout(pkg);
                      }}
                      className="w-full mt-6 flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-[13px] font-medium tracking-[0.08em] uppercase transition-all duration-300 group-hover:opacity-90"
                      style={{
                        background: isElite 
                          ? 'linear-gradient(135deg, #C9A96E 0%, #B8944A 100%)'
                          : 'transparent',
                        color: isElite ? '#0A0A0F' : '#C9A96E',
                        border: isElite ? 'none' : '1px solid rgba(201,169,110,0.3)',
                      }}
                      data-testid={`button-express-checkout-${pkg.id}`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {buyText}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 sm:mt-16 flex justify-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full"
            style={{ 
              border: '1px solid rgba(201,169,110,0.15)',
            }}>
            <Shield className="w-4 h-4" style={{ color: 'rgba(201,169,110,0.6)' }} />
            <span className="text-xs font-medium tracking-[0.1em] uppercase" style={{ color: 'rgba(201,169,110,0.6)' }}>
              {language === 'he' ? 'תשלום מאובטח' : 'Secure Payment'}
            </span>
          </div>
        </div>

        <div className="mt-14 sm:mt-20 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 max-w-3xl mx-auto px-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" 
                style={{ border: '1px solid rgba(201,169,110,0.2)' }}>
                <Check className="w-4 h-4" style={{ color: '#C9A96E' }} strokeWidth={2} />
              </div>
              <h4 className="text-sm font-medium text-white mb-1 tracking-wide">
                {t('packages.trust1Title', language)}
              </h4>
              <p className="text-xs text-gray-500">
                {t('packages.trust1Desc', language)}
              </p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                style={{ border: '1px solid rgba(201,169,110,0.2)' }}>
                <Crown className="w-4 h-4" style={{ color: '#C9A96E' }} strokeWidth={2} />
              </div>
              <h4 className="text-sm font-medium text-white mb-1 tracking-wide">
                {t('packages.trust2Title', language)}
              </h4>
              <p className="text-xs text-gray-500">
                {t('packages.trust2Desc', language)}
              </p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                style={{ border: '1px solid rgba(201,169,110,0.2)' }}>
                <Sparkles className="w-4 h-4" style={{ color: '#C9A96E' }} strokeWidth={2} />
              </div>
              <h4 className="text-sm font-medium text-white mb-1 tracking-wide">
                {t('packages.trust3Title', language)}
              </h4>
              <p className="text-xs text-gray-500">
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
