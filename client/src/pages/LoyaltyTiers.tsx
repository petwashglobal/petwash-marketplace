import { useState } from 'react';
import { Link } from 'wouter';
import { Star, Crown, Award, Gem, Heart, Trophy, Medal, ArrowLeft, Sparkles, Check, Lock, ChevronRight } from 'lucide-react';
import { TIER_CONFIGS } from '@shared/schema-loyalty';

export default function LoyaltyTiers() {
  const [language] = useState(localStorage.getItem('petwash_lang') || 'he');
  const isHebrew = language === 'he';
  const currentTier = 'bronze';
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const tierIcons: Record<string, typeof Star> = {
    bronze: Medal,
    silver: Award,
    gold: Trophy,
    platinum: Gem,
    diamond: Sparkles,
    emerald: Heart,
    royal: Crown,
  };

  const tierGlows: Record<string, string> = {
    bronze: 'rgba(205,127,50,0.25)',
    silver: 'rgba(192,192,192,0.25)',
    gold: 'rgba(255,215,0,0.3)',
    platinum: 'rgba(139,92,246,0.3)',
    diamond: 'rgba(96,165,250,0.3)',
    emerald: 'rgba(52,211,153,0.3)',
    royal: 'rgba(201,169,110,0.4)',
  };

  const currentTierIndex = TIER_CONFIGS.findIndex(t => t.id === currentTier);

  return (
    <div
      dir={isHebrew || language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen"
      style={{ background: '#FFFFFF' }}
    >
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/loyalty">
          <a className="inline-flex items-center gap-2 text-[#C9A96E] hover:text-[#d4af37] transition-all duration-300 mb-8 group">
            <ArrowLeft className={`w-5 h-5 transition-transform duration-300 ${isHebrew ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
            <span className="text-sm font-medium">{isHebrew ? 'חזרה לנאמנות' : 'Back to Loyalty'}</span>
          </a>
        </Link>

        <div className="text-center mb-10">
          <img src="/brand/petwash-logo-white-bg.png" alt="⁦Pet Wash™⁩" className="h-12 mx-auto mb-6 opacity-90" />
          <div className="inline-flex items-center gap-2 mb-4">
            <Star className="w-6 h-6 text-[#C9A96E]" />
            <Sparkles className="w-5 h-5 text-[#C9A96E]/60" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1A1A1A] mb-3">
            {isHebrew ? 'מערכת 7 כוכבים' : '7-Star Tier System'}
          </h1>
          <p className="text-lg text-[#7A7068] max-w-2xl mx-auto">
            {isHebrew ? 'עלו בדרגות והרוויחו הטבות יוקרתיות בכל שלב' : 'Rise through the ranks and earn luxury benefits at every level'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-1 mb-10 overflow-x-auto py-2 px-1">
          {TIER_CONFIGS.map((tier, idx) => {
            const isReached = idx <= currentTierIndex;
            const isCurrent = tier.id === currentTier;
            return (
              <div key={tier.id} className="flex items-center">
                <button
                  onClick={() => setSelectedTier(selectedTier === tier.id ? null : tier.id)}
                  className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-500 shrink-0
                    ${isCurrent
                      ? 'ring-2 ring-[#C9A96E] ring-offset-2 ring-offset-white scale-110'
                      : isReached
                        ? 'opacity-100'
                        : 'opacity-40'
                    }
                  `}
                  style={{ background: isReached ? `${tier.color}30` : 'rgba(255,255,255,0.05)' }}
                >
                  <span className="text-lg">{tier.icon}</span>
                  {isCurrent && (
                    <span className="absolute -bottom-5 text-[9px] font-bold text-[#C9A96E] whitespace-nowrap">
                      {isHebrew ? 'כאן' : 'YOU'}
                    </span>
                  )}
                </button>
                {idx < TIER_CONFIGS.length - 1 && (
                  <div className={`w-4 sm:w-8 h-0.5 mx-0.5 transition-all duration-500 ${idx < currentTierIndex ? 'bg-[#C9A96E]' : 'bg-white/10'}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto pb-4 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex md:grid md:grid-cols-3 lg:grid-cols-4 gap-5 min-w-max md:min-w-0">
            {TIER_CONFIGS.map((tier, idx) => {
              const TierIcon = tierIcons[tier.id] || Star;
              const isActive = tier.id === currentTier;
              const isLocked = idx > currentTierIndex;
              const isExpanded = selectedTier === tier.id;
              const totalDiscount = 5 + tier.benefits.tierBonusPercent;

              return (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTier(isExpanded ? null : tier.id)}
                  className={`
                    w-[280px] md:w-auto p-6 rounded-2xl transition-all duration-500 cursor-pointer
                    bg-white border backdrop-blur-xl
                    ${isActive
                      ? 'border-[#C9A96E] shadow-[0_0_30px_rgba(201,169,110,0.15)]'
                      : isExpanded
                        ? `border-[rgba(201,169,110,0.4)]`
                        : 'border-[#E8E3D9] hover:border-[rgba(201,169,110,0.3)]'
                    }
                    ${isExpanded ? 'scale-[1.02] -translate-y-1' : 'hover:scale-[1.01]'}
                  `}
                  style={isExpanded ? { boxShadow: `0 0 40px ${tierGlows[tier.id] || 'rgba(201,169,110,0.15)'}` } : undefined}
                >
                  {isActive && (
                    <div className="mb-3">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r from-[#C9A96E] to-[#d4af37] text-[#0A0A0F] animate-pulse">
                        {isHebrew ? 'הדרגה שלך' : 'Your Tier'}
                      </span>
                    </div>
                  )}
                  {isLocked && !isActive && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-[#E8E3D9] text-[#9A9088]">
                        <Lock className="w-3 h-3" />
                        {isHebrew ? 'נעול' : 'Locked'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500"
                      style={{ background: `${tier.color}20`, boxShadow: isExpanded ? `0 0 20px ${tier.color}30` : 'none' }}
                    >
                      <span className="text-2xl">{tier.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[#1A1A1A] font-bold text-lg">{isHebrew ? tier.nameHe : tier.name}</h3>
                      <p className="text-[#8A8078] text-xs">{isHebrew ? tier.name : tier.nameHe}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-[#AAAAAA] transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>

                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-center">
                      <span className="text-[#7A7068] text-sm">{isHebrew ? 'נקודות נדרשות' : 'Points Required'}</span>
                      <span className="text-[#C9A96E] font-bold">{tier.threshold.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#7A7068] text-sm">{isHebrew ? 'הנחה' : 'Discount'}</span>
                      <span className="text-[#1A1A1A] font-semibold">{totalDiscount}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#7A7068] text-sm">{isHebrew ? 'מכפיל נקודות' : 'Multiplier'}</span>
                      <span className="text-[#1A1A1A] font-semibold">x{tier.benefits.pointsMultiplier}</span>
                    </div>
                    {tier.benefits.freeWashesPerYear > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#7A7068] text-sm">{isHebrew ? 'רחיצות חינם/שנה' : 'Free Washes/Year'}</span>
                        <span className="text-[#1A1A1A] font-semibold">{tier.benefits.freeWashesPerYear}</span>
                      </div>
                    )}
                  </div>

                  {isActive && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-[#8A8078] mb-1.5">
                        <span>{isHebrew ? 'התקדמות לדרגה הבאה' : 'Progress to next tier'}</span>
                        <span>25%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#E8E3D9] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: '25%', background: `linear-gradient(90deg, ${tier.color}, #C9A96E)` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className={`border-t border-[#E8E3D9] pt-4 space-y-2 transition-all duration-300 ${isExpanded ? 'opacity-100 max-h-[500px]' : 'opacity-70 max-h-[120px] overflow-hidden'}`}>
                    {tier.benefits.prioritySupport && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#C9A96E] flex-shrink-0" />
                        <span className="text-[#6A6A6A] text-xs">{isHebrew ? 'תמיכה בעדיפות' : 'Priority Support'}</span>
                      </div>
                    )}
                    {tier.benefits.exclusiveAccess && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#C9A96E] flex-shrink-0" />
                        <span className="text-[#6A6A6A] text-xs">{isHebrew ? 'גישה בלעדית לאירועים' : 'Exclusive Event Access'}</span>
                      </div>
                    )}
                    {tier.benefits.conciergeService && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#C9A96E] flex-shrink-0" />
                        <span className="text-[#6A6A6A] text-xs">{isHebrew ? 'שירות קונסיירז׳ אישי' : 'Personal Concierge Service'}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#C9A96E]/50 flex-shrink-0" />
                      <span className="text-[#8A8078] text-xs">
                        {isHebrew ? `בונוס יום הולדת: ${tier.benefits.birthdayBonus} נקודות` : `Birthday Bonus: ${tier.benefits.birthdayBonus} pts`}
                      </span>
                    </div>
                    {isExpanded && (
                      <>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#C9A96E]/50 flex-shrink-0" />
                          <span className="text-[#8A8078] text-xs">
                            {isHebrew ? 'שמפו טבעי - שמן עץ התה האוסטרלי' : 'Natural Australian Tea Tree Oil Shampoo'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#C9A96E]/50 flex-shrink-0" />
                          <span className="text-[#8A8078] text-xs">
                            {isHebrew ? 'תשלום ללא מגע - QR, NFC, Apple Pay' : 'Contactless Payment - QR, NFC, Apple Pay'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-12 p-8 rounded-2xl bg-white border border-[#E8E3D9] backdrop-blur-xl">
          <h2 className="text-2xl font-bold text-[#1A1A1A] text-center mb-8">
            {isHebrew ? 'איך צוברים נקודות' : 'How to Earn Points'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center group">
              <div className="w-14 h-14 rounded-xl bg-[rgba(201,169,110,0.1)] flex items-center justify-center mx-auto mb-3 transition-all duration-300 group-hover:bg-[rgba(201,169,110,0.2)] group-hover:scale-110">
                <Star className="w-7 h-7 text-[#C9A96E]" />
              </div>
              <h3 className="font-semibold text-[#1A1A1A] mb-1">{isHebrew ? 'כל רחיצה' : 'Every Wash'}</h3>
              <p className="text-[#8A8078] text-sm">{isHebrew ? '10 נקודות לכל ₪1' : '10 points per ₪1 spent'}</p>
            </div>
            <div className="text-center group">
              <div className="w-14 h-14 rounded-xl bg-[rgba(201,169,110,0.1)] flex items-center justify-center mx-auto mb-3 transition-all duration-300 group-hover:bg-[rgba(201,169,110,0.2)] group-hover:scale-110">
                <Award className="w-7 h-7 text-[#C9A96E]" />
              </div>
              <h3 className="font-semibold text-[#1A1A1A] mb-1">{isHebrew ? 'הפניית חברים' : 'Referrals'}</h3>
              <p className="text-[#8A8078] text-sm">{isHebrew ? '200 נקודות בונוס' : '200 bonus points'}</p>
            </div>
            <div className="text-center group">
              <div className="w-14 h-14 rounded-xl bg-[rgba(201,169,110,0.1)] flex items-center justify-center mx-auto mb-3 transition-all duration-300 group-hover:bg-[rgba(201,169,110,0.2)] group-hover:scale-110">
                <Gem className="w-7 h-7 text-[#C9A96E]" />
              </div>
              <h3 className="font-semibold text-[#1A1A1A] mb-1">{isHebrew ? 'אתגרים יומיים' : 'Daily Challenges'}</h3>
              <p className="text-[#8A8078] text-sm">{isHebrew ? 'נקודות ו-XP נוספים' : 'Extra points & XP'}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-[rgba(201,169,110,0.08)] to-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.15)] text-center">
          <p className="text-[#6A6A6A] text-sm mb-4">
            {isHebrew ? 'רוצים להתחיל לצבור נקודות ולעלות בדרגות?' : 'Ready to start earning points and climbing tiers?'}
          </p>
          <Link href="/sign-in">
            <a className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#C9A96E] to-[#d4af37] text-[#0A0A0F] font-semibold rounded-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(201,169,110,0.3)] hover:scale-105 active:scale-95">
              <Crown className="w-5 h-5" />
              <span>{isHebrew ? 'הצטרפו למועדון VIP' : 'Join VIP Club'}</span>
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
