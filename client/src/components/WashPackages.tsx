import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Sparkles, Crown, Shield, CreditCard, Star } from 'lucide-react';
import { ExpressCheckoutModal } from '@/components/ExpressCheckoutModal';
import { CustomerSignupModal } from '@/components/CustomerSignupModal';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useAnalytics } from '@/hooks/useAnalytics';
import { t, type Language } from '@/lib/i18n';
import { logger } from "@/lib/logger";
import type { WashPackage } from '@shared/schema';

import roseFrontImg from '@assets/IMG_2004_1767477310445.png';
import emeraldFrontImg from '@assets/IMG_2002_1767477310445.png';
import platinumFrontImg from '@assets/IMG_1998_1767477310445.png';
import goldFrontImg from '@assets/IMG_1996_1767477310445.png';

interface WashPackagesProps {
  language: Language;
}

const CARD_IMAGES: Record<number, string> = {
  1: roseFrontImg,
  3: emeraldFrontImg,
  5: platinumFrontImg,
  10: goldFrontImg
};

const FALLBACK_PACKAGES: WashPackage[] = [
  {
    id: '1',
    name: 'Single Wash',
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
    description: 'Ten premium organic washes - Family Pack',
    price: '440',
    washCount: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export function WashPackages({ language }: WashPackagesProps) {
  const [selectedPackage, setSelectedPackage] = useState<WashPackage | null>(null);
  const [isExpressCheckoutOpen, setIsExpressCheckoutOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const { user } = useFirebaseAuth();
  const { trackPackageSelection } = useAnalytics();

  const { data: packages, isLoading, isError, error } = useQuery<WashPackage[]>({
    queryKey: ['/api/packages'],
  });
  
  // Use fallback packages if API fails
  const displayPackages = packages || (isError ? FALLBACK_PACKAGES : []);

  const handleExpressCheckout = (pkg: WashPackage) => {
    logger.debug('Express checkout clicked', { packageName: pkg.name });
    trackPackageSelection(pkg.name, Number(pkg.price), language);
    setSelectedPackage(pkg);
    setIsExpressCheckoutOpen(true);
    logger.debug('Modal state set to open');
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

  // Show compact error notice if API fails (but still display fallback packages)
  const showErrorNotice = isError;

  // NO DISCOUNTS - Official 2025 pricing (55 per wash)
  const getDiscountPercentage = (_washCount: number): number => {
    return 0; // No discounts per official pricing
  };

  // APPLE CARD / MASTERCARD 2025 STYLE THEMES - Ultra Modern Titanium Finish
  const getLuxuryTheme = (index: number) => {
    const themes = [
      {
        // ROSE/TITANIUM PINK - Single Wash - Apple Card Style
        gradient: 'linear-gradient(145deg, #F8E8EC 0%, #E8D0D8 15%, #D4B8C4 35%, #C8A8B8 55%, #BC98AC 75%, #B088A0 100%)',
        badge: 'CLASSIC',
        badgeBg: 'rgba(255,255,255,0.85)',
        icon: CreditCard,
        shadowColor: 'rgba(180,120,140,0.35)',
        chipColor: 'linear-gradient(135deg, #E8E4E0 0%, #D4D0CC 50%, #C8C4C0 100%)',
        textColor: '#1A1A1A',
        holographicGlow: 'rgba(255, 200, 220, 0.4)',
      },
      {
        // EMERALD/TITANIUM GREEN - 3 Washes (Most Popular) - Apple Card Style
        gradient: 'linear-gradient(145deg, #E8F0E8 0%, #D0E0D0 15%, #B8D0BC 35%, #A0C0A8 55%, #88B094 75%, #70A080 100%)',
        badge: 'POPULAR',
        badgeBg: 'rgba(0,0,0,0.85)',
        icon: Crown,
        shadowColor: 'rgba(100,140,100,0.35)',
        chipColor: 'linear-gradient(135deg, #E8E4E0 0%, #D4D0CC 50%, #C8C4C0 100%)',
        textColor: '#1A1A1A',
        holographicGlow: 'rgba(180, 255, 200, 0.4)',
      },
      {
        // PLATINUM/TITANIUM SILVER - 5 Washes (Premium) - Apple Card Style
        gradient: 'linear-gradient(145deg, #F0F0F2 0%, #E4E4E8 15%, #D8D8DC 35%, #CCCCCC 55%, #C0C0C0 75%, #B4B4B8 100%)',
        badge: 'PREMIUM',
        badgeBg: 'rgba(0,0,0,0.85)',
        icon: Sparkles,
        shadowColor: 'rgba(100,100,110,0.4)',
        chipColor: 'linear-gradient(135deg, #E8E4E0 0%, #D4D0CC 50%, #C8C4C0 100%)',
        textColor: '#1A1A1A',
        holographicGlow: 'rgba(200, 200, 255, 0.4)',
      },
      {
        // GOLD/TITANIUM GOLD - 10 Washes (Family Pack - Elite) - Apple Card Style
        gradient: 'linear-gradient(145deg, #FAF6F0 0%, #F0E8DC 15%, #E8DCC8 35%, #DED0B4 55%, #D4C4A0 75%, #C6A664 100%)',
        badge: 'ELITE',
        badgeBg: 'rgba(0,0,0,0.85)',
        icon: Shield,
        shadowColor: 'rgba(180,150,80,0.4)',
        chipColor: 'linear-gradient(135deg, #E8E4E0 0%, #D4D0CC 50%, #C8C4C0 100%)',
        textColor: '#1A1A1A',
        holographicGlow: 'rgba(255, 230, 180, 0.5)',
      },
    ];
    return themes[index] || themes[0];
  };

  return (
    <section 
      id="packages"
      className="py-8 sm:py-12 lg:py-16 bg-white relative overflow-hidden"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Luxury Header Section */}
        <div className="text-center mb-6 sm:mb-10 lg:mb-14">
          {/* Premium Badge */}
          <div className="inline-flex items-center justify-center p-2 mb-4 sm:mb-6">
            <span className="px-4 py-2 bg-white rounded-full text-xs sm:text-sm font-semibold text-black shadow-sm border border-black">
              {t('packages.premiumBadge', language)}
            </span>
          </div>

          {/* Main Title - Serif Typography */}
          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4 sm:mb-6 px-4"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', serif" }}
          >
            {t('packages.title', language)}
          </h2>
          
          {/* Subtitle */}
          <p className="text-lg sm:text-xl lg:text-2xl text-black max-w-3xl mx-auto leading-relaxed mb-2 sm:mb-4 px-4">
            {t('packages.subtitle', language)}
          </p>
          
          {/* Additional tagline */}
          <p className="text-base sm:text-lg text-black max-w-2xl mx-auto italic px-4">
            {t('packages.organicCare', language)}
          </p>
        </div>


        {/* LUXURY CREDIT CARD STYLE PACKAGES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-7xl mx-auto">
          {displayPackages.map((pkg, index) => {
            const discount = getDiscountPercentage(pkg.washCount);
            const pricePerWash = pkg.washCount > 1 
              ? Math.round(Number(pkg.price) / pkg.washCount) 
              : Number(pkg.price);
            
            const theme = getLuxuryTheme(index);
            const IconComponent = theme.icon;
            const isGoldCard = index === 3;
            const isPlatinumCard = index === 2;
            
            return (
              <div
                key={pkg.id}
                className="group relative transform transition-all duration-500 hover:scale-105 hover:-translate-y-2"
                style={{
                  perspective: '1000px',
                }}
              >
                {/* Most Popular Badge */}
                {pkg.washCount === 3 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                    <div 
                      className="px-4 py-1.5 text-xs font-bold rounded-full shadow-lg"
                      style={{
                        background: '#000000',
                        color: '#FFFFFF',
                      }}
                    >
                      {t('packages.mostPopular', language)}
                    </div>
                  </div>
                )}

                {/* CLEAN BRUSHED METAL CARD */}
                <div
                  className="relative overflow-hidden transition-all duration-300"
                  style={{
                    background: theme.gradient,
                    borderRadius: '12px',
                    boxShadow: `0 10px 25px -8px ${theme.shadowColor}, 0 4px 10px -3px rgba(0,0,0,0.1)`,
                    aspectRatio: '1.586/1',
                    minHeight: '320px',
                  }}
                >
                  {/* Brushed Metal Texture */}
                  <div 
                    className="absolute inset-0 opacity-20"
                    style={{
                      background: 'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)',
                    }}
                  />
                  
                  {/* Subtle Light Reflection */}
                  <div className="absolute inset-0 opacity-25">
                    <div className="absolute top-0 left-0 w-full h-1/2" style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)'
                    }} />
                  </div>

                  {/* Card Content */}
                  <div className="relative p-4 sm:p-5 h-full flex flex-col justify-between">
                    {/* TOP: Brand */}
                    <div className="flex items-start justify-between">
                      <p className="text-sm sm:text-base font-semibold" style={{ color: theme.textColor }}>
                        Pet Wash™
                      </p>
                      
                      {/* Badge */}
                      <div 
                        className="flex items-center gap-1 px-2 py-1 rounded-full"
                        style={{ background: theme.badgeBg }}
                      >
                        <IconComponent 
                          className="w-3 h-3" 
                          style={{ color: isGoldCard ? '#FFD700' : '#000000' }}
                        />
                        <span 
                          className="text-[10px] font-bold tracking-wide"
                          style={{ color: isGoldCard ? '#FFFFFF' : '#000000' }}
                        >
                          {theme.badge}
                        </span>
                      </div>
                    </div>
                    
                    {/* EMV Chip & Package Name */}
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-7 sm:w-11 sm:h-8 rounded-sm overflow-hidden flex-shrink-0"
                        style={{
                          background: theme.chipColor,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      >
                        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-[1px] p-1">
                          <div className="rounded-[1px]" style={{ background: 'rgba(0,0,0,0.12)' }} />
                          <div className="rounded-[1px]" style={{ background: 'rgba(0,0,0,0.12)' }} />
                          <div className="rounded-[1px]" style={{ background: 'rgba(0,0,0,0.12)' }} />
                          <div className="rounded-[1px]" style={{ background: 'rgba(0,0,0,0.12)' }} />
                        </div>
                      </div>
                      
                      <div>
                        <h3 
                          className="text-base sm:text-lg font-semibold"
                          style={{ color: theme.textColor }}
                        >
                          {pkg.washCount} {pkg.washCount === 1 ? 'Wash' : 'Washes'} E-Gift
                        </h3>
                        <p 
                          className="text-xs opacity-80"
                          style={{ color: theme.textColor }}
                        >
                          PetWash Ltd
                        </p>
                      </div>
                    </div>

                    {/* Price & Info */}
                    <div>
                      <p 
                        className="text-[10px] sm:text-xs opacity-70"
                        style={{ color: theme.textColor }}
                      >
                        Each wash starts at 55 Shekel
                      </p>
                      <p 
                        className="text-sm sm:text-base font-semibold"
                        style={{ color: theme.textColor }}
                      >
                        ₪{pkg.price}
                      </p>
                      <p 
                        className="text-xs font-mono opacity-80"
                        style={{ color: theme.textColor }}
                      >
                        SN: PWL{String(1234567 + index * 111)}/{pkg.washCount}
                      </p>
                    </div>
                    
                    {/* Bottom: Buy Button & Member */}
                    <div className="flex items-end justify-between">
                      <button
                        onClick={() => handleExpressCheckout(pkg)}
                        className="px-4 py-2 rounded-lg font-semibold text-xs shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200"
                        style={{
                          background: 'rgba(255,255,255,0.95)',
                          color: '#000000',
                        }}
                        data-testid={`button-express-checkout-${pkg.id}`}
                      >
                        {t('packages.buyNow', language)}
                      </button>
                      
                      <p 
                        className="text-sm font-semibold"
                        style={{ color: theme.textColor }}
                      >
                        MEMBER
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Secure Payment Badge - Gucci Black */}
        <div className="mt-12 sm:mt-16 lg:mt-20 flex justify-center">
          <div 
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl shadow-lg"
            style={{ background: '#000000' }}
          >
            <Shield className="w-6 h-6 text-white" />
            <span className="text-white text-base font-semibold tracking-wide">
              {language === 'he' ? 'תשלום מאובטח' : 'Secure Payment'}
            </span>
          </div>
        </div>

        {/* Trust Indicators - Gucci Black/White */}
        <div className="mt-12 sm:mt-16 lg:mt-20 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto px-4">
            <div className="flex flex-col items-center">
              <div 
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-3 sm:mb-4 border-2 border-black"
                style={{ background: '#FFFFFF' }}
              >
                <Check className="w-6 h-6 sm:w-7 sm:h-7 text-black" strokeWidth={3} />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-black mb-1 sm:mb-2">
                {t('packages.trust1Title', language)}
              </h4>
              <p className="text-sm sm:text-base text-black">
                {t('packages.trust1Desc', language)}
              </p>
            </div>
            
            <div className="flex flex-col items-center">
              <div 
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-3 sm:mb-4"
                style={{ background: '#000000' }}
              >
                <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.5} />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-black mb-1 sm:mb-2">
                {t('packages.trust2Title', language)}
              </h4>
              <p className="text-sm sm:text-base text-black">
                {t('packages.trust2Desc', language)}
              </p>
            </div>
            
            <div className="flex flex-col items-center">
              <div 
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-3 sm:mb-4 border-2 border-black"
                style={{ background: '#FFFFFF' }}
              >
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-black" strokeWidth={2.5} />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-black mb-1 sm:mb-2">
                {t('packages.trust3Title', language)}
              </h4>
              <p className="text-sm sm:text-base text-black">
                {t('packages.trust3Desc', language)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Shimmer Animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      {/* Checkout Modals */}
      {selectedPackage && (
        <ExpressCheckoutModal
          isOpen={isExpressCheckoutOpen}
          onClose={handleCloseExpressCheckout}
          package={selectedPackage}
          language={language}
        />
      )}

      {/* Customer Signup Modal */}
      <CustomerSignupModal
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        language={language}
      />
    </section>
  );
}
