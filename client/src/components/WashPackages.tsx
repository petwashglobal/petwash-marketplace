import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Sparkles, Crown, Leaf, ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { ExpressCheckoutModal } from '@/components/ExpressCheckoutModal';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useAnalytics } from '@/hooks/useAnalytics';
import { t, type Language } from '@/lib/i18n';
import { logger } from "@/lib/logger";
import type { WashPackage } from '@shared/schema';

import pinkCardFront from '@assets/IMG_3094_1770832584882.png';
import greenCardFront from '@assets/IMG_3091_1770832584882.png';
import blackCardFront from '@assets/IMG_1998_1770750271081.png';
import goldCardFront from '@assets/IMG_1996_1770750271081.png';

const cardImagesByWashCount: Record<number, string> = {
  1: pinkCardFront,
  3: greenCardFront,
  5: blackCardFront,
  10: goldCardFront,
};


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

const tierConfig: Record<string, {
  labels: Record<string, string>;
  accent: string;
  icon: string;
}> = {
  CLASSIC: {
    labels: { en: 'Essentials', he: 'בסיסי', ar: 'أساسي', ru: 'Классик', fr: 'Essentiel', es: 'Esencial' },
    accent: '#8B7355',
    icon: '◈',
  },
  POPULAR: {
    labels: { en: 'Most Popular', he: 'הכי פופולרי', ar: 'الأكثر شعبية', ru: 'Популярный', fr: 'Populaire', es: 'Popular' },
    accent: '#1a1a1a',
    icon: '★',
  },
  PREMIUM: {
    labels: { en: 'Premium', he: 'פרימיום', ar: 'بريميوم', ru: 'Премиум', fr: 'Premium', es: 'Premium' },
    accent: '#8B7355',
    icon: '♦',
  },
  ELITE: {
    labels: { en: 'Maison Collection', he: 'קולקציית מזון', ar: 'مجموعة ميزون', ru: 'Коллекция Мезон', fr: 'Collection Maison', es: 'Colección Maison' },
    accent: '#2c2c2c',
    icon: '✦',
  },
};

const washText: Record<string, string> = {
  en: 'wash', he: 'רחיצה', ar: 'غسلة', ru: 'мойка', fr: 'lavage', es: 'lavado',
};

const washesText: Record<string, string> = {
  en: 'washes', he: 'רחיצות', ar: 'غسلات', ru: 'моек', fr: 'lavages', es: 'lavados',
};

const buyNowText: Record<string, string> = {
  en: 'Add to Bag', he: 'הוסף לתיק', ar: 'أضف إلى الحقيبة', ru: 'В корзину', fr: 'Ajouter au panier', es: 'Añadir a la bolsa',
};

const perWashText: Record<string, string> = {
  en: 'per wash', he: 'לרחיצה', ar: 'لكل غسلة', ru: 'за мойку', fr: 'par lavage', es: 'por lavado',
};

const organicText: Record<string, string> = {
  en: '100% Australian Tea Tree Oil · Organic', he: 'שמן עץ התה האוסטרלי 100% אורגני', ar: 'زيت شجرة الشاي العضوي 100%', ru: '100% органическое масло чайного дерева', fr: '100% huile bio arbre à thé', es: '100% aceite orgánico árbol de té',
};

export function WashPackages({ language }: WashPackagesProps) {
  const [selectedPackage, setSelectedPackage] = useState<WashPackage | null>(null);
  const [isExpressCheckoutOpen, setIsExpressCheckoutOpen] = useState(false);
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
      <section className="py-6 sm:py-10 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-black rounded-full mx-auto"></div>
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
      className="py-4 sm:py-6 lg:py-8 relative overflow-hidden"
      style={{ background: '#FFFFFF' }}
    >
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)`,
        backgroundSize: '24px 24px',
      }} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-6 sm:mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#c9a96e]" />
            <Leaf className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.2} />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#c9a96e]" />
          </div>

          <p className="text-[10px] sm:text-[11px] tracking-[0.35em] uppercase mb-5 font-medium"
            style={{ color: '#c9a96e' }}>
            {t('packages.premiumBadge', language)}
          </p>

          <h2 
            className="text-3xl sm:text-4xl lg:text-[3.2rem] text-[#1a1a1a] mb-6 px-4 font-light leading-tight"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif", letterSpacing: '-0.03em' }}
          >
            {t('packages.title', language)}
          </h2>
          
          <p className="text-sm sm:text-[15px] text-[#888] max-w-md mx-auto mb-3 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
            {t('packages.subtitle', language)}
          </p>

          <p className="text-[10px] sm:text-[11px] tracking-[0.12em] uppercase font-semibold text-[#c9a96e] mb-1">
            {t('packages.k9000Only', language)}
          </p>

          <p className="text-[11px] sm:text-xs text-[#b5a088] tracking-wide">
            {organicText[language] || organicText.en}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-8 max-w-[1200px] mx-auto">
          {displayPackages.map((pkg, index) => {
            const badge = getTierBadge(index);
            const tier = tierConfig[badge] || tierConfig.CLASSIC;
            const pricePerWash = pkg.washCount > 1 
              ? Math.round(Number(pkg.price) / pkg.washCount) 
              : Number(pkg.price);
            const badgeLabel = tier.labels[language] || tier.labels.en;
            const wText = pkg.washCount === 1 ? (washText[language] || washText.en) : (washesText[language] || washesText.en);
            const buyText = buyNowText[language] || buyNowText.en;
            const perWash = perWashText[language] || perWashText.en;
            const isPopular = badge === 'POPULAR';
            const isElite = badge === 'ELITE';
            const cardImage = cardImagesByWashCount[pkg.washCount] || pinkCardFront;
            
            return (
              <div
                key={pkg.id}
                className="group cursor-pointer"
                onClick={() => handleExpressCheckout(pkg)}
              >
                <div className="relative overflow-hidden transition-all duration-500 bg-white hover:-translate-y-1"
                  style={{ 
                    boxShadow: isPopular
                      ? '0 0 0 1.5px #c9a96e, 0 12px 40px rgba(201,169,110,0.14)'
                      : '0 4px 24px rgba(0,0,0,0.07)',
                    transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s',
                  }}
                >
                  {isPopular && (
                    <div className="absolute top-3 start-3 z-10">
                      <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase px-2.5 py-1 bg-[#c9a96e] text-white font-medium" style={{ borderRadius: '2px' }}>
                        {language === 'he' ? 'מומלץ' : 'Best Value'}
                      </span>
                    </div>
                  )}

                  <div className="relative overflow-hidden">
                    <img 
                      src={cardImage} 
                      alt={`⁦PetWash™⁩ ${pkg.name} Package`}
                      className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      style={{ display: 'block' }}
                      loading="lazy"
                    />
                  </div>

                  <div className="px-3 sm:px-4 py-3 sm:py-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-medium ${
                        isElite || isPopular ? 'text-[#c9a96e]' : 'text-[#999]'
                      }`}>
                        {badgeLabel}
                      </span>
                    </div>

                    <div className="mb-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] sm:text-xs text-[#999]">₪</span>
                        <span className="text-2xl sm:text-3xl lg:text-[2.4rem] font-light text-[#1a1a1a]"
                          style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em', lineHeight: 1 }}>
                          {pkg.price}
                        </span>
                      </div>
                    </div>

                    <div className="mb-2">
                      <p className="text-xs sm:text-[13px] text-[#555] mb-0.5"
                        style={{ fontFamily: "'Inter', sans-serif" }}>
                        {pkg.washCount} {wText}
                      </p>
                      {pkg.washCount > 1 && (
                        <p className="text-[10px] sm:text-[11px] text-[#aaa]">
                          ₪{pricePerWash} {perWash}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-[#eee] pt-2 space-y-1 text-[#888] mb-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                        <span className="text-[10px] sm:text-[11px] font-medium" style={{ color: '#c9a96e' }}>
                          {t('packages.k9000Only', language)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                        <span className="text-[10px] sm:text-[11px]">
                          {t('packages.noBookingNeeded', language)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                        <span className="text-[10px] sm:text-[11px]">
                          {language === 'he' ? 'שמפו אורגני פרימיום' : 'Premium organic shampoo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                        <span className="text-[10px] sm:text-[11px]">
                          {language === 'he' ? 'ללא תאריך תפוגה' : 'Never expires'}
                        </span>
                      </div>
                      {pkg.washCount >= 3 && (
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                          <span className="text-[10px] sm:text-[11px]">
                            {language === 'he' ? 'ניתן להעברה' : 'Transferable'}
                          </span>
                        </div>
                      )}
                      {pkg.washCount >= 10 && (
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                          <span className="text-[10px] sm:text-[11px]">
                            {language === 'he' ? 'הנחה משפחתית' : 'Family discount'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExpressCheckout(pkg);
                    }}
                    className="w-full py-3.5 sm:py-4 text-[10px] sm:text-[11px] tracking-[0.18em] uppercase font-medium transition-all duration-300 flex items-center justify-center gap-2 bg-[#1a1a1a] text-white hover:bg-[#333]"
                    data-testid={`button-express-checkout-${pkg.id}`}
                  >
                    {buyText}
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 sm:mt-10 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-center">
            <Lock className="w-3 h-3 text-[#c9a96e] shrink-0" strokeWidth={1.5} />
            <span className="text-[9px] sm:text-[10px] tracking-[0.12em] uppercase text-[#999] font-medium">
              {language === 'he' ? 'אמצעי תשלום מאובטחים' : 'Secure Payment Methods'}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
            <img className="h-[20px] sm:h-[24px] w-auto object-contain" src="/pay/payment-methods.jpg" alt="Visa, Mastercard, American Express, Apple Pay, Google Pay" loading="lazy" />
            <img className="h-[14px] sm:h-[16px] w-auto object-contain" src="/pay/diners.jpg" alt="Diners Club" loading="lazy" />
          </div>
          <div className="flex items-center gap-2 px-4 py-1 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[8px] sm:text-[9px] font-bold text-white">
              Powered by <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">Nayax</span> Israel
            </span>
          </div>
        </div>

        <div className="mt-16 sm:mt-24">
          <div className="flex items-center justify-center gap-4 mb-12">
            <div className="flex-1 max-w-[80px] h-px bg-gradient-to-r from-transparent to-[#ddd]" />
            <ShieldCheck className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.2} />
            <div className="flex-1 max-w-[80px] h-px bg-gradient-to-l from-transparent to-[#ddd]" />
          </div>
          
          <div className="grid grid-cols-3 gap-8 sm:gap-16 max-w-xl mx-auto">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] sm:text-[11px] tracking-[0.08em] text-[#555] font-medium uppercase">
                {t('packages.trust1Title', language)}
              </p>
              <p className="text-[9px] sm:text-[10px] text-[#aaa] mt-1 hidden sm:block">
                {t('packages.trust1Desc', language)}
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center">
                <Crown className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] sm:text-[11px] tracking-[0.08em] text-[#555] font-medium uppercase">
                {t('packages.trust2Title', language)}
              </p>
              <p className="text-[9px] sm:text-[10px] text-[#aaa] mt-1 hidden sm:block">
                {t('packages.trust2Desc', language)}
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center">
                <Leaf className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] sm:text-[11px] tracking-[0.08em] text-[#555] font-medium uppercase">
                {t('packages.trust3Title', language)}
              </p>
              <p className="text-[9px] sm:text-[10px] text-[#aaa] mt-1 hidden sm:block">
                {t('packages.trust3Desc', language)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 sm:mt-10 max-w-2xl mx-auto px-4 py-4 border border-[#e8e0d5] rounded-sm bg-[#faf8f5]">
          <p className="text-[10px] sm:text-[11px] text-[#888] leading-relaxed text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
            {t('packages.k9000Disclaimer', language)}
          </p>
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
    </section>
  );
}
