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
  ELITE: { en: 'Elite Collection', he: 'קולקציית אליט', ar: 'مجموعة إيليت', ru: 'Коллекция Элит', fr: 'Collection Élite', es: 'Colección Élite' },
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
      <section className="py-16 sm:py-20 bg-white">
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
      className="py-16 sm:py-24 lg:py-28 relative"
      style={{ background: '#FFFFFF' }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-14 lg:mb-16">
          <p className="text-[11px] sm:text-xs tracking-[0.3em] uppercase mb-4 text-gray-400 font-medium">
            {t('packages.premiumBadge', language)}
          </p>

          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl text-black mb-5 px-4 font-light"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif", letterSpacing: '-0.02em' }}
          >
            {t('packages.title', language)}
          </h2>
          
          <p className="text-sm sm:text-base text-gray-500 max-w-lg mx-auto mb-3">
            {t('packages.subtitle', language)}
          </p>
          
          <p className="text-xs sm:text-sm text-gray-400 italic">
            {organicText[language] || organicText.en}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 max-w-5xl mx-auto">
          {displayPackages.map((pkg, index) => {
            const badge = getTierBadge(index);
            const pricePerWash = pkg.washCount > 1 
              ? Math.round(Number(pkg.price) / pkg.washCount) 
              : Number(pkg.price);
            const badgeLabel = tierLabels[badge]?.[language] || tierLabels[badge]?.en || badge;
            const wText = pkg.washCount === 1 ? (washText[language] || washText.en) : (washesText[language] || washesText.en);
            const buyText = buyNowText[language] || buyNowText.en;
            const perWash = perWashText[language] || perWashText.en;
            
            return (
              <div
                key={pkg.id}
                className="group cursor-pointer"
                onClick={() => handleExpressCheckout(pkg)}
              >
                <div className="relative bg-[#F6F4F1] rounded-sm overflow-hidden aspect-square flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-[#EFECE7]">
                  <div className="text-center px-4">
                    <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400 mb-3 font-medium">
                      {badgeLabel}
                    </p>
                    <p className="text-4xl sm:text-5xl font-light text-black mb-2"
                      style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif" }}>
                      ₪{pkg.price}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pkg.washCount} {wText}
                    </p>
                    {pkg.washCount > 1 && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        ₪{pricePerWash} {perWash}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm text-black mb-3 font-normal">
                    {language === 'he' ? (pkg as any).nameHe || pkg.name : pkg.name}
                  </p>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExpressCheckout(pkg);
                    }}
                    className="w-full py-2.5 text-[12px] tracking-[0.1em] uppercase font-medium transition-all duration-200 rounded-none border border-black text-black hover:bg-black hover:text-white"
                    data-testid={`button-express-checkout-${pkg.id}`}
                  >
                    {buyText}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-14 sm:mt-20 flex justify-center gap-6">
          <button className="px-8 py-3 text-[12px] tracking-[0.12em] uppercase font-medium border border-black text-black rounded-full hover:bg-black hover:text-white transition-all duration-200">
            {language === 'he' ? 'תשלום מאובטח' : 'Secure Checkout'}
          </button>
        </div>

        <div className="mt-14 sm:mt-20 border-t border-gray-100 pt-12">
          <div className="grid grid-cols-3 gap-6 sm:gap-12 max-w-2xl mx-auto">
            <div className="text-center">
              <Check className="w-5 h-5 mx-auto mb-2 text-gray-400" strokeWidth={1.5} />
              <p className="text-[11px] sm:text-xs text-gray-600 font-medium">
                {t('packages.trust1Title', language)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 hidden sm:block">
                {t('packages.trust1Desc', language)}
              </p>
            </div>
            
            <div className="text-center">
              <Crown className="w-5 h-5 mx-auto mb-2 text-gray-400" strokeWidth={1.5} />
              <p className="text-[11px] sm:text-xs text-gray-600 font-medium">
                {t('packages.trust2Title', language)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 hidden sm:block">
                {t('packages.trust2Desc', language)}
              </p>
            </div>
            
            <div className="text-center">
              <Sparkles className="w-5 h-5 mx-auto mb-2 text-gray-400" strokeWidth={1.5} />
              <p className="text-[11px] sm:text-xs text-gray-600 font-medium">
                {t('packages.trust3Title', language)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 hidden sm:block">
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
