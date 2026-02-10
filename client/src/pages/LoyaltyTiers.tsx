import { useState } from 'react';
import { Link } from 'wouter';
import { Star, Crown, Award, Gem, Heart, Trophy, Medal, ArrowLeft, Sparkles, Check } from 'lucide-react';
import { TIER_CONFIGS } from '@shared/schema-loyalty';

export default function LoyaltyTiers() {
  const [language] = useState(localStorage.getItem('petwash_lang') || 'he');
  const isHebrew = language === 'he';
  const currentTier = 'bronze';

  const tierIcons: Record<string, typeof Star> = {
    bronze: Medal,
    silver: Award,
    gold: Trophy,
    platinum: Gem,
    diamond: Sparkles,
    emerald: Heart,
    royal: Crown,
  };

  return (
    <div
      dir={isHebrew || language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen"
      style={{ background: '#0A0A0F' }}
    >
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/loyalty">
          <a className="inline-flex items-center gap-2 text-[#C9A96E] hover:text-[#d4af37] transition-all duration-300 mb-8 group">
            <ArrowLeft className={`w-5 h-5 transition-transform duration-300 ${isHebrew ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
            <span className="text-sm font-medium">{isHebrew ? 'חזרה לנאמנות' : 'Back to Loyalty'}</span>
          </a>
        </Link>

        <div className="text-center mb-12">
          <img src="/brand/petwash-logo-black-bg.png" alt="Pet Wash™" className="h-12 mx-auto mb-6 opacity-90" />
          <div className="inline-flex items-center gap-2 mb-4">
            <Star className="w-6 h-6 text-[#C9A96E]" />
            <Sparkles className="w-5 h-5 text-[#C9A96E]/60" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            {isHebrew ? 'מערכת 7 כוכבים' : '7-Star Tier System'}
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            {isHebrew ? 'עלו בדרגות והרוויחו הטבות יוקרתיות בכל שלב' : 'Rise through the ranks and earn luxury benefits at every level'}
          </p>
        </div>

        <div className="overflow-x-auto pb-4 md:overflow-visible">
          <div className="flex md:grid md:grid-cols-3 lg:grid-cols-4 gap-5 min-w-max md:min-w-0">
            {TIER_CONFIGS.map((tier) => {
              const TierIcon = tierIcons[tier.id] || Star;
              const isActive = tier.id === currentTier;
              const totalDiscount = 5 + tier.benefits.tierBonusPercent;

              return (
                <div
                  key={tier.id}
                  className={`
                    w-[280px] md:w-auto p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1
                    bg-[rgba(232,230,240,0.03)] border backdrop-blur-xl
                    ${isActive
                      ? 'border-[#C9A96E] shadow-[0_0_30px_rgba(201,169,110,0.15)]'
                      : 'border-[rgba(232,230,240,0.08)] hover:border-[rgba(201,169,110,0.3)]'
                    }
                  `}
                >
                  {isActive && (
                    <div className="mb-3">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r from-[#C9A96E] to-[#d4af37] text-[#0A0A0F]">
                        {isHebrew ? 'הדרגה שלך' : 'Your Tier'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `${tier.color}20` }}
                    >
                      <span className="text-2xl">{tier.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">{isHebrew ? tier.nameHe : tier.name}</h3>
                      <p className="text-white/40 text-xs">{isHebrew ? tier.name : tier.nameHe}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-center">
                      <span className="text-white/50 text-sm">{isHebrew ? 'נקודות נדרשות' : 'Points Required'}</span>
                      <span className="text-[#C9A96E] font-bold">{tier.threshold.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/50 text-sm">{isHebrew ? 'הנחה' : 'Discount'}</span>
                      <span className="text-white font-semibold">{totalDiscount}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/50 text-sm">{isHebrew ? 'מכפיל נקודות' : 'Multiplier'}</span>
                      <span className="text-white font-semibold">x{tier.benefits.pointsMultiplier}</span>
                    </div>
                    {tier.benefits.freeWashesPerYear > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/50 text-sm">{isHebrew ? 'רחיצות חינם/שנה' : 'Free Washes/Year'}</span>
                        <span className="text-white font-semibold">{tier.benefits.freeWashesPerYear}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[rgba(232,230,240,0.08)] pt-4 space-y-2">
                    {tier.benefits.prioritySupport && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#C9A96E] flex-shrink-0" />
                        <span className="text-white/60 text-xs">{isHebrew ? 'תמיכה בעדיפות' : 'Priority Support'}</span>
                      </div>
                    )}
                    {tier.benefits.exclusiveAccess && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#C9A96E] flex-shrink-0" />
                        <span className="text-white/60 text-xs">{isHebrew ? 'גישה בלעדית' : 'Exclusive Access'}</span>
                      </div>
                    )}
                    {tier.benefits.conciergeService && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#C9A96E] flex-shrink-0" />
                        <span className="text-white/60 text-xs">{isHebrew ? 'שירות קונסיירז׳' : 'Concierge Service'}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#C9A96E]/50 flex-shrink-0" />
                      <span className="text-white/40 text-xs">
                        {isHebrew ? `בונוס יום הולדת: ${tier.benefits.birthdayBonus} נקודות` : `Birthday Bonus: ${tier.benefits.birthdayBonus} pts`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-12 p-8 rounded-2xl bg-[rgba(232,230,240,0.03)] border border-[rgba(232,230,240,0.08)] backdrop-blur-xl">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            {isHebrew ? 'איך צוברים נקודות' : 'How to Earn Points'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl bg-[rgba(201,169,110,0.1)] flex items-center justify-center mx-auto mb-3">
                <Star className="w-7 h-7 text-[#C9A96E]" />
              </div>
              <h3 className="font-semibold text-white mb-1">{isHebrew ? 'כל רחיצה' : 'Every Wash'}</h3>
              <p className="text-white/40 text-sm">{isHebrew ? '10 נקודות לכל ₪1' : '10 points per ₪1 spent'}</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl bg-[rgba(201,169,110,0.1)] flex items-center justify-center mx-auto mb-3">
                <Award className="w-7 h-7 text-[#C9A96E]" />
              </div>
              <h3 className="font-semibold text-white mb-1">{isHebrew ? 'הפניית חברים' : 'Referrals'}</h3>
              <p className="text-white/40 text-sm">{isHebrew ? '200 נקודות בונוס' : '200 bonus points'}</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl bg-[rgba(201,169,110,0.1)] flex items-center justify-center mx-auto mb-3">
                <Gem className="w-7 h-7 text-[#C9A96E]" />
              </div>
              <h3 className="font-semibold text-white mb-1">{isHebrew ? 'אתגרים יומיים' : 'Daily Challenges'}</h3>
              <p className="text-white/40 text-sm">{isHebrew ? 'נקודות ו-XP נוספים' : 'Extra points & XP'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
