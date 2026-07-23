/**
 * Shop Products Manager — the edit/update/save panel the shop was missing.
 *
 * Backed 100% by the EXISTING admin API (server/routes/shop.ts):
 *   GET    /api/shop/products                 (public list — includes inactive? no: active)
 *   POST   /api/shop/admin/products           (create)
 *   PATCH  /api/shop/admin/products/:id       (partial update — price/stock/names)
 *   DELETE /api/shop/admin/products/:id       (soft-delete → is_active=false)
 *
 * This is how the CEO's signed supplier catalog gets loaded: add items here
 * (no prices shown publicly while the shop display flag is off; the closed
 * /shop page previews non-EX items automatically).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ArrowRight, Plus, Save, Trash2, Loader2, ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/apiConfig';

const GOLD = '#D4AF37';
const DEEP = '#063B22';

interface Product {
  id: number;
  sku: string;
  name_he: string;
  name_en: string;
  category: string;
  price_cents: number;
  compare_at_cents: number | null;
  stock_quantity: number;
  is_featured: boolean;
}

export default function AdminShopProducts() {
  const [, nav] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<number, Partial<Product>>>({});
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ sku: '', name_he: '', name_en: '', category: 'treats', price_cents: 0, stock_quantity: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-shop-products'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/shop/products'));
      const d = await res.json();
      return (Array.isArray(d) ? d : d.products ?? []) as Product[];
    },
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Product> }) => {
      const res = await apiRequest('PATCH', `/api/shop/admin/products/${id}`, patch);
      if (!res.ok) throw new Error('save_failed');
      return res.json();
    },
    onSuccess: (_d, { id }) => {
      setEdits((e) => { const n = { ...e }; delete n[id]; return n; });
      qc.invalidateQueries({ queryKey: ['admin-shop-products'] });
      toast({ title: 'נשמר ✓' });
    },
    onError: () => toast({ title: 'שמירה נכשלה', variant: 'destructive' }),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/shop/admin/products', draft);
      if (!res.ok) throw new Error('create_failed');
      return res.json();
    },
    onSuccess: () => {
      setCreating(false);
      setDraft({ sku: '', name_he: '', name_en: '', category: 'treats', price_cents: 0, stock_quantity: 0 });
      qc.invalidateQueries({ queryKey: ['admin-shop-products'] });
      toast({ title: 'מוצר נוצר ✓' });
    },
    onError: () => toast({ title: 'יצירה נכשלה', variant: 'destructive' }),
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/shop/admin/products/${id}`);
      if (!res.ok) throw new Error('delete_failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-products'] });
      toast({ title: 'הוסר מהחנות ✓' });
    },
    onError: () => toast({ title: 'הסרה נכשלה', variant: 'destructive' }),
  });

  const setField = (id: number, field: keyof Product, value: any) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#FAFAF7]" data-testid="admin-shop-products">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <button type="button" onClick={() => nav('/admin/octopus')} className="mb-4 flex items-center gap-1 text-sm text-neutral-500">
          <ArrowRight className="h-4 w-4" /> Octopus
        </button>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold" style={{ color: DEEP }}>
            <ShoppingBag className="h-6 w-6" style={{ color: GOLD }} /> ניהול מוצרי חנות
          </h1>
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold"
            style={{ background: DEEP, color: 'white' }}
            data-testid="shop-admin-new"
          >
            <Plus className="h-4 w-4" /> מוצר חדש
          </button>
        </div>

        <p className="mb-4 text-sm text-neutral-500">
          מוצרים עם SKU שמתחיל ב־EX הם דוגמאות ולא יוצגו ללקוחות. פריטי הספק האמיתיים
          יופיעו אוטומטית בעמוד החנות (ללא מחירים כל עוד החנות סגורה).
        </p>

        {creating && (
          <div className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-3" style={{ borderColor: `${GOLD}66` }} data-testid="shop-admin-create-form">
            {([['sku', 'SKU'], ['name_he', 'שם בעברית'], ['name_en', 'שם באנגלית'], ['category', 'קטגוריה']] as const).map(([f, label]) => (
              <label key={f} className="text-xs font-semibold text-neutral-600">
                {label}
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={(draft as any)[f]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
                />
              </label>
            ))}
            <label className="text-xs font-semibold text-neutral-600">
              מחיר (אגורות)
              <input type="number" className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={draft.price_cents} onChange={(e) => setDraft((d) => ({ ...d, price_cents: Number(e.target.value) }))} />
            </label>
            <label className="text-xs font-semibold text-neutral-600">
              מלאי
              <input type="number" className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={draft.stock_quantity} onChange={(e) => setDraft((d) => ({ ...d, stock_quantity: Number(e.target.value) }))} />
            </label>
            <div className="col-span-2 sm:col-span-3">
              <button
                type="button"
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !draft.sku || !draft.name_he}
                className="flex items-center gap-1 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-40"
                style={{ background: GOLD, color: DEEP }}
              >
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} שמירת מוצר
              </button>
            </div>
          </div>
        )}

        {isLoading && <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />}

        <div className="space-y-2">
          {(data ?? []).map((p) => {
            const e = edits[p.id] ?? {};
            const dirty = Object.keys(e).length > 0;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3" style={{ borderColor: p.sku.startsWith('EX-') ? '#E5E5E5' : `${GOLD}55` }} data-testid={`shop-admin-row-${p.id}`}>
                <span className={`w-28 shrink-0 font-mono text-[11px] ${p.sku.startsWith('EX-') ? 'text-neutral-400' : 'text-neutral-600'}`}>{p.sku}</span>
                <input
                  className="min-w-[10rem] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                  value={(e.name_he ?? p.name_he) || ''}
                  onChange={(ev) => setField(p.id, 'name_he', ev.target.value)}
                />
                <label className="flex items-center gap-1 text-xs text-neutral-500">
                  ₪
                  <input
                    type="number"
                    step="0.1"
                    className="w-20 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                    value={((e.price_cents ?? p.price_cents) / 100).toString()}
                    onChange={(ev) => setField(p.id, 'price_cents', Math.round(Number(ev.target.value) * 100))}
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-neutral-500">
                  מלאי
                  <input
                    type="number"
                    className="w-16 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                    value={String(e.stock_quantity ?? p.stock_quantity)}
                    onChange={(ev) => setField(p.id, 'stock_quantity', Number(ev.target.value))}
                  />
                </label>
                <button
                  type="button"
                  disabled={!dirty || patchMut.isPending}
                  onClick={() => patchMut.mutate({ id: p.id, patch: e })}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-30"
                  style={{ background: dirty ? GOLD : '#eee', color: DEEP }}
                  data-testid={`shop-admin-save-${p.id}`}
                >
                  <Save className="h-3.5 w-3.5" /> שמור
                </button>
                <button
                  type="button"
                  onClick={() => { if (window.confirm(`להסיר את "${p.name_he}" מהחנות? (הסרה רכה — ניתן להחזיר)`)) delMut.mutate(p.id); }}
                  className="rounded-lg border border-red-200 p-1.5 text-red-500"
                  data-testid={`shop-admin-delete-${p.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
