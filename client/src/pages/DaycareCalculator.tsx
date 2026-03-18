/**
 * DaycareCalculator — Smart price calculator with Gemini AI
 * Multi-pet math: 2 dogs + 1 cat for a week
 * Shows: base rates, multi-pet discount, weekly discount, flash deal discount, VAT (18% Israel)
 * Gemini AI generates a friendly Hebrew/English explanation of the breakdown
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Calculator, Sparkles, ChevronLeft, Info } from 'lucide-react';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type PetType = 'dog' | 'cat';
type PetSize = 'small' | 'medium' | 'large' | 'giant';

interface Pet {
  id: string;
  type: PetType;
  size: PetSize;
  name: string;
}

interface CalcResult {
  breakdown: {
    petBreakdowns: { name: string; dailyRate: number; days: number; subtotal: number }[];
    baseTotal: number;
    multiPetDiscount: { rate: number; saving: number };
    weeklyDiscount: { rate: number; saving: number };
    flashDiscount: { rate: number; saving: number };
    subtotalBeforeVat: number;
    vatAmount: number;
    vatRate: number;
    grandTotal: number;
    totalSavings: number;
    pricePerDayPerPet: number;
  };
  aiExplanation: string | null;
  summary: {
    totalPets: number;
    totalDays: number;
    grandTotalILS: number;
    totalSavingsILS: number;
    savingsPercent: number;
  };
}

const SIZE_LABELS: Record<PetSize, string> = {
  small: 'Small (< 5 kg)',
  medium: 'Medium (5–20 kg)',
  large: 'Large (20–40 kg)',
  giant: 'Giant (> 40 kg)',
};

const GOLD = '#C5A55A';

function uid() { return Math.random().toString(36).slice(2, 8); }

export default function DaycareCalculator() {
  const [pets, setPets] = useState<Pet[]>([
    { id: uid(), type: 'dog', size: 'medium', name: 'Dog 1' },
    { id: uid(), type: 'dog', size: 'medium', name: 'Dog 2' },
    { id: uid(), type: 'cat', size: 'small',  name: 'Cat 1' },
  ]);
  const [days, setDays] = useState(7);
  const [flashDiscount, setFlashDiscount] = useState(0);
  const [language, setLanguage] = useState<'he' | 'en'>('en');
  const [result, setResult] = useState<CalcResult | null>(null);
  const { toast } = useToast();

  const calcMutation = useMutation({
    mutationFn: (body: object) => apiRequest('POST', '/api/daycare-calculator/calculate', body) as Promise<CalcResult>,
    onSuccess: (data) => setResult(data),
    onError: () => toast({ title: 'Calculation failed', variant: 'destructive' }),
  });

  function addPet(type: PetType) {
    if (pets.length >= 6) return;
    const count = pets.filter(p => p.type === type).length + 1;
    setPets(prev => [...prev, { id: uid(), type, size: 'medium', name: `${type === 'dog' ? 'Dog' : 'Cat'} ${count}` }]);
  }

  function removePet(id: string) {
    setPets(prev => prev.filter(p => p.id !== id));
  }

  function updatePet(id: string, field: keyof Pet, value: string) {
    setPets(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  function calculate() {
    if (pets.length === 0) {
      toast({ title: 'Add at least one pet', variant: 'destructive' });
      return;
    }
    calcMutation.mutate({
      pets: pets.map(p => ({ type: p.type, size: p.size, name: p.name })),
      days,
      flashDiscountPercent: flashDiscount,
      language,
    });
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-white border-b border-gray-100"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)', paddingBottom: 16 }}
      >
        <div className="max-w-lg mx-auto px-5 flex items-center gap-3">
          <Link href="/">
            <button className="text-gray-400 hover:text-gray-700 transition-colors" style={{ touchAction: 'manipulation' }}>
              <ChevronLeft size={20} strokeWidth={1.5} />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <Calculator size={16} style={{ color: GOLD }} />
            <span className="text-[14px] font-medium text-gray-900">Daycare Calculator</span>
          </div>
          <div className="ml-auto flex gap-1">
            {(['en', 'he'] as ('en' | 'he')[]).map(l => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: language === l ? '#111' : '#f5f5f5',
                  color: language === l ? 'white' : '#666',
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide transition-all"
              >
                {l === 'en' ? 'EN' : 'עב'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Intro */}
        <div>
          <h1 className="text-[18px] font-light text-gray-900 tracking-tight mb-1">
            Smart Daycare Pricing
          </h1>
          <p className="text-[12px] text-gray-400 leading-relaxed">
            Multi-pet math with Gemini AI · VAT 18% included · Flash deal compatible
          </p>
        </div>

        {/* Pets section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-medium text-gray-700 tracking-wide uppercase">Your Pets</p>
            <div className="flex gap-2">
              <button
                onClick={() => addPet('dog')}
                disabled={pets.length >= 6}
                style={{ touchAction: 'manipulation', borderColor: '#e5e5e5' }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] text-gray-600 hover:border-gray-400 transition-all disabled:opacity-40"
              >
                <Plus size={10} /> Dog
              </button>
              <button
                onClick={() => addPet('cat')}
                disabled={pets.length >= 6}
                style={{ touchAction: 'manipulation', borderColor: '#e5e5e5' }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] text-gray-600 hover:border-gray-400 transition-all disabled:opacity-40"
              >
                <Plus size={10} /> Cat
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {pets.map(pet => (
              <motion.div
                key={pet.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ border: '1px solid #f0f0f0', backgroundColor: '#fafafa' }}
              >
                <span className="text-[18px]">{pet.type === 'dog' ? '🐕' : '🐈'}</span>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    value={pet.name}
                    onChange={e => updatePet(pet.id, 'name', e.target.value)}
                    className="text-[12px] text-gray-800 bg-transparent border-b border-gray-200 focus:outline-none focus:border-gray-400 pb-0.5"
                    placeholder="Name"
                  />
                  <select
                    value={pet.size}
                    onChange={e => updatePet(pet.id, 'size', e.target.value as PetSize)}
                    className="text-[11px] text-gray-600 bg-transparent border-b border-gray-200 focus:outline-none focus:border-gray-400 pb-0.5"
                  >
                    {(Object.entries(SIZE_LABELS) as [PetSize, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => removePet(pet.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Trash2 size={13} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Days selector */}
        <div>
          <p className="text-[12px] font-medium text-gray-700 tracking-wide uppercase mb-3">Number of Days</p>
          <div className="flex gap-2 flex-wrap">
            {[1, 3, 5, 7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: days === d ? '#111' : '#f5f5f5',
                  color: days === d ? 'white' : '#555',
                }}
                className="px-4 py-2 rounded-xl text-[12px] font-medium transition-all"
              >
                {d === 7 ? '1 week' : d === 14 ? '2 weeks' : d === 30 ? '1 month' : `${d}d`}
              </button>
            ))}
          </div>
          {days >= 7 && (
            <p className="text-[11px] mt-2" style={{ color: '#16A34A' }}>
              Weekly discount applies (12% off)
            </p>
          )}
        </div>

        {/* Flash deal discount */}
        <div>
          <p className="text-[12px] font-medium text-gray-700 tracking-wide uppercase mb-3">
            Flash Deal Discount
            <Link href="/flash-deals">
              <span className="ml-2 text-[10px] normal-case font-normal underline" style={{ color: GOLD }}>
                Browse deals
              </span>
            </Link>
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={40}
              step={5}
              value={flashDiscount}
              onChange={e => setFlashDiscount(Number(e.target.value))}
              className="flex-1 accent-amber-600"
            />
            <span
              className="text-[13px] font-medium w-12 text-right"
              style={{ color: flashDiscount > 0 ? '#D97706' : '#ccc' }}
            >
              {flashDiscount > 0 ? `-${flashDiscount}%` : 'None'}
            </span>
          </div>
        </div>

        {/* Calculate button */}
        <button
          onClick={calculate}
          disabled={calcMutation.isPending || pets.length === 0}
          style={{ touchAction: 'manipulation', backgroundColor: '#111' }}
          className="w-full py-4 rounded-2xl text-white text-[12px] font-medium tracking-[0.1em] uppercase transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {calcMutation.isPending ? (
            <>
              <Sparkles size={14} className="animate-spin" />
              Calculating with AI...
            </>
          ) : (
            <>
              <Calculator size={14} />
              Calculate Price
            </>
          )}
        </button>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Grand total card */}
              <div
                className="rounded-3xl overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}
              >
                <div
                  className="h-1"
                  style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
                />
                <div className="px-6 py-6">
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <p className="text-[10px] tracking-[0.15em] text-gray-400 uppercase mb-1">Grand Total</p>
                      <p className="text-[32px] font-light text-gray-900 tracking-tight">
                        ₪{result.breakdown.grandTotal.toLocaleString()}
                      </p>
                    </div>
                    {result.summary.totalSavingsILS > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 mb-0.5">You save</p>
                        <p className="text-[16px] font-medium" style={{ color: '#16A34A' }}>
                          ₪{result.summary.totalSavingsILS}
                        </p>
                        <p className="text-[10px]" style={{ color: '#16A34A' }}>
                          {result.summary.savingsPercent}% off
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Line items */}
                  <div className="space-y-2 border-t border-gray-100 pt-4">
                    {result.breakdown.petBreakdowns.map((p, i) => (
                      <div key={i} className="flex justify-between text-[12px]">
                        <span className="text-gray-600">{p.name} × {p.days}d</span>
                        <span className="text-gray-800">₪{p.subtotal}</span>
                      </div>
                    ))}

                    {result.breakdown.multiPetDiscount.saving > 0 && (
                      <div className="flex justify-between text-[12px]" style={{ color: '#16A34A' }}>
                        <span>Multi-pet discount ({Math.round(result.breakdown.multiPetDiscount.rate * 100)}%)</span>
                        <span>-₪{result.breakdown.multiPetDiscount.saving}</span>
                      </div>
                    )}
                    {result.breakdown.weeklyDiscount.saving > 0 && (
                      <div className="flex justify-between text-[12px]" style={{ color: '#16A34A' }}>
                        <span>Weekly discount (12%)</span>
                        <span>-₪{result.breakdown.weeklyDiscount.saving}</span>
                      </div>
                    )}
                    {result.breakdown.flashDiscount.saving > 0 && (
                      <div className="flex justify-between text-[12px]" style={{ color: '#D97706' }}>
                        <span>Flash deal ({Math.round(result.breakdown.flashDiscount.rate * 100)}%)</span>
                        <span>-₪{result.breakdown.flashDiscount.saving}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-[12px] border-t border-gray-100 pt-2">
                      <span className="text-gray-600">Subtotal (excl. VAT)</span>
                      <span className="text-gray-800">₪{result.breakdown.subtotalBeforeVat}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-gray-400 flex items-center gap-1">
                        VAT 18% (Israel)
                        <Info size={10} className="text-gray-300" />
                      </span>
                      <span className="text-gray-600">₪{result.breakdown.vatAmount}</span>
                    </div>
                    <div className="flex justify-between text-[13px] font-medium border-t border-gray-200 pt-2">
                      <span className="text-gray-900">Total</span>
                      <span className="text-gray-900">₪{result.breakdown.grandTotal}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 mt-3 text-center">
                    ₪{result.breakdown.pricePerDayPerPet} per pet / per day · VAT included · Reg. 516788400
                  </p>
                </div>
              </div>

              {/* Gemini AI explanation */}
              {result.aiExplanation && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="px-5 py-4 rounded-2xl"
                  style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={12} style={{ color: '#B45309' }} />
                    <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: '#B45309' }}>
                      AI Breakdown
                    </span>
                  </div>
                  <p
                    className="text-[12px] text-gray-700 leading-relaxed"
                    style={{ direction: language === 'he' ? 'rtl' : 'ltr' }}
                  >
                    {result.aiExplanation}
                  </p>
                </motion.div>
              )}

              {/* Book CTA */}
              <Link href="/flash-deals">
                <button
                  style={{ touchAction: 'manipulation', backgroundColor: GOLD }}
                  className="w-full py-4 rounded-2xl text-white text-[12px] font-medium tracking-[0.08em] uppercase transition-all active:scale-[0.98]"
                >
                  Browse Deals for This Price
                </button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
