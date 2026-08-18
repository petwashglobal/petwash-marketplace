import { useState } from 'react';
import { Link } from 'wouter';
import { Cake, Gift, Sparkles, Heart, PartyPopper, Star, ArrowLeft, Crown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { PetWashIcon } from '@/components/PetWashIcon';
import { useSEO, pageSEO } from '@/lib/seo';

export default function LoyaltyBirthday() {
  useSEO(pageSEO.loyaltyBirthday);
  const [language] = useState(localStorage.getItem('petwash_lang') || 'he');
  const isHebrew = language === 'he';

  // PR-LOYALTY-BIRTHDAY-COPY-TRUTH (2026-08-15) — fire-order item 40.
  // Backend implementation of the birthday programme (server/birthday-coupon.ts)
  // is exactly ONE thing: a 10% discount coupon, valid inside a 30-day window
  // around the member's birthday, once per year, applied to K9000 wash
  // transactions (K9000TransactionService.ts:226 discountApplied =
  // birthdayDiscount.discountPercent). None of the other pre-launch marketing
  // items on this page (double points, gift package, pet rewards, VIP session)
  // have any backend implementation. Aligned the LIVE row to the real benefit
  // and marked the other four rows as planned so members are not promised
  // benefits that don't ship. Do NOT delete the aspirational rows outright —
  // they read as the CEO's product roadmap the customer can look forward to;
  // just brand them Coming Soon so today's promise is honest.
  const rewards = [
    {
      icon: Gift,
      // The ONE benefit that is live today (10% discount within a 30-day
      // window around the member's birthday, once per year). Replaces the
      // pre-fix aspirational row 1 that promised a complimentary premium
      // wash — no such coupon is issued by the backend today.
      title: isHebrew ? 'הנחת יום הולדת 10%' : '10% Birthday Discount',
      subtitle: isHebrew ? '10% Birthday Discount' : 'הנחת יום הולדת 10%',
      description: isHebrew
        ? 'הנחה של 10% על שטיפת K9000, חלון של 30 יום סביב יום ההולדת שלכם, פעם בשנה.'
        : '10% off a K9000 wash, valid inside a 30-day window around your birthday, once per year.',
      tier: isHebrew ? 'כל החברים' : 'All Members',
      live: true,
    },
    {
      icon: Sparkles,
      title: isHebrew ? 'נקודות כפולות' : 'Double Points',
      subtitle: isHebrew ? 'Double Points' : 'נקודות כפולות',
      description: isHebrew ? 'הטבה מתוכננת — בהמשך.' : 'Planned benefit — coming soon.',
      tier: isHebrew ? 'כסף+' : 'Silver+',
      live: false,
    },
    {
      icon: PartyPopper,
      title: isHebrew ? 'מתנת יום הולדת בלעדית' : 'Exclusive Birthday Gift',
      subtitle: isHebrew ? 'Exclusive Birthday Gift' : 'מתנת יום הולדת בלעדית',
      description: isHebrew ? 'הטבה מתוכננת — בהמשך.' : 'Planned benefit — coming soon.',
      tier: isHebrew ? 'זהב+' : 'Gold+',
      live: false,
    },
    {
      icon: Heart,
      title: isHebrew ? 'הטבות יום הולדת לחיית מחמד' : 'Pet Birthday Rewards',
      subtitle: isHebrew ? 'Pet Birthday Rewards' : 'הטבות יום הולדת לחיית מחמד',
      description: isHebrew ? 'הטבה מתוכננת — בהמשך.' : 'Planned benefit — coming soon.',
      tier: isHebrew ? 'כל החברים' : 'All Members',
      live: false,
    },
    {
      icon: Star,
      title: isHebrew ? 'חוויית VIP ליום הולדת' : 'VIP Birthday Experience',
      subtitle: isHebrew ? 'VIP Birthday Experience' : 'חוויית VIP ליום הולדת',
      description: isHebrew ? 'הטבה מתוכננת — בהמשך.' : 'Planned benefit — coming soon.',
      tier: isHebrew ? 'מלכותי' : 'Royal',
      live: false,
    },
  ];

  const steps = [
    {
      num: '1',
      title: isHebrew ? 'הוסיפו את יום ההולדת' : 'Add Your Birthday',
      subtitle: isHebrew ? 'Add Your Birthday' : 'הוסיפו את יום ההולדת',
      description: isHebrew ? 'הוסיפו את יום ההולדת שלכם ושל חיות המחמד לפרופיל' : 'Add your birthday and your pets\' birthdays to your profile',
    },
    {
      num: '2',
      title: isHebrew ? 'התראה אוטומטית' : 'Automatic Notification',
      subtitle: isHebrew ? 'Automatic Notification' : 'התראה אוטומטית',
      description: isHebrew ? 'נשלח לכם הודעת יום הולדת מיוחדת עם ההטבות שלכם' : 'We\'ll send you a special birthday message with your rewards',
    },
    {
      num: '3',
      title: isHebrew ? 'ממשו וחגגו' : 'Redeem & Celebrate',
      subtitle: isHebrew ? 'Redeem & Celebrate' : 'ממשו וחגגו',
      description: isHebrew ? 'נצלו את הטבות יום ההולדת בכל זמן במהלך חודש יום ההולדת' : 'Use your birthday rewards anytime during your birthday month',
    },
  ];

  return (
    <div
      dir={isHebrew || language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen"
      style={{ background: '#FFFFFF' }}
    >
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/loyalty">
          <a className="inline-flex items-center gap-2 text-[#0a0a0a] hover:text-[#0a0a0a] transition-all duration-300 mb-8 group">
            <ArrowLeft className={`w-5 h-5 transition-transform duration-300 ${isHebrew ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
            <span className="text-sm font-medium">{isHebrew ? 'חזרה לנאמנות' : 'Back to Loyalty'}</span>
          </a>
        </Link>

        <div className="text-center mb-12">
          <img src="/brand/petwash-logo-white-bg.png" alt="⁦PetWash™⁩" className="h-12 mx-auto mb-6 opacity-90" />
          <div className="w-16 h-16 rounded-2xl bg-[rgba(236,72,153,0.1)] border border-[rgba(236,72,153,0.2)] flex items-center justify-center mx-auto mb-4">
            <Cake className="w-8 h-8 text-[#D4AF37]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1A1A1A] mb-3">
            {isHebrew ? 'הטבות יום הולדת' : 'Birthday Rewards'}
          </h1>
          <p className="text-lg text-[#7A7068] max-w-2xl mx-auto">
            {isHebrew ? 'הפתעות אוטומטיות לחיות מחמד ובני אדם. חגגו את היום המיוחד שלכם!' : 'Automatic surprises for pets and humans. Celebrate your special day!'}
          </p>
        </div>

        <div className="p-8 md:p-12 rounded-2xl bg-white border border-[rgba(217, 184, 76,0.15)] backdrop-blur-xl text-center mb-12 shadow-[0_0_40px_rgba(217, 184, 76,0.05)]">
          <div className="max-w-2xl mx-auto">
            <div className="w-20 h-20 rounded-2xl bg-[rgba(217, 184, 76,0.1)] border border-[rgba(217, 184, 76,0.2)] flex items-center justify-center mx-auto mb-6">
              <PartyPopper className="w-10 h-10 text-[#0a0a0a]" />
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-[#1A1A1A] mb-4">
              {isHebrew ? 'חגגו את היום המיוחד שלכם' : 'Celebrate Your Special Day'}
            </h2>
            <p className="text-[#7A7068] mb-8 leading-relaxed">
              {isHebrew
                ? 'כל יום הולדת מיוחד בפט וואש! אנחנו חוגגים אוטומטית גם לכם וגם לחיות המחמד שלכם עם הטבות בלעדיות, רחיצות חינם והפתעות מיוחדות.'
                : 'Every birthday is special at Pet Wash! We automatically celebrate both you and your pets\' birthdays with exclusive rewards, free washes, and special surprises.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-white border border-[#E8E3D9]">
                <p className="text-3xl mb-2">🎂</p>
                <p className="font-semibold text-[#1A1A1A] text-sm">{isHebrew ? 'יום ההולדת שלך' : 'Your Birthday'}</p>
                <p className="text-[#8A8078] text-xs">{isHebrew ? 'הטבות חברי מועדון' : 'Special member rewards'}</p>
              </div>
              <div className="p-4 rounded-xl bg-white border border-[#E8E3D9]">
                <p className="mb-2"><PetWashIcon name="brand_paw" size={30} label={isHebrew ? 'יום הולדת חיית מחמד' : "Pet's Birthday"} /></p>
                <p className="font-semibold text-[#1A1A1A] text-sm">{isHebrew ? 'יום הולדת חיית מחמד' : "Pet's Birthday"}</p>
                <p className="text-[#8A8078] text-xs">{isHebrew ? 'חטיפים וצעצועים' : 'Treats & toys included'}</p>
              </div>
              <div className="p-4 rounded-xl bg-white border border-[#E8E3D9]">
                <p className="mb-2"><PetWashIcon name="brand_sparkle" size={30} label={isHebrew ? 'אוטומטי' : 'Automatic'} /></p>
                <p className="font-semibold text-[#1A1A1A] text-sm">{isHebrew ? 'אוטומטי' : 'Automatic'}</p>
                <p className="text-[#8A8078] text-xs">{isHebrew ? 'ללא צורך בפעולה' : 'No action needed'}</p>
              </div>
            </div>

            {/* Was a dead button (no onClick). Birthday rewards need each pet's
                date of birth — send the member to pet management to add/edit it. */}
            <Link href="/pets">
              <Button className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#D9B84C] to-[#D9B84C] text-[#0A0A0F] font-semibold rounded-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(217, 184, 76,0.3)] hover:scale-105" data-testid="button-setup-birthday">
                <Gift className="w-5 h-5" />
                <span>{isHebrew ? 'הגדירו הטבות יום הולדת' : 'Set Up Birthday Rewards'}</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[#1A1A1A] text-center mb-8">
            {isHebrew ? 'הטבות יום הולדת לפי דרגה' : 'Birthday Rewards by Tier'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rewards.map((reward, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-[#E8E3D9] backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-[rgba(236,72,153,0.3)] group"
              >
                <div className="w-12 h-12 rounded-xl bg-[rgba(236,72,153,0.1)] flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-[rgba(236,72,153,0.2)]">
                  <reward.icon className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-[#1A1A1A] font-bold text-lg">{reward.title}</h3>
                  {/* PR-LOYALTY-BIRTHDAY-COPY-TRUTH: coming-soon tag so
                      planned benefits don't read as live promises. */}
                  {!reward.live && (
                    <span className="text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 border border-amber-200 text-amber-700 rounded-sm">
                      {isHebrew ? 'בקרוב' : 'Coming Soon'}
                    </span>
                  )}
                </div>
                <p className="text-[#9A9088] text-xs mb-3">{reward.subtitle}</p>
                <p className="text-[#7A7068] text-sm mb-4 leading-relaxed">{reward.description}</p>
                <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-[rgba(217, 184, 76,0.1)] text-[#0a0a0a] border border-[rgba(217, 184, 76,0.2)]">
                  {reward.tier}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-white border border-[#E8E3D9] backdrop-blur-xl">
          <h2 className="text-2xl font-bold text-[#1A1A1A] text-center mb-8">
            {isHebrew ? 'איך זה עובד' : 'How It Works'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#D9B84C] to-[#D9B84C] text-[#0A0A0F] font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="font-semibold text-[#1A1A1A] mb-1">{step.title}</h3>
                <p className="text-[#9A9088] text-xs mb-2">{step.subtitle}</p>
                <p className="text-[#8A8078] text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
