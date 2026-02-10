import { ArrowRight, Gift } from 'lucide-react';
import { Link } from 'wouter';
import { t, type Language } from '@/lib/i18n';

interface GiftCardsProps {
  language: Language;
}

const cardStyles = {
  rose: {
    gradient: 'linear-gradient(135deg, #FFB6C1 0%, #FF69B4 30%, #DB7093 70%, #C71585 100%)',
    textColor: '#FFFFFF',
    accentColor: '#FFF0F5'
  },
  emerald: {
    gradient: 'linear-gradient(135deg, #2E8B57 0%, #228B22 30%, #006400 70%, #004D00 100%)',
    textColor: '#FFFFFF',
    accentColor: '#98FB98'
  },
  platinum: {
    gradient: 'linear-gradient(135deg, #2D2D2D 0%, #1A1A1A 30%, #0D0D0D 70%, #000000 100%)',
    textColor: '#FFFFFF',
    accentColor: '#C0C0C0'
  },
  gold: {
    gradient: 'linear-gradient(135deg, #FFD700 0%, #DAA520 30%, #B8860B 70%, #8B6914 100%)',
    textColor: '#1A1A1A',
    accentColor: '#FFF8DC'
  }
};

const vouchers = [
  { id: '1', value: 100, color: 'rose' as const },
  { id: '2', value: 250, color: 'emerald' as const },
  { id: '3', value: 500, color: 'platinum' as const },
  { id: '4', value: 1000, color: 'gold' as const }
];

export function GiftCards({ language }: GiftCardsProps) {
  const formatValue = (value: number) => 
    value >= 1000 ? `₪${(value / 1000).toFixed(0)},000` : `₪${value}`;

  return (
    <section 
      id="gift-cards"
      className="py-8 sm:py-12 lg:py-16 bg-white relative overflow-hidden"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-6 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black mb-3 px-4">
            {t('giftCards.title', language)}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            {language === 'he' 
              ? 'המתנה המושלמת לאוהבי חיות מחמד' 
              : 'The perfect gift for pet lovers'}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 max-w-6xl mx-auto">
          {vouchers.map((voucher) => {
            const style = cardStyles[voucher.color];
            return (
              <Link
                key={voucher.id}
                href={`/egift?value=${voucher.value}`}
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

                <div 
                  className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl transition-all duration-500 group-hover:shadow-2xl group-hover:scale-[1.03]"
                  style={{ background: style.gradient }}
                >
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full" style={{
                      backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)'
                    }} />
                  </div>
                  
                  <div className="absolute top-3 sm:top-4 left-3 sm:left-4 flex items-center gap-1.5 sm:gap-2 pointer-events-none">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: style.accentColor }}>
                      <Gift className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: voucher.color === 'gold' ? '#8B6914' : '#333' }} />
                    </div>
                    <span className="text-xs sm:text-sm font-bold tracking-wider" style={{ color: style.textColor }}>
                      Pet Wash™
                    </span>
                  </div>

                  <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 pointer-events-none">
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight" style={{ color: style.textColor }}>
                      {formatValue(voucher.value)}
                    </p>
                    <p className="text-[10px] sm:text-xs font-medium opacity-80" style={{ color: style.textColor }}>
                      E-Gift Credit
                    </p>
                  </div>

                  <div className="absolute top-3 sm:top-4 right-3 sm:right-4 pointer-events-none">
                    <div className="w-8 h-5 sm:w-10 sm:h-6 rounded" style={{ 
                      background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 sm:mt-8 text-center">
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
