import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Sparkles, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export function WashPackages({ language }: WashPackagesProps) {
  const [selectedPackage, setSelectedPackage] = useState<WashPackage | null>(null);
  const [isExpressCheckoutOpen, setIsExpressCheckoutOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const { user } = useFirebaseAuth();
  const { trackPackageSelection } = useAnalytics();

  const { data: packages, isLoading, isError, error } = useQuery<WashPackage[]>({
    queryKey: ['/api/packages'],
  });

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
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-gray-600">
              {t('common.loading', language)}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('packages.errorLoading', language)}
            </h3>
            <p className="text-gray-600">
              {t('packages.tryAgainLater', language)}
            </p>
            {error && (
              <p className="text-sm text-gray-500 mt-2">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  const getDiscountPercentage = (washCount: number): number => {
    if (washCount === 3) return 10;
    if (washCount === 5) return 20;
    return 0;
  };

  const getLuxuryTheme = (index: number) => {
    const themes = [
      {
        // Premium Blue - Single Wash
        gradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1e40af 100%)',
        badge: 'PREMIUM',
        icon: Sparkles,
        shadowColor: 'rgba(59, 130, 246, 0.3)',
      },
      {
        // Royal Purple - 3 Washes (Recommended)
        gradient: 'linear-gradient(135deg, #6b21a8 0%, #a855f7 50%, #7c3aed 100%)',
        badge: 'POPULAR',
        icon: Crown,
        shadowColor: 'rgba(168, 85, 247, 0.3)',
      },
      {
        // Elite Gold - 5 Washes (Best Value)
        gradient: 'linear-gradient(135deg, #be5504 0%, #f59e0b 50%, #d97706 100%)',
        badge: 'BEST VALUE',
        icon: Crown,
        shadowColor: 'rgba(245, 158, 11, 0.3)',
      },
    ];
    return themes[index] || themes[0];
  };

  return (
    <section 
      id="packages"
      className="py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-slate-50 via-white to-slate-50 relative overflow-hidden"
    >
      {/* Luxury Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.08),transparent_50%)]"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Luxury Header Section */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          {/* Premium Badge */}
          <div className="inline-flex items-center justify-center p-2 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-full mb-4 sm:mb-6">
            <span className="px-4 py-2 bg-white rounded-full text-xs sm:text-sm font-semibold text-gray-700 shadow-sm">
              {t('packages.premiumBadge', language)}
            </span>
          </div>

          {/* Main Title */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-4 sm:mb-6 px-4">
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

        {/* Luxury Package Cards Grid - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 max-w-7xl mx-auto">
          {packages?.map((pkg, index) => {
            const discount = getDiscountPercentage(pkg.washCount);
            const pricePerWash = pkg.washCount > 1 
              ? Math.round(Number(pkg.price) / pkg.washCount) 
              : Number(pkg.price);
            
            const theme = getLuxuryTheme(index);
            const IconComponent = theme.icon;
            
            return (
              <div
                key={pkg.id}
                className="group relative transform transition-all duration-300 hover:scale-105"
                style={{
                  perspective: '1000px',
                }}
              >
                {/* Recommended Badge - Most Popular */}
                {pkg.washCount === 3 && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="px-4 sm:px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs sm:text-sm font-bold rounded-full shadow-lg animate-pulse">
                      {t('packages.mostPopular', language)}
                    </div>
                  </div>
                )}

                {/* Luxury Card Container */}
                <div
                  className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl transition-all duration-500"
                  style={{
                    background: theme.gradient,
                    boxShadow: `0 20px 60px ${theme.shadowColor}, 0 0 0 1px rgba(255,255,255,0.1) inset`,
                  }}
                >
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {/* Card Content */}
                  <div className="relative p-6 sm:p-8 lg:p-10">
                    {/* Package Badge */}
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white/90" />
                        <span className="text-xs sm:text-sm font-bold text-white/90 tracking-wider">
                          {theme.badge}
                        </span>
                      </div>
                      {discount > 0 && (
                        <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                          <span className="text-xs sm:text-sm font-bold text-white">
                            -{discount}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Package Name */}
                    <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3">
                      {language === 'he' ? pkg.nameHe : pkg.name}
                    </h3>

                    {/* Price Display */}
                    <div className="mb-6 sm:mb-8">
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white">
                          ₪{pkg.price}
                        </span>
                      </div>
                      {pkg.washCount > 1 && (
                        <p className="text-base sm:text-lg text-white/80 mt-2">
                          ₪{pricePerWash} {t('packages.perWash', language)}
                        </p>
                      )}
                    </div>

                    {/* Features List */}
                    <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-1 bg-white/20 rounded-full">
                          <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={3} />
                        </div>
                        <span className="text-sm sm:text-base text-white/95 leading-relaxed">
                          {t('packages.feature1', language)}
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-1 bg-white/20 rounded-full">
                          <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={3} />
                        </div>
                        <span className="text-sm sm:text-base text-white/95 leading-relaxed">
                          {t('packages.feature2', language)}
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-1 bg-white/20 rounded-full">
                          <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={3} />
                        </div>
                        <span className="text-sm sm:text-base text-white/95 leading-relaxed">
                          {t('packages.feature3', language)}
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-1 bg-white/20 rounded-full">
                          <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={3} />
                        </div>
                        <span className="text-sm sm:text-base text-white/95 leading-relaxed">
                          {t('packages.feature4', language)}
                        </span>
                      </div>
                      {pkg.washCount > 1 && (
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-1 bg-white/20 rounded-full">
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={3} />
                          </div>
                          <span className="text-sm sm:text-base text-white/95 leading-relaxed font-semibold">
                            {t('packages.noExpiration', language)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      <button
                        onClick={() => handleExpressCheckout(pkg)}
                        className="w-full py-3 sm:py-4 px-6 bg-white text-gray-900 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                        data-testid={`button-express-checkout-${pkg.id}`}
                      >
                        {t('packages.buyNow', language)}
                      </button>
                      
                      {!user && (
                        <button
                          onClick={() => setIsSignupModalOpen(true)}
                          className="w-full py-3 sm:py-4 px-6 bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base hover:bg-white/30 transition-all duration-300"
                          data-testid={`button-signup-save-${pkg.id}`}
                        >
                          {t('packages.signupSave', language)}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Number & Decorative Element */}
                  <div className="px-6 sm:px-8 lg:px-10 pb-6 sm:pb-8">
                    <div className="flex items-center justify-between text-white/60 text-xs sm:text-sm">
                      <span className="font-mono">#{String(Date.now() + pkg.id).slice(-6)}</span>
                      <span className="font-semibold">PET WASH™</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 sm:mt-16 lg:mt-20 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto px-4">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-3 sm:mb-4">
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
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mb-3 sm:mb-4">
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
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.5} />
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
