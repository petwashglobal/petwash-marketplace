import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Sparkles, Crown, Shield, CreditCard } from 'lucide-react';
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

// Fallback packages when API fails - OFFICIAL 2025 PRICES (NO DISCOUNTS)
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
    price: '165',
    washCount: 3,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    name: '5-Wash Package',
    description: 'Five premium organic washes',
    price: '275',
    washCount: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    name: '10-Wash Package',
    description: 'Ten premium organic washes - Family Pack',
    price: '550',
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
            <div className="animate-spin w-10 h-10 sm:w-12 sm:h-12 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-gray-600">
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

  // LUXURY CREDIT CARD THEMES - Metallic Gold, Silver, Platinum, Black
  const getLuxuryTheme = (index: number) => {
    const themes = [
      {
        // SILVER - Single Wash
        gradient: 'linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 25%, #A8A8A8 50%, #D4D4D4 75%, #C0C0C0 100%)',
        textGradient: 'linear-gradient(135deg, #4A4A4A 0%, #1A1A1A 100%)',
        badge: 'SILVER',
        badgeBg: 'rgba(192, 192, 192, 0.3)',
        icon: CreditCard,
        shadowColor: 'rgba(160, 160, 160, 0.5)',
        chipColor: '#A8A8A8',
        textColor: '#1A1A1A',
        accentColor: '#666666',
      },
      {
        // GOLD - 3 Washes (Most Popular)
        gradient: 'linear-gradient(135deg, #FFD700 0%, #FFF2CC 20%, #DAA520 40%, #FFD700 60%, #FFC107 80%, #FFE55C 100%)',
        textGradient: 'linear-gradient(135deg, #5D4E0B 0%, #3D3200 100%)',
        badge: 'GOLD',
        badgeBg: 'rgba(255, 215, 0, 0.3)',
        icon: Crown,
        shadowColor: 'rgba(218, 165, 32, 0.5)',
        chipColor: '#DAA520',
        textColor: '#3D3200',
        accentColor: '#5D4E0B',
      },
      {
        // PLATINUM - 5 Washes
        gradient: 'linear-gradient(135deg, #E5E4E2 0%, #FFFFFF 20%, #C9C9C7 40%, #E5E4E2 60%, #FFFFFF 80%, #D3D3D3 100%)',
        textGradient: 'linear-gradient(135deg, #2C2C2C 0%, #1A1A1A 100%)',
        badge: 'PLATINUM',
        badgeBg: 'rgba(229, 228, 226, 0.5)',
        icon: Sparkles,
        shadowColor: 'rgba(200, 200, 200, 0.6)',
        chipColor: '#B0B0B0',
        textColor: '#1A1A1A',
        accentColor: '#4A4A4A',
      },
      {
        // BLACK CARD - 10 Washes (Family Pack - Elite)
        gradient: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 25%, #0D0D0D 50%, #1F1F1F 75%, #1A1A1A 100%)',
        textGradient: 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)',
        badge: 'BLACK CARD',
        badgeBg: 'rgba(255, 215, 0, 0.2)',
        icon: Shield,
        shadowColor: 'rgba(0, 0, 0, 0.6)',
        chipColor: '#FFD700',
        textColor: '#FFFFFF',
        accentColor: '#FFD700',
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
          <div className="inline-flex items-center justify-center p-2 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-full mb-4 sm:mb-6">
            <span className="px-4 py-2 bg-white rounded-full text-xs sm:text-sm font-semibold text-emerald-700 shadow-sm border border-emerald-100">
              {t('packages.premiumBadge', language)}
            </span>
          </div>

          {/* Main Title - Serif Typography */}
          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 px-4"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', serif" }}
          >
            {t('packages.title', language)}
          </h2>
          
          {/* Subtitle */}
          <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-2 sm:mb-4 px-4">
            {t('packages.subtitle', language)}
          </p>
          
          {/* Additional tagline */}
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto italic px-4">
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
            const isBlackCard = index === 3;
            
            return (
              <div
                key={pkg.id}
                className="group relative transform transition-all duration-500 hover:scale-105 hover:-translate-y-2"
                style={{
                  perspective: '1000px',
                }}
              >
                {/* Most Popular Badge - Gold Card */}
                {pkg.washCount === 3 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                    <div 
                      className="px-4 py-1.5 text-xs font-bold rounded-full shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)',
                        color: '#3D3200',
                      }}
                    >
                      {t('packages.mostPopular', language)}
                    </div>
                  </div>
                )}

                {/* CREDIT CARD CONTAINER */}
                <div
                  className="relative overflow-hidden rounded-2xl transition-all duration-500"
                  style={{
                    background: theme.gradient,
                    boxShadow: `0 20px 60px ${theme.shadowColor}, 0 0 0 1px rgba(255,255,255,0.2) inset`,
                    aspectRatio: '1.586/1', // Standard credit card ratio
                    minHeight: '380px',
                  }}
                >
                  {/* Metallic Shine Effect */}
                  <div 
                    className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-500"
                    style={{
                      background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.4) 55%, transparent 60%)',
                      transform: 'translateX(-100%)',
                      animation: 'shimmer 3s infinite',
                    }}
                  />

                  {/* Card Content */}
                  <div className="relative p-5 sm:p-6 h-full flex flex-col justify-between">
                    {/* TOP: Badge & Chip */}
                    <div className="flex items-start justify-between">
                      {/* Card Chip (EMV Chip) */}
                      <div 
                        className="w-10 h-8 rounded-md"
                        style={{
                          background: `linear-gradient(135deg, ${theme.chipColor} 0%, ${isBlackCard ? '#FFFFFF' : '#888'} 50%, ${theme.chipColor} 100%)`,
                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
                        }}
                      >
                        <div className="w-full h-full grid grid-cols-2 gap-0.5 p-1">
                          <div className="bg-white/20 rounded-sm"></div>
                          <div className="bg-white/20 rounded-sm"></div>
                          <div className="bg-white/20 rounded-sm"></div>
                          <div className="bg-white/20 rounded-sm"></div>
                        </div>
                      </div>

                      {/* Badge */}
                      <div 
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                        style={{ background: theme.badgeBg }}
                      >
                        <IconComponent 
                          className="w-4 h-4" 
                          style={{ color: theme.accentColor }}
                        />
                        <span 
                          className="text-xs font-bold tracking-wider"
                          style={{ color: theme.accentColor }}
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
                          background: isBlackCard 
                            ? 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)' 
                            : '#FFFFFF',
                          color: isBlackCard ? '#1A1A1A' : theme.textColor,
                        }}
                        data-testid={`button-express-checkout-${pkg.id}`}
                      >
                        {t('packages.buyNow', language)}
                      </button>

                      {/* Card Footer */}
                      <div 
                        className="flex items-center justify-between text-xs pt-2 border-t"
                        style={{ 
                          borderColor: isBlackCard ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                          color: theme.textColor,
                          opacity: 0.7,
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

        {/* Secure Payment Badge - Emerald */}
        <div className="mt-12 sm:mt-16 lg:mt-20 flex justify-center">
          <div 
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #008F46 0%, #00C569 50%, #008F46 100%)',
            }}
          >
            <Shield className="w-6 h-6 text-white" />
            <span className="text-white text-base font-semibold tracking-wide">
              {language === 'he' ? 'תשלום מאובטח' : 'Secure Payment'}
            </span>
          </div>
        </div>

        {/* Trust Indicators - Emerald Theme */}
        <div className="mt-12 sm:mt-16 lg:mt-20 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto px-4">
            <div className="flex flex-col items-center">
              <div 
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-3 sm:mb-4"
                style={{
                  background: 'linear-gradient(135deg, #008F46 0%, #00C569 100%)',
                }}
              >
                <Check className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={3} />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">
                {t('packages.trust1Title', language)}
              </h4>
              <p className="text-sm sm:text-base text-gray-600">
                {t('packages.trust1Desc', language)}
              </p>
            </div>
            
            <div className="flex flex-col items-center">
              <div 
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-3 sm:mb-4"
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #DAA520 100%)',
                }}
              >
                <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.5} />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">
                {t('packages.trust2Title', language)}
              </h4>
              <p className="text-sm sm:text-base text-gray-600">
                {t('packages.trust2Desc', language)}
              </p>
            </div>
            
            <div className="flex flex-col items-center">
              <div 
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-3 sm:mb-4"
                style={{
                  background: 'linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 50%, #A8A8A8 100%)',
                }}
              >
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-gray-700" strokeWidth={2.5} />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">
                {t('packages.trust3Title', language)}
              </h4>
              <p className="text-sm sm:text-base text-gray-600">
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
