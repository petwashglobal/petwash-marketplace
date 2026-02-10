import { ArrowRight, Leaf, Gift, Check } from 'lucide-react';
import { Link } from 'wouter';
import { t, type Language } from '@/lib/i18n';

interface GiftCardsProps {
  language: Language;
}

const vouchers = [
  { id: '1', value: 100, tier: 'CLASSIC' },
  { id: '2', value: 250, tier: 'PLUS' },
  { id: '3', value: 500, tier: 'PREMIUM' },
  { id: '4', value: 1000, tier: 'ELITE' }
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-7 max-w-[1040px] mx-auto">
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
                <div className={`relative overflow-hidden transition-all duration-500 ${
                  isElite ? 'bg-[#1a1a1a]' : 'bg-white'
                }`}
                  style={{
                    borderRadius: '2px',
                    border: isPremium ? '1.5px solid #c9a96e' : isElite ? '1.5px solid #333' : '1px solid #eee',
                  }}
                >
                  {isPremium && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#c9a96e] via-[#e8d5b0] to-[#c9a96e]" />
                  )}

                  <div className="px-4 sm:px-5 pt-5 sm:pt-6 pb-4">
                    <div className="flex items-center justify-between mb-5 sm:mb-6">
                      <span className={`text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-medium ${
                        isElite || isPremium ? 'text-[#c9a96e]' : 'text-[#999]'
                      }`}>
                        {tierLabel}
                      </span>
                      {isElite && (
                        <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 bg-[#c9a96e] text-white font-medium" style={{ borderRadius: '1px' }}>
                          {bestValueText[language] || bestValueText.en}
                        </span>
                      )}
                    </div>

                    <div className="mb-5 sm:mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-[11px] sm:text-xs ${isElite ? 'text-[#888]' : 'text-[#999]'}`}>₪</span>
                        <span className={`text-4xl sm:text-5xl lg:text-[3.4rem] font-light ${
                          isElite ? 'text-white' : 'text-[#1a1a1a]'
                        }`}
                          style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em', lineHeight: 1 }}>
                          {formatValue(voucher.value)}
                        </span>
                      </div>
                      <p className={`text-[10px] sm:text-[11px] mt-2 tracking-[0.1em] uppercase ${isElite ? 'text-[#777]' : 'text-[#aaa]'}`}>
                        E-Gift Credit
                      </p>
                    </div>

                    <div className={`border-t ${isElite ? 'border-[#333]' : 'border-[#eee]'} pt-4 mb-4`}>
                      <div className={`space-y-2 ${isElite ? 'text-[#999]' : 'text-[#888]'}`}>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                          <span className="text-[10px] sm:text-[11px]">
                            {language === 'he' ? 'כל השירותים' : 'All services'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                          <span className="text-[10px] sm:text-[11px]">
                            {language === 'he' ? 'ללא צורך בחשבון' : 'No account needed'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                          <span className="text-[10px] sm:text-[11px]">
                            {language === 'he' ? 'משלוח מיידי' : 'Instant delivery'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`w-full py-3.5 sm:py-4 text-[10px] sm:text-[11px] tracking-[0.18em] uppercase font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                    isElite
                      ? 'bg-white text-[#1a1a1a] hover:bg-[#f5f5f5]'
                      : isPremium
                        ? 'bg-[#1a1a1a] text-white hover:bg-[#333]'
                        : 'bg-transparent text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white border-t border-[#eee]'
                  }`}>
                    {language === 'he' ? 'שלח מתנה' : 'Send Gift'}
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
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
