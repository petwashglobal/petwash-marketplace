import { ArrowRight } from 'lucide-react';
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
    { id: '1', value: 100, image: roseFrontImg },
    { id: '2', value: 250, image: emeraldFrontImg },
    { id: '3', value: 500, image: platinumFrontImg },
    { id: '4', value: 1000, image: goldFrontImg }
  ];

  const formatValue = (value: number) => 
    value >= 1000 ? `₪${(value / 1000).toFixed(0)},000` : `₪${value}`;

  return (
    <section 
      id="gift-cards"
      className="py-16 sm:py-20 lg:py-24 bg-white relative overflow-hidden"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4 px-4">
            {t('giftCards.title', language)}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            {language === 'he' 
              ? 'המתנה המושלמת לאוהבי חיות מחמד' 
              : 'The perfect gift for pet lovers'}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
          {vouchers.map((voucher) => (
            <Link
              key={voucher.id}
              href="/egift"
              className="group relative block"
              data-testid={`gift-card-${voucher.value}`}
            >
              {voucher.value === 1000 && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                  <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
                    {language === 'he' ? 'הכי משתלם' : 'BEST VALUE'}
                  </span>
                </div>
              )}

              <div className="relative w-full aspect-[1.586/1] rounded-xl overflow-hidden shadow-xl transition-all duration-500 group-hover:shadow-2xl group-hover:scale-[1.03]">
                <img 
                  src={voucher.image}
                  alt={`${formatValue(voucher.value)} E-Gift Card`}
                  className="w-full h-full object-cover object-center transform transition-transform duration-500 group-hover:scale-105"
                  style={{ imageRendering: 'high-quality' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              <div className="mt-3 text-center">
                <p className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">
                  {formatValue(voucher.value)}
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
