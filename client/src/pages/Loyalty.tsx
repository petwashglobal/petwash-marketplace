import { useEffect, useState } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { 
  ProgressCircle,
  SparklineChart,
  DashboardWidget,
  StatusBadge,
  GlassCard
} from '@/components/LuxuryWidgets';
import { 
  calculateTier, 
  getTierProgress, 
  getTierConfig, 
  getTierDisplay,
  calculatePointsValue,
  type LoyaltyTier 
} from '@/lib/loyalty';
import { formatILS } from '@/lib/currency';
import { Crown, Gift, Star, Sparkles, TrendingUp, Zap, Award, Heart, Diamond, Shield, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { useAnalytics } from '@/hooks/useAnalytics';
import { logger } from "@/lib/logger";
import { useLocation } from "wouter";

export default function Loyalty() {
  const { user: firebaseUser, loading: authLoading } = useFirebaseAuth();
  const { trackEvent } = useAnalytics();
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<Language>((localStorage.getItem('petwash_lang') as Language) || 'he');
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'benefits' | 'progress'>('overview');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!firebaseUser?.uid) {
        setLoading(false);
        return;
      }

      try {
        const profileRef = doc(db, 'users', firebaseUser.uid, 'profile', 'data');
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setProfileData(data);
          
          const washes = data?.washes || 0;
          const tier = calculateTier(washes);
          trackEvent({
            action: 'vip_tier_view',
            category: 'loyalty_vip',
            label: tier,
            value: washes,
            language,
            userId: firebaseUser.uid,
          });
        }
      } catch (error) {
        logger.error('Error fetching profile', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [firebaseUser]);

  if (authLoading || loading) {
    return (
      <Layout language={language} onLanguageChange={setLanguage}>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative">
              <div className="w-20 h-20 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-6"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-purple-400 animate-pulse" />
            </div>
            <p className="text-lg text-purple-200 font-light tracking-wide">{t('loyalty.loading', language)}</p>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const washes = profileData?.washes || 0;
  const firstName = profileData?.firstName || firebaseUser?.displayName?.split(' ')[0] || 'Guest';
  const tierProgress = getTierProgress(washes);
  const currentTierConfig = getTierConfig(tierProgress.currentTier);
  const totalSaved = calculatePointsValue(washes);
  const memberSince = profileData?.createdAt ? new Date(profileData.createdAt.toDate()).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' }) : '';

  // Luxury tier colors with metallic gradients
  const getLuxuryGradient = (tier: LoyaltyTier) => {
    const gradients = {
      new: 'from-slate-600 via-slate-500 to-slate-600',
      silver: 'from-gray-400 via-gray-200 to-gray-400',
      gold: 'from-yellow-600 via-yellow-400 to-yellow-600',
      platinum: 'from-purple-600 via-indigo-400 to-purple-600',
    };
    return gradients[tier] || gradients.new;
  };

  const getTierIcon = (tier: LoyaltyTier) => {
    const icons = {
      new: <Star className="w-12 h-12" />,
      silver: <Award className="w-12 h-12" />,
      gold: <Crown className="w-12 h-12" />,
      platinum: <Diamond className="w-12 h-12" />,
    };
    return icons[tier] || icons.new;
  };

  // Map old perk keys to new i18n keys
  const getPerkTranslation = (perkKey: string): string => {
    const perkMap: Record<string, string> = {
      'perk_welcome_bonus': 'loyalty.perk.welcomeBonus',
      'perk_pet_profile': 'loyalty.perk.petProfile',
      'perk_email_notifications': 'loyalty.perk.emailNotifications',
      'perk_10_discount': 'loyalty.perk.discount10',
      'perk_priority_booking': 'loyalty.perk.priorityBooking',
      'perk_birthday_bonus': 'loyalty.perk.birthdayBonus',
      'perk_sms_notifications': 'loyalty.perk.smsNotifications',
      'perk_15_discount': 'loyalty.perk.discount15',
      'perk_priority_247': 'loyalty.perk.priority247',
      'perk_early_access_products': 'loyalty.perk.earlyAccessProducts',
      'perk_premium_shampoo': 'loyalty.perk.premiumShampoo',
      'perk_20_discount': 'loyalty.perk.discount20',
      'perk_vip_priority': 'loyalty.perk.vipPriority',
      'perk_early_access_events': 'loyalty.perk.earlyAccessEvents',
      'perk_exclusive_vip': 'loyalty.perk.exclusiveVip',
      'perk_account_manager': 'loyalty.perk.accountManager',
    };
    const i18nKey = perkMap[perkKey];
    return i18nKey ? t(i18nKey, language) : perkKey;
  };

  return (
    <Layout language={language} onLanguageChange={setLanguage}>
      {/* Ultra-Luxury Background with Mesh Gradient */}
      <div className="min-h-screen luxury-bg-mesh">
        <div className="luxury-container luxury-section">
          {/* VIP Header with Luxury Typography */}
          <motion.div 
            className="text-center mb-16 luxury-animate-fade-in"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="inline-flex items-center luxury-gap-md mb-6">
              <div className="p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 luxury-shadow-md">
                <Shield className="w-10 h-10 text-purple-600" />
              </div>
              <h1 className="luxury-heading-xl">
                {t('loyalty.title', language)}
              </h1>
              <div className="p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 luxury-shadow-md">
                <Shield className="w-10 h-10 text-purple-600" />
              </div>
            </div>
            <p className="luxury-text-body text-gray-600">{t('loyalty.subtitle', language)}</p>
          </motion.div>

          {/* Personalized Welcome */}
          <motion.div 
            className="text-center mb-16 luxury-animate-fade-in luxury-delay-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <h2 className="luxury-heading-lg mb-3">
              {t('loyalty.welcome', language)} <span className="luxury-text-gradient">{firstName}</span>
            </h2>
            {memberSince && (
              <p className="luxury-text-small uppercase tracking-wider text-gray-500">{t('loyalty.memberSince', language)} {memberSince}</p>
            )}
          </motion.div>

          {/* Luxury VIP Member Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.7, type: "spring" }}
            className="mb-16 luxury-animate-scale-in luxury-delay-2"
          >
            <div className="relative max-w-3xl mx-auto">
              {/* Premium Card with Glassmorphism */}
              <div className={`luxury-glass-card luxury-hover-glow p-1 bg-gradient-to-br ${getLuxuryGradient(tierProgress.currentTier)} luxury-shadow-xl`}>
                <div className="rounded-3xl bg-gradient-to-br from-white/95 to-white/90 backdrop-blur-xl p-10 md:p-12">
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-10 luxury-gap-lg">
                    <div className="flex items-center luxury-gap-md">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                        className={`p-4 rounded-2xl bg-gradient-to-br ${getLuxuryGradient(tierProgress.currentTier)} luxury-shadow-md`}
                      >
                        <div className="text-white">
                          {getTierIcon(tierProgress.currentTier)}
                        </div>
                      </motion.div>
                      <div>
                        <div className={`luxury-badge ${tierProgress.currentTier === 'gold' ? 'luxury-badge-gold' : tierProgress.currentTier === 'platinum' ? '' : tierProgress.currentTier === 'silver' ? '' : ''} mb-2`}>
                          <h3 className="luxury-heading-md" data-testid="tier-name">
                            {getTierDisplay(tierProgress.currentTier, language).toUpperCase()}
                          </h3>
                        </div>
                        <p className="luxury-text-small uppercase tracking-wider text-gray-500">{t('loyalty.vipCard', language)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="luxury-text-small uppercase tracking-wider text-gray-400 mb-2">Pet Wash™</div>
                      <Sparkles className="w-10 h-10 text-purple-400 ml-auto" />
                    </div>
                  </div>

                  {/* LUXURY STATS with Progress Circle */}
                  <div className="flex items-center justify-between luxury-gap-xl mb-10">
                    {/* LEFT: Circular Progress */}
                    <div className="flex-shrink-0">
                      <ProgressCircle 
                        progress={tierProgress.progressPercentage || 0}
                        size={160}
                        strokeWidth={16}
                        color={tierProgress.currentTier === 'platinum' ? '#A855F7' : tierProgress.currentTier === 'gold' ? '#EAB308' : tierProgress.currentTier === 'silver' ? '#9CA3AF' : '#6B7280'}
                      >
                        <div className="text-center">
                          <div className="luxury-heading-lg luxury-text-gradient" data-testid="tier-stats">{washes}</div>
                          <div className="luxury-text-small text-gray-500 uppercase mt-2">{t('loyalty.washes', language)}</div>
                        </div>
                      </ProgressCircle>
                    </div>

                    {/* RIGHT: Stats Grid */}
                    <div className="flex-1 luxury-grid-2">
                      <div className="luxury-glass-minimal luxury-shadow-sm p-5 rounded-2xl">
                        <div className="luxury-text-small uppercase tracking-wider text-gray-500 mb-3">{t('loyalty.discount', language)}</div>
                        <div className="luxury-heading-lg luxury-text-gradient">{currentTierConfig.discount}%</div>
                      </div>
                      <div className="luxury-glass-minimal luxury-shadow-sm p-5 rounded-2xl">
                        <div className="luxury-text-small uppercase tracking-wider text-gray-500 mb-3">{t('loyalty.totalSaved', language)}</div>
                        <div className="luxury-heading-md text-green-600" data-testid="total-saved-amount">{formatILS(totalSaved, language)}</div>
                      </div>
                      {/* Wash Activity Sparkline */}
                      <div className="col-span-2 luxury-glass-minimal luxury-shadow-sm p-5 rounded-2xl">
                        <div className="luxury-text-small uppercase tracking-wider text-gray-500 mb-4">
                          {t('loyalty.recentActivity', language)}
                        </div>
                        <SparklineChart 
                          data={[washes * 0.3, washes * 0.5, washes * 0.7, washes * 0.85, washes]}
                          color="#A855F7"
                          height={50}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Premium Divider */}
                  <div className="luxury-divider my-8"></div>

                  {/* Progress to Next Tier */}
                  {tierProgress.nextTier && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8, duration: 0.5 }}
                    >
                      <div className="flex justify-between luxury-text-body text-gray-600 mb-3">
                        <span>{tierProgress.washesUntilNext} {t('loyalty.washesUntil', language)} <span className="luxury-text-gradient font-semibold">{getTierDisplay(tierProgress.nextTier, language)}</span></span>
                        <span className="font-semibold">{tierProgress.currentWashes} / {tierProgress.nextTierAt}</span>
                      </div>
                      <div className="relative h-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full overflow-hidden luxury-shadow-sm">
                        <motion.div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full luxury-shadow-md"
                          initial={{ width: 0 }}
                          animate={{ width: `${tierProgress.progressPercentage}%` }}
                          transition={{ delay: 1, duration: 1.2, ease: "easeOut" }}
                          data-testid="tier-progress-bar"
                        />
                      </div>
                    </motion.div>
                  )}

                  {tierProgress.currentTier === 'platinum' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8, duration: 0.5 }}
                      className="mt-6 luxury-badge luxury-badge-success flex items-center justify-center luxury-gap-sm py-4"
                    >
                      <Sparkles className="h-5 w-5 animate-pulse" />
                      <span className="font-bold tracking-wide">
                        {t('loyalty.eliteStatus', language)}
                      </span>
                      <Sparkles className="h-5 w-5 animate-pulse" />
                    </motion.div>
                  )}

                  {/* Membership Number (Premium Detail) */}
                  <div className="luxury-divider my-8"></div>
                  <div className="flex items-center justify-between">
                    <div className="luxury-text-small uppercase tracking-widest text-gray-400">Member ID</div>
                    <div className="luxury-text-body font-mono tracking-wider text-gray-600">{firebaseUser?.uid.slice(0, 12).toUpperCase()}</div>
                  </div>
                </div>
              </div>

              {/* Card Glow Effect */}
              <div className={`absolute -inset-1 bg-gradient-to-br ${getLuxuryGradient(tierProgress.currentTier)} rounded-3xl blur-2xl opacity-20 -z-10`}></div>
            </div>
          </motion.div>

          {/* Exclusive Benefits Section */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Your Perks */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30">
                    <Star className="h-6 w-6 text-purple-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{t('loyalty.yourPerks', language)}</h3>
                </div>
                <ul className="space-y-4">
                  {currentTierConfig.perks.map((perk, index) => (
                    <motion.li
                      key={index}
                      className="flex items-start gap-3 group"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + (index * 0.1), duration: 0.3 }}
                    >
                      <div className="mt-1">
                        <div className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 group-hover:scale-150 transition-transform duration-300" />
                      </div>
                      <span className="text-purple-100/90 group-hover:text-white transition-colors duration-300">
                        {getPerkTranslation(perk)}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* VIP Services */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30">
                    <Shield className="h-6 w-6 text-blue-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{t('loyalty.premiumServices', language)}</h3>
                </div>
                <div className="space-y-4">
                  <motion.div
                    className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-400/20 hover:border-purple-400/40 transition-all duration-300"
                    whileHover={{ scale: 1.02, x: 5 }}
                  >
                    <Zap className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                    <div>
                      <div className="text-white font-semibold">{t('loyalty.prioritySupport', language)}</div>
                      <div className="text-purple-200/60 text-sm">{t('loyalty.support247', language)}</div>
                    </div>
                  </motion.div>

                  <motion.div
                    className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-transparent border border-pink-400/20 hover:border-pink-400/40 transition-all duration-300"
                    whileHover={{ scale: 1.02, x: 5 }}
                  >
                    <Heart className="h-5 w-5 text-pink-400 flex-shrink-0" />
                    <div>
                      <div className="text-white font-semibold">{t('loyalty.exclusiveAccess', language)}</div>
                      <div className="text-purple-200/60 text-sm">{t('loyalty.earlyAccessProducts', language)}</div>
                    </div>
                  </motion.div>

                  {tierProgress.currentTier === 'platinum' && (
                    <motion.div
                      className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300"
                      whileHover={{ scale: 1.02, x: 5 }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ delay: 1, duration: 0.5 }}
                    >
                      <Crown className="h-5 w-5 text-purple-300 flex-shrink-0" />
                      <div>
                        <div className="text-white font-semibold">{t('loyalty.conciergeService', language)}</div>
                        <div className="text-purple-200/60 text-sm">{t('loyalty.personalAccountManager', language)}</div>
                      </div>
                    </motion.div>
                  )}

                  <Button
                    className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 rounded-xl shadow-lg shadow-purple-500/30 transition-all duration-300"
                    onClick={() => {
                      trackEvent({
                        action: 'view_vip_rewards_click',
                        category: 'loyalty_vip',
                        label: tierProgress.currentTier,
                        language,
                        userId: firebaseUser?.uid,
                      });
                      setLocation('/packages');
                    }}
                    data-testid="button-view-rewards"
                  >
                    <Gift className="h-5 w-5 mr-2" />
                    {t('loyalty.viewRewards', language)}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* All Tiers Overview - Luxury Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8">
              <h3 className="text-3xl font-bold text-white mb-8 text-center">{t('loyalty.allTiers', language)}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {(['new', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map((tier, index) => {
                  const config = getTierConfig(tier);
                  const isCurrent = tier === tierProgress.currentTier;
                  
                  return (
                    <motion.div
                      key={tier}
                      className="relative group"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1 + (index * 0.1), duration: 0.4 }}
                      whileHover={{ scale: 1.05, y: -10 }}
                      data-testid={`tier-card-${tier}`}
                    >
                      <div className={`relative rounded-2xl p-6 h-full transition-all duration-300 ${
                        isCurrent
                          ? `bg-gradient-to-br ${getLuxuryGradient(tier)} shadow-2xl shadow-${tier === 'platinum' ? 'purple' : tier === 'gold' ? 'yellow' : tier === 'silver' ? 'gray' : 'slate'}-500/50`
                          : 'bg-white/5 border border-white/10 hover:border-white/30'
                      }`}>
                        <div className="text-center">
                          <motion.div
                            className="mb-4"
                            animate={isCurrent ? { rotate: [0, 5, -5, 0] } : {}}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                          >
                            {getTierIcon(tier)}
                          </motion.div>
                          <h4 className={`font-bold text-xl mb-2 ${isCurrent ? 'text-white' : 'text-purple-200'}`}>
                            {getTierDisplay(tier, language).toUpperCase()}
                          </h4>
                          <p className={`text-sm mb-4 ${isCurrent ? 'text-white/80' : 'text-purple-300/60'}`}>
                            {config.minWashes}+ {t('loyalty.washes', language)}
                          </p>
                          {isCurrent && (
                            <Badge className="mb-4 bg-white/20 text-white border-white/30 backdrop-blur-sm">
                              {t('loyalty.currentlyHere', language)}
                            </Badge>
                          )}
                          <div className={`text-3xl font-bold mb-2 ${isCurrent ? 'text-white' : 'text-purple-200'}`}>
                            {config.discount}%
                          </div>
                          <p className={`text-xs ${isCurrent ? 'text-white/60' : 'text-purple-300/50'}`}>{t('loyalty.discount', language)}</p>
                        </div>
                        
                        {/* Glow effect on hover */}
                        <div className={`absolute -inset-1 bg-gradient-to-br ${getLuxuryGradient(tier)} rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300 -z-10`}></div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Bottom Spacing */}
          <div className="h-12"></div>
        </motion.div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -20px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(20px, 20px) scale(1.05); }
        }
        .animate-blob {
          animation: blob 20s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </Layout>
  );
}
