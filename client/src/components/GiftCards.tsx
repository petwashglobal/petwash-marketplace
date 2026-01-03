import { Gift, Sparkles, Crown, Star, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { t, type Language } from '@/lib/i18n';

import roseFrontImg from '@assets/IMG_2004_1767477310445.png';
import emeraldFrontImg from '@assets/IMG_2002_1767477310445.png';
import platinumFrontImg from '@assets/IMG_1998_1767477310445.png';
import goldFrontImg from '@assets/IMG_1996_1767477310445.png';

interface GiftCardsProps {
  language: Language;
}

export function GiftCards({ language }: GiftCardsProps) {
  const vouchers = [
    {
      id: '1',
      name: "₪100 Credit",
      nameHe: "קרדיט ₪100",
      price: '100',
      colorVariant: "rose",
      image: roseFrontImg,
      description: "Perfect starter gift",
      descriptionHe: "מתנה מושלמת להתחלה"
    },
    {
      id: '2',
      name: "₪250 Credit",
      nameHe: "קרדיט ₪250",
      price: '250',
      colorVariant: "emerald",
      image: emeraldFrontImg,
      description: "Popular choice",
      descriptionHe: "הבחירה הפופולרית"
    },
    {
      id: '3',
      name: "₪500 Credit",
      nameHe: "קרדיט ₪500",
      price: '500',
      colorVariant: "platinum",
      image: platinumFrontImg,
      description: "Premium gift",
      descriptionHe: "מתנה פרימיום"
    },
    {
      id: '4',
      name: "₪1,000 Credit",
      nameHe: "קרדיט ₪1,000",
      price: '1000',
      colorVariant: "gold",
      image: goldFrontImg,
      description: "Ultimate luxury gift",
      descriptionHe: "מתנת היוקרה האולטימטיבית"
    }
  ];

  return (
    <section 
      id="gift-cards"
      className="py-16 sm:py-20 lg:py-24 bg-white relative overflow-hidden"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <div className="inline-flex items-center justify-center p-2 mb-4 sm:mb-6">
            <span className="px-4 py-2 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-full text-xs sm:text-sm font-semibold text-amber-800">
              {language === 'he' ? 'קרדיט לכל הפלטפורמות' : 'PLATFORM-WIDE CREDIT'}
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4 sm:mb-6 px-4">
            {t('giftCards.title', language)}
          </h2>
          
          <p className="text-lg sm:text-xl lg:text-2xl text-black max-w-3xl mx-auto leading-relaxed mb-2 sm:mb-4 px-4">
            {t('giftCards.subtitle', language)}
          </p>
          
          <p className="text-base sm:text-lg text-black max-w-2xl mx-auto italic px-4">
            {language === 'he' ? 'השתמש בכל פלטפורמות Pet Wash™' : 'Use at all Pet Wash™ platforms'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-6 max-w-7xl mx-auto">
          {vouchers.map((voucher) => (
            <Link
              key={voucher.id}
              href="/egift"
              className="group relative transform transition-all duration-300 hover:scale-105 block"
              data-testid={`gift-card-${voucher.price}`}
            >
              {voucher.price === '1000' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                  <div className="px-4 sm:px-6 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs sm:text-sm font-bold rounded-full shadow-lg">
                    {language === 'he' ? 'הכי משתלם' : 'BEST VALUE'}
                  </div>
                </div>
              )}

              <div className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl mb-4">
                <img 
                  src={voucher.image}
                  alt={`${voucher.name} E-Gift Card`}
                  className="w-full h-full object-cover object-center"
                  loading="lazy"
                />
              </div>

              <div className="text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                  {language === 'he' ? voucher.nameHe : voucher.name}
                </h3>
                <p className="text-lg font-semibold text-gray-700 mb-1">
                  {language === 'he' ? 'קרדיט לכל הפלטפורמות' : 'Platform Credit'}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  {language === 'he' ? voucher.descriptionHe : voucher.description}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/egift"
            className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl"
            data-testid="button-shop-gift-cards"
          >
            {language === 'he' ? 'קנה כרטיס מתנה' : 'Shop Gift Cards'}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
