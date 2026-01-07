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
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin w-10 h-10 sm:w-12 sm:h-12 border-4 border-black border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-black">
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

  // LUXURY CRYSTAL CREDIT CARD THEMES
  const getLuxuryTheme = (index: number) => {
    const themes = [
      {
        // ROSE/PINK - Single Wash
        gradient: 'linear-gradient(145deg, #FF9EC4 0%, #FF6B9D 25%, #E91E8C 50%, #C71585 75%, #9B1168 100%)',
        glassOverlay: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.25) 100%)',
        holographic: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)',
        textGradient: '#000000',
        badge: 'BASIC',
        badgeBg: 'rgba(255,255,255,0.95)',
        icon: CreditCard,
        shadowColor: 'rgba(199,21,133,0.5)',
        chipColor: 'linear-gradient(145deg, #D4AF37 0%, #F5D76E 40%, #D4AF37 60%, #AA8C2C 100%)',
        textColor: '#FFFFFF',
        accentColor: '#FFD1E3',
        border: 'none',
      },
      {
        // EMERALD/GREEN - 3 Washes (Most Popular)
        gradient: 'linear-gradient(145deg, #4ADE80 0%, #22C55E 25%, #16A34A 50%, #15803D 75%, #166534 100%)',
        glassOverlay: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.2) 100%)',
        holographic: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
        textGradient: '#000000',
        badge: 'POPULAR',
        badgeBg: 'rgba(255,255,255,0.95)',
        icon: Crown,
        shadowColor: 'rgba(22,163,74,0.5)',
        chipColor: 'linear-gradient(145deg, #D4AF37 0%, #F5D76E 40%, #D4AF37 60%, #AA8C2C 100%)',
        textColor: '#FFFFFF',
        accentColor: '#BBF7D0',
        border: 'none',
      },
      {
        // PLATINUM/BLACK - 5 Washes (Premium)
        gradient: 'linear-gradient(145deg, #6B7280 0%, #4B5563 20%, #374151 40%, #1F2937 60%, #111827 80%, #030712 100%)',
        glassOverlay: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 40%, rgba(192,192,192,0.15) 70%, rgba(255,255,255,0.2) 100%)',
        holographic: 'linear-gradient(45deg, transparent 25%, rgba(192,192,192,0.6) 50%, transparent 75%)',
        textGradient: '#FFFFFF',
        badge: 'PREMIUM',
        badgeBg: 'rgba(255,255,255,0.95)',
        icon: Sparkles,
        shadowColor: 'rgba(0,0,0,0.6)',
        chipColor: 'linear-gradient(145deg, #E8E8E8 0%, #C0C0C0 40%, #A8A8A8 60%, #808080 100%)',
        textColor: '#FFFFFF',
        accentColor: '#E5E7EB',
        border: 'none',
      },
      {
        // GOLD - 10 Washes (Family Pack - Elite)
        gradient: 'linear-gradient(145deg, #FCD34D 0%, #F59E0B 20%, #D97706 40%, #B45309 60%, #92400E 80%, #78350F 100%)',
        glassOverlay: 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 40%, rgba(255,215,0,0.2) 70%, rgba(255,255,255,0.3) 100%)',
        holographic: 'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.6) 50%, transparent 75%)',
        textGradient: '#FFFFFF',
        badge: 'ELITE',
        badgeBg: 'rgba(0,0,0,0.9)',
        icon: Shield,
        shadowColor: 'rgba(217,119,6,0.5)',
        chipColor: 'linear-gradient(145deg, #FFD700 0%, #FFA500 40%, #FF8C00 60%, #D4AF37 100%)',
        textColor: '#1C1917',
        accentColor: '#FEF3C7',
        border: 'none',
      },
    ];
    return themes[index] || themes[0];
  };

  return (
    <section 
      id="packages"
      className="py-16 sm:py-20 lg:py-24 bg-white relative overflow-hidden"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Luxury Header Section */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
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

        {/* Compact error notice if API fails */}
        {showErrorNotice && (
          <div className="mb-6 max-w-4xl mx-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-800">
                {t('packages.errorLoading', language)} - {language === 'he' ? 'מציג מחירים בסיסיים' : 'Showing standard pricing'}
              </p>
            </div>
          </div>
        )}

        {/* LUXURY CREDIT CARD STYLE PACKAGES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 max-w-7xl mx-auto">
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

                {/* PREMIUM CRYSTAL CREDIT CARD CONTAINER */}
                <div
                  className="relative overflow-hidden rounded-2xl transition-all duration-500"
                  style={{
                    background: theme.gradient,
                    border: theme.border,
                    boxShadow: `0 20px 50px -12px ${theme.shadowColor}, 0 10px 25px -8px rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)`,
                    aspectRatio: '1.586/1',
                    minHeight: '380px',
                  }}
                >
                  {/* Crystal Glass Overlay */}
                  <div className="absolute inset-0 opacity-60" style={{ background: theme.glassOverlay }} />
                  
                  {/* Holographic Shine Effect on Hover */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{
                      background: theme.holographic,
                    }}
                  />
                  
                  {/* Light Reflection */}
                  <div className="absolute inset-0 opacity-40">
                    <div className="absolute top-0 left-0 w-full h-full" style={{
                      backgroundImage: 'radial-gradient(ellipse at 20% 20%, rgba(255,255,255,0.6) 0%, transparent 40%), radial-gradient(ellipse at 80% 80%, rgba(255,255,255,0.2) 0%, transparent 30%)'
                    }} />
                  </div>
                  
                  {/* Inner Border Glow */}
                  <div className="absolute inset-[1px] rounded-[15px]" style={{
                    border: '1px solid rgba(255,255,255,0.25)',
                    boxShadow: 'inset 0 0 20px rgba(255,255,255,0.1)'
                  }} />

                  {/* Card Content */}
                  <div className="relative p-5 sm:p-6 h-full flex flex-col justify-between">
                    {/* TOP: Badge & Chip */}
                    <div className="flex items-start justify-between">
                      {/* EMV Chip - Premium Gold/Silver Metallic */}
                      <div 
                        className="w-12 h-9 rounded-md overflow-hidden"
                        style={{
                          background: theme.chipColor,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2)',
                        }}
                      >
                        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-[2px] p-1.5">
                          <div className="rounded-sm" style={{ background: 'rgba(0,0,0,0.15)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />
                          <div className="rounded-sm" style={{ background: 'rgba(0,0,0,0.15)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />
                          <div className="rounded-sm" style={{ background: 'rgba(0,0,0,0.15)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />
                          <div className="rounded-sm" style={{ background: 'rgba(0,0,0,0.15)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />
                        </div>
                      </div>

                      {/* Badge */}
                      <div 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm"
                        style={{ 
                          background: theme.badgeBg,
                          boxShadow: '0 2px 10px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)'
                        }}
                      >
                        <IconComponent 
                          className="w-4 h-4" 
                          style={{ color: isGoldCard ? '#FFD700' : '#000000' }}
                        />
                        <span 
                          className="text-xs font-black tracking-wider"
                          style={{ color: isGoldCard ? '#FFFFFF' : '#000000' }}
                        >
                          {theme.badge}
                        </span>
                      </div>
                    </div>

                    {/* MIDDLE: Package Name & Price */}
                    <div className="flex-1 flex flex-col justify-center py-4">
                      <h3 
                        className="text-xl sm:text-2xl font-bold mb-2"
                        style={{ 
                          color: theme.textColor,
                          fontFamily: "'Playfair Display', serif",
                        }}
                      >
                        {language === 'he' ? pkg.nameHe : pkg.name}
                      </h3>

                      {/* Price Display */}
                      <div className="mb-2">
                        <span 
                          className="text-4xl sm:text-5xl font-bold"
                          style={{ color: theme.textColor }}
                        >
                          ₪{pkg.price}
                        </span>
                      </div>
                      
                      {pkg.washCount > 1 && (
                        <p 
                          className="text-sm opacity-80"
                          style={{ color: theme.textColor }}
                        >
                          ₪{pricePerWash} {t('packages.perWash', language)}
                        </p>
                      )}

                      {/* Features */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4" style={{ color: theme.accentColor }} strokeWidth={3} />
                          <span className="text-xs" style={{ color: theme.textColor, opacity: 0.9 }}>
                            {t('packages.feature1', language)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4" style={{ color: theme.accentColor }} strokeWidth={3} />
                          <span className="text-xs" style={{ color: theme.textColor, opacity: 0.9 }}>
                            {t('packages.feature2', language)}
                          </span>
                        </div>
                        {pkg.washCount > 1 && (
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4" style={{ color: theme.accentColor }} strokeWidth={3} />
                            <span className="text-xs font-semibold" style={{ color: theme.textColor }}>
                              {t('packages.noExpiration', language)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BOTTOM: Card Number & Brand */}
                    <div>
                      {/* Buy Button */}
                      <button
                        onClick={() => handleExpressCheckout(pkg)}
                        className="w-full py-2.5 px-4 rounded-lg font-bold text-sm shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 mb-3"
                        style={{
                          background: isGoldCard ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
                          color: isGoldCard ? '#FFD700' : '#000000',
                        }}
                        data-testid={`button-express-checkout-${pkg.id}`}
                      >
                        {t('packages.buyNow', language)}
                      </button>

                      {/* Card Footer */}
                      <div 
                        className="flex items-center justify-between text-xs pt-2 border-t"
                        style={{ 
                          borderColor: 'rgba(255,255,255,0.3)',
                          color: theme.textColor,
                          opacity: 0.9,
                        }}
                      >
                        <span className="font-mono tracking-wider">
                          •••• {String(1000 + index * 111)}
                        </span>
                        <span 
                          className="font-bold tracking-wide"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          PET WASH™
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contactless Icon */}
                  <div 
                    className="absolute top-5 right-5 w-6 h-6 opacity-60"
                    style={{ transform: 'rotate(90deg)' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke={theme.textColor} strokeWidth="2">
                      <path d="M8.5 14.5A7.5 7.5 0 0016 7" />
                      <path d="M5 17.5A12 12 0 0017 5.5" />
                    </svg>
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
