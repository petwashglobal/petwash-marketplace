import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, ArrowRight, ArrowLeft, Leaf, Sparkles, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';

import pinkCardFront from '@assets/IMG_3094_1770832584882.png';
import greenCardFront from '@assets/IMG_3091_1770832584882.png';
import blackCardFront from '@assets/IMG_1998_1770750271081.png';
import goldCardFront from '@assets/IMG_1996_1770750271081.png';

const WASH_PRICE = 55;

interface PackageOption {
  washes: number;
  name: string;
  nameHe: string;
  discount: number;
  tier: string;
  image: string;
  features: { en: string; he: string }[];
  popular?: boolean;
}

const packageOptions: PackageOption[] = [
  { 
    washes: 1, 
    name: 'Essentials', 
    nameHe: 'בסיסי',
    discount: 0, 
    tier: 'CLASSIC',
    image: pinkCardFront,
    features: [
      { en: 'Single premium wash', he: 'רחיצה פרימיום בודדת' },
      { en: '100% organic shampoo', he: 'שמפו אורגני 100%' },
      { en: 'Valid 6 months', he: 'בתוקף 6 חודשים' },
    ]
  },
  { 
    washes: 3, 
    name: 'Silver', 
    nameHe: 'סילבר',
    discount: 5, 
    tier: 'POPULAR',
    image: greenCardFront,
    features: [
      { en: '3 premium washes', he: '3 רחיצות פרימיום' },
      { en: '5% discount', he: '5% הנחה' },
      { en: 'Valid 9 months', he: 'בתוקף 9 חודשים' },
      { en: 'Transferable', he: 'ניתן להעברה' },
    ],
    popular: true
  },
  { 
    washes: 5, 
    name: 'Premium', 
    nameHe: 'פרימיום',
    discount: 8, 
    tier: 'PREMIUM',
    image: blackCardFront,
    features: [
      { en: '5 premium washes', he: '5 רחיצות פרימיום' },
      { en: '8% discount', he: '8% הנחה' },
      { en: 'Priority booking', he: 'הזמנה בעדיפות' },
      { en: 'Valid 12 months', he: 'בתוקף 12 חודשים' },
    ]
  },
  { 
    washes: 10, 
    name: 'Maison Collection', 
    nameHe: 'קולקציית מזון',
    discount: 12, 
    tier: 'ELITE',
    image: goldCardFront,
    features: [
      { en: '10 premium washes', he: '10 רחיצות פרימיום' },
      { en: '12% discount', he: '12% הנחה' },
      { en: 'VIP treatment', he: 'טיפול VIP' },
      { en: '2x loyalty points', he: 'נקודות נאמנות כפולות' },
      { en: 'Valid 12 months', he: 'בתוקף 12 חודשים' },
    ]
  }
];

const tierLabels: Record<string, Record<string, string>> = {
  CLASSIC: { en: 'Essentials', he: 'בסיסי' },
  POPULAR: { en: 'Most Popular', he: 'הכי פופולרי' },
  PREMIUM: { en: 'Premium', he: 'פרימיום' },
  ELITE: { en: 'Maison Collection', he: 'קולקציית מזון' },
};

export default function Packages() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language } = useLanguage();
  const lang = language || 'he';
  const isHe = lang === 'he';

  const dir = ['he', 'ar'].includes(lang) ? 'rtl' : 'ltr';
  const isRtl = dir === 'rtl';
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const ForwardIcon = isRtl ? ArrowLeft : ArrowRight;

  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handlePackageClick = (pkg: PackageOption) => {
    setSelectedPackage(pkg);
  };

  const proceedToDetails = () => {
    if (!selectedPackage) {
      toast({ title: isHe ? "נא לבחור חבילה" : "Please select a package", variant: "destructive" });
      return;
    }
    setShowDetails(true);
  };

  const handlePurchase = () => {
    if (!selectedPackage) return;
    toast({ title: isHe ? "מעבד את הרכישה..." : "Processing your purchase...", description: isHe ? "מפנה לתשלום" : "Redirecting to payment" });
  };

  if (showDetails && selectedPackage) {
    const price = Math.round(selectedPackage.washes * WASH_PRICE * (1 - selectedPackage.discount / 100));
    const originalPrice = selectedPackage.washes * WASH_PRICE;
    const tierLabel = tierLabels[selectedPackage.tier]?.[lang] || tierLabels[selectedPackage.tier]?.en;

    return (
      <div className="min-h-screen bg-white" dir={dir}>
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
          <Button 
            variant="ghost" 
            onClick={() => setShowDetails(false)}
            className="mb-4 sm:mb-6 text-[#555] hover:text-[#1a1a1a]"
            data-testid="button-back"
          >
            <BackIcon className="w-4 h-4 me-1" />
            {isHe ? 'חזרה' : 'Back'}
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
            <div className="order-2 lg:order-1">
              <div className="border border-[#eee] p-5 sm:p-7" style={{ borderRadius: '2px' }}>
                <div className="mb-6">
                  <p className="text-[10px] tracking-[0.25em] uppercase text-[#c9a96e] font-medium mb-2">{tierLabel}</p>
                  <h2 className="text-2xl sm:text-3xl font-light text-[#1a1a1a]"
                    style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif" }}>
                    {isHe ? selectedPackage.nameHe : selectedPackage.name}
                  </h2>
                  <p className="text-[13px] text-[#888] mt-1">
                    {selectedPackage.washes} {isHe ? 'רחיצות פרימיום' : `Premium Wash${selectedPackage.washes > 1 ? 'es' : ''}`}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-[#999]">₪</span>
                    <span className="text-4xl sm:text-5xl font-light text-[#1a1a1a]"
                      style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em' }}>
                      {price}
                    </span>
                    {selectedPackage.discount > 0 && (
                      <span className="text-base text-[#bbb] line-through">₪{originalPrice}</span>
                    )}
                  </div>
                  {selectedPackage.discount > 0 && (
                    <p className="text-[11px] text-[#c9a96e] font-medium mt-1.5 tracking-wide">
                      {isHe ? `חסכת ₪${originalPrice - price} (${selectedPackage.discount}% הנחה)` : `You save ₪${originalPrice - price} (${selectedPackage.discount}% off)`}
                    </p>
                  )}
                </div>

                <div className="border-t border-[#eee] pt-5 mb-6">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-[#999] font-medium mb-3">
                    {isHe ? 'מה כולל:' : "What's Included:"}
                  </p>
                  <ul className="space-y-2.5">
                    {selectedPackage.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-[#555] text-[13px]">
                        <Check className="w-3.5 h-3.5 text-[#c9a96e] flex-shrink-0" strokeWidth={1.5} />
                        {isHe ? feature.he : feature.en}
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  className="w-full py-4 text-[11px] tracking-[0.18em] uppercase font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-all duration-300 flex items-center justify-center gap-2"
                  onClick={handlePurchase}
                  data-testid="button-purchase"
                  style={{ borderRadius: '2px' }}
                >
                  {isHe ? 'רכישה' : 'Buy Now'} — ₪{price}
                  <ForwardIcon className="w-3.5 h-3.5" />
                </button>

                <p className="text-[10px] text-[#aaa] text-center mt-3 tracking-wide">
                  {isHe ? 'תשלום מאובטח · שמפו אורגני 100%' : 'Secure checkout · 100% organic pet care'}
                </p>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="w-full mx-auto lg:sticky lg:top-8">
                <div className="bg-gradient-to-b from-[#f8f8f6] to-[#f0eeea] p-4 sm:p-5 lg:p-6" style={{ borderRadius: '8px', border: '1px solid #eee' }}>
                  <p className="text-[10px] tracking-[0.25em] uppercase text-[#c9a96e] font-medium mb-3 text-center">
                    {tierLabel} · ⁦Pet Wash™⁩
                  </p>
                  <img 
                    src={selectedPackage.image} 
                    alt={`⁦PetWash™⁩ ${isHe ? selectedPackage.nameHe : selectedPackage.name} Wash Package`}
                    className="w-full h-auto rounded-lg shadow-xl"
                    style={{ 
                      filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.15))',
                      display: 'block',
                    }}
                  />
                  <div className="text-center mt-5">
                    <p className="text-3xl sm:text-4xl font-light text-[#1a1a1a] mb-1"
                      style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em' }}>
                      ₪{price}
                    </p>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-[#aaa]">
                      {selectedPackage.washes} {isHe ? 'רחיצות' : 'washes'} · Premium Organic
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" dir={dir}>
      <div className="container mx-auto px-4 py-12 sm:py-16 lg:py-20">
        <div className="text-center mb-14 sm:mb-20">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#c9a96e]" />
            <Leaf className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.2} />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#c9a96e]" />
          </div>

          <p className="text-[10px] sm:text-[11px] tracking-[0.35em] uppercase mb-5 font-medium"
            style={{ color: '#c9a96e' }}>
            {isHe ? 'חבילות רחיצה פרימיום' : 'Premium Wash Packages'}
          </p>

          <h1 className="text-3xl sm:text-4xl lg:text-[3.2rem] text-[#1a1a1a] mb-6 px-4 font-light leading-tight"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif", letterSpacing: '-0.03em' }}>
            {isHe ? 'חבילות רחיצה פרמיום' : 'Premium Wash Packages'}
          </h1>
          <p className="text-sm sm:text-[15px] text-[#888] max-w-md mx-auto leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
            {isHe ? 'חסכו עם חבילות רחיצה. שמפו אורגני 100% עם שמן עץ התה האוסטרלי.' : 'Save more with multi-wash packages. 100% organic shampoo with Australian tea tree oil.'}
          </p>
        </div>

        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-8">
            {packageOptions.map((pkg) => {
              const price = Math.round(pkg.washes * WASH_PRICE * (1 - pkg.discount / 100));
              const originalPrice = pkg.washes * WASH_PRICE;
              const isElite = pkg.tier === 'ELITE';
              const isPopular = pkg.tier === 'POPULAR';
              const selected = selectedPackage?.washes === pkg.washes;
              const tierLabel = tierLabels[pkg.tier]?.[lang] || tierLabels[pkg.tier]?.en;
              const pricePerWash = Math.round(price / pkg.washes);

              return (
                <button
                  key={pkg.washes}
                  type="button"
                  className="group text-start transition-all duration-300"
                  onClick={() => handlePackageClick(pkg)}
                  data-testid={`package-card-${pkg.tier.toLowerCase()}`}
                >
                  <div className="relative overflow-hidden transition-all duration-500 bg-white hover:shadow-xl hover:shadow-black/[0.06]"
                    style={{
                      borderRadius: '6px',
                      border: selected 
                        ? '2.5px solid #1a1a1a'
                        : isPopular ? '1.5px solid #c9a96e' : '1px solid #eee',
                    }}
                  >
                    {selected && (
                      <div className="absolute top-3 end-3 z-10">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#1a1a1a] shadow-lg">
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                        </div>
                      </div>
                    )}

                    {isPopular && (
                      <div className="absolute top-3 start-3 z-10">
                        <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase px-2.5 py-1 bg-[#c9a96e] text-white font-medium" style={{ borderRadius: '2px' }}>
                          {isHe ? 'מומלץ' : 'Best'}
                        </span>
                      </div>
                    )}

                    <div className="relative overflow-hidden bg-gradient-to-b from-[#f8f8f6] to-[#f0eeea]">
                      <img 
                        src={pkg.image} 
                        alt={`⁦PetWash™⁩ ${isHe ? pkg.nameHe : pkg.name} Wash Package`}
                        className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.03] group-hover:-translate-y-1"
                        style={{ 
                          display: 'block',
                        }}
                        loading="lazy"
                      />
                    </div>

                    <div className="px-3 sm:px-5 py-3 sm:py-5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-medium ${
                          isElite || isPopular ? 'text-[#c9a96e]' : 'text-[#999]'
                        }`}>
                          {tierLabel}
                        </span>
                      </div>

                      <div className="mb-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-[11px] sm:text-xs text-[#999]">₪</span>
                          <span className="text-3xl sm:text-4xl lg:text-[2.8rem] font-light text-[#1a1a1a]"
                            style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em', lineHeight: 1 }}>
                            {price}
                          </span>
                          {pkg.discount > 0 && (
                            <span className="text-[10px] line-through text-[#ccc] ms-1">₪{originalPrice}</span>
                          )}
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-xs sm:text-[13px] text-[#555] mb-0.5">
                          {pkg.washes} {isHe ? 'רחיצות' : `wash${pkg.washes > 1 ? 'es' : ''}`}
                        </p>
                        {pkg.washes > 1 && (
                          <p className="text-[10px] sm:text-[11px] text-[#aaa]">
                            ₪{pricePerWash} {isHe ? 'לרחיצה' : 'per wash'}
                          </p>
                        )}
                        {pkg.discount > 0 && (
                          <p className="text-[10px] sm:text-[11px] text-[#c9a96e] mt-0.5 font-medium">
                            {isHe ? `${pkg.discount}% הנחה` : `Save ${pkg.discount}%`}
                          </p>
                        )}
                      </div>

                      <div className="border-t border-[#eee] pt-3 space-y-1.5 text-[#888]">
                        {pkg.features.slice(0, 3).map((feature, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#c9a96e' }} />
                            <span className="text-[10px] sm:text-[11px]">
                              {isHe ? feature.he : feature.en}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedPackage && (
            <div className="mt-10 sm:mt-12 text-center">
              <button
                className="px-10 sm:px-14 py-4 text-[11px] tracking-[0.18em] uppercase font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-all duration-300 inline-flex items-center gap-2.5"
                onClick={proceedToDetails}
                data-testid="button-proceed-details"
                style={{ borderRadius: '2px' }}
              >
                {isHe ? 'צפה בפרטי החבילה' : 'View Package Details'}
                <ForwardIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="mt-14 sm:mt-20">
            <div className="flex items-center justify-center gap-4 mb-10">
              <div className="flex-1 max-w-[80px] h-px bg-gradient-to-r from-transparent to-[#ddd]" />
              <ShieldCheck className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.2} />
              <div className="flex-1 max-w-[80px] h-px bg-gradient-to-l from-transparent to-[#ddd]" />
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10 max-w-xl mx-auto">
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#c9a96e]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {isHe ? 'אורגני 100%' : '100% Organic'}
                </p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#c9a96e]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {isHe ? '24/7 שירות עצמי' : '24/7 Self-Service'}
                </p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#c9a96e]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {isHe ? 'כל הסניפים' : 'All Locations'}
                </p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-[#c9a96e]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {isHe ? 'ניתן להעברה' : 'Transferable'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
