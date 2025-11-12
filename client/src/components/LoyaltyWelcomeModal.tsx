import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Sparkles, Crown, Award, Gift } from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLocation } from 'wouter';
import type { Language } from '@/lib/i18n';

// Ultra-luxury metallic card imagery (NEW 5-TIER SYSTEM)
import goldCard from '@assets/stock_images/luxury_gold_metal_cr_58537332.jpg';
import platinumCard from '@assets/stock_images/premium_platinum_met_11e9c72e.jpg';
import silverCard from '@assets/stock_images/premium_platinum_met_692b0367.jpg';
import newMemberCard from '@assets/stock_images/rose_gold_bronze_lux_8ecbc590.jpg'; // Repurpose for "New" tier

// Happy family of pet owners
import happyPetOwners from '@assets/IMG_7114_1761393217647.jpeg';

interface LoyaltyWelcomeModalProps {
  language: Language;
}

const STORAGE_KEY = 'petwash_loyalty_modal_seen_v1';
const MODAL_COOLDOWN_DAYS = 30;

export function LoyaltyWelcomeModal({ language }: LoyaltyWelcomeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState(2); // Default to Gold (index 2 in 5-tier array)
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  
  const isHebrew = language === 'he';

  useEffect(() => {
    const shouldShowModal = () => {
      if (user) return false;
      
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (!lastSeen) return true;
      
      const daysSinceLastSeen = (Date.now() - parseInt(lastSeen)) / (1000 * 60 * 60 * 24);
      return daysSinceLastSeen > MODAL_COOLDOWN_DAYS;
    };

    const timer = setTimeout(() => {
      if (shouldShowModal()) {
        setIsOpen(true);
        
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'loyalty_modal_impression', {
            event_category: 'engagement',
            event_label: 'loyalty_welcome_modal',
            language: language
          });
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [user, language]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  const handleJoinNow = () => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'loyalty_sign_up_click', {
        event_category: 'conversion',
        event_label: 'loyalty_modal_cta',
        language: language
      });
    }
    
    handleClose();
    setLocation('/signup?source=loyalty-modal');
  };

  const tiers = [
    {
      name: isHebrew ? 'חבר חדש' : 'New Member',
      titleEn: 'New Member',
      titleHe: 'חבר חדש',
      discount: '0%',
      hdCard: newMemberCard,
      gradient: 'linear-gradient(135deg, #64748b 0%, #94a3b8 25%, #cbd5e1 50%, #94a3b8 75%, #475569 100%)',
      borderGlow: 'shadow-[0_0_40px_rgba(100,116,139,0.4),0_0_80px_rgba(100,116,139,0.2)]',
      iconColor: 'text-slate-600',
      benefits: isHebrew ? ['צבירת נקודות רגילה', 'גישה לכל המבצעים', 'מעקב אחר תגמולים'] : ['Standard Points Earning', 'Access to All Promotions', 'Reward Tracking']
    },
    {
      name: isHebrew ? 'כסף' : 'Silver',
      titleEn: 'Silver Elite',
      titleHe: 'עילית כסף',
      discount: '10%',
      hdCard: silverCard,
      gradient: 'linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 25%, #F5F5F5 50%, #D3D3D3 75%, #A9A9A9 100%)',
      borderGlow: 'shadow-[0_0_40px_rgba(192,192,192,0.5),0_0_80px_rgba(192,192,192,0.3)]',
      iconColor: 'text-gray-500',
      benefits: isHebrew ? ['הנחה מיידית 10%', 'גישה מוקדמת למבצעים', 'מתנת יום הולדת VIP'] : ['Instant 10% Discount', 'Early Sale Access', 'VIP Birthday Gift']
    },
    {
      name: isHebrew ? 'זהב' : 'Gold',
      titleEn: 'Gold Prestige',
      titleHe: 'יוקרה זהב',
      discount: '15%',
      hdCard: goldCard,
      gradient: 'linear-gradient(135deg, #FFD700 0%, #FFC000 20%, #FFEA00 40%, #FFD700 60%, #DAA520 80%, #B8860B 100%)',
      borderGlow: 'shadow-[0_0_50px_rgba(255,215,0,0.6),0_0_100px_rgba(255,215,0,0.4),0_0_150px_rgba(255,215,0,0.2)]',
      iconColor: 'text-yellow-500',
      benefits: isHebrew ? ['הנחה מיוחדת 15%', 'קונסיירז׳ אישי', 'עדיפות בתורים'] : ['Premium 15% Discount', 'Personal Concierge', 'Priority Queue']
    },
    {
      name: isHebrew ? 'פלטינום' : 'Platinum',
      titleEn: 'Platinum Reserve',
      titleHe: 'רזרבה פלטינום',
      discount: '20%',
      hdCard: platinumCard,
      gradient: 'linear-gradient(135deg, #E5E4E2 0%, #FFFFFF 20%, #B4C5E4 40%, #9CC4E4 60%, #7C98B3 80%, #536878 100%)',
      borderGlow: 'shadow-[0_0_60px_rgba(229,228,226,0.7),0_0_120px_rgba(156,196,228,0.5),0_0_180px_rgba(124,152,179,0.3)]',
      iconColor: 'text-indigo-400',
      benefits: isHebrew ? ['הנחה פרימיום 20%', 'שירותי קונסיירז׳ 24/7', 'אירועים פרטיים בלבד'] : ['Premium 20% Discount', '24/7 Concierge Services', 'Exclusive Private Events']
    },
    {
      name: isHebrew ? 'יהלום' : 'Diamond',
      titleEn: 'Diamond Elite',
      titleHe: 'עילית יהלום',
      discount: '25%',
      hdCard: platinumCard, // Use same platinum card image for now
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 25%, #93c5fd 50%, #60a5fa 75%, #2563eb 100%)',
      borderGlow: 'shadow-[0_0_70px_rgba(59,130,246,0.8),0_0_140px_rgba(96,165,250,0.6),0_0_210px_rgba(37,99,235,0.4)]',
      iconColor: 'text-blue-500',
      benefits: isHebrew ? ['הנחה אולטימטיבית 25%', 'מנהל חשבון ייעודי', 'גישה בלעדית ראשונה'] : ['Ultimate 25% Discount', 'Dedicated Account Manager', 'First-Access Exclusives']
    }
  ];

  const currentTier = tiers[selectedTier];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-[92vw] sm:max-w-3xl md:max-w-5xl lg:max-w-7xl max-h-[90vh] bg-white p-0 gap-0 overflow-y-auto border-0 shadow-[0_25px_80px_rgba(0,0,0,0.25)] rounded-2xl sm:rounded-3xl"
        dir={isHebrew ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{isHebrew ? 'תוכנית נאמנות VIP' : 'VIP Loyalty Program'}</DialogTitle>
          <DialogDescription>
            {isHebrew 
              ? 'הצטרפו לתוכנית הנאמנות הבלעדית שלנו עם חמש רמות יוקרה והנחות עד 25%' 
              : 'Join our exclusive loyalty program with five luxury tiers and discounts up to 25%'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Full-bleed Immersive Layout */}
        <div className="relative bg-gradient-to-br from-white via-gray-50 to-white">
          
          {/* MOBILE-OPTIMIZED Close Button - EXTRA LARGE tap target */}
          <button
            onClick={handleClose}
            className={`fixed sm:absolute top-4 z-[9999] rounded-full bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.3)] p-4 sm:p-3 md:p-4 hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 active:scale-90 border-2 border-gray-400 min-w-[56px] min-h-[56px] flex items-center justify-center ${
              isHebrew ? 'left-4 sm:left-3 md:left-4' : 'right-4 sm:right-3 md:right-4'
            }`}
            aria-label={isHebrew ? 'סגור' : 'Close'}
            data-testid="button-close-loyalty-modal"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="h-7 w-7 sm:h-6 sm:w-6 md:h-7 md:w-7 text-gray-800" strokeWidth={3} />
          </button>
          
          {/* Hero Image - Mobile-optimized heights with safe spacing for close button */}
          <div className="relative w-full h-56 sm:h-64 md:h-80 lg:h-96 overflow-hidden pt-16 sm:pt-0">
            <img 
              src={happyPetOwners}
              alt="Happy Pet Owners"
              className="w-full h-full object-cover"
            />
            {/* Elegant gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-white" />
          </div>
          
          {/* Hero Section - Mobile-first responsive padding with safe zone for close button */}
          <div className="relative px-4 sm:px-8 md:px-12 lg:px-16 -mt-12 sm:-mt-24 md:-mt-32 pb-6 sm:pb-12 md:pb-16 text-center">
            {/* Luxury Crown Icon - Mobile-optimized size */}
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 shadow-[0_20px_60px_rgba(79,70,229,0.4)] mb-4 sm:mb-6 md:mb-8 animate-in fade-in duration-700 ring-2 sm:ring-4 ring-white">
              <Crown className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white" strokeWidth={1.5} />
            </div>

            {/* Headline - Mobile-first responsive text sizing */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-serif font-light leading-[1.15] mb-2 sm:mb-4 md:mb-6 tracking-tight">
              {isHebrew ? (
                <>
                  <span className="font-normal text-gray-900 drop-shadow-[0_2px_8px_rgba(255,255,255,0.9)]">יוקרה</span>
                  <br />
                  <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent font-medium drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]">ללא פשרות</span>
                </>
              ) : (
                <>
                  <span className="font-normal text-gray-900 drop-shadow-[0_2px_8px_rgba(255,255,255,0.9)]">Uncompromising</span>
                  <br />
                  <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent font-medium drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]">Luxury</span>
                </>
              )}
            </h1>
            
            {/* Subtitle - Mobile-responsive text sizing */}
            <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-gray-800 drop-shadow-[0_2px_10px_rgba(255,255,255,0.9)] font-light max-w-3xl mx-auto leading-relaxed tracking-wide">
              {isHebrew 
                ? 'תוכנית נאמנות בלעדית. מעוצבת במיוחד עבור בעלי חיות המחפשים את המיטב.' 
                : 'An exclusive loyalty programme. Crafted for pet owners who demand the finest.'}
            </p>
          </div>

          {/* Tier Showcase - Mobile-first responsive padding */}
          <div className="px-4 sm:px-8 md:px-12 lg:px-16 pb-6 sm:pb-12 md:pb-16">
            {/* Featured Card - Large 3D metallic card */}
            <div className="max-w-4xl mx-auto mb-8 sm:mb-12">
              <div 
                className="relative rounded-3xl overflow-hidden transition-all duration-700 hover:scale-[1.02]"
                style={{ 
                  background: currentTier.gradient,
                  boxShadow: '0 30px 90px rgba(0,0,0,0.15), 0 10px 30px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)'
                }}
              >
                {/* Glass overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/10 pointer-events-none" />
                
                {/* Card Content - Mobile-first responsive padding */}
                <div className="relative p-6 sm:p-8 md:p-12 lg:p-16">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4 sm:gap-0 mb-6 sm:mb-8">
                    <div>
                      <p className="text-gray-800/90 text-xs sm:text-sm font-medium tracking-[0.2em] sm:tracking-[0.3em] uppercase mb-2 drop-shadow-sm">
                        {isHebrew ? 'רמת יוקרה' : 'Prestige Tier'}
                      </p>
                      <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-serif font-light text-gray-900 drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]">
                        {isHebrew ? currentTier.titleHe : currentTier.titleEn}
                      </h2>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-serif font-light text-gray-900 drop-shadow-[0_2px_8px_rgba(255,255,255,0.9)]">
                        {currentTier.discount}
                      </p>
                      <p className="text-gray-800 text-sm sm:text-base md:text-lg font-medium tracking-wider drop-shadow-sm">
                        {isHebrew ? 'הנחה קבועה' : 'Permanent Discount'}
                      </p>
                    </div>
                  </div>

                  {/* Benefits - Mobile-responsive */}
                  <div className="space-y-3 sm:space-y-4">
                    {currentTier.benefits.map((benefit, i) => (
                      <div key={i} className="flex items-center gap-3 sm:gap-4 text-gray-900">
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-gray-800" strokeWidth={1.5} />
                        <span className="text-sm sm:text-base md:text-lg font-normal tracking-wide drop-shadow-sm">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Anisotropic specular highlight */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" style={{ transform: 'skewY(-2deg)' }} />
              </div>
            </div>

            {/* Tier Selector - Mobile-responsive carousel with horizontal scroll on tiny screens */}
            <div className="flex justify-center gap-2 sm:gap-4 md:gap-6 overflow-x-auto pb-2 px-2">
              {tiers.map((tier, index) => (
                <button
                  key={tier.name}
                  onClick={() => setSelectedTier(index)}
                  className={`group relative transition-all duration-500 ${
                    selectedTier === index 
                      ? 'scale-110' 
                      : 'scale-90 opacity-60 hover:opacity-100 hover:scale-95'
                  }`}
                  data-testid={`tier-selector-${tier.name.toLowerCase()}`}
                >
                  {/* Floating glass panel - Mobile-optimized size with flexible shrinking */}
                  <div 
                    className={`relative w-14 h-20 sm:w-20 sm:h-28 md:w-24 md:h-32 rounded-lg sm:rounded-2xl overflow-hidden transition-all duration-500 flex-shrink-0 ${
                      selectedTier === index ? tier.borderGlow : 'shadow-xl'
                    }`}
                    style={{ 
                      background: tier.gradient,
                    }}
                  >
                    {/* Glass morphism overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-black/20" />
                    
                    {/* Tier icon - Mobile-optimized size */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {index === 0 && <Award className="w-5 h-5 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white drop-shadow-lg" strokeWidth={1.5} />}
                      {index === 1 && <Award className="w-5 h-5 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white drop-shadow-lg" strokeWidth={1.5} />}
                      {index === 2 && <Crown className="w-5 h-5 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white drop-shadow-lg" strokeWidth={1.5} />}
                      {index === 3 && <Crown className="w-5 h-5 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white drop-shadow-lg" strokeWidth={1.5} />}
                      {index === 4 && <Crown className="w-5 h-5 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white drop-shadow-lg" strokeWidth={1.5} />}
                    </div>

                    {/* Specular highlight */}
                    <div className="absolute top-0 left-0 w-full h-10 sm:h-12 md:h-16 bg-gradient-to-b from-white/50 to-transparent" />
                  </div>

                  {/* Tier name - Mobile-responsive text */}
                  <p className={`text-center mt-1 sm:mt-3 text-[10px] sm:text-sm font-light tracking-wide sm:tracking-wider transition-all duration-300 whitespace-nowrap ${
                    selectedTier === index ? 'text-gray-900 font-normal' : 'text-gray-500'
                  }`}>
                    {tier.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Premium Benefits Grid - Mobile-first responsive */}
          <div className="px-4 sm:px-8 md:px-12 lg:px-16 pb-6 sm:pb-12 md:pb-16">
            <div className="max-w-5xl mx-auto bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 lg:p-12 shadow-[0_20px_70px_rgba(0,0,0,0.08)] border border-white/60">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-light text-gray-900 mb-6 sm:mb-8 md:mb-10 text-center tracking-tight">
                {isHebrew ? 'חוויית VIP מלאה' : 'Complete VIP Experience'}
              </h3>
              
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
                {[
                  { icon: <Gift className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />, text: isHebrew ? 'מתנות יום הולדת בלעדיות' : 'Exclusive Birthday Gifts' },
                  { icon: <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />, text: isHebrew ? 'גישה מוקדמת למוצרים חדשים' : 'First Access to New Services' },
                  { icon: <Crown className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />, text: isHebrew ? 'כרטיס דיגיטלי ל-Apple & Google Wallet' : 'Apple & Google Wallet Card' },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center text-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg">
                      {item.icon}
                    </div>
                    <p className="text-sm sm:text-base text-gray-700 font-light leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dual CTA Section - Mobile-responsive */}
          <div className="px-4 sm:px-8 md:px-12 lg:px-16 pb-8 sm:pb-16 md:pb-20">
            <div className="max-w-4xl mx-auto">
              {/* Primary CTA - Join Loyalty */}
              <div className="text-center mb-6 sm:mb-8">
                <Button
                  onClick={handleJoinNow}
                  size="lg"
                  className="px-8 sm:px-12 md:px-16 py-4 sm:py-6 md:py-8 text-base sm:text-lg md:text-xl font-light tracking-wider bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white shadow-[0_20px_60px_rgba(79,70,229,0.35)] hover:shadow-[0_25px_70px_rgba(79,70,229,0.45)] transition-all duration-500 hover:scale-105 rounded-full"
                  data-testid="button-join-loyalty"
                >
                  {isHebrew ? 'קבלו את ההזמנה שלכם' : 'Accept Your Invitation'}
                </Button>

                <p className="text-xs sm:text-sm text-gray-500 font-light mt-4 sm:mt-6 tracking-wide px-4">
                  {isHebrew 
                    ? 'הצטרפות ללא עלות • התחייבות אפס • ביטול בכל עת' 
                    : 'Complimentary Membership • Zero Commitment • Cancel Anytime'}
                </p>
              </div>

              {/* Divider with "OR" */}
              <div className="relative flex items-center justify-center my-6 sm:my-8 md:my-10">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative bg-white px-4 sm:px-6">
                  <span className="text-xs sm:text-sm font-light text-gray-500 tracking-[0.2em] uppercase">
                    {isHebrew ? 'או' : 'Or'}
                  </span>
                </div>
              </div>

              {/* Secondary CTA - E-Gift Express Checkout */}
              <div className="text-center">
                <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-[0_15px_50px_rgba(217,119,6,0.15)] border border-amber-200/50">
                  <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" strokeWidth={1.5} />
                    <h4 className="text-lg sm:text-xl md:text-2xl font-serif font-light text-gray-900">
                      {isHebrew ? 'כרטיס מתנה אלקטרוני' : 'E-Gift Card'}
                    </h4>
                    <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" strokeWidth={1.5} />
                  </div>
                  
                  <p className="text-sm sm:text-base text-gray-700 font-light mb-4 sm:mb-6 leading-relaxed max-w-2xl mx-auto">
                    {isHebrew 
                      ? 'רכשו כרטיס מתנה דיגיטלי ושלחו אותו באופן מיידי לאהוביכם. משלוח מיידי למייל או WhatsApp.'
                      : 'Purchase a digital gift card and send it instantly to your loved ones. Immediate delivery via email or WhatsApp.'}
                  </p>

                  <Button
                    onClick={() => {
                      handleClose();
                      setLocation('/claim-voucher');
                    }}
                    size="lg"
                    className="px-8 sm:px-10 md:px-12 py-3 sm:py-4 md:py-5 text-sm sm:text-base md:text-lg font-light tracking-wider bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:via-yellow-600 hover:to-amber-700 text-white shadow-[0_15px_45px_rgba(217,119,6,0.3)] hover:shadow-[0_20px_55px_rgba(217,119,6,0.4)] transition-all duration-500 hover:scale-105 rounded-full"
                    data-testid="button-express-egift"
                  >
                    {isHebrew ? '⚡ קנייה מהירה - כרטיס מתנה' : '⚡ Express Checkout - Gift Card'}
                  </Button>

                  <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4 sm:mt-5 text-xs sm:text-sm text-gray-600 font-light">
                    <span>{isHebrew ? '🎁 משלוח מיידי' : '🎁 Instant Delivery'}</span>
                    <span className="text-gray-400">•</span>
                    <span>{isHebrew ? '💳 תשלום מאובטח' : '💳 Secure Payment'}</span>
                    <span className="text-gray-400">•</span>
                    <span>{isHebrew ? '📱 דיגיטלי 100%' : '📱 100% Digital'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
