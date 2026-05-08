import { useState, useEffect } from 'react';
import { X, Crown, Sparkles, Dog, MapPin, Heart, Car, Search, Monitor, Building2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { isImmersiveRoute } from '@/lib/immersive-routes';

interface Platform {
  id: string;
  name: string;
  description: string;
  icon: typeof Crown;
  gradient: string;
  tags: string[];
  badge?: string;
  badgeColor?: string;
}

const platforms: Platform[] = [
  {
    id: 'wash',
    name: 'Pet ⁦Wash Hub™⁩',
    description: 'Premium organic self-service wash stations',
    icon: Dog,
    gradient: 'from-purple-500 to-purple-600',
    tags: ['24/7 IoT', 'Organic', 'Loyalty'],
  },
  {
    id: 'walk',
    name: '⁦Walk My Pet™⁩',
    description: 'Premium dog walking with real-time GPS',
    icon: MapPin,
    gradient: 'from-emerald-400 to-teal-500',
    tags: ['Live GPS', 'AI Safety', 'HD Cameras'],
    badge: 'AI Powered',
    badgeColor: 'bg-emerald-500',
  },
  {
    id: 'sitter',
    name: '⁦The Sitter Suite™⁩',
    description: 'Pet sitting marketplace with AI matching',
    icon: Heart,
    gradient: 'from-pink-400 to-rose-500',
    tags: ['AI Match', 'Split Pay', '24/7 Support'],
    badge: 'AI Triage',
    badgeColor: 'bg-pink-500',
  },
  {
    id: 'trek',
    name: '⁦PetTrek™⁩',
    description: 'On-demand pet transport with live tracking',
    icon: Car,
    gradient: 'from-amber-400 to-orange-500',
    tags: ['Live ETA', 'Dynamic Pricing', 'Safety'],
    badge: 'Real-time',
    badgeColor: 'bg-amber-500',
  },
  {
    id: 'finder',
    name: '⁦Paw Finder™⁩',
    description: 'FREE lost & found pet recovery service',
    icon: Search,
    gradient: 'from-blue-400 to-indigo-500',
    tags: ['100% Free', 'AI Detection', 'Community'],
    badge: 'FREE',
    badgeColor: 'bg-green-500',
  },
  {
    id: 'k9000',
    name: 'K9000',
    description: 'IoT wash station hardware & cloud platform',
    icon: Monitor,
    gradient: 'from-slate-500 to-gray-600',
    tags: ['Cloud', 'Monitoring', 'API'],
    badge: 'B2B',
    badgeColor: 'bg-slate-600',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Franchise management & white-label solutions',
    icon: Building2,
    gradient: 'from-yellow-400 via-amber-500 to-orange-500',
    tags: ['Franchise', 'Multi-Currency', 'Analytics'],
    badge: 'Global',
    badgeColor: 'bg-gradient-to-r from-yellow-500 to-amber-500',
  },
];

interface VIPLoyaltyPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VIPLoyaltyPopup({ isOpen, onClose }: VIPLoyaltyPopupProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // PR-VIP-LOYALTY-MOBILE-GUARD (latent risk flagged by deep scroll-lock
    // audit, post-#194):
    //   This popup is `fixed inset-0 z-[9999] bg-white overflow-y-auto`
    //   (line 121) — a full-screen opaque overlay with its own scroller.
    //   Locking body scroll is only useful on NORMAL pages (where the
    //   page behind would otherwise scroll under the modal). On
    //   immersive routes (auth, signup, KYC, onboarding, loyalty join,
    //   provider lifecycle) locking body produces the same iPhone Safari
    //   freeze pattern that PR #194 hot-fixed in the immersive CSS:
    //   if anything else (or this popup itself) mounts on /sign-in and
    //   the user dismisses it without the cleanup running, body remains
    //   permanently locked.
    //
    //   Smallest safe fix: defer to the canonical isImmersiveRoute()
    //   helper. On immersive routes, NEVER touch body scroll. On other
    //   routes, preserve the original modal-lock behaviour exactly.
    if (isImmersiveRoute(window.location.pathname)) {
      // On immersive routes the popup is a full-screen overlay anyway;
      // the underlying form / page must remain scrollable in case the
      // popup ever closes (or the user dismisses it). Defensive cleanup
      // ensures any prior body lock left by another mount is cleared.
      document.body.style.overflow = '';
      return;
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleJoin = () => {
    if (email) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-white overflow-y-auto"
          data-testid="vip-loyalty-popup"
        >
          <div className="min-h-screen w-full bg-white">
            <button
              onClick={onClose}
              className="fixed top-4 right-4 z-[10000] w-12 h-12 bg-black/5 hover:bg-black/10 rounded-full flex items-center justify-center transition-colors"
              data-testid="button-close-vip-popup"
            >
              <X className="w-6 h-6 text-black" />
            </button>

            <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center mb-8 md:mb-12"
              >
                <div className="inline-flex items-center gap-2 mb-4">
                  <Crown className="w-8 h-8 md:w-10 md:h-10 text-amber-500" />
                  <span className="text-xs md:text-sm font-medium text-amber-600 uppercase tracking-wider">
                    Exclusive Membership
                  </span>
                  <Crown className="w-8 h-8 md:w-10 md:h-10 text-amber-500" />
                </div>
                
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
                  Join Our Exclusive VIP
                  <br />
                  <span className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
                    Loyalty Program
                  </span>
                </h1>
                
                <p className="text-lg md:text-xl text-gray-600 mb-2">
                  For <span className="font-bold text-black">FREE</span>
                </p>
                
                <div className="flex items-center justify-center gap-1 text-amber-500">
                  {[...Array(7)].map((_, i) => (
                    <Sparkles key={i} className="w-4 h-4" />
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center mb-8"
              >
                <h2 className="text-xl md:text-2xl font-semibold text-black mb-2">
                  7 Luxury Platforms
                </h2>
                <p className="text-gray-500">2026 Global Brands</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10"
              >
                {platforms.map((platform, index) => (
                  <motion.div
                    key={platform.id}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 * index + 0.3 }}
                    className="relative bg-white rounded-2xl border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
                    data-testid={`platform-card-${platform.id}`}
                  >
                    <div className="absolute top-3 left-3 z-10">
                      <span className="px-2 py-1 text-[10px] font-semibold text-white bg-black/80 rounded-full uppercase tracking-wider">
                        Coming Soon
                      </span>
                    </div>

                    {platform.badge && (
                      <div className="absolute top-3 right-3 z-10">
                        <span className={`px-2 py-1 text-[10px] font-semibold text-white ${platform.badgeColor} rounded-full`}>
                          {platform.badge}
                        </span>
                      </div>
                    )}

                    <div className="p-6 pt-10">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                        <platform.icon className="w-7 h-7 text-white" />
                      </div>

                      <h3 className="text-lg font-bold text-black mb-2">
                        {platform.name}
                      </h3>
                      
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                        {platform.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {platform.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-[10px] font-medium text-gray-600 bg-white rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <button
                        className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors group/btn"
                        data-testid={`button-explore-${platform.id}`}
                      >
                        Explore
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 rounded-2xl p-6 md:p-8 text-center text-white"
              >
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-medium uppercase tracking-wider">
                    Join the Global Revolution
                  </span>
                  <Sparkles className="w-5 h-5" />
                </div>

                <p className="text-sm md:text-base text-white/80 mb-6">
                  7 Brands • Banking-Level Security • 2026 Technology • Uncompromised Luxury Experience
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto mb-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full sm:flex-1 px-4 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                    data-testid="input-vip-email"
                  />
                  <button
                    onClick={handleJoin}
                    className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-full flex items-center justify-center gap-2 transition-colors"
                    data-testid="button-start-free"
                  >
                    <Crown className="w-4 h-4" />
                    Start Free Now
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-center gap-1 text-white/60 text-sm">
                  {[...Array(7)].map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                  <span className="ml-2">No credit card • Instant access</span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default VIPLoyaltyPopup;