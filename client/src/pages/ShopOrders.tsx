/**
 * ShopOrders — "My orders" for the flag-gated shop (/shop/orders).
 *
 * Until now checkout navigated here and hit a 404 — this page closes the loop.
 * Wires the EXISTING backend only: GET /api/shop/orders (history),
 * GET /api/shop/orders/:id (detail), POST /api/shop/orders/:id/cancel
 * (allowed pre-dispatch; backend refunds the wallet and releases escrow).
 *
 * Same double gate as ShopStore: rendered only when VITE_SHOP_LIVE_ENABLED
 * is 'true'; degrades to a "launching soon" state when backend SHOP_ENABLED
 * is off (503).
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { type Language } from '@/lib/i18n';
import { getApiUrl } from '@/lib/apiConfig';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { logger } from '@/lib/logger';
import { Package, Loader2, ChevronDown, ChevronUp, Sparkles, Truck } from 'lucide-react';

interface ShopOrdersProps { language: Language; onLanguageChange?: (l: Language) => void; }

interface OrderRow {
  id: number; order_number: string; status: string;
  total_cents: number; created_at: string; item_count: number;
}
interface OrderItem {
  id: number; name_he: string; name_en: string | null;
  quantity: number; unit_price_cents: number; line_total_cents: number;
}
interface OrderDetail extends OrderRow {
  items: OrderItem[];
  subtotal_cents: number; delivery_cents: number; vat_cents: number;
  tracking_number: string | null; tracking_url: string | null;
  deliveryAddress: { full_name: string; street: string; city: string; phone: string } | null;
}

const shekel = (cents: number) => {
  const c = Number(cents) || 0;
  return c % 100 === 0
    ? `₪${Math.round(c / 100).toLocaleString('he-IL')}`
    : `₪${(c / 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Order states the backend writes today. Unknown states render as-is in gray.
const STATUS_LABELS: Record<string, { en: string; he: string; cls: string }> = {
  payment_required: { en: 'Awaiting payment', he: 'ממתינה לתשלום', cls: 'text-gray-600' },
  pending: { en: 'Received', he: 'התקבלה', cls: 'text-gray-600' },
  confirmed: { en: 'Confirmed', he: 'אושרה', cls: 'text-emerald-600' },
  dispatched: { en: 'On its way', he: 'בדרך אליך', cls: 'text-gray-900' },
  delivered: { en: 'Delivered', he: 'נמסרה', cls: 'text-emerald-700' },
  cancelled: { en: 'Cancelled', he: 'בוטלה', cls: 'text-gray-400' },
};
const CANCELLABLE = new Set(['pending', 'confirmed', 'payment_required']);

export default function ShopOrders({ language, onLanguageChange }: ShopOrdersProps) {
  const he = language === 'he';
  const tr = (en: string, hv: string) => (he ? hv : en);
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useFirebaseAuth();

  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [comingSoon, setComingSoon] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, OrderDetail>>({});
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [refundNote, setRefundNote] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/signin?redirect=/shop/orders'); return; }
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function loadOrders() {
    try {
      const r = await fetch(getApiUrl('/api/shop/orders'), { credentials: 'include' });
      if (r.status === 503) { setComingSoon(true); return; }
      if (!r.ok) { setErr(tr('Could not load your orders.', 'טעינת ההזמנות נכשלה.')); return; }
      const d = await r.json();
      setOrders((d.orders || []) as OrderRow[]);
    } catch (e) {
      logger.error('[ShopOrders] load', e);
      setErr(tr('Could not load your orders.', 'טעינת ההזמנות נכשלה.'));
    }
  }

  async function toggleDetail(id: number) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id); setConfirmCancelId(null);
    if (!detail[id]) {
      try {
        const r = await fetch(getApiUrl(`/api/shop/orders/${id}`), { credentials: 'include' });
        if (r.ok) { const d = await r.json(); setDetail(prev => ({ ...prev, [id]: d })); }
      } catch (e) { logger.error('[ShopOrders] detail', e); }
    }
  }

  async function cancelOrder(id: number) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(getApiUrl(`/api/shop/orders/${id}/cancel`), { method: 'POST', credentials: 'include' });
      const d = await r.json();
      if (r.ok && d.status === 'cancelled') {
        setRefundNote(tr(`Order cancelled — ${shekel(d.refundCents)} refunded to your wallet.`,
                         `ההזמנה בוטלה — ${shekel(d.refundCents)} הוחזרו לארנק שלך.`));
        setDetail(prev => { const next = { ...prev }; delete next[id]; return next; });
        await loadOrders();
      } else {
        setErr(d.error || tr('This order can no longer be cancelled.', 'לא ניתן עוד לבטל הזמנה זו.'));
      }
    } catch (e) {
      logger.error('[ShopOrders] cancel', e);
      setErr(tr('Cancellation failed. Please try again.', 'הביטול נכשל. נסו שוב.'));
    }
    setConfirmCancelId(null);
    setBusy(false);
  }

  const itemName = (i: OrderItem) => (he ? i.name_he : (i.name_en || i.name_he));
  const statusOf = (s: string) => STATUS_LABELS[s] || { en: s, he: s, cls: 'text-gray-500' };
  const fmtDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(he ? 'he-IL' : 'en-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
    } catch { return iso; }
  };

  if (comingSoon) {
    return (
      <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
        <div className="min-h-screen luxury-bg-mesh flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <Sparkles className="w-10 h-10 mx-auto mb-4 text-black" strokeWidth={1.5} />
            <h1 className="luxury-heading-lg mb-3">{tr('The PetWash Shop is launching soon', 'חנות PetWash נפתחת בקרוב')}</h1>
            <p className="luxury-text-body">{tr('Your orders will appear here.', 'ההזמנות שלך יופיעו כאן.')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
      <div className="min-h-screen luxury-bg-mesh">
        <div className="luxury-services-hero">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="luxury-badge luxury-badge-gold"><Package className="h-5 w-5" /><span>{tr('My orders', 'ההזמנות שלי')}</span></div>
            <h1 className="luxury-heading-xl mt-6">{tr('Your orders', 'ההזמנות שלך')}</h1>
          </div>
        </div>

        {refundNote && <p role="status" className="text-center text-sm py-2 text-emerald-700">{refundNote}</p>}
        {err && <p role="alert" className="text-center text-sm py-2" style={{ color: '#ef4444' }}>{err}</p>}

        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
          {orders === null ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-10 h-10 mx-auto mb-4 text-gray-300" strokeWidth={1} />
              <p className="luxury-text-body mb-6">{tr('No orders yet.', 'אין הזמנות עדיין.')}</p>
              <button onClick={() => navigate('/shop')}
                className="rounded-xl px-6 py-3 bg-black text-white text-sm font-medium">
                {tr('Browse the shop', 'לחנות')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(o => {
                const st = statusOf(o.status);
                const d = detail[o.id];
                const open = openId === o.id;
                return (
                  <div key={o.id} className="luxury-glass-card overflow-hidden">
                    <button onClick={() => void toggleDetail(o.id)}
                      className="w-full flex items-center justify-between gap-3 p-4 text-start"
                      aria-expanded={open}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium"><bdi dir="ltr">#{o.order_number}</bdi></p>
                        <p className="text-xs text-gray-500">{fmtDate(o.created_at)} · {o.item_count} {tr('items', 'פריטים')}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-medium ${st.cls}`}>{he ? st.he : st.en}</span>
                        <span className="font-bold text-sm">{shekel(o.total_cents)}</span>
                        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>

                    {open && (
                      <div className="border-t border-gray-100 p-4 space-y-4">
                        {!d ? (
                          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              {d.items.map(i => (
                                <div key={i.id} className="flex justify-between text-sm">
                                  <span className="min-w-0">{itemName(i)} × {i.quantity}</span>
                                  <span className="text-gray-500 shrink-0">{shekel(i.line_total_cents)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
                              <div className="flex justify-between text-gray-500">
                                <span>{tr('Delivery', 'משלוח')}</span>
                                <span>{Number(d.delivery_cents) === 0 ? tr('Free', 'חינם') : shekel(d.delivery_cents)}</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>{tr('VAT (incl.)', 'מע״מ (כלול)')}</span>
                                <span>{shekel(d.vat_cents)}</span>
                              </div>
                              <div className="flex justify-between font-bold">
                                <span>{tr('Total', 'סה״כ')}</span>
                                <span>{shekel(d.total_cents)}</span>
                              </div>
                            </div>
                            {d.deliveryAddress && (
                              <p className="text-xs text-gray-500">
                                <Truck className="w-3.5 h-3.5 inline me-1" />
                                {d.deliveryAddress.full_name} · {d.deliveryAddress.street}, {d.deliveryAddress.city}
                              </p>
                            )}
                            {d.tracking_number && (
                              <p className="text-xs text-gray-500">
                                {tr('Tracking', 'מעקב')}: {d.tracking_url
                                  ? <a href={d.tracking_url} target="_blank" rel="noopener noreferrer" className="underline"><bdi dir="ltr">{d.tracking_number}</bdi></a>
                                  : <bdi dir="ltr">{d.tracking_number}</bdi>}
                              </p>
                            )}
                            {CANCELLABLE.has(o.status) && (
                              confirmCancelId === o.id ? (
                                <div className="flex items-center gap-2">
                                  <button onClick={() => void cancelOrder(o.id)} disabled={busy}
                                    className="rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
                                    style={{ backgroundColor: '#ef4444' }}>
                                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : tr('Yes, cancel & refund', 'כן, לבטל ולקבל החזר')}
                                  </button>
                                  <button onClick={() => setConfirmCancelId(null)} disabled={busy}
                                    className="rounded-lg px-3 py-2 text-xs border border-gray-300">
                                    {tr('Keep order', 'להשאיר את ההזמנה')}
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmCancelId(o.id)}
                                  className="text-xs text-gray-500 underline">
                                  {tr('Cancel order (full refund before dispatch)', 'ביטול הזמנה (החזר מלא לפני משלוח)')}
                                </button>
                              )
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
