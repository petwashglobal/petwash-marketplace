import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  X, Crown, Building2, Footprints, Heart, Car, Search, Wand2, Cog, Briefcase,
  Sparkles, MapPin, Shield, Zap, ArrowRight, Star, Globe
} from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLocation } from 'wouter';
import type { Language } from '@/lib/i18n';

// Ultra-luxury imagery
import happyPetOwners from '@assets/IMG_7114_1761393217647.jpeg';

interface LuxuryPlatformShowcaseProps {
  language: Language;
}

const STORAGE_KEY = 'petwash_platform_showcase_seen_v2';
const MODAL_COOLDOWN_DAYS = 30;

export function LuxuryPlatformShowcase({ language }: LuxuryPlatformShowcaseProps) {
  const [isOpen, setIsOpen] = useState(false);
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
          (window as any).gtag('event', 'platform_showcase_impression', {
            event_category: 'engagement',
            event_label: 'luxury_platform_modal_2026',
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

  const handlePlatformClick = (path: string, platform: string) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'platform_cta_click', {
        event_category: 'conversion',
        event_label: platform,
        language: language
      });
    }
    
    handleClose();
    setLocation(path);
  };

  const platforms = [
    {
      id: 'pet-wash-hub',
      name: 'Pet Wash Hub™',
      nameHe: 'Pet Wash Hub™',
      icon: Building2,
      gradient: 'from-blue-500 via-cyan-500 to-blue-600',
      description: 'Premium organic self-service wash stations',
      descriptionHe: 'תחנות שטיפה עצמית אורגניות פרימיום',
      features: ['24/7 IoT', 'Organic', 'Loyalty'],
      featuresHe: ['IoT 24/7', 'אורגני', 'נאמנות'],
      path: '/services',
      badge: null,
      shimmer: 'bg-gradient-to-r from-blue-200/0 via-white/80 to-blue-200/0',
    },
    {
      id: 'walk-my-pet',
      name: 'Walk My Pet™',
      nameHe: 'Walk My Pet™',
      icon: Footprints,
      gradient: 'from-green-500 via-emerald-500 to-teal-600',
      description: 'Premium dog walking with real-time GPS',
      descriptionHe: 'הליכת כלבים פרימיום עם GPS בזמן אמת',
      features: ['Live GPS', 'AI Safety', 'HD Cameras'],
      featuresHe: ['GPS חי', 'AI ביטחון', 'מצלמות HD'],
      path: '/walk-my-pet',
      badge: 'AI Powered',
      shimmer: 'bg-gradient-to-r from-green-200/0 via-white/80 to-green-200/0',
    },
    {
      id: 'sitter-suite',
      name: 'The Sitter Suite™',
      nameHe: 'The Sitter Suite™',
      icon: Heart,
      gradient: 'from-pink-500 via-rose-500 to-red-500',
      description: 'Pet sitting marketplace with AI matching',
      descriptionHe: 'שוק שמרטפות עם התאמה AI',
      features: ['AI Match', 'Split Pay', '24/7 Support'],
      featuresHe: ['התאמה AI', 'תשלום מפוצל', 'תמיכה 24/7'],
      path: '/the-sitter-suite',
      badge: 'AI Triage',
      shimmer: 'bg-gradient-to-r from-pink-200/0 via-white/80 to-pink-200/0',
    },
    {
      id: 'pettrek',
      name: 'PetTrek™',
      nameHe: 'PetTrek™',
      icon: Car,
      gradient: 'from-purple-500 via-indigo-500 to-violet-600',
      description: 'Uber-style pet transport with live tracking',
      descriptionHe: 'הובלת חיות מחמד בסגנון Uber עם מעקב חי',
      features: ['Live ETA', 'Dynamic Pricing', 'Safety'],
      featuresHe: ['ETA חי', 'תמחור דינמי', 'בטיחות'],
      path: '/pettrek',
      badge: 'Real-time',
      shimmer: 'bg-gradient-to-r from-purple-200/0 via-white/80 to-purple-200/0',
    },
    {
      id: 'paw-finder',
      name: 'Paw Finder™',
      nameHe: 'Paw Finder™',
      icon: Search,
      gradient: 'from-orange-500 via-amber-500 to-yellow-500',
      description: 'FREE lost & found pet recovery service',
      descriptionHe: 'שירות חינמי לאיתור חיות מחמד אבודות',
      features: ['100% Free', 'AI Detection', 'Community'],
      featuresHe: ['חינם 100%', 'זיהוי AI', 'קהילה'],
      path: '/paw-finder',
      badge: 'FREE',
      shimmer: 'bg-gradient-to-r from-amber-200/0 via-white/90 to-amber-200/0',
    },
    // DISABLED: PlushLab - Pet Avatar Creator (frozen for now, keep for future use)
    // {
    //   id: 'plush-lab',
    //   name: 'The Plush Lab™',
    //   nameHe: 'The Plush Lab™',
    //   icon: Wand2,
    //   gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    //   description: 'AI pet avatar creator - Free for everyone',
    //   descriptionHe: 'יוצר אווטארים AI - חינם לכולם',
    //   features: ['AI Art', 'No Sign-up', 'Instant'],
    //   featuresHe: ['אמנות AI', 'ללא הרשמה', 'מיידי'],
    //   path: '/plush-lab',
    //   badge: 'Free',
    //   shimmer: 'bg-gradient-to-r from-purple-200/0 via-white/80 to-purple-200/0',
    // },
    {
      id: 'k9000',
      name: 'K9000',
      nameHe: 'K9000',
      icon: Cog,
      gradient: 'from-slate-500 via-gray-600 to-zinc-700',
      description: 'IoT wash station hardware & cloud platform',
      descriptionHe: 'חומרת תחנות שטיפה IoT ופלטפורמת ענן',
      features: ['Cloud', 'Monitoring', 'API'],
      featuresHe: ['ענן', 'ניטור', 'API'],
      path: '/k9000',
      badge: 'B2B',
      shimmer: 'bg-gradient-to-r from-gray-200/0 via-white/60 to-gray-200/0',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      nameHe: 'Enterprise',
      icon: Briefcase,
      gradient: 'from-red-500 via-orange-500 to-amber-600',
      description: 'Franchise management & white-label solutions',
      descriptionHe: 'ניהול זכיינות ופתרונות white-label',
      features: ['Franchise', 'Multi-Currency', 'Analytics'],
      featuresHe: ['זכיינות', 'רב-מטבע', 'אנליטיקה'],
      path: '/enterprise',
      badge: 'Global',
      shimmer: 'bg-gradient-to-r from-orange-200/0 via-white/80 to-orange-200/0',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="max-w-[95vw] lg:max-w-7xl max-h-[95vh] overflow-y-auto p-0 gap-0 bg-transparent border-none shadow-[0_60px_180px_rgba(0,0,0,0.4)]"
        data-testid="luxury-platform-showcase-modal"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {isHebrew ? 'מערכת אקולוגית Pet Wash™ פרימיום 2026' : 'Premium Pet Wash™ Ecosystem 2026'}
          </DialogTitle>
          <DialogDescription>
            {isHebrew 
              ? 'גלו 8 פלטפורמות יוקרה עם אבטחה ברמה בנקאית וטכנולוגיית 2026'
              : 'Discover 8 luxury platforms with banking-level security and 2026 technology'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 overflow-hidden">
          
          {/* Animated Background Effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          </div>
          
          {/* Close Button */}
          <button
            onClick={handleClose}
            className={`fixed sm:absolute top-4 z-[9999] rounded-full bg-white/95 backdrop-blur-sm shadow-[0_12px_40px_rgba(0,0,0,0.3)] p-4 sm:p-3 md:p-4 hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 active:scale-90 border-2 border-gray-400 min-w-[56px] min-h-[56px] flex items-center justify-center group ${
              isHebrew ? 'left-4 sm:left-3 md:left-4' : 'right-4 sm:right-3 md:right-4'
            }`}
            aria-label={isHebrew ? 'סגור' : 'Close'}
            data-testid="button-close-platform-showcase"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="h-7 w-7 sm:h-6 sm:w-6 md:h-7 md:w-7 text-gray-800 group-hover:rotate-90 transition-transform duration-300" strokeWidth={3} />
          </button>
          
          {/* Compact Hero Section */}
          <div className="relative w-full h-32 sm:h-40 md:h-48 overflow-hidden pt-16 sm:pt-0">
            <img 
              src={happyPetOwners}
              alt="Happy Pet Owners"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-white" />
            
            {/* Floating Title */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-4">
                <div className="inline-flex items-center gap-2 mb-2">
                  <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" strokeWidth={1.5} />
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-light text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                    {isHebrew ? (
                      <>8 פלטפורמות <span className="font-normal">יוקרה</span></>
                    ) : (
                      <>8 <span className="font-normal">Luxury</span> Platforms</>
                    )}
                  </h1>
                  <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" strokeWidth={1.5} />
                </div>
                <p className="text-xs sm:text-sm md:text-base text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-light">
                  {isHebrew ? '★★★★★★★ 2026 - מותגים גלובליים' : '★★★★★★★ 2026 Global Brands'}
                </p>
              </div>
            </div>
          </div>

          {/* 8 Platforms Grid - Compact & Glamorous */}
          <div className="relative px-3 sm:px-6 md:px-8 lg:px-12 py-6 sm:py-8 md:py-10">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 max-w-7xl mx-auto">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                return (
                  <button
                    key={platform.id}
                    onClick={() => handlePlatformClick(platform.path, platform.id)}
                    className="group relative bg-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-all duration-500 hover:scale-105 active:scale-95 border border-gray-100"
                    data-testid={`platform-card-${platform.id}`}
                  >
                    {/* Gradient Header - Smaller */}
                    <div className={`relative h-20 sm:h-24 md:h-28 bg-gradient-to-br ${platform.gradient} overflow-hidden`}>
                      {/* Shimmer Effect */}
                      <div className={`absolute inset-0 ${platform.shimmer} animate-shimmer-slow`} 
                           style={{ 
                             animation: 'shimmer 3s infinite linear',
                             backgroundSize: '200% 100%' 
                           }} 
                      />
                      
                      {/* Icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.15)] group-hover:scale-110 transition-transform duration-500 border border-white/30">
                          <Icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white drop-shadow-lg" strokeWidth={1.5} />
                        </div>
                      </div>
                      
                      {/* Badge */}
                      {platform.badge && (
                        <div className={`absolute top-2 ${isHebrew ? 'left-2' : 'right-2'}`}>
                          <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold shadow-lg border border-white/30 ${
                            platform.badge === 'FREE' || platform.badge === 'Free'
                              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                              : 'bg-white/90 backdrop-blur-sm text-gray-800'
                          }`}>
                            {platform.badge}
                          </div>
                        </div>
                      )}
                      
                      {/* Glow Effect */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                    
                    {/* Content - Compact */}
                    <div className="p-3 sm:p-4 md:p-5 space-y-2 sm:space-y-3">
                      <h3 className="font-serif font-light text-base sm:text-lg md:text-xl text-gray-900 leading-tight">
                        {isHebrew ? platform.nameHe : platform.name}
                      </h3>
                      
                      <p className="text-xs sm:text-sm text-gray-600 leading-snug line-clamp-2 font-light">
                        {isHebrew ? platform.descriptionHe : platform.description}
                      </p>
                      
                      {/* Features - Minimal Pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {(isHebrew ? platform.featuresHe : platform.features).map((feature, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-0.5 bg-gradient-to-r from-gray-100 to-gray-50 text-[10px] sm:text-xs text-gray-700 rounded-full border border-gray-200 font-medium"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                      
                      {/* CTA Arrow */}
                      <div className="flex items-center justify-between pt-1 sm:pt-2">
                        <span className="text-xs sm:text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 group-hover:from-purple-600 group-hover:to-pink-600 transition-all duration-300">
                          {isHebrew ? 'גלה עוד' : 'Explore'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all duration-300" />
                      </div>
                    </div>
                    
                    {/* Hover Border Glow */}
                    <div className={`absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${platform.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none`} />
                  </button>
                );
              })}
            </div>
            
            {/* Bottom CTA - Ultra Luxurious */}
            <div className="mt-8 sm:mt-12 text-center max-w-4xl mx-auto">
              <div className="relative bg-gradient-to-br from-white via-blue-50/50 to-purple-50/50 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 md:p-10 shadow-[0_30px_90px_rgba(0,0,0,0.1)] border-2 border-white/60 backdrop-blur-xl overflow-hidden">
                {/* Animated Stars */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <Star className="absolute top-4 left-8 w-4 h-4 text-yellow-400/30 animate-pulse" />
                  <Star className="absolute top-8 right-12 w-3 h-3 text-blue-400/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <Star className="absolute bottom-6 left-16 w-5 h-5 text-purple-400/30 animate-pulse" style={{ animationDelay: '1s' }} />
                  <Sparkles className="absolute bottom-8 right-8 w-6 h-6 text-pink-400/30 animate-pulse" style={{ animationDelay: '1.5s' }} />
                </div>
                
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 mb-4">
                    <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-light">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                        {isHebrew ? 'הצטרף למהפכה הגלובלית' : 'Join the Global Revolution'}
                      </span>
                    </h3>
                    <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                  </div>
                  
                  <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 font-light leading-relaxed">
                    {isHebrew 
                      ? '8 מותגים • אבטחה ברמה בנקאית • טכנולוגיית 2026 • חוויה יוקרתית ללא פשרות'
                      : '8 Brands • Banking-Level Security • 2026 Technology • Uncompromised Luxury Experience'}
                  </p>
                  
                  <Button 
                    onClick={() => handlePlatformClick('/signup', 'global-cta')}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-[0_20px_60px_rgba(139,92,246,0.3)] hover:shadow-[0_30px_90px_rgba(139,92,246,0.4)] transition-all duration-500 hover:scale-105 active:scale-95 text-base sm:text-lg px-8 py-3 sm:py-4 rounded-full border-2 border-white/50"
                    data-testid="button-join-global"
                  >
                    <Crown className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                    {isHebrew ? 'התחל עכשיו בחינם' : 'Start Free Now'}
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 ml-2" />
                  </Button>
                  
                  <p className="mt-4 text-xs sm:text-sm text-gray-500 font-light">
                    {isHebrew ? '★★★★★★★ ללא כרטיס אשראי • גישה מיידית' : '★★★★★★★ No credit card • Instant access'}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .animate-shimmer-slow {
            animation: shimmer 3s infinite linear;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
