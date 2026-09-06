import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, ArrowRight, ArrowLeft, Leaf, Sparkles, ShieldCheck, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { CheckoutLegalNotice } from '@/components/legal/CheckoutLegalNotice';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import type { WashPackage } from '@shared/schema';

import pinkCardFront from '@assets/IMG_3094_1770832584882.png';
import greenCardFront from '@assets/IMG_3091_1770832584882.png';
import blackCardFront from '@assets/IMG_1998_1770750271081.png';
import goldCardFront from '@assets/IMG_1996_1770750271081.png';
import { useSEO, pageSEO } from '@/lib/seo';
import { SeoFaqSection, type SeoFaqItem } from '@/components/SeoFaqSection';

const WASH_PRICE = 55;

// AEO/GEO — visible FAQ mirrored 1:1 into FAQPage JSON-LD so answer engines can
// lift a factual sentence verbatim. Truthful, legal-safe; price ₪55 incl VAT
// (CEO 2026-07-09). Module-level = stable reference (no effect re-run per render).
const PACKAGES_FAQ: SeoFaqItem[] = [
  {
    qHe: 'כמה עולה שטיפה אחת?',
    qEn: 'How much is a single wash?',
    aHe: 'שטיפה עצמית סטנדרטית עולה ₪55 (כולל מע״מ).',
    aEn: 'A standard self-service wash is ₪55 (VAT included).',
  },
  {
    qHe: 'האם חבילות רב-שטיפה זולות יותר לשטיפה?',
    qEn: 'Do multi-wash packages cost less per wash?',
    aHe: 'כן — חבילות רב-שטיפה וחברות מועדון מפחיתות את המחיר לשטיפה.',
    aEn: 'Yes — multi-wash packages and club membership lower the price per wash.',
  },
  {
    qHe: 'איך משתמשים בחבילה?',
    qEn: 'How do I use a package?',
    aHe: 'רוכשים חבילה, ומממשים כל שטיפה בעמדה דרך אפליקציית ⁦PetWash™⁩.',
    aEn: 'Buy a package, then redeem each wash at the station via the ⁦PetWash™⁩ app.',
  },
  {
    qHe: 'אפשר לתת חבילה במתנה?',
    qEn: 'Can I give a package as a gift?',
    aHe: 'כן — ניתן לרכוש שובר מתנה דיגיטלי.',
    aEn: 'Yes — you can buy a digital gift card.',
  },
  {
    qHe: 'באילו עמדות אפשר לממש את החבילות?',
    qEn: 'Which stations accept the packages?',
    aHe: 'בכל עמדות ⁦K9000⁩ הפעילות שלנו בישראל.',
    aEn: 'At all our active ⁦K9000⁩ stations in Israel.',
  },
];

// Card artwork keyed by wash count — mirrors client/src/components/WashPackages.tsx
// so a shared visual identity carries between the homepage widget and /packages.
// Unknown wash counts (admin-added tiers) fall back to the pink card.
const cardImagesByWashCount: Record<number, string> = {
  1: pinkCardFront,
  3: greenCardFront,
  5: blackCardFront,
  10: goldCardFront,
};

const TIER_ORDER = ['CLASSIC', 'POPULAR', 'PREMIUM', 'ELITE'] as const;
type Tier = typeof TIER_ORDER[number];

const tierLabels: Record<Tier, Record<string, string>> = {
  CLASSIC: { en: 'Essentials', he: 'בסיסי' },
  POPULAR: { en: 'Most Popular', he: 'הכי פופולרי' },
  PREMIUM: { en: 'Premium', he: 'פרימיום' },
  ELITE: { en: 'Maison Collection', he: 'קולקציית מזון' },
};

// Feature bullets are derived from washCount buckets, not from the DB row. The
// admin CRUD (`/admin/wash-packages`) only owns name/price/washCount/active,
// so keeping the "what you get" copy client-side lets the CEO reprice without
// having to re-author marketing bullets in Hebrew.
function featuresForPackage(pkg: WashPackage, discountPct: number): { en: string; he: string }[] {
  const items: { en: string; he: string }[] = [];
  if (pkg.washCount === 1) {
    items.push({ en: 'Single premium wash', he: 'רחיצה פרימיום בודדת' });
  } else {
    items.push({
      en: `${pkg.washCount} premium washes`,
      he: `${pkg.washCount} רחיצות פרימיום`,
    });
  }
  items.push({ en: 'natural shampoo', he: 'שמפו טבעי' });
  if (discountPct > 0) {
    items.push({ en: `${discountPct}% discount`, he: `${discountPct}% הנחה` });
  }
  if (pkg.washCount >= 3) {
    items.push({ en: 'Transferable', he: 'ניתן להעברה' });
  }
  if (pkg.washCount >= 5) {
    items.push({ en: 'Priority booking', he: 'הזמנה בעדיפות' });
  }
  if (pkg.washCount >= 10) {
    items.push({ en: 'VIP treatment', he: 'טיפול VIP' });
    items.push({ en: '2x loyalty points', he: 'נקודות נאמנות כפולות' });
  }
  return items;
}

// Discount % is inferred from the DB price so the CEO reprices from
// /admin/wash-packages and the "You save …" copy stays honest without another
// touchpoint. Any per-wash price at-or-above the single-wash rate → 0% shown.
function discountPercentFor(pkg: WashPackage): number {
  if (pkg.washCount <= 1) return 0;
  const perWash = Number(pkg.price) / pkg.washCount;
  if (!Number.isFinite(perWash) || perWash >= WASH_PRICE) return 0;
  const pct = (1 - perWash / WASH_PRICE) * 100;
  return Math.max(0, Math.round(pct));
}

function tierForIndex(index: number, isElite: boolean): Tier {
  if (isElite) return 'ELITE';
  return TIER_ORDER[Math.min(index, TIER_ORDER.length - 1)];
}

export default function Packages() {
  useSEO(pageSEO.packages);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language } = useLanguage();
  const lang = language || 'he';
  const isHe = lang === 'he';
  const { user } = useFirebaseAuth();

  const dir = ['he', 'ar'].includes(lang) ? 'rtl' : 'ltr';
  const isRtl = dir === 'rtl';
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const ForwardIcon = isRtl ? ArrowLeft : ArrowRight;

  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ washesAdded: number; amountPaid: number; discountApplied: number } | null>(null);

  const { data: packages, isLoading, isError } = useQuery<WashPackage[]>({
    queryKey: ['/api/packages'],
  });

  const selectedPackage = packages?.find(p => p.id === selectedPackageId) ?? null;

  const purchaseMutation = useMutation({
    mutationFn: async ({ packageId }: { packageId: number }) => {
      const res = await apiRequest('POST', '/api/checkout', { packageId, paymentMethod: 'credit_card' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.messageHe || err.message || (isHe ? 'שגיאה ברכישה' : 'Purchase failed'));
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setPurchaseSuccess({ washesAdded: data.washesAdded, amountPaid: data.amountPaid, discountApplied: data.discountApplied || 0 });
    },
    onError: (err: Error) => {
      toast({ title: isHe ? 'שגיאה ברכישה' : 'Purchase failed', description: err.message, variant: 'destructive' });
    }
  });

  const proceedToDetails = () => {
    if (!selectedPackage) {
      toast({ title: isHe ? "נא לבחור חבילה" : "Please select a package", variant: "destructive" });
      return;
    }
    setShowDetails(true);
  };

  const handlePurchase = () => {
    if (!selectedPackage) return;
    if (!user) {
      toast({ title: isHe ? 'נדרשת התחברות' : 'Login required', description: isHe ? 'יש להתחבר לפני הרכישה' : 'Please log in before purchasing', variant: 'destructive' });
      setLocation('/sign-up');
      return;
    }
    purchaseMutation.mutate({ packageId: selectedPackage.id });
  };

  if (purchaseSuccess && selectedPackage) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-16" dir={dir}>
        <div className="max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-[#0a0a0a]" strokeWidth={1.2} />
            </div>
          </div>
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#0a0a0a] font-medium mb-4">
            {isHe ? 'רכישה הושלמה' : 'Purchase Complete'}
          </p>
          <h2 className="text-3xl font-light text-[#1a1a1a] mb-3"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {isHe ? 'תודה רבה!' : 'Thank You!'}
          </h2>
          <p className="text-[#888] text-sm mb-8 leading-relaxed">
            {isHe
              ? `${purchaseSuccess.washesAdded} רחיצות נוספו לחשבונך. שולמו ₪${purchaseSuccess.amountPaid.toFixed(2)}.${purchaseSuccess.discountApplied > 0 ? ` הנחה ${purchaseSuccess.discountApplied}% הוחלה.` : ''}`
              : `${purchaseSuccess.washesAdded} wash${purchaseSuccess.washesAdded > 1 ? 'es' : ''} added to your account. ₪${purchaseSuccess.amountPaid.toFixed(2)} charged.${purchaseSuccess.discountApplied > 0 ? ` ${purchaseSuccess.discountApplied}% discount applied.` : ''}`
            }
          </p>
          <div className="flex flex-col gap-3">
            <Button
              className="w-full py-3.5 text-[11px] tracking-[0.18em] uppercase font-medium bg-[#1a1a1a] text-white hover:bg-[#333]"
              style={{ borderRadius: '2px' }}
              onClick={() => setLocation('/dashboard')}
              data-testid="button-go-dashboard"
            >
              {isHe ? 'לדשבורד שלי' : 'Go to My Dashboard'}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-[#888] text-[12px]"
              onClick={() => { setPurchaseSuccess(null); setShowDetails(false); }}
            >
              {isHe ? 'חזרה לחבילות' : 'Back to Packages'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (showDetails && selectedPackage) {
    const discountPct = discountPercentFor(selectedPackage);
    const price = Math.round(Number(selectedPackage.price));
    const originalPrice = selectedPackage.washCount * WASH_PRICE;
    const index = packages?.findIndex(p => p.id === selectedPackage.id) ?? 0;
    const tier = tierForIndex(index, index === (packages?.length ?? 0) - 1 && (packages?.length ?? 0) >= 4);
    const tierLabel = tierLabels[tier][lang] ?? tierLabels[tier].en;
    const cardImage = cardImagesByWashCount[selectedPackage.washCount] ?? pinkCardFront;
    const features = featuresForPackage(selectedPackage, discountPct);

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
                  <p className="text-[10px] tracking-[0.25em] uppercase text-[#0a0a0a] font-medium mb-2">{tierLabel}</p>
                  <h2 className="text-2xl sm:text-3xl font-light text-[#1a1a1a]"
                    style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif" }}>
                    {isHe ? selectedPackage.nameHe : selectedPackage.name}
                  </h2>
                  <p className="text-[13px] text-[#888] mt-1">
                    {selectedPackage.washCount} {isHe ? 'רחיצות פרימיום' : `Premium Wash${selectedPackage.washCount > 1 ? 'es' : ''}`}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-[#999]">₪</span>
                    <span className="text-4xl sm:text-5xl font-light text-[#1a1a1a]"
                      style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.04em' }}>
                      {price}
                    </span>
                    {discountPct > 0 && (
                      <span className="text-base text-[#bbb] line-through">₪{originalPrice}</span>
                    )}
                  </div>
                  {discountPct > 0 && (
                    <p className="text-[11px] text-[#0a0a0a] font-medium mt-1.5 tracking-wide">
                      {isHe ? `חסכת ₪${originalPrice - price} (${discountPct}% הנחה)` : `You save ₪${originalPrice - price} (${discountPct}% off)`}
                    </p>
                  )}
                </div>

                <div className="border-t border-[#eee] pt-5 mb-6">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-[#999] font-medium mb-3">
                    {isHe ? 'מה כולל:' : "What's Included:"}
                  </p>
                  <ul className="space-y-2.5">
                    {features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-[#555] text-[13px]">
                        <Check className="w-3.5 h-3.5 text-[#0a0a0a] flex-shrink-0" strokeWidth={1.5} />
                        {isHe ? feature.he : feature.en}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  className="w-full py-4 text-[11px] tracking-[0.18em] uppercase font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
                  onClick={handlePurchase}
                  disabled={purchaseMutation.isPending}
                  data-testid="button-purchase"
                  style={{ borderRadius: '2px' }}
                >
                  {purchaseMutation.isPending
                    ? (isHe ? 'מעבד...' : 'Processing...')
                    : <>{isHe ? 'רכישה' : 'Buy Now'} — ₪{price}<ForwardIcon className="w-3.5 h-3.5" /></>
                  }
                </Button>

                <p className="text-[10px] text-[#aaa] text-center mt-3 tracking-wide">
                  {isHe ? 'תשלום מאובטח · שמפו טבעי' : 'Secure checkout · natural pet care'}
                </p>

                <CheckoutLegalNotice className="mt-3" />
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="w-full mx-auto lg:sticky lg:top-8">
                <div className="bg-gradient-to-b from-[#f8f8f6] to-[#f0eeea] p-4 sm:p-5 lg:p-6" style={{ borderRadius: '8px', border: '1px solid #eee' }}>
                  <p className="text-[10px] tracking-[0.25em] uppercase text-[#0a0a0a] font-medium mb-3 text-center">
                    {tierLabel} · ⁦PetWash™⁩
                  </p>
                  <img
                    src={cardImage}
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
                      {selectedPackage.washCount} {isHe ? 'רחיצות' : 'washes'} · Premium Natural
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
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#D9B84C]" />
            <Leaf className="w-4 h-4 text-[#0a0a0a]" strokeWidth={1.2} />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#D9B84C]" />
          </div>

          <p className="text-[10px] sm:text-[11px] tracking-[0.35em] uppercase mb-5 font-medium"
            style={{ color: '#0a0a0a' }}>
            {isHe ? 'חבילות רחיצה פרימיום' : 'Premium Wash Packages'}
          </p>

          <h1 className="text-3xl sm:text-4xl lg:text-[3.2rem] text-[#1a1a1a] mb-6 px-4 font-light leading-tight"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif", letterSpacing: '-0.03em' }}>
            {isHe ? 'חבילות רחיצה פרמיום' : 'Premium Wash Packages'}
          </h1>
          <p className="text-sm sm:text-[15px] text-[#888] max-w-md mx-auto leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
            {isHe ? 'חסכו עם חבילות רחיצה. שמפו טבעי עם שמן עץ התה האוסטרלי.' : 'Save more with multi-wash packages. Natural shampoo with Australian tea tree oil.'}
          </p>
        </div>

        <div className="max-w-[1200px] mx-auto">
          {isLoading && (
            <div className="flex justify-center py-16" data-testid="packages-loading">
              <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-black rounded-full" />
            </div>
          )}

          {!isLoading && isError && (
            <div className="text-center py-16" data-testid="packages-error">
              <p className="text-[13px] text-[#888]">
                {isHe ? 'לא הצלחנו לטעון את החבילות כרגע. נסה שוב בעוד רגע.' : 'We couldn’t load the packages right now. Please try again in a moment.'}
              </p>
            </div>
          )}

          {!isLoading && !isError && packages && packages.length === 0 && (
            <div className="text-center py-16" data-testid="packages-empty">
              <p className="text-[13px] text-[#888]">
                {isHe ? 'אין חבילות פעילות כעת. חזרו בקרוב.' : 'No active packages right now. Please check back soon.'}
              </p>
            </div>
          )}

          {!isLoading && !isError && packages && packages.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-8">
              {packages.map((pkg, index) => {
                const discountPct = discountPercentFor(pkg);
                const price = Math.round(Number(pkg.price));
                const originalPrice = pkg.washCount * WASH_PRICE;
                const isEliteByIndex = index === packages.length - 1 && packages.length >= 4;
                const tier = tierForIndex(index, isEliteByIndex);
                const isElite = tier === 'ELITE';
                const isPopular = tier === 'POPULAR';
                const selected = selectedPackageId === pkg.id;
                const tierLabel = tierLabels[tier][lang] ?? tierLabels[tier].en;
                const pricePerWash = Math.max(1, Math.round(price / Math.max(1, pkg.washCount)));
                const cardImage = cardImagesByWashCount[pkg.washCount] ?? pinkCardFront;
                const features = featuresForPackage(pkg, discountPct);

                return (
                  <Button
                    key={pkg.id}
                    type="button"
                    className="group text-start transition-all duration-300"
                    onClick={() => setSelectedPackageId(pkg.id)}
                    data-testid={`package-card-${tier.toLowerCase()}`}
                  >
                    <div className="relative overflow-hidden transition-all duration-500 bg-white hover:shadow-xl hover:shadow-black/[0.06]"
                      style={{
                        borderRadius: '6px',
                        border: selected
                          ? '2.5px solid #1a1a1a'
                          : isPopular ? '1.5px solid #D9B84C' : '1px solid #eee',
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
                          <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase px-2.5 py-1 bg-[#D9B84C] text-[#0a0a0a] font-medium" style={{ borderRadius: '2px' }}>
                            {isHe ? 'מומלץ' : 'Best'}
                          </span>
                        </div>
                      )}

                      <div className="relative overflow-hidden bg-gradient-to-b from-[#f8f8f6] to-[#f0eeea]">
                        <img
                          src={cardImage}
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
                            isElite || isPopular ? 'text-[#0a0a0a]' : 'text-[#999]'
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
                            {discountPct > 0 && (
                              <span className="text-[10px] line-through text-[#ccc] ms-1">₪{originalPrice}</span>
                            )}
                          </div>
                        </div>

                        <div className="mb-3">
                          <p className="text-xs sm:text-[13px] text-[#555] mb-0.5">
                            {pkg.washCount} {isHe ? 'רחיצות' : `wash${pkg.washCount > 1 ? 'es' : ''}`}
                          </p>
                          {pkg.washCount > 1 && (
                            <p className="text-[10px] sm:text-[11px] text-[#aaa]">
                              ₪{pricePerWash} {isHe ? 'לרחיצה' : 'per wash'}
                            </p>
                          )}
                          {discountPct > 0 && (
                            <p className="text-[10px] sm:text-[11px] text-[#0a0a0a] mt-0.5 font-medium">
                              {isHe ? `${discountPct}% הנחה` : `Save ${discountPct}%`}
                            </p>
                          )}
                        </div>

                        <div className="border-t border-[#eee] pt-3 space-y-1.5 text-[#888]">
                          {features.slice(0, 3).map((feature, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: '#0a0a0a' }} />
                              <span className="text-[10px] sm:text-[11px]">
                                {isHe ? feature.he : feature.en}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          )}

          {selectedPackage && (
            <div className="mt-10 sm:mt-12 text-center">
              <Button
                className="px-10 sm:px-14 py-4 text-[11px] tracking-[0.18em] uppercase font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-all duration-300 inline-flex items-center gap-2.5"
                onClick={proceedToDetails}
                data-testid="button-proceed-details"
                style={{ borderRadius: '2px' }}
              >
                {isHe ? 'צפה בפרטי החבילה' : 'View Package Details'}
                <ForwardIcon className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          <div className="mt-14 sm:mt-20">
            <div className="flex items-center justify-center gap-4 mb-10">
              <div className="flex-1 max-w-[80px] h-px bg-gradient-to-r from-transparent to-[#ddd]" />
              <ShieldCheck className="w-4 h-4 text-[#0a0a0a]" strokeWidth={1.2} />
              <div className="flex-1 max-w-[80px] h-px bg-gradient-to-l from-transparent to-[#ddd]" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10 max-w-xl mx-auto">
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#0a0a0a]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {isHe ? 'טבעי' : 'Natural'}
                </p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#0a0a0a]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {isHe ? '24/7 שירות עצמי' : '24/7 Self-Service'}
                </p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#0a0a0a]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {isHe ? 'כל הסניפים' : 'All Locations'}
                </p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-2.5 rounded-full border border-[#e8e4de] flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-[#0a0a0a]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] tracking-[0.08em] text-[#555] font-medium uppercase">
                  {isHe ? 'ניתן להעברה' : 'Transferable'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SeoFaqSection faq={PACKAGES_FAQ} isHebrew={isHe} />
    </div>
  );
}
