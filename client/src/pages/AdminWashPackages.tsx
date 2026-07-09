/**
 * AdminWashPackages — /admin/wash-packages (2026-07-09)
 *
 * Lets the CEO set the homepage wash packages + prices himself. The public
 * /api/packages returns only ACTIVE packages; prod was empty (section blank) and
 * the only source was a STALE hardcoded seed (₪39 vs the live ₪48). Here he can
 * add / edit / activate packages with real prices — no code deploy, no guessing.
 * The homepage populates the moment a package is active.
 *
 * Admin-gated on the server (requireAdmin on every /api/admin/wash-packages route).
 */
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Save, Check, X } from 'lucide-react';

interface WashPackage {
  id: number;
  name: string;
  nameHe: string;
  description?: string | null;
  descriptionHe?: string | null;
  price: string;
  washCount: number;
  isActive: boolean;
}

type Draft = {
  name: string; nameHe: string; description: string; descriptionHe: string;
  price: string; washCount: string; isActive: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: '', nameHe: '', description: '', descriptionHe: '', price: '', washCount: '', isActive: true,
};

function refreshEverywhere() {
  queryClient.invalidateQueries({ queryKey: ['/api/admin/wash-packages'] });
  queryClient.invalidateQueries({ queryKey: ['/api/packages'] }); // homepage reads this
}

export default function AdminWashPackages() {
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<number, Partial<Draft>>>({});
  const [newPkg, setNewPkg] = useState<Draft>(EMPTY_DRAFT);
  const [showNew, setShowNew] = useState(false);

  const { data: packages, isLoading, isError } = useQuery<WashPackage[]>({
    queryKey: ['/api/admin/wash-packages'],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, any> }) =>
      apiRequest('PATCH', `/api/admin/wash-packages/${id}`, patch),
    onSuccess: () => { refreshEverywhere(); toast({ title: 'Package updated' }); },
    onError: (e: any) => toast({ title: 'Update failed', description: String(e?.message || e), variant: 'destructive' }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => apiRequest('POST', '/api/admin/wash-packages', payload),
    onSuccess: () => {
      refreshEverywhere();
      setNewPkg(EMPTY_DRAFT); setShowNew(false);
      toast({ title: 'Package created' });
    },
    onError: (e: any) => toast({ title: 'Create failed', description: String(e?.message || e), variant: 'destructive' }),
  });

  const setEdit = (id: number, field: keyof Draft, value: any) =>
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const saveRow = (pkg: WashPackage) => {
    const e = edits[pkg.id];
    if (!e) return;
    const patch: Record<string, any> = {};
    if (e.name !== undefined) patch.name = e.name;
    if (e.nameHe !== undefined) patch.nameHe = e.nameHe;
    if (e.price !== undefined) patch.price = String(e.price);
    if (e.washCount !== undefined) patch.washCount = Number(e.washCount);
    if (e.isActive !== undefined) patch.isActive = e.isActive;
    if (Object.keys(patch).length === 0) return;
    updateMutation.mutate({ id: pkg.id, patch });
    setEdits(prev => { const n = { ...prev }; delete n[pkg.id]; return n; });
  };

  const createNew = () => {
    if (!newPkg.name.trim() || !newPkg.nameHe.trim() || !newPkg.price.trim() || !newPkg.washCount.trim()) {
      toast({ title: 'Fill name, Hebrew name, price and wash count', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      name: newPkg.name.trim(),
      nameHe: newPkg.nameHe.trim(),
      description: newPkg.description.trim() || null,
      descriptionHe: newPkg.descriptionHe.trim() || null,
      price: String(newPkg.price).trim(),
      washCount: Number(newPkg.washCount),
      isActive: newPkg.isActive,
    });
  };

  const cell = (id: number, field: keyof Draft, current: any, type = 'text', width = 'w-full') => (
    <input
      type={type}
      value={edits[id]?.[field] ?? current}
      onChange={e => setEdit(id, field, type === 'number' ? e.target.value : e.target.value)}
      className={`${width} rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-[#D4AF37] outline-none`}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Wash Packages</h1>
          <button
            onClick={() => setShowNew(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1a1a] text-white text-sm font-medium hover:bg-black"
            data-testid="add-package"
          >
            <Plus className="w-4 h-4" /> New package
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          These are the prepaid wash packages shown on the homepage. Only <strong>active</strong> packages appear to customers.
          Prices are the amount the customer pays (VAT-inclusive).
        </p>

        {showNew && (
          <div className="bg-white border border-[#D4AF37]/40 rounded-2xl p-5 mb-6 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-gray-500">Name (EN)
              <input value={newPkg.name} onChange={e => setNewPkg(v => ({ ...v, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Single Wash" />
            </label>
            <label className="text-xs font-semibold text-gray-500">שם (HE)
              <input value={newPkg.nameHe} onChange={e => setNewPkg(v => ({ ...v, nameHe: e.target.value }))}
                dir="rtl" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="רחיצה בודדת" />
            </label>
            <label className="text-xs font-semibold text-gray-500">Price ₪ (VAT-incl)
              <input type="number" step="0.01" value={newPkg.price} onChange={e => setNewPkg(v => ({ ...v, price: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="55.00" />
            </label>
            <label className="text-xs font-semibold text-gray-500">Wash count
              <input type="number" value={newPkg.washCount} onChange={e => setNewPkg(v => ({ ...v, washCount: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="1" />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
              <input type="checkbox" checked={newPkg.isActive} onChange={e => setNewPkg(v => ({ ...v, isActive: e.target.checked }))} />
              Active (visible on the homepage)
            </label>
            <div className="sm:col-span-2">
              <button onClick={createNew} disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] text-black text-sm font-semibold disabled:opacity-60">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : isError ? (
          <p className="text-red-500 text-sm">Could not load packages.</p>
        ) : !packages || packages.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-500">
            No packages yet. The homepage packages section stays hidden until you add an active package.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_90px_110px_90px_80px] gap-2 px-4 py-3 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <span>Name (EN)</span><span>שם (HE)</span><span>Washes</span><span>Price ₪</span><span>Active</span><span></span>
            </div>
            {packages.map(pkg => {
              const dirty = !!edits[pkg.id];
              const activeVal = edits[pkg.id]?.isActive ?? pkg.isActive;
              return (
                <div key={pkg.id} className="grid grid-cols-[1fr_1fr_90px_110px_90px_80px] gap-2 px-4 py-3 items-center border-t border-gray-100"
                  data-testid={`package-row-${pkg.id}`}>
                  {cell(pkg.id, 'name', pkg.name)}
                  {cell(pkg.id, 'nameHe', pkg.nameHe)}
                  {cell(pkg.id, 'washCount', pkg.washCount, 'number')}
                  {cell(pkg.id, 'price', pkg.price, 'number')}
                  <button
                    onClick={() => setEdit(pkg.id, 'isActive', !activeVal)}
                    className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                      activeVal ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {activeVal ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    {activeVal ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => saveRow(pkg)}
                    disabled={!dirty || updateMutation.isPending}
                    className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold bg-[#1a1a1a] text-white disabled:opacity-30"
                    data-testid={`save-package-${pkg.id}`}
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
