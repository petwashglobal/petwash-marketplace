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
import { ShoppingBag, Plus, Minus, X, Loader2, Sparkles } from 'lucide-react';

interface ShopStoreProps { language: Language; onLanguageChange?: (l: Language) => void; }

interface Product {
  id: number; sku: string; name_he: string; name_en: string | null;
  category: string; brand: string | null; price_cents: number; compare_at_cents: number | null;
  stock_quantity: number; images: string[]; is_featured: boolean;
}
interface CartItem {
  id: number; product_id: number; quantity: number;
  name_he: string; name_en: string | null; price_cents: number;
  effectivePriceCents?: number; lineTotalCents?: number; images?: string[];
}
interface Cart { id: string; items: CartItem[]; subtotalCents: number; vatCents: number; totalCents: number; }

const shekel = (cents: number) => `₪${Math.round((cents || 0) / 100).toLocaleString('he-IL')}`;

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
    setBusy(true);
    try {
      await fetch(getApiUrl('/api/shop/cart/items'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ productId: p.id, quantity: 1 }),
      });
      await refreshCart(); setCartOpen(true);
    } catch (e) { logger.error('[ShopStore] add', e); }
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

  async function checkout() {
    if (!cart) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(getApiUrl('/api/shop/checkout'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ cartId: cart.id, paymentMethod: 'wallet', deliveryMethod: 'delivery', language }),
      });
      const d = await r.json();
      if (d.paymentUrl) { window.location.href = d.paymentUrl; return; }
      if (d.order || d.ok) { navigate('/shop/orders'); return; }
      setErr(d.error || tr('Checkout could not complete.', 'התשלום לא הושלם.'));
    } catch (e) { logger.error('[ShopStore] checkout', e); setErr(tr('Checkout could not complete.', 'התשלום לא הושלם.')); }
    setBusy(false);
  }

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
            </div>
            <button onClick={() => setCartOpen(true)} className="relative rounded-full border border-gray-300 p-3 bg-white hover:bg-gray-50" aria-label={tr('Cart', 'עגלה')}>
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && <span className="absolute -top-1 -end-1 bg-black text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">{cartCount}</span>}
            </button>
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

        {/* Cart drawer */}
        {cartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setCartOpen(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative w-full max-w-sm bg-white h-full shadow-xl p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="luxury-heading-md">{tr('Your cart', 'העגלה שלך')}</h2>
                <button onClick={() => setCartOpen(false)} aria-label={tr('Close', 'סגור')}><X className="w-5 h-5" /></button>
              </div>
              {!cart || cart.items.length === 0 ? (
                <p className="luxury-text-body">{tr('Your cart is empty.', 'העגלה ריקה.')}</p>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{name(item)}</p>
                          <p className="text-xs text-gray-500">{shekel(item.effectivePriceCents ?? item.price_cents)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item, item.quantity - 1)} disabled={busy} className="border rounded p-1"><Minus className="w-3 h-3" /></button>
                          <span className="text-sm w-5 text-center">{item.quantity}</span>
                          <button onClick={() => updateQty(item, item.quantity + 1)} disabled={busy} className="border rounded p-1"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-4 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-500"><span>{tr('VAT (incl.)', 'מע״מ (כלול)')}</span><span>{shekel(cart.vatCents)}</span></div>
                    <div className="flex justify-between font-bold text-base"><span>{tr('Total', 'סה״כ')}</span><span>{shekel(cart.totalCents)}</span></div>
                  </div>
                  <button onClick={checkout} disabled={busy}
                    className="w-full mt-6 rounded-xl px-4 py-3 bg-black text-white text-sm font-medium">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : tr('Checkout', 'לתשלום')}
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
