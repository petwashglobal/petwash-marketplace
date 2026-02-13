import { useEffect, useState } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { 
  calculateTier, 
  getTierProgress, 
  getTierConfig, 
  getTierDisplay,
  calculatePointsValue,
  type LoyaltyTier 
} from '@/lib/loyalty';
import { formatILS } from '@/lib/currency';
import { Crown, Gift, Star, Sparkles, TrendingUp, Zap, Award, Heart, Diamond, Shield, ArrowRight, Users, Calendar, MapPin, Clock, Check, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { useAnalytics } from '@/hooks/useAnalytics';
import { logger } from "@/lib/logger";
import { useLocation, Link } from "wouter";

const gold = '#C9A96E';

export default function Loyalty() {
  const { user: firebaseUser, loading: authLoading } = useFirebaseAuth();
  const { trackEvent } = useAnalytics();
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<Language>((localStorage.getItem('petwash_lang') as Language) || 'he');
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
            action: 'privilege_tier_view',
            category: 'loyalty_privilege',
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

  const isRTL = language === 'he' || language === 'ar';

  if (authLoading || loading) {
    return (
      <Layout language={language} onLanguageChange={setLanguage}>
        <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0d0d0d 100%)', borderRadius: '2px' }}>
              <Crown className="w-10 h-10 animate-pulse" style={{ color: gold }} />
            </div>
            <p className="text-gray-400 text-sm uppercase tracking-[0.2em]">{t('loyalty.loading', language)}</p>
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

  const tierCardGradient = (tier: LoyaltyTier) => {
    const map = {
      new: { bg: '#f8f9fa', border: '#e5e7eb', accent: '#6B7280' },
      silver: { bg: '#f1f3f5', border: '#d1d5db', accent: '#94A3B8' },
      gold: { bg: '#fffbeb', border: '#fcd34d', accent: '#D4AF37' },
      platinum: { bg: '#f5f3ff', border: '#c4b5fd', accent: '#7C3AED' },
    };
    return map[tier] || map.new;
  };

  const tierEmoji = (tier: LoyaltyTier) => {
    const map = { new: '🌟', silver: '🥈', gold: '🥇', platinum: '💎' };
    return map[tier] || '🌟';
  };

  return (
    <Layout language={language} onLanguageChange={setLanguage}>
      <div className="min-h-screen bg-[#fafafa]" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* HERO WELCOME - Bright white with subtle pattern */}
        <section className="relative bg-white pt-12 sm:pt-16 pb-16 sm:pb-24 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center space-y-5 mb-12">
              <p className="text-[11px] uppercase tracking-[0.3em] font-medium text-gray-400">PetWash™ Privilege</p>
              <h1 className="text-3xl sm:text-5xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('loyalty.welcome', language)} <span style={{ color: gold }}>{firstName}</span>
              </h1>
              {memberSince && (
                <p className="text-sm text-gray-400 uppercase tracking-wider">{t('loyalty.memberSince', language)} {memberSince}</p>
              )}
            </motion.div>

            {/* FLOATING PRIVILEGE CARD - Dark metallic */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="relative mx-auto max-w-lg"
            >
              <div
                className="relative p-7 sm:p-8 text-white overflow-hidden"
                style={{
                  background: 'radial-gradient(circle at 10% -10%, rgba(255,255,255,0.24), transparent 55%), radial-gradient(circle at 95% 110%, rgba(201,169,110,0.15), transparent 55%), linear-gradient(135deg, #05070a, #121b2a 60%, #1a2e3a 100%)',
                  borderRadius: '2px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.2), 0 10px 20px rgba(0,0,0,0.1)'
                }}
              >
                <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-white/5 blur-3xl" />
                <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full blur-3xl" style={{ background: `${gold}08` }} />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-[11px] tracking-[0.2em] uppercase text-white/50">Pet Wash™</div>
                      <div className="text-[10px] tracking-[0.15em] uppercase mt-0.5" style={{ color: gold }}>PRIVILEGE CARD</div>
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center" style={{ background: `${gold}15`, borderRadius: '2px' }}>
                      <Crown className="w-5 h-5" style={{ color: gold }} />
                    </div>
                  </div>

                  {/* Tier & Wash Count */}
                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t('loyalty.currentTier', language)}</div>
                      <div className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                        {getTierDisplay(tierProgress.currentTier, language as any)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t('loyalty.washes', language)}</div>
                      <div className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: gold }}>
                        {washes}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar to Next Tier */}
                  {tierProgress.nextTier && (
                    <div className="mb-5">
                      <div className="flex justify-between text-[10px] uppercase tracking-wider text-white/50 mb-2">
                        <span>{tierProgress.washesUntilNext} {t('loyalty.washesUntil', language)} {getTierDisplay(tierProgress.nextTier, language as any)}</span>
                        <span>{tierProgress.currentWashes} / {tierProgress.nextTierAt}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 overflow-hidden" style={{ borderRadius: '1px' }}>
                        <motion.div
                          className="h-full"
                          style={{ background: `linear-gradient(90deg, ${gold}, #e8d5a3)` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${tierProgress.progressPercentage}%` }}
                          transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  )}

                  {tierProgress.currentTier === 'platinum' && (
                    <div className="flex items-center justify-center gap-2 py-2 mb-4" style={{ background: `${gold}10`, borderRadius: '2px' }}>
                      <Sparkles className="w-3.5 h-3.5" style={{ color: gold }} />
                      <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: gold }}>{t('loyalty.eliteStatus', language)}</span>
                      <Sparkles className="w-3.5 h-3.5" style={{ color: gold }} />
                    </div>
                  )}

                  {/* Card Footer Stats */}
                  <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                    <span className="px-3 py-1 text-[10px] uppercase tracking-wider text-white/80" style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                      {currentTierConfig.discount}% {t('loyalty.discount', language)}
                    </span>
                    <span className="px-3 py-1 text-[10px] uppercase tracking-wider" style={{ background: `${gold}15`, color: gold, borderRadius: '2px' }}>
                      {formatILS(totalSaved, language)} {t('loyalty.totalSaved', language)}
                    </span>
                  </div>

                  {/* Member ID */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                    <div className="text-[9px] uppercase tracking-widest text-white/30">Member ID</div>
                    <div className="text-[11px] font-mono tracking-wider text-white/40">{firebaseUser?.uid.slice(0, 12).toUpperCase()}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* QUICK STATS ROW */}
        <section className="bg-white border-t border-gray-100 py-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { value: washes.toString(), label: t('loyalty.washes', language), icon: <Sparkles className="w-5 h-5" /> },
                { value: `${currentTierConfig.discount}%`, label: t('loyalty.discount', language), icon: <Gift className="w-5 h-5" /> },
                { value: formatILS(totalSaved, language), label: t('loyalty.totalSaved', language), icon: <TrendingUp className="w-5 h-5" /> },
                { value: currentTierConfig.perks.length.toString(), label: t('loyalty.yourPerks', language), icon: <Star className="w-5 h-5" /> },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="flex justify-center mb-3 text-gray-300">{stat.icon}</div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* YOUR EXCLUSIVE BENEFITS */}
        <section className="bg-[#fafafa] py-14 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-8">
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-gray-400 mb-2">PetWash™ Privilege</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('loyalty.yourPerks', language)}
              </h2>
            </motion.div>
            <div className="grid sm:grid-cols-2 gap-3">
              {currentTierConfig.perks.map((perk, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isRTL ? 15 : -15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-4 p-4 bg-white hover:bg-gray-50 transition-colors"
                  style={{ borderRadius: '2px', border: '1px solid #f0f0f0' }}
                >
                  <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: `${gold}10`, borderRadius: '2px' }}>
                    <Check className="w-4 h-4" style={{ color: gold }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{getPerkTranslation(perk)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* PREMIUM SERVICES */}
        <section className="bg-white py-14 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* Premium Services List */}
              <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="space-y-5">
                <h2 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {t('loyalty.premiumServices', language)}
                </h2>
                <div className="space-y-3">
                  {[
                    { icon: <Zap className="w-5 h-5" />, title: t('loyalty.prioritySupport', language), desc: t('loyalty.support247', language) },
                    { icon: <Heart className="w-5 h-5" />, title: t('loyalty.exclusiveAccess', language), desc: t('loyalty.earlyAccessProducts', language) },
                    { icon: <Calendar className="w-5 h-5" />, title: t('loyalty.perk.birthdayBonus', language), desc: language === 'he' ? 'מתנות ליום הולדת שלך ושל חיית המחמד' : 'Birthday gifts for you and your pet' },
                  ].map((service, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-4 p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                      style={{ borderRadius: '2px' }}
                    >
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 bg-white shadow-sm" style={{ borderRadius: '2px', color: gold }}>
                        {service.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-0.5">{service.title}</h3>
                        <p className="text-xs text-gray-500">{service.desc}</p>
                      </div>
                    </motion.div>
                  ))}

                  {tierProgress.currentTier === 'platinum' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="flex items-start gap-4 p-4" 
                      style={{ borderRadius: '2px', background: `${gold}08`, border: `1px solid ${gold}20` }}
                    >
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ borderRadius: '2px', background: '#0a0a0a' }}>
                        <Crown className="w-5 h-5" style={{ color: gold }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-0.5">{t('loyalty.conciergeService', language)}</h3>
                        <p className="text-xs text-gray-500">{t('loyalty.personalAccountManager', language)}</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                <Button
                  className="w-full mt-4 text-sm font-bold text-white"
                  style={{ borderRadius: '2px', background: '#0a0a0a', padding: '14px 24px' }}
                  onClick={() => {
                    trackEvent({
                      action: 'view_rewards_click',
                      category: 'loyalty_privilege',
                      label: tierProgress.currentTier,
                      language,
                      userId: firebaseUser?.uid,
                    });
                    setLocation('/packages');
                  }}
                >
                  <Gift className="w-4 h-4 mr-2" />
                  {t('loyalty.viewRewards', language)}
                </Button>
              </motion.div>

              {/* Tier Journey Card */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-gray-50 p-6" style={{ borderRadius: '2px' }}>
                <h3 className="text-lg font-bold text-gray-900 mb-6" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {t('loyalty.allTiers', language)}
                </h3>
                <div className="space-y-3">
                  {(['new', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map((tier, i) => {
                    const config = getTierConfig(tier);
                    const isCurrent = tier === tierProgress.currentTier;
                    const tierColors = tierCardGradient(tier);

                    return (
                      <motion.div
                        key={tier}
                        initial={{ opacity: 0, x: isRTL ? -10 : 10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.08 }}
                        className={`flex items-center justify-between p-4 transition-colors ${isCurrent ? 'shadow-sm' : ''}`}
                        style={{
                          borderRadius: '2px',
                          background: isCurrent ? 'white' : '#fafafa',
                          border: isCurrent ? `2px solid ${tierColors.accent}` : '1px solid #f0f0f0',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{tierEmoji(tier)}</span>
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {getTierDisplay(tier, language as any)}
                              {isCurrent && (
                                <span className="inline-block ml-2 px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold text-white" style={{ background: tierColors.accent, borderRadius: '2px' }}>
                                  {language === 'he' ? 'נוכחי' : 'Current'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400">{config.minWashes}+ {t('loyalty.washes', language)} · {config.discount}% {t('loyalty.discount', language)}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">{config.perks.length} {language === 'he' ? 'הטבות' : 'perks'}</div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA - JOIN PRIVILEGE CLUB */}
        <section className="py-16 border-t border-gray-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
              <div className="w-16 h-16 mx-auto flex items-center justify-center" style={{ background: '#0a0a0a', borderRadius: '2px' }}>
                <Shield className="w-8 h-8" style={{ color: gold }} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('loyalty.title', language)}
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">{t('loyalty.subtitle', language)}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link href="/privilege">
                  <Button className="px-8 py-3 text-sm font-bold text-white" style={{ borderRadius: '2px', background: '#0a0a0a' }}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    {t('loyalty.signUp', language)}
                  </Button>
                </Link>
                <Link href="/loyalty/dashboard">
                  <Button variant="outline" className="px-8 py-3 text-sm font-medium border-gray-200 text-gray-700" style={{ borderRadius: '2px' }}>
                    {language === 'he' ? 'לוח בקרה מתקדם' : 'Advanced Dashboard'}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FOOTER NOTE */}
        <section className="bg-white border-t border-gray-100 py-8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-300">
              <Shield className="w-3.5 h-3.5" />
              <span>Pet Wash™ Privilege · {language === 'he' ? 'הנתונים שלך מוגנים ומוצפנים' : 'Your data is protected and encrypted'}</span>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
