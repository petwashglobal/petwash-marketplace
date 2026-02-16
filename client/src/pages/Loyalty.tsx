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
import diamondLogo from "@assets/IMG_3257_1771244654511.png";

const gold = '#C9A96E';

const PRESTIGE_TIERS = [
  {
    key: 'member',
    nameKey: 'privilege.tierMember',
    descKey: 'privilege.tierMemberDesc',
    cardBg: 'linear-gradient(155deg, #f5f5f5 0%, #e8e8e8 30%, #d4d4d8 70%, #c0c0c0 100%)',
    labelColor: '#71717a',
    tierNameColor: '#52525b',
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: 'rgba(0,0,0,0.06)',
    icon: '◇',
    benefits: ['privilege.tierMemberBenefit1', 'privilege.tierMemberBenefit2'],
  },
  {
    key: 'signature',
    nameKey: 'privilege.tierSignature',
    descKey: 'privilege.tierSignatureDesc',
    cardBg: 'linear-gradient(155deg, #d4d4d4 0%, #b8b8b8 30%, #909090 70%, #787878 100%)',
    labelColor: '#e5e5e5',
    tierNameColor: '#f0f0f0',
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: 'rgba(0,0,0,0.10)',
    icon: '♛',
    benefits: ['privilege.tierSignatureBenefit1', 'privilege.tierSignatureBenefit2'],
  },
  {
    key: 'elite',
    nameKey: 'privilege.tierElite',
    descKey: 'privilege.tierEliteDesc',
    cardBg: 'linear-gradient(155deg, #d4b87a 0%, #C9A96E 25%, #b8963e 60%, #9a7b2e 100%)',
    labelColor: '#f5e6c8',
    tierNameColor: '#fff8eb',
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: 'rgba(180,140,60,0.15)',
    icon: '♕',
    benefits: ['privilege.tierEliteBenefit1', 'privilege.tierEliteBenefit2'],
  },
  {
    key: 'privilege',
    nameKey: 'privilege.tierPrivilege',
    descKey: 'privilege.tierPrivilegeDesc',
    cardBg: 'linear-gradient(155deg, #2a2a2a 0%, #1a1a1a 30%, #111111 70%, #0a0a0a 100%)',
    labelColor: gold,
    tierNameColor: '#ffffff',
    borderColor: `${gold}25`,
    shadowColor: 'rgba(0,0,0,0.20)',
    icon: '◆',
    benefits: ['privilege.tierPrivilegeBenefit1', 'privilege.tierPrivilegeBenefit2'],
  },
  {
    key: 'blackReserve',
    nameKey: 'privilege.tierBlackReserve',
    descKey: 'privilege.tierBlackReserveDesc',
    cardBg: 'linear-gradient(155deg, #0f0f0f 0%, #080808 40%, #050505 70%, #0a0a0a 100%)',
    labelColor: gold,
    tierNameColor: '#ffffff',
    borderColor: `${gold}30`,
    shadowColor: 'rgba(0,0,0,0.25)',
    icon: '⬥',
    isInviteOnly: true,
    benefits: ['privilege.tierBlackReserveBenefit1', 'privilege.tierBlackReserveBenefit2'],
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

  const serif = 'Georgia, "Times New Roman", serif';

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* SECTION 1 — HERO */}
      <section className="relative pt-20 sm:pt-32 pb-16 sm:pb-24 overflow-hidden bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="space-y-5">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light text-gray-900 leading-[1.15] tracking-tight" style={{ fontFamily: serif }}>
              {t('privilege.heroHeadline', language)}
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 font-light max-w-lg mx-auto" style={{ fontFamily: serif }}>
              {t('privilege.heroSubheadline', language)}
            </p>
          </motion.div>

          {/* Hero Privilege Card — 3D perspective with diamond logo */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.3, duration: 0.9, ease: 'easeOut' }}
            className="relative mx-auto mt-14 mb-12"
            style={{ perspective: '1200px', maxWidth: '420px' }}
          >
            <div
              className="relative overflow-hidden"
              style={{
                background: 'linear-gradient(155deg, #1f1f1f 0%, #141414 25%, #0d0d0d 50%, #141414 75%, #1a1a1a 100%)',
                borderRadius: '16px',
                padding: '28px 24px 20px',
                border: '1px solid rgba(201,169,110,0.12)',
                boxShadow: '0 60px 120px rgba(0,0,0,0.25), 0 25px 50px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)',
                transform: 'rotateY(-1.5deg) rotateX(2deg)',
                transformStyle: 'preserve-3d',
                aspectRatio: '1.586 / 1',
              }}
            >
              <div className="absolute inset-0" style={{ background: 'linear-gradient(125deg, transparent 25%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.05) 45%, transparent 55%)', pointerEvents: 'none' }} />
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl" style={{ background: 'rgba(201,169,110,0.05)' }} />
              <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl" style={{ background: 'rgba(201,169,110,0.03)' }} />

              <img
                src={diamondLogo}
                alt=""
                className="absolute pointer-events-none select-none"
                style={{
                  bottom: '12px',
                  right: '16px',
                  width: '130px',
                  height: 'auto',
                  opacity: 0.12,
                  filter: 'brightness(1.3)',
                }}
              />

              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[14px] tracking-[0.22em] font-medium text-white/70" style={{ fontFamily: serif }}>PetWash&trade;</div>
                    <div className="text-[11px] tracking-[0.3em] uppercase mt-1.5 font-light" style={{ color: gold }}>PRIVILEGE CLUB</div>
                  </div>
                  <div
                    className="w-9 h-9 flex items-center justify-center rounded-md"
                    style={{
                      border: `1px solid ${gold}35`,
                      background: `linear-gradient(135deg, ${gold}08, transparent)`,
                    }}
                  >
                    <Diamond className="w-4.5 h-4.5" style={{ color: gold }} />
                  </div>
                </div>
                <div>
                  <div className="h-px mb-4" style={{ background: `linear-gradient(90deg, transparent, ${gold}30, ${gold}20, transparent)` }} />
                  <div className="flex items-center justify-between">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-white/30" style={{ fontFamily: serif }}>Loyalty Member</div>
                    <div className="text-[10px] font-mono tracking-widest text-white/20">PWP ••••</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button
              className="w-full sm:w-auto px-10 py-3.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity rounded-lg"
              style={{ background: '#0a0a0a' }}
              onClick={() => setLocation('/privilege')}
            >
              {t('privilege.activateButton', language)}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto px-8 py-3.5 text-sm font-medium border-gray-200 text-gray-500 hover:bg-white/80 transition-colors rounded-lg"
              onClick={() => {
                document.getElementById('membership-tiers')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {t('privilege.exploreTiers', language)}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 — MEMBERSHIP TIERS (Card Gallery) */}
      <section id="membership-tiers" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-4xl font-light text-gray-900 text-center mb-16"
            style={{ fontFamily: serif }}
          >
            {t('privilege.membershipTiers', language)}
          </motion.h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5 max-w-[960px] mx-auto">
            {[...PRESTIGE_TIERS].reverse().map((tier, i) => {
              const isDark = tier.key === 'privilege' || tier.key === 'blackReserve';
              const isGold = tier.key === 'elite';
              return (
                <motion.div
                  key={tier.key}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="text-center group"
                >
                  <div
                    className="relative overflow-hidden transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-2xl cursor-default mx-auto"
                    style={{
                      background: tier.cardBg,
                      borderRadius: '12px',
                      border: `1px solid ${tier.borderColor}`,
                      boxShadow: `0 16px 40px ${tier.shadowColor}, 0 4px 16px rgba(0,0,0,0.06)`,
                      aspectRatio: '1.586 / 1',
                      width: '100%',
                      maxWidth: '180px',
                      padding: '14px 12px 10px',
                    }}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.06) 48%, transparent 65%)' }} />
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl" style={{ background: isGold ? 'rgba(201,169,110,0.1)' : isDark ? 'rgba(201,169,110,0.04)' : 'rgba(255,255,255,0.04)' }} />

                    {(isDark || isGold) && (
                      <img
                        src={diamondLogo}
                        alt=""
                        className="absolute pointer-events-none select-none"
                        style={{
                          bottom: '4px',
                          right: '6px',
                          width: '55px',
                          height: 'auto',
                          opacity: isDark ? 0.06 : 0.08,
                          filter: 'brightness(1.2)',
                        }}
                      />
                    )}

                    <div className="relative z-10 h-full flex flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <div className="text-[7px] sm:text-[8px] tracking-[0.18em] font-medium" style={{ color: tier.labelColor, opacity: 0.8, fontFamily: serif }}>
                          PetWash&trade;
                        </div>
                        <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded" style={{ border: `1px solid ${tier.borderColor}` }}>
                          {tier.key === 'member' && <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" style={{ color: tier.labelColor }} />}
                          {tier.key === 'signature' && <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3" style={{ color: tier.labelColor }} />}
                          {tier.key === 'elite' && <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3" style={{ color: gold }} />}
                          {tier.key === 'privilege' && <Diamond className="w-2.5 h-2.5 sm:w-3 sm:h-3" style={{ color: gold }} />}
                          {tier.key === 'blackReserve' && <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3" style={{ color: gold }} />}
                        </div>
                      </div>
                      <div>
                        <div className="h-px mb-1.5 opacity-20" style={{ background: isDark || isGold ? `linear-gradient(90deg, transparent, ${gold}, transparent)` : 'rgba(0,0,0,0.12)' }} />
                        <div className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase font-bold" style={{ color: tier.tierNameColor }}>
                          {t(tier.nameKey, language)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <h3 className="text-[12px] font-semibold text-gray-900" style={{ fontFamily: serif }}>
                      {t(tier.nameKey, language)}
                    </h3>
                    {tier.benefits.map((bKey, bi) => (
                      <p key={bi} className="text-[10px] text-gray-400 leading-snug">
                        {t(bKey, language)}
                      </p>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Gold divider */}
      <div className="max-w-xl mx-auto px-8">
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}35, transparent)` }} />
      </div>

      {/* SECTION 3 — WHY JOIN */}
      <section className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16 space-y-4">
            <h2 className="text-2xl sm:text-4xl font-light text-gray-900" style={{ fontFamily: serif }}>
              {t('privilege.whyJoinTitle', language)}
            </h2>
            <p className="text-gray-400 text-base max-w-md mx-auto">
              {t('privilege.whyJoinSubtitle', language)}
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-10 sm:gap-14">
            {[
              { icon: <Clock className="w-5 h-5" strokeWidth={1.2} />, titleKey: 'privilege.pillarPriority', descKey: 'privilege.pillarPriorityDesc' },
              { icon: <Star className="w-5 h-5" strokeWidth={1.2} />, titleKey: 'privilege.pillarRewards', descKey: 'privilege.pillarRewardsDesc' },
              { icon: <Crown className="w-5 h-5" strokeWidth={1.2} />, titleKey: 'privilege.pillarStatus', descKey: 'privilege.pillarStatusDesc' },
            ].map((pillar, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="text-center space-y-3"
              >
                <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full" style={{ background: `${gold}10`, color: gold }}>
                  {pillar.icon}
                </div>
                <h3 className="text-base font-semibold text-gray-900 uppercase tracking-wider" style={{ fontFamily: serif }}>
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
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}35, transparent)` }} />
      </div>

      {/* SECTION 4 — HOW IT WORKS */}
      <section className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-2xl sm:text-4xl font-light text-gray-900" style={{ fontFamily: serif }}>
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
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center space-y-3"
              >
                <div className="text-2xl font-light" style={{ color: gold, fontFamily: serif }}>{step.num}</div>
                <div className="w-10 h-10 mx-auto flex items-center justify-center text-gray-400">
                  {step.icon}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{t(step.key, language)}</p>
              </motion.div>
            ))}
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12 text-sm text-gray-400 italic"
            style={{ fontFamily: serif }}
          >
            {t('privilege.noFees', language)}
          </motion.p>
        </div>
      </section>

      {/* Gold divider */}
      <div className="max-w-xl mx-auto px-8">
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}35, transparent)` }} />
      </div>

      {/* SECTION 5 — TIER COMPARISON TABLE */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-2xl sm:text-4xl font-light text-gray-900" style={{ fontFamily: serif }}>
              {t('privilege.tierCompareTitle', language)}
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100"
          >
            <table className="w-full min-w-[700px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="text-start p-4 text-xs uppercase tracking-wider text-gray-300 font-medium" style={{ borderBottom: '1px solid #f0f0f0' }}></th>
                  {PRESTIGE_TIERS.map((tier) => (
                    <th
                      key={tier.key}
                      className="p-4 text-center text-[11px] uppercase tracking-wider font-semibold"
                      style={{
                        borderBottom: `2px solid ${tier.key === 'blackReserve' || tier.key === 'privilege' ? gold : '#e5e5e5'}`,
                        color: tier.key === 'blackReserve' || tier.key === 'privilege' ? gold : '#6b7280',
                        fontFamily: serif,
                      }}
                    >
                      {t(tier.nameKey, language)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, ri) => (
                  <tr key={ri} className="bg-white">
                    <td className="p-4 text-sm text-gray-600 font-medium" style={{ borderBottom: '1px solid #f5f5f5' }}>
                      {t(row.key, language)}
                    </td>
                    {row.values.map((val, ci) => (
                      <td
                        key={ci}
                        className="p-4 text-center"
                        style={{ borderBottom: '1px solid #f5f5f5' }}
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

      {/* SECTION 6 — EMOTIONAL STORYTELLING */}
      <section className="py-24 sm:py-32">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-8">
            <div className="w-px h-10 mx-auto" style={{ background: `linear-gradient(to bottom, transparent, ${gold}60, transparent)` }} />
            <h2 className="text-2xl sm:text-3xl font-light text-gray-900" style={{ fontFamily: serif }}>
              {t('privilege.storyTitle', language)}
            </h2>
            <p className="text-gray-400 leading-loose text-base sm:text-lg" style={{ fontFamily: serif }}>
              {t('privilege.storyText', language)}
            </p>
            <div className="w-px h-10 mx-auto" style={{ background: `linear-gradient(to bottom, transparent, ${gold}60, transparent)` }} />
          </motion.div>
        </div>
      </section>

      {/* SECTION 7 — FINAL CTA */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
            <h2 className="text-3xl sm:text-4xl font-light text-gray-900" style={{ fontFamily: serif }}>
              {t('privilege.ctaTitle', language)}
            </h2>
            <p className="text-gray-400 text-lg max-w-md mx-auto" style={{ fontFamily: serif }}>
              {t('privilege.ctaSubtitle', language)}
            </p>
            <Button
              className="px-12 py-4 text-sm font-semibold text-white hover:opacity-90 transition-opacity rounded-lg"
              style={{ background: '#0a0a0a' }}
              onClick={() => setLocation('/privilege')}
            >
              {t('privilege.activateButton', language)}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* FOOTER NOTE */}
      <section className="border-t border-gray-100/50 py-8 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-300">
            <Shield className="w-3.5 h-3.5" />
            <span>⁦Pet Wash™⁩ Privilege · {t('privilege.dataProtected', language)}</span>
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
    const map: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', diamond: '💠', emerald: '💚', royal: '👑' };
    return map[tier] || '🥉';
  };

  return (
    <Layout language={language} onLanguageChange={setLanguage}>
      <div className="min-h-screen bg-[#fafafa]" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* HERO WELCOME - Bright white with subtle pattern */}
        <section className="relative bg-white pt-12 sm:pt-16 pb-16 sm:pb-24 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center space-y-5 mb-12">
              <p className="text-[11px] uppercase tracking-[0.3em] font-medium text-gray-400">⁦PetWash™⁩ Privilege</p>
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
                      <div className="text-[11px] tracking-[0.2em] uppercase text-white/50">⁦Pet Wash™⁩</div>
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
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-gray-400 mb-2">⁦PetWash™⁩ Privilege</p>
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
                  {(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'emerald', 'royal'] as LoyaltyTier[]).map((tier, i) => {
                    const config = getTierConfig(tier);
                    const isCurrent = tier === tierProgress.currentTier;
                    const tierColors: Record<LoyaltyTier, { accent: string }> = {
                      bronze: { accent: '#CD7F32' },
                      silver: { accent: '#94A3B8' },
                      gold: { accent: '#D4AF37' },
                      platinum: { accent: '#9CA3AF' },
                      diamond: { accent: '#3B82F6' },
                      emerald: { accent: '#10B981' },
                      royal: { accent: '#8B5CF6' },
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
              <span>⁦Pet Wash™⁩ Privilege · {t('privilege.dataProtected', language)}</span>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
