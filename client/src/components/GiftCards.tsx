import { useState, useEffect } from 'react';
import { Gift, Sparkles, Crown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExpressCheckoutModal } from './ExpressCheckoutModal';
import { CustomerSignupModal } from './CustomerSignupModal';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { t, type Language } from '@/lib/i18n';
import { logger } from "@/lib/logger";

interface GiftCardsProps {
  language: Language;
}

export function GiftCards({ language }: GiftCardsProps) {
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState(false);
  const { user } = useFirebaseAuth();

  // ✅ Auto-resume checkout after authentication
  useEffect(() => {
    if (user && pendingPurchase && selectedPackage) {
      logger.debug('User authenticated - auto-opening checkout', { userId: user.uid });
      setPendingPurchase(false);
      setIsSignupModalOpen(false);
      setIsCheckoutOpen(true);
    }
  }, [user, pendingPurchase, selectedPackage]);

  const vouchers = [
    {
      id: '1',
      name: "1 Premium Wash",
      nameHe: "רחיצה פרימיום אחת",
      washCount: 1,
      price: '55',
      colorVariant: "fresh-pink"
    },
    {
      id: '2',
      name: "3 Premium Washes",
      nameHe: "3 רחיצות פרימיום",
      washCount: 3,
      price: '150',
      colorVariant: "pearl-silver"
    },
    {
      id: '3',
      name: "5 Premium Washes",
      nameHe: "5 רחיצות פרימיום",
      washCount: 5,
      price: '220',
      colorVariant: "champagne-gold"
    }
  ];

  const getLuxuryTheme = (index: number) => {
    const themes = [
      {
        // White - Single Gift
        gradient: '#FFFFFF',
        badge: 'SIGNATURE',
        icon: Gift,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        textColor: '#000000',
        border: '1px solid #000000',
      },
      {
        // Light Gray - 3 Washes (Recommended)
        gradient: '#F5F5F5',
        badge: 'POPULAR',
        icon: Crown,
        shadowColor: 'rgba(0, 0, 0, 0.12)',
        textColor: '#000000',
        border: '2px solid #000000',
      },
      {
        // Black - 5 Washes (Best Value)
        gradient: '#000000',
        badge: 'BEST VALUE',
        icon: Sparkles,
        shadowColor: 'rgba(0, 0, 0, 0.2)',
        textColor: '#FFFFFF',
        border: 'none',
      },
    ];
    return themes[index] || themes[0];
  };

  const handlePurchase = (voucher: any) => {
    logger.debug('Gift card purchase clicked', { voucherName: voucher.name });
    
    // Convert to WashPackage format
    const packageData = {
      id: voucher.id,
      name: voucher.name,
      nameHe: voucher.nameHe,
      description: null,
      descriptionHe: null,
      price: voucher.price.toString(),
      washCount: voucher.washCount,
      isActive: true,
      createdAt: null,
    };
    
    setSelectedPackage(packageData);
    
    // ✅ E-Gift cards can be purchased by anyone - no membership required
    // Gift cards are meant to be given to loved ones, so express checkout is open to all
    setIsCheckoutOpen(true);
    logger.debug('Gift card modal state set to open');
  };

  const handleCloseSignupModal = () => {
    setIsSignupModalOpen(false);
    // Clear pending purchase if user cancels signup
    if (!user) {
      setPendingPurchase(false);
      setSelectedPackage(null);
    }
  };

  return (
    <section 
      id="gift-cards"
      className="py-16 sm:py-20 lg:py-24 bg-white relative overflow-hidden"
    >
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Luxury Header Section */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          {/* Premium Badge */}
          <div className="inline-flex items-center justify-center p-2 mb-4 sm:mb-6">
            <span className="px-4 py-2 bg-white rounded-full text-xs sm:text-sm font-semibold text-black border border-black">
              {language === 'he' ? 'כרטיסי מתנה דיגיטליים' : 'PREMIUM DIGITAL GIFTS'}
            </span>
          </div>

          {/* Main Title */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4 sm:mb-6 px-4">
            {t('giftCards.title', language)}
          </h2>
          
          {/* Subtitle */}
          <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-2 sm:mb-4 px-4">
            {t('giftCards.subtitle', language)}
          </p>
          
          {/* Additional tagline */}
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto italic px-4">
            {language === 'he' ? 'המתנה המושלמת למישהו שאתה אוהב' : 'The perfect gift for someone you love'}
          </p>
        </div>

        {/* Luxury Gift Cards Grid - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 max-w-7xl mx-auto">
          {vouchers.map((voucher, index) => {
            const theme = getLuxuryTheme(index);
            const IconComponent = theme.icon;
            
            return (
              <div
                key={voucher.id}
                className="group relative transform transition-all duration-300 hover:scale-105"
                style={{
                  perspective: '1000px',
                }}
              >
                {/* Recommended Badge - Most Popular */}
                {voucher.washCount === 3 && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="px-4 sm:px-6 py-2 bg-black text-white text-xs sm:text-sm font-bold rounded-full shadow-lg">
                      {language === 'he' ? 'הכי פופולרי' : 'MOST POPULAR'}
                    </div>
                  </div>
                )}

                {/* Luxury Card Container */}
                <div
                  className="relative overflow-hidden rounded-2xl sm:rounded-3xl transition-all duration-500"
                  style={{
                    background: theme.gradient,
                    border: theme.border,
                    boxShadow: `0 10px 40px ${theme.shadowColor}`,
                  }}
                >
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {/* Card Content */}
                  <div className="relative p-6 sm:p-8 lg:p-10">
                    {/* Gift Badge */}
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.textColor }} />
                        <span className="text-xs sm:text-sm font-bold tracking-wider" style={{ color: theme.textColor }}>
                          {theme.badge}
                        </span>
                      </div>
                      <div className="px-3 py-1 rounded-full" style={{ background: index === 2 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }}>
                        <span className="text-xs sm:text-sm font-bold" style={{ color: theme.textColor }}>
                          {language === 'he' ? 'מתנה' : 'GIFT'}
                        </span>
                      </div>
                    </div>

                    {/* Gift Name */}
                    <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3" style={{ color: theme.textColor }}>
                      {language === 'he' ? voucher.nameHe : voucher.name}
                    </h3>

                    {/* Price Display */}
                    <div className="mb-6 sm:mb-8">
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl sm:text-6xl lg:text-7xl font-bold" style={{ color: theme.textColor }}>
                          ₪{voucher.price}
                        </span>
                      </div>
                      <p className="text-base sm:text-lg mt-2" style={{ color: theme.textColor, opacity: 0.8 }}>
                        {voucher.washCount} {language === 'he' ? 'רחיצות פרימיום' : 'Premium Washes'}
                      </p>
                    </div>

                    {/* Features List */}
                    <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-1 rounded-full" style={{ background: index === 2 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }}>
                          <Check className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: theme.textColor }} strokeWidth={3} />
                        </div>
                        <span className="text-sm sm:text-base leading-relaxed" style={{ color: theme.textColor, opacity: 0.95 }}>
                          {language === 'he' ? 'טיפול אורגני פרימיום' : 'Premium organic care'}
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-1 rounded-full" style={{ background: index === 2 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }}>
                          <Check className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: theme.textColor }} strokeWidth={3} />
                        </div>
                        <span className="text-sm sm:text-base leading-relaxed" style={{ color: theme.textColor, opacity: 0.95 }}>
                          {language === 'he' ? 'משלוח מיידי באימייל' : 'Instant email delivery'}
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-1 rounded-full" style={{ background: index === 2 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }}>
                          <Check className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: theme.textColor }} strokeWidth={3} />
                        </div>
                        <span className="text-sm sm:text-base leading-relaxed" style={{ color: theme.textColor, opacity: 0.95 }}>
                          {language === 'he' ? 'ללא תאריך תפוגה' : 'Never expires'}
                        </span>
                      </div>
                    </div>

                    {/* Purchase Button */}
                    <div className="space-y-3">
                      <button
                        onClick={() => handlePurchase(voucher)}
                        className="w-full py-3 sm:py-4 px-6 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                        style={{ 
                          background: index === 2 ? '#FFFFFF' : '#000000',
                          color: index === 2 ? '#000000' : '#FFFFFF',
                        }}
                        data-testid={`button-gift-purchase-${voucher.id}`}
                      >
                        {language === 'he' ? 'רכישה מיידית' : 'Buy Now'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Express Checkout Modal */}
      {selectedPackage && (
        <ExpressCheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          package={selectedPackage}
          language={language}
          isGiftCard={true}
        />
      )}
      
      {/* Sign Up Modal for Guest Users - Auto-resumes checkout after signup */}
      <CustomerSignupModal
        isOpen={isSignupModalOpen}
        onClose={handleCloseSignupModal}
        language={language}
      />
    </section>
  );
}