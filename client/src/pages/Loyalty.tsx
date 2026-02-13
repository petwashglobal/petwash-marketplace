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

const PRESTIGE_TIERS = [
  {
    key: 'member',
    nameKey: 'privilege.tierMember',
    descKey: 'privilege.tierMemberDesc',
    gradient: 'linear-gradient(145deg, #e8e8e8 0%, #d4d4d8 30%, #a1a1aa 100%)',
    shimmer: 'rgba(255,255,255,0.6)',
    textColor: '#3f3f46',
    accentColor: '#71717a',
    multiplier: '1x',
  },
  {
    key: 'signature',
    nameKey: 'privilege.tierSignature',
    descKey: 'privilege.tierSignatureDesc',
    gradient: 'linear-gradient(145deg, #c0c0c0 0%, #a8a8a8 30%, #808080 80%, #696969 100%)',
    shimmer: 'rgba(255,255,255,0.5)',
    textColor: '#ffffff',
    accentColor: '#d4d4d4',
    multiplier: '1.05x',
  },
  {
    key: 'elite',
    nameKey: 'privilege.tierElite',
    descKey: 'privilege.tierEliteDesc',
    gradient: 'linear-gradient(145deg, #e8d5a3 0%, #C9A96E 30%, #b8963e 80%, #9a7b2e 100%)',
    shimmer: 'rgba(255,255,255,0.45)',
    textColor: '#1a1a0e',
    accentColor: '#f5e6c0',
    multiplier: '1.1x',
  },
  {
    key: 'privilege',
    nameKey: 'privilege.tierPrivilege',
    descKey: 'privilege.tierPrivilegeDesc',
    gradient: 'linear-gradient(145deg, #e0e7ef 0%, #b8c6d4 20%, #8b9bb0 60%, #6b7d92 100%)',
    shimmer: 'rgba(255,255,255,0.55)',
    textColor: '#0f172a',
    accentColor: '#e2e8f0',
    multiplier: '1.15x',
  },
  {
    key: 'blackReserve',
    nameKey: 'privilege.tierBlackReserve',
    descKey: 'privilege.tierBlackReserveDesc',
    gradient: 'linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 40%, #111111 70%, #1a1a1a 100%)',
    shimmer: 'rgba(201,169,110,0.15)',
    textColor: '#ffffff',
    accentColor: gold,
    multiplier: '1.25x',
    isInviteOnly: true,
  },
];

const COMPARISON_ROWS = [
  { key: 'privilege.compareBonusCredit', values: ['-', '+5%', '+10%', '+15%', '+25%'] },
  { key: 'privilege.comparePriorityBooking', values: [false, true, true, true, true] },
  { key: 'privilege.compareBirthdayReward', values: [true, true, true, true, true] },
  { key: 'privilege.compareExclusiveOffers', values: [false, true, true, true, true] },
  { key: 'privilege.compareFreeWashMilestone', values: [false, false, true, true, true] },
  { key: 'privilege.compareConcierge', values: [false, false, false, true, true] },
  { key: 'privilege.compareInviteOnly', values: [false, false, false, false, true] },
];

function PublicPrivilegeLanding({ language, isRTL }: { language: Language; isRTL: boolean }) {
  const [, setLocation] = useLocation();
  const [activeTier, setActiveTier] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* SECTION 1 — HERO */}
      <section className="relative bg-white pt-20 sm:pt-32 pb-24 sm:pb-36 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.008]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 0.5px, transparent 0)', backgroundSize: '48px 48px' }} />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="text-center space-y-8">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.1]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.heroHeadline', language)}
            </h1>
            <p className="text-xl sm:text-2xl text-gray-400 font-light max-w-2xl mx-auto" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.heroSubheadline', language)}
            </p>
            <p className="text-sm sm:text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
              {t('privilege.heroDescription', language)}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="relative mx-auto max-w-md mt-16"
          >
            <div
              className="relative p-7 sm:p-9 text-white overflow-hidden"
              style={{
                background: 'radial-gradient(circle at 10% -10%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(circle at 95% 110%, rgba(201,169,110,0.12), transparent 55%), linear-gradient(145deg, #0a0a0a, #111827 60%, #1e293b 100%)',
                borderRadius: '2px',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 40px 80px rgba(0,0,0,0.15), 0 15px 30px rgba(0,0,0,0.08)'
              }}
            >
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.1) 41%, transparent 42%, transparent 58%, rgba(255,255,255,0.1) 59%, transparent 60%)' }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <div className="text-[11px] tracking-[0.25em] uppercase text-white/40">Pet Wash™</div>
                    <div className="text-[10px] tracking-[0.2em] uppercase mt-1" style={{ color: gold }}>PRIVILEGE CARD</div>
                  </div>
                  <Crown className="w-5 h-5" style={{ color: `${gold}60` }} />
                </div>
                <div className="mb-10">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2">{t('loyalty.currentTier', language)}</div>
                  <div className="text-3xl sm:text-4xl font-bold tracking-wide" style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: gold }}>
                    {t('privilege.tierBlackReserve', language)}
                  </div>
                </div>
                <div className="h-px mb-6" style={{ background: `linear-gradient(90deg, transparent, ${gold}30, transparent)` }} />
                <div className="flex items-center justify-between">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-white/25">Member ID</div>
                  <div className="text-[10px] font-mono tracking-widest text-white/30">PWP-XXXX-XXXX</div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-12"
          >
            <Button
              className="w-full sm:w-auto px-12 py-4 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{ borderRadius: '2px', background: '#0a0a0a' }}
              onClick={() => setLocation('/privilege')}
            >
              {t('privilege.activateButton', language)}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto px-10 py-4 text-sm font-medium border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ borderRadius: '2px' }}
              onClick={() => setLocation('/signin')}
            >
              {t('privilege.alreadyMember', language)}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Gold thin divider */}
      <div className="max-w-xl mx-auto px-8">
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}40, transparent)` }} />
      </div>

      {/* SECTION 2 — WHY JOIN (Three Pillars) */}
      <section className="bg-white py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16 space-y-4">
            <h2 className="text-3xl sm:text-5xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.whyJoinTitle', language)}
            </h2>
            <p className="text-gray-400 text-lg max-w-lg mx-auto">
              {t('privilege.whyJoinSubtitle', language)}
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-12 sm:gap-16">
            {[
              { icon: <Clock className="w-6 h-6" strokeWidth={1.2} />, titleKey: 'privilege.pillarPriority', descKey: 'privilege.pillarPriorityDesc' },
              { icon: <Star className="w-6 h-6" strokeWidth={1.2} />, titleKey: 'privilege.pillarRewards', descKey: 'privilege.pillarRewardsDesc' },
              { icon: <Crown className="w-6 h-6" strokeWidth={1.2} />, titleKey: 'privilege.pillarStatus', descKey: 'privilege.pillarStatusDesc' },
            ].map((pillar, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center space-y-4"
              >
                <div className="w-14 h-14 mx-auto flex items-center justify-center" style={{ color: gold }}>
                  {pillar.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wider" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {t(pillar.titleKey, language)}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
                  {t(pillar.descKey, language)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Gold divider */}
      <div className="max-w-xl mx-auto px-8">
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}40, transparent)` }} />
      </div>

      {/* SECTION 3 — FLOATING METALLIC TIER CARDS */}
      <section className="bg-[#fafafa] py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16 space-y-4">
            <p className="text-[10px] uppercase tracking-[0.3em] font-medium" style={{ color: gold }}>PetWash Privilege</p>
            <h2 className="text-3xl sm:text-5xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('loyalty.allTiers', language)}
            </h2>
          </motion.div>

          <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {PRESTIGE_TIERS.map((tier, i) => (
              <motion.div
                key={tier.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="flex-shrink-0 w-[220px] sm:w-[240px] snap-center cursor-pointer group"
                onClick={() => setActiveTier(activeTier === i ? null : i)}
              >
                <div
                  className="relative p-6 h-[300px] sm:h-[320px] overflow-hidden transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2"
                  style={{
                    background: tier.gradient,
                    borderRadius: '2px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.06)',
                    border: tier.key === 'blackReserve' ? `1px solid ${gold}30` : '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{
                      background: `linear-gradient(105deg, transparent 40%, ${tier.shimmer} 45%, transparent 50%)`,
                    }}
                  />
                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <div>
                      <div className="text-[8px] tracking-[0.3em] uppercase mb-1" style={{ color: tier.key === 'blackReserve' ? `${gold}80` : `${tier.textColor}60`, opacity: 0.7 }}>
                        Pet Wash™
                      </div>
                      <div className="text-[7px] tracking-[0.2em] uppercase" style={{ color: tier.key === 'blackReserve' ? gold : `${tier.textColor}50`, opacity: 0.6 }}>
                        PRIVILEGE
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-xl sm:text-2xl font-bold tracking-wide" style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: tier.textColor }}>
                        {t(tier.nameKey, language)}
                      </div>
                      {tier.isInviteOnly && (
                        <div className="inline-block px-2 py-0.5 text-[8px] uppercase tracking-[0.15em]" style={{ background: `${gold}20`, color: gold, borderRadius: '1px' }}>
                          {t('privilege.invitationOnly', language)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${tier.key === 'blackReserve' ? `${gold}15` : 'rgba(255,255,255,0.15)'}` }}>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: `${tier.textColor}50`, opacity: 0.6 }}>
                        {tier.multiplier}
                      </div>
                      <Crown className="w-3.5 h-3.5" style={{ color: tier.key === 'blackReserve' ? gold : `${tier.textColor}40`, opacity: 0.5 }} />
                    </div>
                  </div>
                </div>

                {activeTier === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-3 p-4 bg-white"
                    style={{ borderRadius: '2px', border: '1px solid #f0f0f0' }}
                  >
                    <p className="text-xs text-gray-500 leading-relaxed">{t(tier.descKey, language)}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 — COMPLIMENTARY MEMBERSHIP */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.complimentaryTitle', language)}
            </h2>
            <p className="text-gray-500 leading-relaxed text-base sm:text-lg max-w-xl mx-auto">
              {t('privilege.complimentaryText', language)}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Gold divider */}
      <div className="max-w-xl mx-auto px-8">
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}40, transparent)` }} />
      </div>

      {/* SECTION 5 — HOW IT WORKS */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.howItWorks', language)}
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { num: '01', key: 'privilege.step1', icon: <Users className="w-5 h-5" strokeWidth={1.2} /> },
              { num: '02', key: 'privilege.step2', icon: <Crown className="w-5 h-5" strokeWidth={1.2} /> },
              { num: '03', key: 'privilege.step3', icon: <TrendingUp className="w-5 h-5" strokeWidth={1.2} /> },
              { num: '04', key: 'privilege.step4', icon: <Gift className="w-5 h-5" strokeWidth={1.2} /> },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="text-center space-y-4"
              >
                <div className="w-12 h-12 mx-auto flex items-center justify-center" style={{ color: gold }}>
                  {step.icon}
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: gold }}>{step.num}</div>
                <p className="text-sm text-gray-600 leading-relaxed">{t(step.key, language)}</p>
              </motion.div>
            ))}
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12 text-sm text-gray-400 italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('privilege.noFees', language)}
          </motion.p>
        </div>
      </section>

      {/* Gold divider */}
      <div className="max-w-xl mx-auto px-8">
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}40, transparent)` }} />
      </div>

      {/* SECTION 6 — TIER COMPARISON TABLE (Airline Style) */}
      <section className="bg-[#fafafa] py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.tierCompareTitle', language)}
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[700px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="text-left p-4 text-xs uppercase tracking-wider text-gray-400 font-medium" style={{ borderBottom: '1px solid #e5e5e5' }}></th>
                  {PRESTIGE_TIERS.map((tier) => (
                    <th
                      key={tier.key}
                      className="p-4 text-center text-xs uppercase tracking-wider font-bold"
                      style={{
                        borderBottom: `2px solid ${tier.key === 'blackReserve' ? gold : '#e5e5e5'}`,
                        color: tier.key === 'blackReserve' ? gold : '#374151',
                        fontFamily: 'Georgia, "Times New Roman", serif',
                      }}
                    >
                      {t(tier.nameKey, language)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
                    <td className="p-4 text-sm text-gray-600 font-medium" style={{ borderBottom: '1px solid #f0f0f0' }}>
                      {t(row.key, language)}
                    </td>
                    {row.values.map((val, ci) => (
                      <td
                        key={ci}
                        className="p-4 text-center"
                        style={{ borderBottom: '1px solid #f0f0f0' }}
                      >
                        {typeof val === 'boolean' ? (
                          val ? (
                            <Check className="w-4 h-4 mx-auto" style={{ color: gold }} />
                          ) : (
                            <span className="text-gray-200">—</span>
                          )
                        ) : (
                          <span className="text-sm font-bold" style={{ color: val === '-' ? '#d4d4d8' : gold }}>{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* SECTION 7 — EMOTIONAL STORYTELLING */}
      <section className="bg-white py-24 sm:py-32">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-8">
            <div className="w-px h-12 mx-auto" style={{ background: `linear-gradient(to bottom, transparent, ${gold}, transparent)` }} />
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.storyTitle', language)}
            </h2>
            <p className="text-gray-400 leading-loose text-base sm:text-lg" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.storyText', language)}
            </p>
            <div className="w-px h-12 mx-auto" style={{ background: `linear-gradient(to bottom, transparent, ${gold}, transparent)` }} />
          </motion.div>
        </div>
      </section>

      {/* SECTION 8 — FINAL CTA */}
      <section className="bg-[#fafafa] py-24 sm:py-32 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-8">
            <h2 className="text-3xl sm:text-5xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.ctaTitle', language)}
            </h2>
            <p className="text-gray-400 text-lg max-w-md mx-auto" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.ctaSubtitle', language)}
            </p>
            <Button
              className="px-14 py-5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{ borderRadius: '2px', background: '#0a0a0a' }}
              onClick={() => setLocation('/privilege')}
            >
              {t('privilege.activateButton', language)}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* FOOTER NOTE */}
      <section className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-300">
            <Shield className="w-3.5 h-3.5" />
            <span>Pet Wash™ Privilege · {t('privilege.dataProtected', language)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

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

  if (authLoading || (firebaseUser && loading)) {
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

  if (!firebaseUser) {
    return (
      <Layout language={language} onLanguageChange={setLanguage}>
        <PublicPrivilegeLanding language={language} isRTL={isRTL} />
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

                  <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                    <span className="px-3 py-1 text-[10px] uppercase tracking-wider text-white/80" style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                      {currentTierConfig.discount}% {t('loyalty.discount', language)}
                    </span>
                    <span className="px-3 py-1 text-[10px] uppercase tracking-wider" style={{ background: `${gold}15`, color: gold, borderRadius: '2px' }}>
                      {formatILS(totalSaved, language)} {t('loyalty.totalSaved', language)}
                    </span>
                  </div>

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
              <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="space-y-5">
                <h2 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {t('loyalty.premiumServices', language)}
                </h2>
                <div className="space-y-3">
                  {[
                    { icon: <Zap className="w-5 h-5" />, title: t('loyalty.prioritySupport', language), desc: t('loyalty.support247', language) },
                    { icon: <Heart className="w-5 h-5" />, title: t('loyalty.exclusiveAccess', language), desc: t('loyalty.earlyAccessProducts', language) },
                    { icon: <Calendar className="w-5 h-5" />, title: t('loyalty.perk.birthdayBonus', language), desc: t('privilege.benefit3', language) },
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
                    const tierColors: Record<LoyaltyTier, { accent: string }> = {
                      new: { accent: '#6B7280' },
                      silver: { accent: '#94A3B8' },
                      gold: { accent: '#D4AF37' },
                      platinum: { accent: '#7C3AED' },
                    };

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
                          border: isCurrent ? `2px solid ${tierColors[tier].accent}` : '1px solid #f0f0f0',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{tierEmoji(tier)}</span>
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {getTierDisplay(tier, language as any)}
                              {isCurrent && (
                                <span className="inline-block ml-2 px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold text-white" style={{ background: tierColors[tier].accent, borderRadius: '2px' }}>
                                  {t('loyalty.currentTier', language)}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400">{config.minWashes}+ {t('loyalty.washes', language)} · {config.discount}% {t('loyalty.discount', language)}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">{config.perks.length} {t('loyalty.yourPerks', language)}</div>
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
                    {t('loyalty.advancedDashboard', language)}
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
              <span>Pet Wash™ Privilege · {t('privilege.dataProtected', language)}</span>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
