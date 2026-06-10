/**
 * ShopStore — the live luxury storefront, wired to Codex's shop backend (/api/shop/*).
 *
 * FLAG-GATED: rendered at /shop only when VITE_SHOP_LIVE_ENABLED === 'true' (default
 * OFF). When OFF, App.tsx keeps the existing Shop waitlist. When the BACKEND
 * SHOP_ENABLED is off, /api/shop/products returns 503 and this degrades gracefully to
 * a "launching soon" state — so it never shows a broken store.
 *
 * Wires: GET /products · GET /cart · POST /cart/items · PATCH/DELETE /cart/items/:id ·
 * POST /checkout. Money (checkout) is the backend's domain (wallet/Sumit/escrow/VAT);
 * this UI only initiates it. Design per docs/design/2026-05-26-shop-module-physical-goods.md.
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { type Language } from '@/lib/i18n';
import { getApiUrl } from '@/lib/apiConfig';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { logger } from '@/lib/logger';
import { ShoppingBag, Plus, Minus, X, Loader2, Sparkles, ArrowLeft, Package } from 'lucide-react';

interface ShopStoreProps { language: Language; onLanguageChange?: (l: Language) => void; }

interface Product {
  id: number; sku: string; name_he: string; name_en: string | null;
  category: string; brand: string | null; price_cents: number; compare_at_cents: number | null;
  stock_quantity: number; images: string[]; is_featured: boolean; tags?: string[];
}
interface CartItem {
  id: number; product_id: number; quantity: number;
  name_he: string; name_en: string | null; price_cents: number;
  effectivePriceCents?: number; lineTotalCents?: number; images?: string[];
  weight_grams?: number | null;
}
interface Cart { id: string; items: CartItem[]; subtotalCents: number; vatCents: number; totalCents: number; }
interface SavedAddress {
  id: number; full_name: string; phone: string; street: string;
  city: string; zip_code: string | null; is_default: boolean;
}
// Shape of GET /api/shop/delivery/estimate — server is the single source of truth
// for the delivery fee; the UI never hardcodes ₪ amounts or thresholds.
interface DeliveryEstimate {
  standard: { cents: number; estimatedDate: string; label_he: string; label_en: string };
  freeThresholdCents: number;
}

// Exact when there are agorot (₪29.90 must not display as ₪30 — price-disclosure law).
// Browse-only soft opening: catalog + cart are live, purchases unlock when
// this build flag flips (server enforces the same gate on POST /checkout).
const CHECKOUT_OPEN = import.meta.env.VITE_SHOP_CHECKOUT_ENABLED === 'true';

const shekel = (cents: number) => {
  const c = cents || 0;
  return c % 100 === 0
    ? `₪${Math.round(c / 100).toLocaleString('he-IL')}`
    : `₪${(c / 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ShopStore({ language, onLanguageChange }: ShopStoreProps) {
  const he = language === 'he';
  const tr = (en: string, hv: string) => (he ? hv : en);
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [comingSoon, setComingSoon] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Two-step drawer: review cart → delivery address + final total → pay.
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addr, setAddr] = useState({ fullName: '', phone: '', street: '', city: '', zipCode: '' });
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  // Per-product bespoke engraving: pet name (HE/EN), owner, international mobile.
  type Engrave = { petName?: string; ownerName?: string; ownerMobile?: string };
  const [engraving, setEngraving] = useState<Record<number, Engrave>>({});
  const setEng = (id: number, field: keyof Engrave, val: string) =>
    setEngraving(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  // Auto-detect script → engrave RTL (Hebrew) or LTR (English) correctly.
  const isHebrew = (s: string) => /[֐-׿]/.test(s);
  // International mobile: +<country><digits> (e.g. +972…, +6141…). Local 05X allowed.
  const validMobile = (s: string) => /^\+?\d[\d\s-]{6,18}$/.test(s.trim());

  // A product is personalised (engravable) if tagged accordingly.
  const isEngravable = (p: Product) => !!p.tags?.some(t => t === 'engraving' || t === 'personalised');

  useEffect(() => { void loadProducts(); }, []);
  useEffect(() => { if (user) void refreshCart(); }, [user]);

  async function loadProducts() {
    try {
      const r = await fetch(getApiUrl('/api/shop/products'), { credentials: 'include' });
      if (r.status === 503) { setComingSoon(true); return; }
      const d = await r.json();
      setProducts((d.products || d.items || (Array.isArray(d) ? d : [])) as Product[]);
    } catch (e) { logger.error('[ShopStore] load products', e); setErr(tr('Could not load the shop.', 'טעינת החנות נכשלה.')); }
  }

  async function refreshCart() {
    if (!user) return;
    try { const r = await fetch(getApiUrl('/api/shop/cart'), { credentials: 'include' }); if (r.ok) setCart(await r.json()); } catch { /* ignore */ }
  }

  async function addToCart(p: Product) {
    if (!user) { navigate('/signin?redirect=/shop'); return; }
    const e = engraving[p.id] || {};
    const petName = e.petName?.trim();
    if (isEngravable(p) && !petName) {
      setErr(tr('Please type the pet name to engrave first.', 'נא להקליד את שם החיה לחריטה תחילה.'));
      return;
    }
    const mobile = e.ownerMobile?.trim();
    if (mobile && !validMobile(mobile)) {
      setErr(tr('Please enter a valid mobile (e.g. +972…, +61…).', 'נא להזין מספר נייד תקין (לדוגמה +972…, +61…).'));
      return;
    }
    setBusy(true); setErr(null);
    try {
      const body: Record<string, unknown> = { productId: p.id, quantity: 1 };
      if (isEngravable(p) && petName) {
        body.personalization = {
          petName,
          petNameLang: isHebrew(petName) ? 'he' : 'en',
          ...(e.ownerName?.trim() ? { ownerName: e.ownerName.trim() } : {}),
          ...(mobile ? { ownerMobile: mobile } : {}),
        };
      }
      await fetch(getApiUrl('/api/shop/cart/items'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      });
      if (petName) setEngraving(prev => ({ ...prev, [p.id]: {} }));
      await refreshCart(); setStep('cart'); setCartOpen(true);
    } catch (err) { logger.error('[ShopStore] add', err); }
    setBusy(false);
  }

  async function updateQty(item: CartItem, q: number) {
    setBusy(true);
    try {
      if (q <= 0) await fetch(getApiUrl(`/api/shop/cart/items/${item.id}`), { method: 'DELETE', credentials: 'include' });
      else await fetch(getApiUrl(`/api/shop/cart/items/${item.id}`), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ quantity: q }),
      });
      await refreshCart();
    } catch (e) { logger.error('[ShopStore] qty', e); }
    setBusy(false);
  }

  // Delivery fee disclosed in the cart BEFORE checkout (חוק הגנת הצרכן §17a —
  // the total the customer commits to must already include delivery). The fee
  // comes from the server estimate; until it loads, the pay button stays off
  // rather than showing a number that could change.
  const subtotalCents = cart?.subtotalCents ?? 0;
  const deliveryCents = !estimate || subtotalCents <= 0
    ? null
    : (subtotalCents >= estimate.freeThresholdCents ? 0 : estimate.standard.cents);
  const payTotalCents = deliveryCents === null ? null : subtotalCents + deliveryCents;

  useEffect(() => {
    if (!cart || cart.subtotalCents <= 0) { setEstimate(null); return; }
    const grams = cart.items.reduce((g, i) => g + (i.weight_grams || 0) * i.quantity, 0);
    const city = addresses?.find(a => a.id === addressId)?.city || '';
    fetch(getApiUrl(`/api/shop/delivery/estimate?subtotalCents=${cart.subtotalCents}&totalGrams=${grams}&city=${encodeURIComponent(city)}`), { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.standard) setEstimate(d); })
      .catch(e => logger.error('[ShopStore] delivery estimate', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.subtotalCents, addressId]);

  async function loadAddresses(preferId?: number) {
    try {
      const r = await fetch(getApiUrl('/api/shop/delivery/addresses'), { credentials: 'include' });
      const list: SavedAddress[] = r.ok ? await r.json() : [];
      setAddresses(list);
      if (list.length === 0) setAddingAddress(true);
      else setAddressId(prev => preferId ?? prev ?? (list.find(a => a.is_default) || list[0]).id);
    } catch (e) { logger.error('[ShopStore] addresses', e); setAddresses([]); setAddingAddress(true); }
  }

  function openCheckout() {
    setStep('checkout'); setErr(null);
    if (addresses === null) void loadAddresses();
  }

  async function saveAddress() {
    if (addr.fullName.trim().length < 2 || addr.phone.trim().length < 9 || addr.street.trim().length < 3 || addr.city.trim().length < 2) {
      setErr(tr('Please fill name, phone, street and city.', 'נא למלא שם, טלפון, רחוב ועיר.'));
      return;
    }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(getApiUrl('/api/shop/delivery/address'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          fullName: addr.fullName.trim(), phone: addr.phone.trim(), street: addr.street.trim(),
          city: addr.city.trim(), ...(addr.zipCode.trim() ? { zipCode: addr.zipCode.trim() } : {}),
          isDefault: !(addresses && addresses.length > 0),
        }),
      });
      if (r.ok) {
        const saved = await r.json();
        setAddingAddress(false);
        setAddr({ fullName: '', phone: '', street: '', city: '', zipCode: '' });
        await loadAddresses(saved.id);
      } else {
        const d = await r.json().catch(() => ({}));
        setErr(d.error || tr('Could not save the address.', 'שמירת הכתובת נכשלה.'));
      }
    } catch (e) { logger.error('[ShopStore] save address', e); setErr(tr('Could not save the address.', 'שמירת הכתובת נכשלה.')); }
    setBusy(false);
  }

  async function placeOrder() {
    if (!cart || payTotalCents === null) return;
    if (!addressId) { setErr(tr('Please choose a delivery address.', 'נא לבחור כתובת למשלוח.')); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(getApiUrl('/api/shop/checkout'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ cartId: cart.id, paymentMethod: 'wallet', deliveryMethod: 'delivery', deliveryAddressId: addressId, language }),
      });
      const d = await r.json();
      if (d.paymentUrl) { window.location.href = d.paymentUrl; return; }
      if (r.ok && (d.status === 'confirmed' || d.orderId)) { navigate('/shop/orders'); return; }
      setErr(d.error || tr('Checkout could not complete.', 'התשלום לא הושלם.'));
    } catch (e) { logger.error('[ShopStore] checkout', e); setErr(tr('Checkout could not complete.', 'התשלום לא הושלם.')); }
    setBusy(false);
  }

  function closeDrawer() { setCartOpen(false); setStep('cart'); }

  const fmtDate = (iso: string) => {
    try { return new Intl.DateTimeFormat(he ? 'he-IL' : 'en-IL', { day: 'numeric', month: 'long' }).format(new Date(iso)); }
    catch { return iso; }
  };

  // Full price disclosure — items, delivery, and the exact amount the wallet
  // will be charged. Rendered in BOTH drawer steps so the number never changes
  // between "what I saw" and "what I paid".
  const renderTotals = (showArrival = false) => (
    <div className="border-t pt-4 space-y-1 text-sm">
      <div className="flex justify-between text-gray-500">
        <span>{tr('Items (VAT incl.)', 'פריטים (כולל מע״מ)')}</span>
        <span>{shekel(subtotalCents)}</span>
      </div>
      <div className="flex justify-between text-gray-500">
        <span>{tr('Delivery', 'משלוח')}</span>
        <span>{deliveryCents === null ? '…' : deliveryCents === 0 ? tr('Free', 'חינם') : shekel(deliveryCents)}</span>
      </div>
      {estimate && deliveryCents !== null && deliveryCents > 0 && (
        <p className="text-xs text-gray-400">
          {tr(`Free delivery on orders over ${shekel(estimate.freeThresholdCents)}`,
              `משלוח חינם בהזמנה מעל ${shekel(estimate.freeThresholdCents)}`)}
        </p>
      )}
      {showArrival && estimate && (
        <div className="flex justify-between text-gray-500">
          <span>{tr('Estimated arrival', 'הגעה משוערת')}</span>
          <span>{fmtDate(estimate.standard.estimatedDate)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-base pt-1">
        <span>{tr('Total to pay', 'סה״כ לתשלום')}</span>
        <span>{payTotalCents === null ? '…' : shekel(payTotalCents)}</span>
      </div>
      <p className="text-[11px] text-gray-400">
        {tr('Includes VAT and delivery — nothing added at payment.', 'כולל מע״מ ומשלוח — ללא תוספות בתשלום.')}
      </p>
    </div>
  );

  const name = (p: { name_he: string; name_en: string | null }) => (he ? p.name_he : (p.name_en || p.name_he));
  const categories = products ? ['all', ...Array.from(new Set(products.map(p => p.category)))] : ['all'];
  const shown = products ? (category === 'all' ? products : products.filter(p => p.category === category)) : [];
  const cartCount = cart?.items.reduce((n, i) => n + i.quantity, 0) || 0;

  // ── Coming-soon (backend SHOP_ENABLED off) ──
  if (comingSoon) {
    return (
      <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
        <div className="min-h-screen luxury-bg-mesh flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <Sparkles className="w-10 h-10 mx-auto mb-4 text-black" strokeWidth={1.5} />
            <h1 className="luxury-heading-lg mb-3">{tr('The PetWash Shop is launching soon', 'חנות PetWash נפתחת בקרוב')}</h1>
            <p className="luxury-text-body">{tr('Keychains, treats, toys, games and care — crafted for your pet. Almost ready.', 'מחזיקי מפתחות, חטיפים, צעצועים, משחקים וטיפוח — כמעט מוכן.')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Hero + cart button */}
        <div className="luxury-services-hero">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div>
              <div className="luxury-badge luxury-badge-gold"><Sparkles className="h-5 w-5" /><span>{tr('The Shop', 'החנות')}</span></div>
              <h1 className="luxury-heading-xl mt-6">{tr('Everything your pet loves', 'כל מה שחיית המחמד שלך אוהבת')}</h1>
              {!CHECKOUT_OPEN && (
                <p className="text-xs tracking-wide text-gray-500 mt-3">
                  {tr('Preview collection · purchases opening soon', 'קולקציית תצוגה · הרכישה תיפתח בקרוב')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <button onClick={() => navigate('/shop/orders')} className="rounded-full border border-gray-300 p-3 bg-white hover:bg-gray-50" aria-label={tr('My orders', 'ההזמנות שלי')}>
                  <Package className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => { setStep('cart'); setCartOpen(true); }} className="relative rounded-full border border-gray-300 p-3 bg-white hover:bg-gray-50" aria-label={tr('Cart', 'עגלה')}>
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && <span className="absolute -top-1 -end-1 bg-black text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">{cartCount}</span>}
              </button>
            </div>
          </div>
        </div>

        {err && <p role="alert" className="text-center text-sm py-2" style={{ color: '#ef4444' }}>{err}</p>}

        {/* Category pills */}
        <div className="luxury-container flex flex-wrap gap-2 justify-center mb-8">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-2 text-xs font-medium border ${category === c ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {c === 'all' ? tr('All', 'הכל') : c}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="luxury-container pb-20">
          {products === null ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : shown.length === 0 ? (
            <p className="text-center luxury-text-body py-20">{tr('No products in this category yet.', 'אין מוצרים בקטגוריה זו עדיין.')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {shown.map(p => (
                <div key={p.id} className="luxury-glass-card luxury-hover-lift overflow-hidden flex flex-col">
                  <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt={name(p)} className="w-full h-full object-cover" loading="lazy" />
                      : <ShoppingBag className="w-10 h-10 text-gray-300" strokeWidth={1} />}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    {p.brand && <span className="text-[10px] uppercase tracking-wider text-gray-400">{p.brand}</span>}
                    <h3 className="luxury-heading-sm text-sm mb-1 flex-1">{name(p)}</h3>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-bold">{shekel(p.price_cents)}</span>
                      {p.compare_at_cents && p.compare_at_cents > p.price_cents &&
                        <span className="text-xs text-gray-400 line-through">{shekel(p.compare_at_cents)}</span>}
                    </div>
                    {isEngravable(p) && (
                      // ── Bespoke engraving — high-jewellery panel (black/gold + emerald·rose·gold gems) ──
                      <div className="relative rounded-2xl p-[1.5px] mb-3 bg-gradient-to-br from-amber-300 via-yellow-100 to-amber-400 shadow-[0_8px_30px_rgba(180,140,40,0.25)]">
                        <div className="rounded-2xl bg-gradient-to-b from-neutral-900 via-neutral-950 to-black p-4 space-y-2.5">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-emerald-300 text-[10px]">◇</span>
                            <span className="text-rose-300 text-[10px]">✦</span>
                            <span className="text-[10px] font-serif uppercase tracking-[0.25em] bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent">
                              {tr('Bespoke Engraving', 'חריטה יוקרתית בהזמנה')}
                            </span>
                            <span className="text-rose-300 text-[10px]">✦</span>
                            <span className="text-emerald-300 text-[10px]">◇</span>
                          </div>

                          {/* Pet name — Hebrew or English, RTL/LTR auto */}
                          <input
                            type="text" dir="auto" maxLength={40}
                            value={engraving[p.id]?.petName || ''}
                            onChange={e => setEng(p.id, 'petName', e.target.value.slice(0, 40))}
                            placeholder={tr("Pet's name · שם החיה", "שם החיה · Pet's name")}
                            className="w-full rounded-lg bg-white/[0.04] border border-amber-300/40 text-amber-50 placeholder-amber-200/30 px-3 py-2 text-xs focus:border-amber-300 focus:ring-1 focus:ring-amber-300/40 outline-none transition"
                            aria-label={tr('Pet name to engrave', 'שם החיה לחריטה')}
                          />
                          {/* Owner name */}
                          <input
                            type="text" dir="auto" maxLength={60}
                            value={engraving[p.id]?.ownerName || ''}
                            onChange={e => setEng(p.id, 'ownerName', e.target.value.slice(0, 60))}
                            placeholder={tr('Owner name (optional)', 'שם הבעלים (רשות)')}
                            className="w-full rounded-lg bg-white/[0.04] border border-amber-300/40 text-amber-50 placeholder-amber-200/30 px-3 py-2 text-xs focus:border-amber-300 focus:ring-1 focus:ring-amber-300/40 outline-none transition"
                            aria-label={tr('Owner name', 'שם הבעלים')}
                          />
                          {/* International mobile — defaults to +972, accepts any country */}
                          <input
                            type="tel" inputMode="tel" dir="ltr" maxLength={20}
                            value={engraving[p.id]?.ownerMobile || ''}
                            onFocus={() => { if (!engraving[p.id]?.ownerMobile) setEng(p.id, 'ownerMobile', '+972 '); }}
                            onChange={e => setEng(p.id, 'ownerMobile', e.target.value.slice(0, 20))}
                            placeholder="+972 50 000 0000  ·  +61 4xx xxx"
                            className="w-full rounded-lg bg-white/[0.04] border border-amber-300/40 text-amber-50 placeholder-amber-200/30 px-3 py-2 text-xs focus:border-amber-300 focus:ring-1 focus:ring-amber-300/40 outline-none transition"
                            aria-label={tr('Owner mobile (international)', 'נייד הבעלים (בינלאומי)')}
                          />

                          {/* Live engraved nameplate preview — metallic gold on black */}
                          {engraving[p.id]?.petName?.trim() && (
                            <div className="mt-1 rounded-xl p-[1px] bg-gradient-to-r from-emerald-400 via-amber-200 to-rose-300">
                              <div className="rounded-xl bg-black/90 px-4 py-3 text-center">
                                <span
                                  className="font-serif text-xl tracking-wide bg-gradient-to-r from-amber-200 via-yellow-50 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                                  dir="auto"
                                >
                                  {engraving[p.id]?.petName}
                                </span>
                                <p className="text-[8px] uppercase tracking-[0.3em] text-amber-200/40 mt-1">
                                  {tr('Engraving preview  ◇  18k finish', 'תצוגת חריטה  ◇  גימור זהב')}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* §14ג(ד)(4) disclosure BEFORE add-to-cart: custom-made goods
                              are exempt from the distance-sale cancellation right. */}
                          <p className="text-[9px] text-center tracking-wide text-amber-200/50">
                            {tr('Custom engraved · final sale (defects excepted)', 'חריטה אישית · ללא החזרה (למעט פגם)')}
                          </p>
                        </div>
                      </div>
                    )}
                    <button onClick={() => addToCart(p)} disabled={busy || p.stock_quantity <= 0}
                      className="w-full rounded-xl px-3 py-2 bg-black text-white text-xs font-medium disabled:opacity-40">
                      {p.stock_quantity <= 0 ? tr('Sold out', 'אזל מהמלאי') : tr('Add to cart', 'הוסף לעגלה')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart drawer — step 1 review, step 2 delivery address + final total.
            The total shown ALWAYS includes delivery before the customer commits. */}
        {cartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={closeDrawer}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative w-full max-w-sm bg-white h-full shadow-xl p-6 overflow-y-auto"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  {step === 'checkout' && (
                    <button onClick={() => setStep('cart')} aria-label={tr('Back to cart', 'חזרה לעגלה')}
                      className="border border-gray-200 rounded-full p-1.5 hover:border-gray-400">
                      <ArrowLeft className={`w-4 h-4 ${he ? 'scale-x-[-1]' : ''}`} />
                    </button>
                  )}
                  <h2 className="luxury-heading-md">
                    {step === 'cart' ? tr('Your cart', 'העגלה שלך') : tr('Delivery & payment', 'משלוח ותשלום')}
                  </h2>
                </div>
                <button onClick={closeDrawer} aria-label={tr('Close', 'סגור')}><X className="w-5 h-5" /></button>
              </div>

              {!cart || cart.items.length === 0 ? (
                <p className="luxury-text-body">{tr('Your cart is empty.', 'העגלה ריקה.')}</p>
              ) : step === 'cart' ? (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{name(item)}</p>
                          <p className="text-xs text-gray-500">{shekel(item.effectivePriceCents ?? item.price_cents)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item, item.quantity - 1)} disabled={busy} className="border rounded p-1" aria-label={tr('Less', 'פחות')}><Minus className="w-3 h-3" /></button>
                          <span className="text-sm w-5 text-center">{item.quantity}</span>
                          <button onClick={() => updateQty(item, item.quantity + 1)} disabled={busy} className="border rounded p-1" aria-label={tr('More', 'יותר')}><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderTotals()}
                  {CHECKOUT_OPEN ? (
                    <button onClick={openCheckout} disabled={busy || payTotalCents === null}
                      className="w-full mt-6 rounded-xl px-4 py-3 bg-black text-white text-sm font-medium disabled:opacity-40">
                      {tr('Continue to checkout', 'המשך לתשלום')}
                    </button>
                  ) : (
                    // Browse-only soft opening: server enforces the same block
                    // (POST /checkout → 503 CHECKOUT_NOT_OPEN).
                    <div className="mt-6 rounded-xl p-[1.5px] bg-gradient-to-br from-amber-300 via-yellow-100 to-amber-400">
                      <div className="rounded-xl bg-white px-4 py-3 text-center">
                        <span className="text-sm font-medium tracking-wide">
                          ✨ {tr('Purchases opening soon', 'הרכישה תיפתח בקרוב')}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-sm font-medium mb-3">{tr('Delivery address', 'כתובת למשלוח')}</h3>
                  {addresses === null ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {addresses.map(a => (
                        <label key={a.id}
                          className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer transition ${addressId === a.id ? 'border-black' : 'border-gray-200 hover:border-gray-400'}`}>
                          <input type="radio" name="ship-address" checked={addressId === a.id}
                            onChange={() => setAddressId(a.id)} className="mt-1 accent-black" />
                          <span className="text-sm min-w-0">
                            <span className="font-medium block">{a.full_name}</span>
                            <span className="text-gray-500 block">{a.street}, {a.city}</span>
                            <span className="text-gray-400 block" dir="ltr">{a.phone}</span>
                          </span>
                        </label>
                      ))}
                      {!addingAddress && (
                        <button onClick={() => setAddingAddress(true)} className="text-sm underline text-gray-600">
                          {tr('+ New address', '+ כתובת חדשה')}
                        </button>
                      )}
                    </div>
                  )}

                  {addingAddress && (
                    <div className="space-y-2 mb-4 border border-gray-200 rounded-xl p-3">
                      <input type="text" dir="auto" maxLength={120} value={addr.fullName} autoComplete="name"
                        onChange={e => setAddr(v => ({ ...v, fullName: e.target.value }))}
                        placeholder={tr('Full name', 'שם מלא')} aria-label={tr('Full name', 'שם מלא')}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
                      <input type="tel" inputMode="tel" dir="ltr" maxLength={20} value={addr.phone} autoComplete="tel"
                        onChange={e => setAddr(v => ({ ...v, phone: e.target.value }))}
                        placeholder="+972 50 000 0000" aria-label={tr('Phone', 'טלפון')}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
                      <input type="text" dir="auto" maxLength={200} value={addr.street} autoComplete="street-address"
                        onChange={e => setAddr(v => ({ ...v, street: e.target.value }))}
                        placeholder={tr('Street & number', 'רחוב ומספר')} aria-label={tr('Street & number', 'רחוב ומספר')}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
                      <div className="flex gap-2">
                        <input type="text" dir="auto" maxLength={80} value={addr.city} autoComplete="address-level2"
                          onChange={e => setAddr(v => ({ ...v, city: e.target.value }))}
                          placeholder={tr('City', 'עיר')} aria-label={tr('City', 'עיר')}
                          className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
                        <input type="text" inputMode="numeric" dir="ltr" maxLength={12} value={addr.zipCode} autoComplete="postal-code"
                          onChange={e => setAddr(v => ({ ...v, zipCode: e.target.value }))}
                          placeholder={tr('Zip (optional)', 'מיקוד (רשות)')} aria-label={tr('Zip code', 'מיקוד')}
                          className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-black outline-none" />
                      </div>
                      <button onClick={saveAddress} disabled={busy}
                        className="w-full rounded-lg px-3 py-2 border border-black text-sm font-medium disabled:opacity-40">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : tr('Save address', 'שמירת כתובת')}
                      </button>
                    </div>
                  )}

                  {renderTotals(true)}

                  {/* Returns/cancellation disclosure BEFORE payment — required for
                      distance sales (§14ג(ב)) and to enforce the custom-goods
                      exemption. Full policy: docs/legal/shop-returns-cancellation-
                      policy-2026-06-10.md */}
                  <details className="mt-4 text-xs text-gray-500">
                    <summary className="cursor-pointer select-none font-medium text-gray-600">
                      {tr('Cancellation & returns', 'מדיניות ביטול והחזרות')}
                    </summary>
                    <ul className="mt-2 space-y-1 ps-4 list-disc">
                      <li>{tr('Before dispatch — cancel from “My orders” for a full refund, no fee.',
                              'לפני המשלוח — ביטול מ"ההזמנות שלי" בהחזר מלא, ללא דמי ביטול.')}</li>
                      <li>{tr('After delivery — 14 days per the Consumer Protection Law; a cancellation fee of 5% or ₪100 (the lower) may apply on change of mind.',
                              'לאחר המסירה — 14 יום בהתאם לחוק הגנת הצרכן; בביטול שאינו עקב פגם ייתכנו דמי ביטול של 5% או ₪100, הנמוך מביניהם.')}</li>
                      <li>{tr('Custom-engraved items and perishable treats — final sale by law.',
                              'פריטים בחריטה אישית וחטיפים פסידים — ללא זכות ביטול על פי חוק.')}</li>
                      <li>{tr('Defective or wrong item — replacement or full refund, on us. Always.',
                              'פריט פגום או שגוי — החלפה או החזר מלא, על חשבוננו. תמיד.')}</li>
                    </ul>
                  </details>

                  <button onClick={placeOrder} disabled={busy || !addressId || payTotalCents === null}
                    className="w-full mt-4 rounded-xl px-4 py-3 bg-black text-white text-sm font-medium disabled:opacity-40">
                    {busy
                      ? <Loader2 className="w-4 h-4 animate-spin inline" />
                      : tr(`Pay ${payTotalCents !== null ? shekel(payTotalCents) : ''} from wallet`,
                           `לתשלום ${payTotalCents !== null ? shekel(payTotalCents) : ''} מהארנק`)}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
