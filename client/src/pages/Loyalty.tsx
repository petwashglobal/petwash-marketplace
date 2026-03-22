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
import diamondLogoBlack from "@assets/IMG_3269_1771249415226.png";

const gold = '#85C4CE';

const PRESTIGE_TIERS = [
  {
    key: 'member',
    nameKey: 'privilege.tierMember',
    descKey: 'privilege.tierMemberDesc',
    cardBg: 'linear-gradient(145deg, #9B59B6 0%, #8844AA 20%, #7B2D9E 45%, #6A1B93 70%, #5B1088 100%)',
    shine: 'linear-gradient(125deg, transparent 15%, rgba(255,255,255,0.18) 35%, rgba(255,255,255,0.28) 42%, transparent 55%)',
    labelColor: '#e8d5f5',
    tierNameColor: '#ffffff',
    borderColor: 'rgba(200,160,255,0.25)',
    shadowMain: '0 25px 60px rgba(91,16,136,0.40), 0 10px 25px rgba(91,16,136,0.25)',
    benefits: ['privilege.tierMemberBenefit1', 'privilege.tierMemberBenefit2'],
  },
  {
    key: 'signature',
    nameKey: 'privilege.tierSignature',
    descKey: 'privilege.tierSignatureDesc',
    cardBg: 'linear-gradient(145deg, #85C4CE 0%, #6AADB8 20%, #4F8FA0 45%, #3A7085 70%, #2A5568 100%)',
    shine: 'linear-gradient(125deg, transparent 15%, rgba(255,255,255,0.22) 35%, rgba(255,255,255,0.32) 42%, transparent 55%)',
    labelColor: '#D4EFF3',
    tierNameColor: '#ffffff',
    borderColor: 'rgba(133,196,206,0.30)',
    shadowMain: '0 25px 60px rgba(42,85,104,0.45), 0 10px 25px rgba(42,85,104,0.28)',
    benefits: ['privilege.tierSignatureBenefit1', 'privilege.tierSignatureBenefit2'],
  },
  {
    key: 'elite',
    nameKey: 'privilege.tierElite',
    descKey: 'privilege.tierEliteDesc',
    cardBg: 'linear-gradient(145deg, #27AE60 0%, #219A52 20%, #1B8A45 45%, #15793A 70%, #0D6830 100%)',
    shine: 'linear-gradient(125deg, transparent 15%, rgba(255,255,255,0.16) 35%, rgba(255,255,255,0.26) 42%, transparent 55%)',
    labelColor: '#b9f6ca',
    tierNameColor: '#ffffff',
    borderColor: 'rgba(100,255,160,0.22)',
    shadowMain: '0 25px 60px rgba(21,121,58,0.40), 0 10px 25px rgba(21,121,58,0.25)',
    benefits: ['privilege.tierEliteBenefit1', 'privilege.tierEliteBenefit2'],
  },
  {
    key: 'privilege',
    nameKey: 'privilege.tierPrivilege',
    descKey: 'privilege.tierPrivilegeDesc',
    cardBg: 'linear-gradient(145deg, #1E5799 0%, #1A4D8C 20%, #15407A 45%, #103468 70%, #0B2856 100%)',
    shine: 'linear-gradient(125deg, transparent 15%, rgba(255,255,255,0.14) 35%, rgba(255,255,255,0.24) 42%, transparent 55%)',
    labelColor: '#90CAF9',
    tierNameColor: '#ffffff',
    borderColor: 'rgba(100,180,255,0.22)',
    shadowMain: '0 25px 60px rgba(16,52,104,0.45), 0 10px 25px rgba(16,52,104,0.30)',
    benefits: ['privilege.tierPrivilegeBenefit1', 'privilege.tierPrivilegeBenefit2'],
  },
  {
    key: 'blackReserve',
    nameKey: 'privilege.tierBlackReserve',
    descKey: 'privilege.tierBlackReserveDesc',
    cardBg: 'linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 20%, #111111 45%, #080808 70%, #000000 100%)',
    shine: 'linear-gradient(125deg, transparent 15%, rgba(133,196,206,0.08) 35%, rgba(255,255,255,0.06) 42%, transparent 55%)',
    labelColor: gold,
    tierNameColor: '#ffffff',
    borderColor: `rgba(133,196,206,0.25)`,
    shadowMain: '0 25px 60px rgba(0,0,0,0.50), 0 10px 25px rgba(0,0,0,0.35)',
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
      <section className="relative pt-16 sm:pt-24 pb-10 sm:pb-14 overflow-hidden bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="space-y-5">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light text-gray-900 leading-[1.15] tracking-tight" style={{ fontFamily: serif }}>
              {t('privilege.heroHeadline', language)}
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 font-light max-w-lg mx-auto" style={{ fontFamily: serif }}>
              {t('privilege.heroSubheadline', language)}
            </p>
          </motion.div>

          {/* Hero Privilege Card — Ultra Premium Credit Card */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.9, ease: 'easeOut' }}
            className="relative mx-auto mt-14 mb-12 w-full px-4"
            style={{ maxWidth: '520px' }}
          >
            <div
              className="relative overflow-hidden w-full"
              style={{
                borderRadius: 'clamp(12px, 3.5vw, 18px)',
                border: '1px solid rgba(133,196,206,0.22)',
                boxShadow: '0 60px 120px rgba(0,0,0,0.40), 0 25px 50px rgba(0,0,0,0.30)',
                aspectRatio: '1.586 / 1',
              }}
            >
              {/* Full-bleed logo image as card background — covers entire card */}
              <img
                src={diamondLogoBlack}
                alt=""
                className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                style={{ borderRadius: 'clamp(12px, 3.5vw, 18px)' }}
              />

              {/* Card content grid: 3 rows — header / spacer / footer */}
              <div
                className="relative z-10 h-full"
                dir="ltr"
                style={{
                  display: 'grid',
                  gridTemplateRows: 'auto 1fr auto',
                  padding: 'clamp(16px, 5.5%, 28px) clamp(16px, 5.5%, 28px) clamp(14px, 4.5%, 22px)',
                }}
              >
                {/* ROW 1: Top header — title + chip */}
                <div className="flex items-start justify-between">
                  <div>
                    <div style={{ fontSize: 'clamp(8px, 2.2%, 11px)', color: gold, letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
                      PRIVILEGE LOYALTY CARD
                    </div>
                    <div style={{ fontSize: 'clamp(6px, 1.6%, 8px)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '2px', fontWeight: 400 }}>
                      PetWash™ Exclusive Member
                    </div>
                  </div>
                  {/* Gold chip — scales with card */}
                  <div
                    className="rounded-md flex-shrink-0"
                    style={{
                      width: 'clamp(32px, 8.5%, 42px)',
                      height: 'clamp(24px, 6.5%, 32px)',
                      background: 'linear-gradient(145deg, #D4EFF3 0%, #A8C4CE 25%, #85C4CE 50%, #6AADB8 75%, #A8C4CE 100%)',
                      border: '1px solid rgba(133,196,206,0.5)',
                      boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.15), 0 3px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div className="w-full h-full rounded-md" style={{ background: 'linear-gradient(90deg, transparent 28%, rgba(0,0,0,0.06) 30%, rgba(0,0,0,0.06) 33%, transparent 35%, transparent 65%, rgba(0,0,0,0.06) 67%, rgba(0,0,0,0.06) 70%, transparent 72%)' }}>
                      <div className="w-full h-full" style={{ background: 'linear-gradient(0deg, transparent 38%, rgba(0,0,0,0.06) 40%, rgba(0,0,0,0.06) 43%, transparent 45%, transparent 55%, rgba(0,0,0,0.06) 57%, rgba(0,0,0,0.06) 60%, transparent 62%)' }} />
                    </div>
                  </div>
                </div>

                {/* ROW 2: Spacer — logo image fills this naturally */}
                <div />

                {/* ROW 3: Bottom footer — card number, holder, valid thru */}
                <div>
                  <div
                    style={{
                      fontSize: 'clamp(14px, 3.9%, 20px)',
                      color: '#ffffff',
                      fontFamily: 'ui-monospace, "SF Mono", Monaco, "Cascadia Mono", monospace',
                      letterSpacing: '0.22em',
                      fontWeight: 400,
                      marginBottom: 'clamp(6px, 2%, 12px)',
                    }}
                  >
                    5678 9012 3456 7890
                  </div>
                  {/* Gold divider line */}
                  <div style={{
                    height: '1px',
                    marginBottom: 'clamp(6px, 2%, 12px)',
                    background: `linear-gradient(90deg, ${gold}40, ${gold}15, transparent)`,
                  }} />
                  <div className="flex items-end justify-between">
                    <div>
                      <div style={{ fontSize: 'clamp(5px, 1.5%, 8px)', color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '2px' }}>
                        CARD HOLDER
                      </div>
                      <div
                        style={{
                          fontSize: 'clamp(10px, 2.8%, 14px)',
                          color: '#ffffff',
                          textTransform: 'uppercase',
                          letterSpacing: '0.14em',
                          fontWeight: 500,
                        }}
                      >
                        MRS. L. PAWSHINGTON
                      </div>
                    </div>
                    <div style={{ textAlign: 'end' }}>
                      <div style={{ fontSize: 'clamp(5px, 1.5%, 8px)', color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '2px' }}>
                        VALID THRU
                      </div>
                      <div
                        style={{
                          fontSize: 'clamp(11px, 3%, 15px)',
                          color: '#ffffff',
                          fontFamily: 'ui-monospace, monospace',
                          letterSpacing: '0.15em',
                          fontWeight: 500,
                        }}
                      >
                        12/28
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Diamond style={{ width: 'clamp(14px, 3.5%, 20px)', height: 'clamp(14px, 3.5%, 20px)', color: gold, opacity: 0.6 }} />
                    </div>
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
              style={{ background: 'linear-gradient(90deg, #c9a96e, #d4af37)', color: '#0f0d08' }}
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

      {/* SECTION 2 — MEMBERSHIP TIERS */}
      <section id="membership-tiers" className="py-12 sm:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-4xl font-light text-gray-900 text-center mb-14"
            style={{ fontFamily: serif }}
          >
            {t('privilege.membershipTiers', language)}
          </motion.h2>

          <div className="space-y-8">
            {[...PRESTIGE_TIERS].reverse().map((tier, i) => {
              const isBlack = tier.key === 'blackReserve';
              return (
                <motion.div
                  key={tier.key}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.6, ease: 'easeOut' }}
                  className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 group"
                >
                  <div
                    className="relative overflow-hidden transition-all duration-500 group-hover:-translate-y-1 group-hover:scale-[1.02] cursor-default flex-shrink-0"
                    style={{
                      background: tier.cardBg,
                      borderRadius: '16px',
                      border: `1px solid ${tier.borderColor}`,
                      boxShadow: tier.shadowMain + ', inset 0 1px 0 rgba(255,255,255,0.08)',
                      width: '280px',
                      height: '176px',
                      padding: '22px 20px 16px',
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-70 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                      style={{ background: tier.shine }}
                    />

                    <div
                      className="absolute pointer-events-none select-none flex items-center justify-center"
                      style={{
                        bottom: '10px',
                        right: '12px',
                        width: '70px',
                        height: '70px',
                        opacity: isBlack ? 0.12 : 0.10,
                      }}
                    >
                      <Diamond className="w-12 h-12" style={{ color: tier.labelColor }} />
                    </div>

                    <div className="relative z-10 h-full flex flex-col justify-between" dir="ltr">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[10px] tracking-[0.22em] font-semibold" style={{ color: tier.labelColor, fontFamily: serif }}>
                            PetWash™
                          </div>
                          <div className="text-[8px] tracking-[0.25em] uppercase mt-0.5 font-light" style={{ color: tier.labelColor, opacity: 0.6 }}>
                            PRIVILEGE CLUB
                          </div>
                        </div>
                        <div
                          className="w-7 h-7 flex items-center justify-center rounded-md"
                          style={{
                            border: `1px solid ${tier.borderColor}`,
                            background: 'rgba(255,255,255,0.06)',
                          }}
                        >
                          {tier.key === 'member' && <ChevronRight className="w-3.5 h-3.5" style={{ color: tier.labelColor }} />}
                          {tier.key === 'signature' && <Star className="w-3.5 h-3.5" style={{ color: tier.labelColor }} />}
                          {tier.key === 'elite' && <Crown className="w-3.5 h-3.5" style={{ color: tier.labelColor }} />}
                          {tier.key === 'privilege' && <Diamond className="w-3.5 h-3.5" style={{ color: tier.labelColor }} />}
                          {tier.key === 'blackReserve' && <Shield className="w-3.5 h-3.5" style={{ color: gold }} />}
                        </div>
                      </div>
                      <div>
                        <div
                          className="h-px mb-2.5"
                          style={{ background: `linear-gradient(90deg, transparent, ${tier.labelColor}50, transparent)` }}
                        />
                        <div className="flex items-end justify-between">
                          <div
                            className="text-[13px] tracking-[0.2em] uppercase font-bold"
                            style={{ color: tier.tierNameColor, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                          >
                            {t(tier.nameKey, language)}
                          </div>
                          <div className="text-[8px] font-mono tracking-widest" style={{ color: tier.labelColor, opacity: 0.4 }}>
                            PWP ••••
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center sm:text-start space-y-2 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: serif }}>
                      {t(tier.nameKey, language)}
                    </h3>
                    {tier.benefits.map((bKey, bi) => (
                      <div key={bi} className="flex items-center gap-2 justify-center sm:justify-start">
                        <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: gold }} />
                        <p className="text-sm text-gray-500">
                          {t(bKey, language)}
                        </p>
                      </div>
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
      <section className="py-12 sm:py-16">
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
      <section className="py-12 sm:py-16">
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
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-8">
            <h2 className="text-2xl sm:text-4xl font-light text-gray-900" style={{ fontFamily: serif }}>
              {t('privilege.tierCompareTitle', language)}
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-xl shadow-sm border border-gray-100"
          >
            {/* Header row */}
            <div className="grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
              <div className="p-2 sm:p-3" style={{ borderBottom: '1px solid #f0f0f0' }} />
              {PRESTIGE_TIERS.map((tier) => {
                const headerColors: Record<string, string> = {
                  member: '#7B2D9E',
                  signature: '#937225',
                  elite: '#1B8A45',
                  privilege: '#15407A',
                  blackReserve: '#1a1a1a',
                };
                const c = headerColors[tier.key] || '#6b7280';
                return (
                  <div
                    key={tier.key}
                    className="p-1.5 sm:p-3 text-center text-[8px] sm:text-[11px] uppercase tracking-wider font-semibold flex items-center justify-center"
                    style={{
                      borderBottom: `2px solid ${c}`,
                      color: c,
                      fontFamily: serif,
                      wordBreak: 'break-word',
                      lineHeight: '1.2',
                    }}
                  >
                    {t(tier.nameKey, language)}
                  </div>
                );
              })}
            </div>
            {/* Data rows */}
            {COMPARISON_ROWS.map((row, ri) => (
              <div key={ri} className="grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
                <div className="p-2 sm:p-3 text-[11px] sm:text-sm text-gray-600 font-medium flex items-center" style={{ borderBottom: '1px solid #f5f5f5' }}>
                  {t(row.key, language)}
                </div>
                {row.values.map((val, ci) => (
                  <div
                    key={ci}
                    className="p-1.5 sm:p-3 flex items-center justify-center"
                    style={{ borderBottom: '1px solid #f5f5f5' }}
                  >
                    {typeof val === 'boolean' ? (
                      val ? (
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: gold }} />
                      ) : (
                        <span className="text-gray-200 text-xs">—</span>
                      )
                    ) : (
                      <span className="text-[10px] sm:text-sm font-bold" style={{ color: val === '-' ? '#d4d4d8' : gold }}>{val}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SECTION 6 — EMOTIONAL STORYTELLING */}
      <section className="py-12 sm:py-16">
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
      <section className="py-12 sm:py-16 bg-white">
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
              style={{ background: 'linear-gradient(90deg, #c9a96e, #d4af37)', color: '#0f0d08' }}
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
        <div className="min-h-screen flex items-center justify-center bg-white">
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #c9a96e 0%, #d4af37 100%)', borderRadius: '2px' }}>
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
      <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>

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
                  background: 'radial-gradient(circle at 10% -10%, rgba(255,255,255,0.24), transparent 55%), radial-gradient(circle at 95% 110%, rgba(133,196,206,0.15), transparent 55%), linear-gradient(135deg, #05070a, #121b2a 60%, #1a2e3a 100%)',
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
        <section className="bg-white py-14 border-t border-gray-100">
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
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ borderRadius: '2px', background: 'rgba(201,169,110,0.15)' }}>
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
                  style={{ borderRadius: '2px', background: 'linear-gradient(90deg, #c9a96e, #d4af37)', color: '#0f0d08', padding: '14px 24px' }}
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
                      bronze: { accent: '#8E9EA8' },
                      silver: { accent: '#94A3B8' },
                      gold: { accent: '#85C4CE' },
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
                          background: isCurrent ? 'white' : '#FFFFFF',
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
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center" style={{ background: 'linear-gradient(145deg, #1a1208 0%, #2a1e0a 40%, #1a1208 100%)', borderRadius: '50%', boxShadow: '0 0 0 1px rgba(212,175,55,0.35), 0 8px 32px rgba(201,169,110,0.25)' }}>
                <Crown className="w-9 h-9" style={{ color: '#d4af37' }} />
                <Sparkles className="absolute top-1 right-1 w-3.5 h-3.5" style={{ color: '#c9a96e', opacity: 0.8 }} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('loyalty.title', language)}
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">{t('loyalty.subtitle', language)}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link href="/privilege">
                  <Button className="px-8 py-3 text-sm font-bold" style={{ borderRadius: '2px', background: 'linear-gradient(90deg, #c9a96e, #d4af37)', color: '#0f0d08' }}>
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
