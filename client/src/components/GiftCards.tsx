import { useState, useEffect } from 'react';
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
      id: 1,
      name: "1 Premium Wash",
      nameHe: "רחיצה פרימיום אחת",
      washCount: 1,
      price: 55,
      colorVariant: "fresh-pink"
    },
    {
      id: 2,
      name: "3 Premium Washes",
      nameHe: "3 רחיצות פרימיום",
      washCount: 3,
      price: 150,
      colorVariant: "pearl-silver"
    },
    {
      id: 3,
      name: "5 Premium Washes",
      nameHe: "5 רחיצות פרימיום",
      washCount: 5,
      price: 220,
      colorVariant: "champagne-gold"
    }
  ];

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
    
    // ✅ Require authentication for purchases (security & payment processing)
    if (!user) {
      logger.debug('User not authenticated - showing signup modal');
      setPendingPurchase(true);
      setIsSignupModalOpen(true);
      return;
    }
    
    // User is authenticated - proceed to checkout
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
    <section className="py-24 bg-gradient-to-br from-gray-50 via-white to-gray-50 relative overflow-hidden">
      {/* Luxury Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(168,85,247,0.05),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_70%,rgba(59,130,246,0.05),transparent_50%)]"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center p-2 bg-gradient-to-r from-purple-600/10 to-blue-600/10 rounded-full mb-6">
            <span className="px-4 py-2 bg-white rounded-full text-sm font-semibold text-gray-700 shadow-sm">
              PREMIUM DIGITAL GIFTS
            </span>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-purple-900 to-blue-900 bg-clip-text text-transparent mb-6">
            {t('giftCards.title', language)}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-4">
            {t('giftCards.subtitle', language)}
          </p>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto italic">
            {language === 'he' ? 'המתנה המושלמת למישהו שאתה אוהב' : 'The perfect gift to someone you love'}
          </p>
        </div>

        <div className="apple-style-cards-section">
          {/* Apple-Style Pet Wash™ E-Vouchers */}
          <div className="apple-cards-grid">
            {vouchers.map((voucher, index) => {
              const appleCardThemes = [
                {
                  // Deep Blue Theme
                  id: "deep-blue",
                  name: "SIGNATURE",
                  bg: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1e40af 100%)",
                  textColor: "#ffffff",
                  accentColor: "#ffffff",
                  buttonClass: "apple-blue-btn"
                },
                {
                  // Teal Theme  
                  id: "teal",
                  name: "PREMIUM",
                  bg: "linear-gradient(135deg, #0f766e 0%, #14b8a6 50%, #0d9488 100%)",
                  textColor: "#ffffff", 
                  accentColor: "#ffffff",
                  buttonClass: "apple-teal-btn"
                },
                {
                  // Rose Gold Theme
                  id: "rose-gold",
                  name: "LUXE",
                  bg: "linear-gradient(135deg, #be185d 0%, #ec4899 50%, #db2777 100%)",
                  textColor: "#ffffff",
                  accentColor: "#ffffff",
                  buttonClass: "apple-rose-btn"
                }
              ];
              
              const theme = appleCardThemes[index % 3];
              
              return (
                <div key={voucher.id} className="apple-card-container">
                  
                  {/* Apple-Style Pet Wash™ Card */}
                  <div className={`apple-gift-card ${theme.id}-theme`} style={{ background: theme.bg }}>
                    
                    {/* Card Header */}
                    <div className="apple-card-header">
                      <div className="brand-logo-section">
                        <div className="main-brand" style={{ color: theme.textColor }}>
                          PET WASH™
                        </div>
                        <div className="brand-subtitle" style={{ color: theme.accentColor }}>
                          {theme.name} COLLECTION
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Body - Value Display */}
                    <div className="apple-card-body">
                      <div className="value-display-section">
                        <div className="currency-amount" style={{ color: theme.textColor }}>
                          ₪{voucher.washCount === 5 ? '220' : voucher.price}
                        </div>
                        <div className="service-description" style={{ color: theme.accentColor }}>
                          {voucher.washCount} {language === 'he' ? 'רחיצות יוקרה' : 'LUXURY WASHES'}
                        </div>
                        <div className="wash-count-detail" style={{ color: '#ffffff', fontSize: '0.65rem', opacity: '0.8', marginTop: '0.25rem' }}>
                          {voucher.washCount === 1 ? 'Single Wash' : voucher.washCount === 3 ? 'Three Washes' : 'Five Washes'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Footer */}
                    <div className="apple-card-footer">
                      <div className="card-details">
                        <div className="card-number" style={{ color: theme.accentColor }}>
                          #{String(Date.now() + voucher.id).slice(-6)}
                        </div>
                        <div className="qr-area">
                          <div className="qr-box" style={{ borderColor: theme.accentColor }}>
                            <div className="qr-label" style={{ color: theme.accentColor }}>
                              {language === 'he' ? 'QR' : 'QR'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Apple-Style Subtle Effects */}
                    <div className="apple-shine-effect"></div>
                    
                  </div>
                  
                  {/* Apple-Style Purchase Button */}
                  <button 
                    onClick={() => handlePurchase(voucher)}
                    className={`apple-purchase-btn ${theme.buttonClass}`}
                  >
                    {language === 'he' ? 'רכישה מיידית' : 'Buy Now'}
                  </button>
                  
                </div>
              );
            })}
          </div>
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