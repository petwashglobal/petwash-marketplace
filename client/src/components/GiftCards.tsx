import { ArrowRight, Leaf, Gift } from 'lucide-react';
import { Link } from 'wouter';
import { t, type Language } from '@/lib/i18n';

import pinkCardFront from '@assets/IMG_2004_1770750271081.png';
import greenCardFront from '@assets/IMG_2002_1770750271081.png';
import blackCardFront from '@assets/IMG_1998_1770750271081.png';
import goldCardFront from '@assets/IMG_1996_1770750271081.png';

interface GiftCardsProps {
  language: Language;
}

const vouchers = [
  { id: '1', value: 100, tier: 'CLASSIC', image: pinkCardFront, label: 'Single Wash', labelHe: 'רחיצה בודדת' },
  { id: '2', value: 250, tier: 'PLUS', image: greenCardFront, label: '3 Washes', labelHe: '3 רחיצות' },
  { id: '3', value: 500, tier: 'PREMIUM', image: blackCardFront, label: '5 Washes', labelHe: '5 רחיצות' },
  { id: '4', value: 1000, tier: 'ELITE', image: goldCardFront, label: '10 Washes', labelHe: '10 רחיצות' }
];

const tierLabels: Record<string, Record<string, string>> = {
  CLASSIC: { en: 'Classic', he: 'קלאסי', ar: 'كلاسيك', ru: 'Классик', fr: 'Classique', es: 'Clásico' },
  PLUS: { en: 'Plus', he: 'פלוס', ar: 'بلس', ru: 'Плюс', fr: 'Plus', es: 'Plus' },
  PREMIUM: { en: 'Premium', he: 'פרימיום', ar: 'بريميوم', ru: 'Премиум', fr: 'Premium', es: 'Premium' },
  ELITE: { en: 'Maison', he: 'מזון', ar: 'ميزون', ru: 'Мезон', fr: 'Maison', es: 'Maison' },
};

const bestValueText: Record<string, string> = {
  en: 'Best Value', he: 'הכי משתלם', ar: 'أفضل قيمة', ru: 'Лучшая цена', fr: 'Meilleur prix', es: 'Mejor valor',
};

export function GiftCards({ language }: GiftCardsProps) {
  const formatValue = (value: number) => 
    value >= 1000 ? `${(value / 1000).toFixed(0)},000` : `${value}`;

  return (
    <section 
      id="gift-cards"
      className="py-20 sm:py-28 lg:py-32 relative overflow-hidden"
      style={{ background: '#FAFAF8' }}
    >
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, #000 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-14 sm:mb-20">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#c9a96e]" />
            <Gift className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.2} />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#c9a96e]" />
          </div>

          <p className="text-[10px] sm:text-[11px] tracking-[0.35em] uppercase mb-5 font-medium"
            style={{ color: '#c9a96e' }}>
            E-Gift Collection
          </p>

          <h2 
            className="text-3xl sm:text-4xl lg:text-[3.2rem] text-[#1a1a1a] mb-6 px-4 font-light leading-tight"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif", letterSpacing: '-0.03em' }}
          >
            {t('giftCards.title', language)}
          </h2>
          <p className="text-sm sm:text-[15px] text-[#888] max-w-md mx-auto leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
            {language === 'he' 
              ? 'המתנה המושלמת לאוהבי חיות מחמד' 
              : 'The perfect gift for pet lovers'}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-8 max-w-[1200px] mx-auto">
          {vouchers.map((voucher) => {
            const isElite = voucher.tier === 'ELITE';
            const isPremium = voucher.tier === 'PREMIUM';
            const tierLabel = tierLabels[voucher.tier]?.[language] || tierLabels[voucher.tier]?.en || voucher.tier;

            return (
              <Link
                key={voucher.id}
                href={`/egift?value=${voucher.value}`}
                className="group block"
                data-testid={`gift-card-${voucher.value}`}
              >
                <div className="relative overflow-hidden transition-all duration-500 bg-white hover:shadow-xl hover:shadow-black/[0.06]"
                  style={{
                    borderRadius: '6px',
                    border: isPremium ? '1.5px solid #c9a96e' : isElite ? '1.5px solid #c9a96e' : '1px solid #eee',
                  }}
                >
                  {isElite && (
                    <div className="absolute top-3 end-3 z-10">
                      <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase px-2.5 py-1 bg-[#c9a96e] text-white font-medium" style={{ borderRadius: '2px' }}>
                        {bestValueText[language] || bestValueText.en}
                      </span>
                    </div>
                  )}

                  <div className="relative overflow-hidden bg-gradient-to-b from-[#f8f8f6] to-[#f0eeea] p-4 sm:p-5 lg:p-6">
                    <div className="relative mx-auto" style={{ perspective: '1000px' }}>
                      <img 
                        src={voucher.image} 
                        alt={`PetWash™ ${voucher.label} E-Gift Card`}
                        className="w-full h-auto rounded-lg shadow-lg transition-transform duration-500 group-hover:scale-[1.03] group-hover:-translate-y-1"
                        style={{ 
                          filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.12))',
                          maxWidth: '280px',
                          margin: '0 auto',
                          display: 'block',
                        }}
                        loading="lazy"
                      />
                    </div>
                  </div>

                  <div className="px-4 sm:px-5 py-4 sm:py-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-medium ${
                        isElite || isPremium ? 'text-[#c9a96e]' : 'text-[#999]'
                      }`}>
                        {tierLabel}
                      </span>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] sm:text-xs text-[#999]">₪</span>
                        <span className="text-3xl sm:text-4xl lg:text-[2.8rem] font-light text-[#1a1a1a]"
                          style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em', lineHeight: 1 }}>
                          {formatValue(voucher.value)}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] mt-1.5 text-[#aaa]">
                        {language === 'he' ? voucher.labelHe : voucher.label} · E-Gift
                      </p>
                    </div>

                    <div className="w-full py-3 sm:py-3.5 text-[10px] sm:text-[11px] tracking-[0.18em] uppercase font-medium transition-all duration-300 flex items-center justify-center gap-2 bg-[#1a1a1a] text-white hover:bg-[#333]"
                      style={{ borderRadius: '2px' }}
                    >
                      {language === 'he' ? 'שלח מתנה' : 'Send Gift'}
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-16 sm:mt-24">
          <div className="flex items-center justify-center gap-4 mb-12">
            <div className="flex-1 max-w-[80px] h-px bg-gradient-to-r from-transparent to-[#ddd]" />
            <Leaf className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.2} />
            <div className="flex-1 max-w-[80px] h-px bg-gradient-to-l from-transparent to-[#ddd]" />
          </div>

          <div className="text-center">
            <Link
              href="/egift"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 text-[11px] tracking-[0.18em] uppercase font-medium border border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white transition-all duration-300"
              style={{ borderRadius: '2px' }}
              data-testid="button-shop-gift-cards"
            >
              {language === 'he' ? 'כל כרטיסי המתנה' : 'View All Gift Cards'}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
