/**
 * FlashDeals — Provider limited-time discount marketplace
 * Airbnb/dynamic pricing style: urgency, countdown, slot scarcity
 * Supports 2 dogs + 1 cat weekly bookings as requested
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Zap, Clock, MapPin, Dog, Star, Filter, CheckCircle2, AlertCircle, ChevronLeft } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

type ServiceFilter = 'all' | 'grooming' | 'walking' | 'daycare' | 'k9000';
type PetFilter = 'all' | 'dog' | 'cat';

const SERVICE_LABELS: Record<string, string> = {
  grooming: 'Grooming',
  walking: 'Walking',
  daycare: 'Daycare',
  k9000: 'K9000 Wash',
  all: 'All Services',
};

const URGENCY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: '#FEF2F2', text: '#DC2626', label: 'Last slots!' },
  high:     { bg: '#FFFBEB', text: '#D97706', label: 'Filling fast' },
  normal:   { bg: '#F0FDF4', text: '#16A34A', label: 'Available' },
};

function formatHours(h: number): string {
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  return `${h}h left`;
}

function SlotBar({ fill, urgency }: { fill: number; urgency: string }) {
  const colors = {
    critical: '#DC2626',
    high: '#D97706',
    normal: '#16A34A',
  };
  return (
    <div className="w-full h-1 bg-white rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: colors[urgency as keyof typeof colors] || '#16A34A' }}
        initial={{ width: 0 }}
        animate={{ width: `${fill}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

interface Deal {
  id: string;
  providerName: string;
  serviceType: string;
  petTypes: string[];
  discountPercent: number;
  originalPrice: number;
  discountedPrice: number;
  savingsAmount: number;
  slotsRemaining: number;
  slotsTotal: number;
  validUntil: string;
  headline: string;
  headlineHe: string;
  location: string;
  urgencyLevel: string;
  hoursLeft: number;
  fillPercent: number;
}

export default function FlashDeals() {
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [petFilter, setPetFilter] = useState<PetFilter>('all');
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<{ deals: Deal[] }>({
    queryKey: ['/api/flash-deals', serviceFilter, petFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (serviceFilter !== 'all') params.set('serviceType', serviceFilter);
      if (petFilter !== 'all') params.set('petType', petFilter);
      const r = await fetch(`/api/flash-deals?${params}`);
      return r.json();
    },
    refetchInterval: 30000,
  });

  const claimMutation = useMutation({
    mutationFn: async ({ dealId, numPets }: { dealId: string; numPets: number }) => {
      return apiRequest('POST', `/api/flash-deals/${dealId}/claim`, {
        userId: 'guest-user',
        petType: 'dog',
        numPets,
      });
    },
    onSuccess: (data: any, vars) => {
      setClaimedId(vars.dealId);
      toast({
        title: 'Deal claimed!',
        description: data.message || `You saved ₪${data.totalSavings}`,
      });
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: 'Could not claim deal',
        description: err.message || 'This deal may have filled up.',
        variant: 'destructive',
      });
    },
  });

  const deals = data?.deals ?? [];

  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-white border-b border-gray-100"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)', paddingBottom: 16 }}
      >
        <div className="max-w-lg mx-auto px-5">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/">
              <button className="text-gray-400 hover:text-gray-700 transition-colors" style={{ touchAction: 'manipulation' }}>
                <ChevronLeft size={20} strokeWidth={1.5} />
              </button>
            </Link>
            <div className="flex items-center gap-2 flex-1">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wider uppercase"
                style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}
              >
                <Zap size={10} fill="#B45309" />
                Flash Deals
              </div>
              <span className="text-[13px] text-gray-800 font-medium">This Week</span>
            </div>
            <span className="text-[11px] text-gray-400">{deals.length} offers</span>
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(['all', 'grooming', 'walking', 'daycare', 'k9000'] as ServiceFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setServiceFilter(s)}
                style={{
                  touchAction: 'manipulation',
                  backgroundColor: serviceFilter === s ? '#111' : '#f5f5f5',
                  color: serviceFilter === s ? 'white' : '#555',
                  flexShrink: 0,
                }}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide transition-all whitespace-nowrap"
              >
                {SERVICE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6">
        {/* Pet type toggle */}
        <div className="flex gap-2 mb-6">
          {(['all', 'dog', 'cat'] as PetFilter[]).map(p => (
            <button
              key={p}
              onClick={() => setPetFilter(p)}
              style={{
                touchAction: 'manipulation',
                borderColor: petFilter === p ? '#C5A55A' : '#e5e5e5',
                backgroundColor: petFilter === p ? 'rgba(197,165,90,0.07)' : 'white',
                color: petFilter === p ? '#8B6914' : '#888',
              }}
              className="flex-1 py-2 rounded-xl border text-[11px] font-medium tracking-wide capitalize transition-all"
            >
              {p === 'all' ? '🐾 All pets' : p === 'dog' ? '🐕 Dogs' : '🐈 Cats'}
            </button>
          ))}
        </div>

        {/* Weekly deal callout — 2 dogs + 1 cat banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 px-4 py-3.5 rounded-2xl"
          style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}
        >
          <p className="text-[11px] font-medium tracking-wider uppercase mb-1" style={{ color: '#B45309' }}>
            Weekly Bundle
          </p>
          <p className="text-[13px] text-gray-800 leading-snug">
            Book <strong>2 dogs + 1 cat</strong> for a full week — multi-pet discount up to <strong>14%</strong> stacked with flash deals.
            Use the <Link href="/daycare-calculator"><span className="underline cursor-pointer">daycare calculator</span></Link> to see exact pricing.
          </p>
        </motion.div>

        {/* Deal grid */}
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-40 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">🐾</p>
            <p className="text-[14px] font-light text-gray-600">No deals match your filters right now</p>
            <p className="text-[12px] text-gray-400 mt-1">Check back soon — new offers appear daily</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {deals.map((deal, i) => {
                const urgency = URGENCY_COLORS[deal.urgencyLevel] ?? URGENCY_COLORS.normal;
                const isClaimed = claimedId === deal.id;
                return (
                  <motion.div
                    key={deal.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.05 }}
                    className="bg-white rounded-2xl overflow-hidden"
                    style={{
                      border: '1px solid rgba(0,0,0,0.07)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Top accent — urgency color */}
                    <div className="h-0.5" style={{ backgroundColor: urgency.text, opacity: 0.6 }} />

                    <div className="px-4 pt-4 pb-4">
                      {/* Badge row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2.5 py-[3px] rounded-full text-[10px] font-medium tracking-wider uppercase"
                            style={{ backgroundColor: urgency.bg, color: urgency.text }}
                          >
                            {urgency.label}
                          </span>
                          <span className="text-[10px] text-gray-400 tracking-wide">
                            {SERVICE_LABELS[deal.serviceType]}
                          </span>
                        </div>
                        <span
                          className="text-[11px] font-semibold px-2 py-[3px] rounded-full"
                          style={{ backgroundColor: '#111', color: 'white' }}
                        >
                          -{deal.discountPercent}%
                        </span>
                      </div>

                      {/* Provider + headline */}
                      <p className="text-[13px] font-medium text-gray-900 leading-tight mb-0.5">
                        {deal.providerName}
                      </p>
                      <p className="text-[11px] text-gray-500 mb-3 leading-snug">{deal.headline}</p>

                      {/* Price */}
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-[20px] font-semibold text-gray-900">₪{deal.discountedPrice}</span>
                        <span className="text-[12px] text-gray-400 line-through">₪{deal.originalPrice}</span>
                        <span className="text-[11px] font-medium" style={{ color: '#16A34A' }}>
                          Save ₪{deal.savingsAmount}
                        </span>
                      </div>

                      {/* Slot bar */}
                      <div className="mb-2">
                        <SlotBar fill={deal.fillPercent} urgency={deal.urgencyLevel} />
                        <div className="flex justify-between mt-1.5">
                          <span className="text-[10px] text-gray-400">
                            {deal.slotsRemaining} slot{deal.slotsRemaining !== 1 ? 's' : ''} remaining
                          </span>
                          <div className="flex items-center gap-1 text-gray-400">
                            <Clock size={9} />
                            <span className="text-[10px]">{formatHours(deal.hoursLeft)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Location + pets */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center gap-1 text-gray-400">
                          <MapPin size={10} />
                          <span className="text-[10px]">{deal.location}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {deal.petTypes.includes('all') ? '🐾 All pets' : deal.petTypes.map(p => p === 'dog' ? '🐕' : '🐈').join(' ')}
                        </span>
                      </div>

                      {/* CTA */}
                      {isClaimed ? (
                        <div
                          className="w-full py-3 rounded-xl text-[12px] font-medium tracking-wide flex items-center justify-center gap-2"
                          style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                        >
                          <CheckCircle2 size={14} />
                          Deal Claimed — Discount Locked
                        </div>
                      ) : (
                        <button
                          onClick={() => claimMutation.mutate({ dealId: deal.id, numPets: 1 })}
                          disabled={claimMutation.isPending || deal.slotsRemaining === 0}
                          style={{
                            touchAction: 'manipulation',
                            backgroundColor: deal.slotsRemaining === 0 ? '#f5f5f5' : '#111',
                            color: deal.slotsRemaining === 0 ? '#aaa' : 'white',
                          }}
                          className="w-full py-3 rounded-xl text-[12px] font-medium tracking-[0.08em] uppercase transition-all active:scale-[0.98] disabled:cursor-not-allowed"
                        >
                          {deal.slotsRemaining === 0 ? 'Fully Booked' : claimMutation.isPending ? 'Claiming...' : 'Claim Deal'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
