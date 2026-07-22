/**
 * CheckoutCanon — the canonical web checkout per the CEO's 2026-07-22 mockup.
 *
 *   /checkout?sku=<PHASE1_SKU>            (e.g. /checkout?sku=WASH_PACKAGE_5)
 *
 * TRUTH RULES (money-integrity):
 *  - Prices render ONLY from GET /api/payments/sumit/catalog (server-owned).
 *    This page holds zero price constants — what you see is what /begin charges.
 *  - Coupon: validated by POST /api/coupons/validate for the PREVIEW, then the
 *    CODE (never an amount) rides to /begin, which re-validates server-side and
 *    fail-closes on any mismatch. Kiosk wash products only.
 *  - Card rail is LIVE (SUMIT hosted page — no card data touches our code).
 *    bit / PayBox / Apple Pay are honest "coming soon" tiles until their vendor
 *    rails exist. No fake buttons.
 *  - Prices are VAT-inclusive; the summary shows the 18% VAT line inside the
 *    total (net = total / 1.18), matching the fiscal doc SUMIT issues.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard, QrCode, Ticket, ShieldCheck, ChevronRight, Loader2, Sparkles, Check,
} from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/apiConfig';
import { apiRequest } from '@/lib/queryClient';
import { startSkuCheckout, type SumitSku } from '@/lib/sumitCheckout';

const GOLD = '#D4AF37';
const DEEP = '#063B22';

interface CatalogProduct {
  sku: SumitSku;
  amountCents: number;
  description: string;
  surface: string;
  washCount?: number;
  couponEligible: boolean;
}

/** Hebrew display names for the server catalog (display only — never prices). */
const SKU_HE: Record<string, { title: string; sub: string }> = {
  SINGLE_WASH:     { title: 'שטיפה אחת בעמדת K9000', sub: 'קרדיט לשטיפה אחת בכל עמדת PetWash' },
  WASH_PACKAGE_3:  { title: 'חבילת 3 שטיפות', sub: 'קרדיטים לשלוש שטיפות בעמדות K9000' },
  WASH_PACKAGE_5:  { title: 'חבילת 5 שטיפות', sub: 'קרדיטים לחמש שטיפות בעמדות K9000' },
  WASH_PACKAGE_10: { title: 'חבילת 10 שטיפות — Maison', sub: 'קרדיטים לעשר שטיפות בעמדות K9000' },
  EGIFT_100:       { title: 'שובר מתנה ₪100', sub: 'eGift — נטען לארנק המתנה של המקבל' },
  EGIFT_250:       { title: 'שובר מתנה ₪250', sub: 'eGift — נטען לארנק המתנה של המקבל' },
  EGIFT_500:       { title: 'שובר מתנה ₪500', sub: 'eGift — נטען לארנק המתנה של המקבל' },
  EGIFT_1000:      { title: 'שובר מתנה ₪1,000 — Maison', sub: 'eGift — נטען לארנק המתנה של המקבל' },
};

const COUPON_ORDER_TYPE: Record<string, string> = {
  SINGLE_WASH: 'kiosk_wash',
  WASH_PACKAGE_3: 'package_purchase',
  WASH_PACKAGE_5: 'package_purchase',
  WASH_PACKAGE_10: 'package_purchase',
};

function ils(cents: number): string {
  const v = cents / 100;
  return `₪${Number.isInteger(v) ? v.toLocaleString('he-IL') : v.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CheckoutCanon() {
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();

  const urlSku = useMemo(() => {
    const p = new URLSearchParams(window.location.search).get('sku') || '';
    return p.toUpperCase();
  }, []);

  const { data: catalog, isLoading: catalogLoading, isError: catalogError } = useQuery({
    queryKey: ['sumit-catalog'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/payments/sumit/catalog'));
      if (!res.ok) throw new Error('catalog_unavailable');
      return res.json() as Promise<{ ok: boolean; products: CatalogProduct[] }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const products = catalog?.products ?? [];
  const [selectedSku, setSelectedSku] = useState<string>('');
  useEffect(() => {
    if (!products.length) return;
    if (!selectedSku) {
      setSelectedSku(products.some((p) => p.sku === urlSku) ? urlSku : products[0].sku);
    }
  }, [products, urlSku, selectedSku]);
  const product = products.find((p) => p.sku === selectedSku) || null;

  // ── Coupon (preview via /api/coupons/validate; the CODE goes to /begin) ──
  const [couponInput, setCouponInput] = useState('');
  const [couponChecking, setCouponChecking] = useState(false);
  const [coupon, setCoupon] = useState<{ code: string; discountCents: number; amountAfterCents: number; campaignName?: string } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  useEffect(() => { setCoupon(null); setCouponError(null); }, [selectedSku]);

  const applyCoupon = async () => {
    if (!product || !couponInput.trim() || couponChecking) return;
    if (!user) { toast({ title: 'יש להתחבר כדי להשתמש בקופון', variant: 'destructive' }); return; }
    setCouponChecking(true);
    setCouponError(null);
    try {
      const res = await apiRequest('POST', '/api/coupons/validate', {
        code: couponInput.trim(),
        orderType: COUPON_ORDER_TYPE[product.sku] || 'kiosk_wash',
        amountCents: product.amountCents,
      });
      const data = await res.json().catch(() => ({} as any));
      if (data?.valid && data?.discountAmountCents > 0 && data?.amountAfterCents > 0) {
        setCoupon({
          code: couponInput.trim(),
          discountCents: data.discountAmountCents,
          amountAfterCents: data.amountAfterCents,
          campaignName: data.campaignName,
        });
      } else {
        setCoupon(null);
        setCouponError(data?.error || 'הקופון אינו תקף להזמנה זו');
      }
    } catch {
      setCoupon(null);
      setCouponError('לא ניתן לבדוק את הקופון כרגע');
    } finally {
      setCouponChecking(false);
    }
  };

  // ── Totals (VAT-inclusive; net = total / 1.18) ──
  const totalCents = coupon ? coupon.amountAfterCents : (product?.amountCents ?? 0);
  const netCents = Math.round(totalCents / 1.18);
  const vatCents = totalCents - netCents;

  // ── Pay ──
  const [paying, setPaying] = useState(false);
  const pay = async () => {
    if (!product || paying) return;
    if (!user) {
      setLocation(`/signup?next=${encodeURIComponent(`/checkout?sku=${product.sku}`)}`);
      return;
    }
    setPaying(true);
    const result = await startSkuCheckout({
      sku: product.sku,
      ...(coupon ? { couponCode: coupon.code } : {}),
    });
    if (!result.ok) {
      setPaying(false);
      if (result.errorCode?.startsWith('COUPON')) {
        setCoupon(null);
        setCouponError(result.error || 'הקופון נדחה — נסו שוב ללא קופון');
      }
      toast({
        title: 'לא ניתן להתחיל את התשלום',
        description: result.error || 'נסו שוב בעוד רגע או פנו לתמיכה',
        variant: 'destructive',
      });
    }
    // On success the browser navigates to SUMIT's hosted page.
  };

  const methods = [
    { id: 'card', label: 'כרטיס אשראי', sub: 'תשלום מאובטח דרך SUMIT', icon: CreditCard, live: true },
    { id: 'applepay', label: 'Apple Pay', sub: 'בקרוב', icon: Sparkles, live: false },
    { id: 'bit', label: 'bit', sub: 'בקרוב', icon: Sparkles, live: false },
    { id: 'paybox', label: 'PayBox', sub: 'בקרוב', icon: Sparkles, live: false },
  ];

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#FAFAF7]" data-testid="checkout-canon">
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:pt-10">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: DEEP }}>
            <ShieldCheck className="h-6 w-6" style={{ color: GOLD }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: DEEP }}>תשלום מאובטח</h1>
          <p className="mt-1 text-sm text-neutral-500">PetWash™ · SUMIT · ללא שמירת פרטי אשראי אצלנו</p>
        </div>

        {/* Product */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: `${GOLD}55` }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-500">ההזמנה שלך</h2>
            {catalogLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
          </div>
          {catalogError && (
            <p className="text-sm text-red-600" data-testid="checkout-catalog-error">
              המחירון אינו זמין כרגע — נסו לרענן את העמוד.
            </p>
          )}
          <div className="grid gap-2">
            {products.map((p) => {
              const he = SKU_HE[p.sku] || { title: p.description, sub: '' };
              const selected = p.sku === selectedSku;
              return (
                <button
                  key={p.sku}
                  type="button"
                  onClick={() => setSelectedSku(p.sku)}
                  data-testid={`checkout-product-${p.sku}`}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-right transition ${selected ? 'shadow-md' : 'hover:bg-neutral-50'}`}
                  style={selected ? { borderColor: GOLD, background: '#FFFDF5' } : { borderColor: '#E5E5E5' }}
                >
                  <span>
                    <span className="block font-semibold" style={{ color: DEEP }}>{he.title}</span>
                    <span className="block text-xs text-neutral-500">{he.sub}</span>
                  </span>
                  <span className="mr-3 flex items-center gap-2">
                    <span className="text-lg font-bold" style={{ color: DEEP }}>{ils(p.amountCents)}</span>
                    {selected && <Check className="h-4 w-4" style={{ color: GOLD }} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment method */}
        <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: `${GOLD}55` }}>
          <h2 className="mb-3 text-sm font-semibold text-neutral-500">אמצעי תשלום</h2>
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <div
                key={m.id}
                data-testid={`checkout-method-${m.id}`}
                aria-disabled={!m.live}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${m.live ? '' : 'opacity-50'}`}
                style={m.live ? { borderColor: GOLD, background: '#FFFDF5' } : { borderColor: '#E5E5E5' }}
              >
                <m.icon className="h-5 w-5 shrink-0" style={{ color: m.live ? GOLD : '#9CA3AF' }} />
                <span>
                  <span className="block text-sm font-semibold" style={{ color: m.live ? DEEP : '#6B7280' }}>{m.label}</span>
                  <span className="block text-[11px] text-neutral-500">{m.sub}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Coupon — kiosk wash products only (server enforces the same rule) */}
        {product?.couponEligible && (
          <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: `${GOLD}55` }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-500">
              <Ticket className="h-4 w-4" style={{ color: GOLD }} /> קוד קופון
            </h2>
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="יש לכם קופון? הזינו כאן"
                data-testid="checkout-coupon-input"
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponChecking || !couponInput.trim()}
                data-testid="checkout-coupon-apply"
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: DEEP }}
              >
                {couponChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'החלה'}
              </button>
            </div>
            {coupon && (
              <p className="mt-2 text-sm font-medium text-emerald-700" data-testid="checkout-coupon-ok">
                הקופון הופעל{coupon.campaignName ? ` — ${coupon.campaignName}` : ''}: חיסכון {ils(coupon.discountCents)}
              </p>
            )}
            {couponError && <p className="mt-2 text-sm text-red-600" data-testid="checkout-coupon-error">{couponError}</p>}
          </div>
        )}

        {/* Nayax DOT QR redemption */}
        <div className="mt-5 rounded-2xl border p-5 shadow-sm" style={{ borderColor: DEEP, background: DEEP }}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <QrCode className="h-6 w-6" style={{ color: GOLD }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">מימוש בעמדה עם Nayax DOT</p>
              <p className="text-xs text-white/70">קרדיטים ושוברים ממומשים בעמדת השטיפה בסריקת ה־QR האישי שלכם</p>
            </div>
            <button
              type="button"
              onClick={() => setLocation('/my-wallet')}
              data-testid="checkout-dotqr-wallet"
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: GOLD, color: DEEP }}
            >
              לארנק שלי <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            </button>
          </div>
        </div>

        {/* Summary (VAT-inclusive) */}
        <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: `${GOLD}55` }} data-testid="checkout-summary">
          <h2 className="mb-3 text-sm font-semibold text-neutral-500">סיכום הזמנה</h2>
          {product && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">{(SKU_HE[product.sku] || { title: product.description }).title}</span>
                <span className="font-medium">{ils(product.amountCents)}</span>
              </div>
              {coupon && (
                <div className="flex justify-between text-emerald-700">
                  <span>קופון {coupon.code}</span>
                  <span>-{ils(coupon.discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-neutral-500">
                <span>לפני מע״מ</span>
                <span>{ils(netCents)}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-500">
                <span>מע״מ 18% (כלול במחיר)</span>
                <span>{ils(vatCents)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-3 text-base font-bold" style={{ borderColor: `${GOLD}44`, color: DEEP }}>
                <span>סה״כ לתשלום</span>
                <span data-testid="checkout-total">{ils(totalCents)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Pay CTA */}
        <button
          type="button"
          onClick={pay}
          disabled={!product || paying || catalogLoading}
          data-testid="checkout-pay"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold shadow-lg transition disabled:opacity-50"
          style={{ background: GOLD, color: DEEP }}
        >
          {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
          {user ? `שלם עכשיו ${product ? ils(totalCents) : ''}` : 'התחברות ותשלום'}
        </button>
        <p className="mt-3 text-center text-[11px] text-neutral-400">
          התשלום מתבצע בדף מאובטח של SUMIT · חשבונית מס/קבלה תישלח אליכם אוטומטית
        </p>
      </div>
    </div>
  );
}
