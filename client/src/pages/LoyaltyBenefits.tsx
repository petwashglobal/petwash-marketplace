import { useState } from 'react';
import { Link } from 'wouter';
import { Sparkles, Calendar, Gift, Percent, Crown, Zap, Star, Heart, ArrowLeft } from 'lucide-react';

export default function LoyaltyBenefits() {
  const [language] = useState(localStorage.getItem('petwash_lang') || 'he');
  const isHebrew = language === 'he';

  const benefits = [
    {
      icon: Percent,
      title: isHebrew ? 'הנחות בלעדיות' : 'Exclusive Discounts',
      subtitle: isHebrew ? 'Exclusive Discounts' : 'הנחות בלעדיות',
      description: isHebrew ? 'חסכו עד 15% בכל הרחיצות בהתאם לדרגה שלכם' : 'Save up to 15% on all washes depending on your tier',
      tier: isHebrew ? 'כל הדרגות' : 'All Tiers',
    },
    {
      icon: Calendar,
      title: isHebrew ? 'הזמנה בעדיפות' : 'Priority Booking',
      subtitle: isHebrew ? 'Priority Booking' : 'הזמנה בעדיפות',
      description: isHebrew ? 'דלגו על התור עם גישה מועדפת לכל המשבצות' : 'Skip the wait with priority access to all time slots',
      tier: isHebrew ? 'פלטינום+' : 'Platinum+',
    },
    {
      icon: Gift,
      title: isHebrew ? 'רחיצות חינם' : 'Free Washes',
      subtitle: isHebrew ? 'Free Washes' : 'רחיצות חינם',
      description: isHebrew ? 'רחיצות חינם לאורך כל השנה בהתאם לדרגה' : 'Enjoy complimentary washes throughout the year',
      tier: isHebrew ? 'זהב+' : 'Gold+',
    },
    {
      icon: Crown,
      title: isHebrew ? 'אירועי VIP' : 'VIP Events',
      subtitle: isHebrew ? 'VIP Events' : 'אירועי VIP',
      description: isHebrew ? 'הזמנות בלעדיות לאירועים של חברי מועדון בלבד' : 'Exclusive invitations to member-only events',
      tier: isHebrew ? 'יהלום+' : 'Diamond+',
    },
    {
      icon: Zap,
      title: isHebrew ? 'שדרוגים חינם' : 'Free Upgrades',
      subtitle: isHebrew ? 'Free Upgrades' : 'שדרוגים חינם',
      description: isHebrew ? 'שדרוגים אוטומטיים לחבילות רחיצה פרימיום' : 'Automatic upgrades to premium wash packages',
      tier: isHebrew ? 'כסף+' : 'Silver+',
    },
    {
      icon: Sparkles,
      title: isHebrew ? 'שירות קונסיירז׳' : 'Concierge Service',
      subtitle: isHebrew ? 'Concierge Service' : 'שירות קונסיירז׳',
      description: isHebrew ? 'מנהל חשבון אישי לכל הצרכים שלכם' : 'Personal account manager for all your needs',
      tier: isHebrew ? 'אמרלד+' : 'Emerald+',
    },
    {
      icon: Star,
      title: isHebrew ? 'גישה מוקדמת' : 'Early Access',
      subtitle: isHebrew ? 'Early Access' : 'גישה מוקדמת',
      description: isHebrew ? 'היו הראשונים לנסות שירותים ותכונות חדשות' : 'Be first to try new services and features',
      tier: isHebrew ? 'פלטינום+' : 'Platinum+',
    },
    {
      icon: Heart,
      title: isHebrew ? 'הטבות יום הולדת' : 'Birthday Rewards',
      subtitle: isHebrew ? 'Birthday Rewards' : 'הטבות יום הולדת',
      description: isHebrew ? 'הפתעות מיוחדות לכם ולחיות המחמד ביום ההולדת' : 'Special treats for you and your pets on birthdays',
      tier: isHebrew ? 'כל הדרגות' : 'All Tiers',
    },
  ];

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

        <div className="text-center mb-12">
          <img src="/brand/petwash-logo-white-bg.png" alt="⁦Pet Wash™⁩" className="h-12 mx-auto mb-6 opacity-90" />
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-[#C9A96E]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1A1A1A] mb-3">
            {isHebrew ? 'הטבות ופריבילגיות' : 'Benefits & Privileges'}
          </h1>
          <p className="text-lg text-[#7A7068] max-w-2xl mx-auto">
            {isHebrew ? 'גלו את כל ההטבות הבלעדיות שמחכות לכם כחברי מועדון' : 'Discover all the exclusive benefits awaiting you as a club member'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-12">
          {benefits.map((benefit, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-[#F7F4EE] border border-[#E8E3D9] backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-[rgba(201,169,110,0.3)] group"
            >
              <div className="w-12 h-12 rounded-xl bg-[rgba(201,169,110,0.1)] flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-[rgba(201,169,110,0.2)]">
                <benefit.icon className="w-6 h-6 text-[#C9A96E]" />
              </div>

              <h3 className="text-[#1A1A1A] font-bold text-lg mb-1">{benefit.title}</h3>
              <p className="text-[#9A9088] text-xs mb-3">{benefit.subtitle}</p>
              <p className="text-[#7A7068] text-sm mb-4 leading-relaxed">{benefit.description}</p>

              <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-[rgba(201,169,110,0.1)] text-[#C9A96E] border border-[rgba(201,169,110,0.2)]">
                {benefit.tier}
              </span>
            </div>
          ))}
        </div>

        <div className="p-8 rounded-2xl bg-[#F7F4EE] border border-[#E8E3D9] backdrop-blur-xl text-center">
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-3">
            {isHebrew ? 'מוכנים ליהנות מהטבות בלעדיות?' : 'Ready to enjoy exclusive benefits?'}
          </h2>
          <p className="text-[#8A8078] mb-6 max-w-xl mx-auto">
            {isHebrew ? 'הצטרפו למועדון הנאמנות שלנו והתחילו לצבור נקודות והטבות מהרגע הראשון' : 'Join our loyalty club and start earning points and benefits from day one'}
          </p>
          <Link href="/loyalty">
            <a className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#C9A96E] to-[#d4af37] text-[#0A0A0F] font-semibold rounded-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(201,169,110,0.3)] hover:scale-105">
              <Crown className="w-5 h-5" />
              <span>{isHebrew ? 'הצטרפו עכשיו' : 'Join Now'}</span>
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
