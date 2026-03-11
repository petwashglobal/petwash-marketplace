import { useState } from 'react';
import { Link } from 'wouter';
import { Cake, Gift, Sparkles, Heart, PartyPopper, Star, ArrowLeft, Crown } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function LoyaltyBirthday() {
  const [language] = useState(localStorage.getItem('petwash_lang') || 'he');
  const isHebrew = language === 'he';

  const rewards = [
    {
      icon: Gift,
      title: isHebrew ? 'רחיצה פרימיום חינם' : 'Free Premium Wash',
      subtitle: isHebrew ? 'Free Premium Wash' : 'רחיצה פרימיום חינם',
      description: isHebrew ? 'רחיצת פרימיום חינם בחודש יום ההולדת שלכם' : 'Complimentary premium wash on your birthday month',
      tier: isHebrew ? 'כל החברים' : 'All Members',
    },
    {
      icon: Sparkles,
      title: isHebrew ? 'נקודות כפולות' : 'Double Points',
      subtitle: isHebrew ? 'Double Points' : 'נקודות כפולות',
      description: isHebrew ? 'צברו X2 נקודות על כל הרחיצות בחודש יום ההולדת' : 'Earn 2x points on all washes during your birthday month',
      tier: isHebrew ? 'כסף+' : 'Silver+',
    },
    {
      icon: PartyPopper,
      title: isHebrew ? 'מתנת יום הולדת בלעדית' : 'Exclusive Birthday Gift',
      subtitle: isHebrew ? 'Exclusive Birthday Gift' : 'מתנת יום הולדת בלעדית',
      description: isHebrew ? 'חבילת מתנה מיוחדת ישירות עד הדלת' : 'Special surprise gift package delivered to your door',
      tier: isHebrew ? 'זהב+' : 'Gold+',
    },
    {
      icon: Heart,
      title: isHebrew ? 'הטבות יום הולדת לחיית מחמד' : 'Pet Birthday Rewards',
      subtitle: isHebrew ? 'Pet Birthday Rewards' : 'הטבות יום הולדת לחיית מחמד',
      description: isHebrew ? 'חטיפים וצעצועים מיוחדים ליום ההולדת של החיה שלכם' : 'Special treats and toys for your furry friends birthday',
      tier: isHebrew ? 'כל החברים' : 'All Members',
    },
    {
      icon: Star,
      title: isHebrew ? 'חוויית VIP ליום הולדת' : 'VIP Birthday Experience',
      subtitle: isHebrew ? 'VIP Birthday Experience' : 'חוויית VIP ליום הולדת',
      description: isHebrew ? 'סשן רחיצה פרטי עם שמפניה ופינוקים' : 'Private wash session with champagne and treats',
      tier: isHebrew ? 'מלכותי' : 'Royal',
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
          <a className="inline-flex items-center gap-2 text-[#C9A96E] hover:text-[#d4af37] transition-all duration-300 mb-8 group">
            <ArrowLeft className={`w-5 h-5 transition-transform duration-300 ${isHebrew ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
            <span className="text-sm font-medium">{isHebrew ? 'חזרה לנאמנות' : 'Back to Loyalty'}</span>
          </a>
        </Link>

        <div className="text-center mb-12">
          <img src="/brand/petwash-logo-white-bg.png" alt="⁦Pet Wash™⁩" className="h-12 mx-auto mb-6 opacity-90" />
          <div className="w-16 h-16 rounded-2xl bg-[rgba(236,72,153,0.1)] border border-[rgba(236,72,153,0.2)] flex items-center justify-center mx-auto mb-4">
            <Cake className="w-8 h-8 text-pink-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1A1A1A] mb-3">
            {isHebrew ? 'הטבות יום הולדת' : 'Birthday Rewards'}
          </h1>
          <p className="text-lg text-[#7A7068] max-w-2xl mx-auto">
            {isHebrew ? 'הפתעות אוטומטיות לחיות מחמד ובני אדם. חגגו את היום המיוחד שלכם!' : 'Automatic surprises for pets and humans. Celebrate your special day!'}
          </p>
        </div>

        <div className="p-8 md:p-12 rounded-2xl bg-[#F7F4EE] border border-[rgba(201,169,110,0.15)] backdrop-blur-xl text-center mb-12 shadow-[0_0_40px_rgba(201,169,110,0.05)]">
          <div className="max-w-2xl mx-auto">
            <div className="w-20 h-20 rounded-2xl bg-[rgba(201,169,110,0.1)] border border-[rgba(201,169,110,0.2)] flex items-center justify-center mx-auto mb-6">
              <PartyPopper className="w-10 h-10 text-[#C9A96E]" />
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
              <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#E8E3D9]">
                <p className="text-3xl mb-2">🎂</p>
                <p className="font-semibold text-[#1A1A1A] text-sm">{isHebrew ? 'יום ההולדת שלך' : 'Your Birthday'}</p>
                <p className="text-[#8A8078] text-xs">{isHebrew ? 'הטבות חברי מועדון' : 'Special member rewards'}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#E8E3D9]">
                <p className="text-3xl mb-2">🐾</p>
                <p className="font-semibold text-[#1A1A1A] text-sm">{isHebrew ? 'יום הולדת חיית מחמד' : "Pet's Birthday"}</p>
                <p className="text-[#8A8078] text-xs">{isHebrew ? 'חטיפים וצעצועים' : 'Treats & toys included'}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#E8E3D9]">
                <p className="text-3xl mb-2">✨</p>
                <p className="font-semibold text-[#1A1A1A] text-sm">{isHebrew ? 'אוטומטי' : 'Automatic'}</p>
                <p className="text-[#8A8078] text-xs">{isHebrew ? 'ללא צורך בפעולה' : 'No action needed'}</p>
              </div>
            </div>

            <Button className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#C9A96E] to-[#d4af37] text-[#0A0A0F] font-semibold rounded-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(201,169,110,0.3)] hover:scale-105">
              <Gift className="w-5 h-5" />
              <span>{isHebrew ? 'הגדירו הטבות יום הולדת' : 'Set Up Birthday Rewards'}</span>
            </Button>
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
                className="p-6 rounded-2xl bg-[#F7F4EE] border border-[#E8E3D9] backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-[rgba(236,72,153,0.3)] group"
              >
                <div className="w-12 h-12 rounded-xl bg-[rgba(236,72,153,0.1)] flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-[rgba(236,72,153,0.2)]">
                  <reward.icon className="w-6 h-6 text-pink-400" />
                </div>
                <h3 className="text-[#1A1A1A] font-bold text-lg mb-1">{reward.title}</h3>
                <p className="text-[#9A9088] text-xs mb-3">{reward.subtitle}</p>
                <p className="text-[#7A7068] text-sm mb-4 leading-relaxed">{reward.description}</p>
                <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-[rgba(201,169,110,0.1)] text-[#C9A96E] border border-[rgba(201,169,110,0.2)]">
                  {reward.tier}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-[#F7F4EE] border border-[#E8E3D9] backdrop-blur-xl">
          <h2 className="text-2xl font-bold text-[#1A1A1A] text-center mb-8">
            {isHebrew ? 'איך זה עובד' : 'How It Works'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#C9A96E] to-[#d4af37] text-[#0A0A0F] font-bold text-xl flex items-center justify-center mx-auto mb-4">
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
