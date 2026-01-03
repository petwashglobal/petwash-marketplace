import { useState, useEffect } from 'react';
import { Gift, Sparkles, Crown, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExpressCheckoutModal } from './ExpressCheckoutModal';
import { CustomerSignupModal } from './CustomerSignupModal';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { t, type Language } from '@/lib/i18n';
import { logger } from "@/lib/logger";

import roseFrontImg from '@assets/IMG_2004_1767477310445.png';
import emeraldFrontImg from '@assets/IMG_2002_1767477310445.png';
import platinumFrontImg from '@assets/IMG_1998_1767477310445.png';
import goldFrontImg from '@assets/IMG_1996_1767477310445.png';

interface GiftCardsProps {
  language: Language;
}

export function GiftCards({ language }: GiftCardsProps) {
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState(false);
  const { user } = useFirebaseAuth();

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
      name: "₪100 Credit",
      nameHe: "קרדיט ₪100",
      price: '100',
      colorVariant: "rose",
      image: roseFrontImg,
      description: "Perfect starter gift",
      descriptionHe: "מתנה מושלמת להתחלה"
    },
    {
      id: '2',
      name: "₪250 Credit",
      nameHe: "קרדיט ₪250",
      price: '250',
      colorVariant: "emerald",
      image: emeraldFrontImg,
      description: "Popular choice",
      descriptionHe: "הבחירה הפופולרית"
    },
    {
      id: '3',
      name: "₪500 Credit",
      nameHe: "קרדיט ₪500",
      price: '500',
      colorVariant: "platinum",
      image: platinumFrontImg,
      description: "Premium gift",
      descriptionHe: "מתנה פרימיום"
    },
    {
      id: '4',
      name: "₪1,000 Credit",
      nameHe: "קרדיט ₪1,000",
      price: '1000',
      colorVariant: "gold",
      image: goldFrontImg,
      description: "Ultimate luxury gift",
      descriptionHe: "מתנת היוקרה האולטימטיבית"
    }
  ];

  const getLuxuryTheme = (colorVariant: string) => {
    const themes: Record<string, any> = {
      rose: {
        gradient: 'linear-gradient(145deg, #E8A4B5 0%, #D18B9D 50%, #C47388 100%)',
        badge: 'STARTER',
        icon: Gift,
        shadowColor: 'rgba(212, 139, 157, 0.3)',
        textColor: '#FFFFFF',
        border: 'none',
      },
      emerald: {
        gradient: 'linear-gradient(145deg, #4A7C59 0%, #3D6B4A 50%, #2F5A3B 100%)',
        badge: 'POPULAR',
        icon: Crown,
        shadowColor: 'rgba(74, 124, 89, 0.3)',
        textColor: '#FFFFFF',
        border: 'none',
      },
      platinum: {
        gradient: 'linear-gradient(145deg, #1A1A1A 0%, #0D0D0D 50%, #000000 100%)',
        badge: 'PREMIUM',
        icon: Sparkles,
        shadowColor: 'rgba(0, 0, 0, 0.4)',
        textColor: '#FFFFFF',
        border: 'none',
      },
      gold: {
        gradient: 'linear-gradient(145deg, #D4AF37 0%, #C5A028 50%, #B8860B 100%)',
        badge: 'VIP ELITE',
        icon: Star,
        shadowColor: 'rgba(212, 175, 55, 0.4)',
        textColor: '#FFFFFF',
        border: 'none',
      },
    };
    return themes[colorVariant] || themes.rose;
  };

  const handlePurchase = (voucher: any) => {
    logger.debug('Gift card credit purchase clicked', { voucherName: voucher.name, creditAmount: voucher.price });
    
    // Convert to package format for checkout modal
    const packageData = {
      id: voucher.id,
      name: voucher.name,
      nameHe: voucher.nameHe,
      description: voucher.description,
      descriptionHe: voucher.descriptionHe,
      price: voucher.price.toString(),
      isActive: true,
      createdAt: null,
      isCreditGift: true, // Flag to indicate this is a platform credit gift
    };
    
    setSelectedPackage(packageData);
    
    // ✅ E-Gift credits can be purchased by anyone - no membership required
    // Gift credits are meant to be given to loved ones, so express checkout is open to all
    setIsCheckoutOpen(true);
    logger.debug('Gift card credit modal state set to open');
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
            <span className="px-4 py-2 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-full text-xs sm:text-sm font-semibold text-amber-800">
              {language === 'he' ? 'קרדיט לכל הפלטפורמות' : 'PLATFORM-WIDE CREDIT'}
            </span>
          </div>

          {/* Main Title */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4 sm:mb-6 px-4">
            {t('giftCards.title', language)}
          </h2>
          
          {/* Subtitle */}
          <p className="text-lg sm:text-xl lg:text-2xl text-black max-w-3xl mx-auto leading-relaxed mb-2 sm:mb-4 px-4">
            {t('giftCards.subtitle', language)}
          </p>
          
          {/* Additional tagline */}
          <p className="text-base sm:text-lg text-black max-w-2xl mx-auto italic px-4">
            {language === 'he' ? 'המתנה המושלמת למישהו שאתה אוהב' : 'The perfect gift for someone you love'}
          </p>
        </div>

        {/* Luxury Gift Cards Grid - Responsive 2x2 on large screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-6 max-w-7xl mx-auto">
          {vouchers.map((voucher) => {
            const theme = getLuxuryTheme(voucher.colorVariant);
            const IconComponent = theme.icon;
            const isDark = voucher.colorVariant === 'platinum' || voucher.colorVariant === 'emerald';
            
            return (
              <div
                key={voucher.id}
                className="group relative transform transition-all duration-300 hover:scale-105"
                style={{
                  perspective: '1000px',
                }}
              >
                {/* Best Value Badge for ₪1000 */}
                {voucher.price === '1000' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="px-4 sm:px-6 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs sm:text-sm font-bold rounded-full shadow-lg">
                      {language === 'he' ? 'הכי משתלם' : 'BEST VALUE'}
                    </div>
                  </div>
                )}

                {/* Card Image Display */}
                <div className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl mb-4">
                  <img 
                    src={voucher.image}
                    alt={`${voucher.name} E-Gift Card`}
                    className="w-full h-full object-cover object-center"
                    loading="lazy"
                  />
                </div>

                {/* Card Info */}
                <div className="text-center">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                    {language === 'he' ? voucher.nameHe : voucher.name}
                  </h3>
                  <p className="text-lg font-semibold text-gray-700 mb-1">
                    {language === 'he' ? 'קרדיט לכל הפלטפורמות' : 'Platform Credit'}
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    {language === 'he' ? voucher.descriptionHe : voucher.description}
                  </p>
                  
                  {/* Purchase Button */}
                  <button
                    onClick={() => handlePurchase(voucher)}
                    className="w-full py-3 px-6 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 bg-black text-white"
                    data-testid={`button-gift-purchase-${voucher.id}`}
                  >
                    {language === 'he' ? 'רכישה מיידית' : 'Buy Now'}
                  </button>
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