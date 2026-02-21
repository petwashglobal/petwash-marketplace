import { ArrowRight, Leaf, Gift, Lock } from 'lucide-react';
import { Link } from 'wouter';
import { t, type Language } from '@/lib/i18n';

import pinkCard from '@assets/IMG_3094_1770832584882.png';
import greenCard from '@assets/IMG_3091_1770832584882.png';
import blackCard from '@assets/IMG_3090_1770824592770.png';
import goldCard from '@assets/IMG_3089_1770824592770.png';

const cardImages: Record<string, string> = {
  CLASSIC: pinkCard,
  PLUS: greenCard,
  PREMIUM: blackCard,
  ELITE: goldCard,
};

interface GiftCardsProps {
  language: Language;
}

const vouchers = [
  { id: '1', value: 100, tier: 'CLASSIC', label: 'E-Gift Credit', labelHe: 'קרדיט מתנה' },
  { id: '2', value: 250, tier: 'PLUS', label: 'E-Gift Credit', labelHe: 'קרדיט מתנה' },
  { id: '3', value: 500, tier: 'PREMIUM', label: 'E-Gift Credit', labelHe: 'קרדיט מתנה' },
  { id: '4', value: 1000, tier: 'ELITE', label: 'E-Gift Credit', labelHe: 'קרדיט מתנה' }
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
      className="py-6 sm:py-10 lg:py-14 relative overflow-hidden"
      style={{ background: '#FAFAF8' }}
    >
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, #000 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-6 sm:mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-8 max-w-[1200px] mx-auto">
          {vouchers.map((voucher) => {
            const isElite = voucher.tier === 'ELITE';
            const isPremium = voucher.tier === 'PREMIUM';
            const tierLabel = tierLabels[voucher.tier]?.[language] || tierLabels[voucher.tier]?.en || voucher.tier;
            const cardImg = cardImages[voucher.tier] || cardImages.CLASSIC;

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

                  <div className="relative overflow-hidden bg-[#f5f5f3]" style={{ aspectRatio: '1120 / 928' }}>
                    <img
                      src={cardImg}
                      alt={`⁦PetWash™⁩ ${tierLabel} E-Gift Card - ₪${voucher.value}`}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </div>

                  <div className="px-3 sm:px-5 py-3 sm:py-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-medium ${
                        isElite || isPremium ? 'text-[#c9a96e]' : 'text-[#999]'
                      }`}>
                        {tierLabel}
                      </span>
                    </div>

                    <div className="mb-2 sm:mb-3">
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

        <div className="mt-8 sm:mt-10 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-3 h-3 text-[#c9a96e]" strokeWidth={1.5} />
            <span className="text-[9px] sm:text-[10px] tracking-[0.12em] uppercase text-[#999] font-medium">
              {language === 'he' ? 'אמצעי תשלום מאובטחים' : 'Secure Payment Methods'}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
            <img className="h-[20px] sm:h-[24px] w-auto object-contain" src="/pay/payment-methods.jpg" alt="Visa, Mastercard, American Express, Apple Pay, Google Pay" loading="lazy" />
            <img className="h-[14px] sm:h-[16px] w-auto object-contain" src="/pay/diners.jpg" alt="Diners Club" loading="lazy" />
          </div>
          <div className="flex items-center gap-2 px-4 py-1 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[8px] sm:text-[9px] font-bold text-white">
              Powered by <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">Nayax</span> Israel
            </span>
          </div>
        </div>

        <div className="mt-8 sm:mt-12">
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
