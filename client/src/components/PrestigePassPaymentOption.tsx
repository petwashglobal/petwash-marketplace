/**
 * PrestigePassPaymentOption
 *
 * A self-contained "Pay with Prestige Pass" section for booking checkout flows.
 * Fetches wallet balances, shows deduction preview, calls /api/prestige-pass/redeem-online.
 *
 * Usage:
 *   <PrestigePassPaymentOption
 *     bookingId={bookingId}
 *     serviceType="pet_sitter"
 *     amountGross={totalCents}
 *     onRedemptionSuccess={(breakdown) => { ... handle success ... }}
 *     onRedemptionError={(err) => { ... }}
 *   />
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, CheckCircle, ChevronDown, ChevronUp, Loader2, AlertCircle, Star } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WalletBalances {
  promo:         number;
  gift:          number;
  wallet:        number;
  washes:        number;
  loyaltyPoints: number;
}

interface MeResponse {
  userId:   string;
  tier:     string;
  balances: WalletBalances;
}

interface DeductionBreakdown {
  promo:        number;
  gift:         number;
  wallet:       number;
  cardFallback: number;
  totalCovered: number;
}

interface RedemptionResult {
  ok:               boolean;
  bookingConfirmed: boolean;
  txnId:            string;
  amountGross:      number;
  deductionBreakdown: DeductionBreakdown;
}

interface Props {
  bookingId:          string;
  serviceType:        'pet_sitter' | 'dog_walker' | 'pet_transport' | 'academy' | 'grooming' | 'vet' | 'daycare' | 'other';
  amountGross:        number;  // in agorot (ILS cents)
  onRedemptionSuccess?: (result: RedemptionResult) => void;
  onRedemptionError?:   (error: string) => void;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmt = (cents: number) => `₪${(cents / 100).toFixed(0)}`;

const TIER_LABEL: Record<string, { label: string; color: string }> = {
  black:    { label: 'פרסטיז שחור',    color: '#D4AF37' },
  elite:    { label: 'פרסטיז שחור',    color: '#D4AF37' },
  diamond:  { label: 'פרסטיז שחור',    color: '#D4AF37' },
  vip:      { label: 'פרסטיז שחור',    color: '#D4AF37' },
  platinum: { label: 'פרסטיז פלטינום', color: '#B8BCC8' },
  gold:     { label: 'פרסטיז זהב',     color: '#D4AF37' },
  silver:   { label: 'פרסטיז כסף',     color: '#9CA3AF' },
  bronze:   { label: 'פרסטיז פנינה',   color: '#CD7F32' },
  new:      { label: 'פרסטיז פנינה',   color: '#CD7F32' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PrestigePassPaymentOption({ bookingId, serviceType, amountGross, onRedemptionSuccess, onRedemptionError }: Props) {
  const [expanded, setExpanded]   = useState(false);
  const [redeemed, setRedeemed]   = useState(false);
  const [txnResult, setTxnResult] = useState<RedemptionResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: me, isLoading, error } = useQuery<MeResponse>({
    queryKey: ['/api/prestige-pass/me'],
    retry: 1,
    staleTime: 30_000,
  });

  const redeemMutation = useMutation<RedemptionResult, Error, void>({
    mutationFn: () =>
      apiRequest('POST', '/api/prestige-pass/redeem-online', {
        bookingId,
        serviceType,
        amountGross,
      }),
    onSuccess: (result) => {
      setRedeemed(true);
      setTxnResult(result);
      queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/wallet'] });
      toast({
        title: 'תשלום בוצע בהצלחה',
        description: `₪${(result.deductionBreakdown.totalCovered / 100).toFixed(0)} שולם מהפאס הפרסטיז שלך`,
      });
      onRedemptionSuccess?.(result);
    },
    onError: (err) => {
      const msg = err.message || 'אירעה שגיאה בתשלום';
      toast({ title: 'שגיאה בתשלום', description: msg, variant: 'destructive' });
      onRedemptionError?.(msg);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-100 bg-amber-50/40">
        <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
        <span className="text-sm text-amber-700">טוען יתרות הפאס הפרסטיז...</span>
      </div>
    );
  }

  if (error || !me) return null;

  const { balances, tier } = me;
  const totalAvailableCents = balances.promo + balances.gift + balances.wallet;
  const tierInfo = TIER_LABEL[tier] || TIER_LABEL.new;

  if (totalAvailableCents === 0 && balances.washes === 0) return null;

  const canCover = totalAvailableCents >= amountGross;
  const shortfallCents = Math.max(0, amountGross - totalAvailableCents);

  if (redeemed && txnResult) {
    return (
      <div
        className="rounded-2xl border border-amber-200 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1c1a0f 100%)' }}
      >
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-full" style={{ background: 'rgba(212,175,55,0.15)' }}>
              <CheckCircle className="h-5 w-5" style={{ color: '#D4AF37' }} />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">תשלום מהפאס הפרסטיז בוצע</div>
              <div className="text-xs" style={{ color: 'rgba(212,175,55,0.8)' }}>#{txnResult.txnId}</div>
            </div>
          </div>

          <div className="space-y-2">
            {txnResult.deductionBreakdown.promo > 0 && (
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span>קרדיטים פרומו</span>
                <span style={{ color: '#D4AF37' }}>-{fmt(txnResult.deductionBreakdown.promo)}</span>
              </div>
            )}
            {txnResult.deductionBreakdown.gift > 0 && (
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span>כרטיס מתנה</span>
                <span style={{ color: '#D4AF37' }}>-{fmt(txnResult.deductionBreakdown.gift)}</span>
              </div>
            )}
            {txnResult.deductionBreakdown.wallet > 0 && (
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span>ארנק מזומן</span>
                <span style={{ color: '#D4AF37' }}>-{fmt(txnResult.deductionBreakdown.wallet)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2" style={{ borderColor: 'rgba(212,175,55,0.2)', color: '#D4AF37' }}>
              <span>סה"כ שולם</span>
              <span>{fmt(txnResult.deductionBreakdown.totalCovered)}</span>
            </div>
            {txnResult.deductionBreakdown.cardFallback > 0 && (
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span>יתרה לתשלום בכרטיס</span>
                <span>{fmt(txnResult.deductionBreakdown.cardFallback)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        background:   'linear-gradient(135deg, #0a0a0a 0%, #1c1a0f 100%)',
        borderColor:  expanded ? 'rgba(212,175,55,0.5)' : 'rgba(212,175,55,0.25)',
        boxShadow:    expanded ? '0 4px 24px rgba(212,175,55,0.12)' : 'none',
      }}
      onClick={() => !redeemed && setExpanded(!expanded)}
    >
      {/* ── Header row ── */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="flex items-center justify-center h-10 w-10 rounded-full flex-shrink-0"
          style={{ background: 'rgba(212,175,55,0.12)' }}
        >
          <Wallet className="h-5 w-5" style={{ color: '#D4AF37' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">תשלום עם פאס פרסטיז</span>
            <Badge
              style={{
                background:   'rgba(212,175,55,0.15)',
                color:        tierInfo.color,
                borderColor:  'rgba(212,175,55,0.3)',
                fontSize:     '10px',
                padding:      '1px 6px',
              }}
              variant="outline"
            >
              {tierInfo.label}
            </Badge>
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(212,175,55,0.7)' }}>
            יתרה זמינה: {fmt(totalAvailableCents)}
            {balances.washes > 0 && ` · ${balances.washes} שטיפות`}
          </div>
        </div>

        <div style={{ color: 'rgba(212,175,55,0.6)' }}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div
          className="border-t px-4 pb-4 pt-3 space-y-3"
          style={{ borderColor: 'rgba(212,175,55,0.15)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Balance breakdown */}
          <div className="space-y-2">
            {balances.promo > 0 && (
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                <span className="flex items-center gap-1.5">
                  <Star className="h-3 w-3" style={{ color: '#D4AF37' }} />
                  קרדיטים פרומו
                </span>
                <span style={{ color: '#D4AF37' }}>{fmt(balances.promo)}</span>
              </div>
            )}
            {balances.gift > 0 && (
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                <span>כרטיס מתנה (eGift)</span>
                <span style={{ color: '#D4AF37' }}>{fmt(balances.gift)}</span>
              </div>
            )}
            {balances.wallet > 0 && (
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                <span>ארנק מזומן</span>
                <span style={{ color: '#D4AF37' }}>{fmt(balances.wallet)}</span>
              </div>
            )}
            <div
              className="flex justify-between text-sm font-semibold border-t pt-2"
              style={{ borderColor: 'rgba(212,175,55,0.2)', color: '#D4AF37' }}
            >
              <span>סה"כ זמין</span>
              <span>{fmt(totalAvailableCents)}</span>
            </div>
          </div>

          {/* Coverage summary */}
          <div
            className="rounded-xl p-3 text-xs leading-relaxed"
            style={{
              background: canCover ? 'rgba(212,175,55,0.08)' : 'rgba(239,68,68,0.08)',
              borderColor: canCover ? 'rgba(212,175,55,0.2)' : 'rgba(239,68,68,0.2)',
            }}
          >
            {canCover ? (
              <span style={{ color: 'rgba(212,175,55,0.9)' }}>
                ✓ יתרתך מכסה את כל סכום ההזמנה ({fmt(amountGross)})
              </span>
            ) : (
              <span style={{ color: 'rgba(239,68,68,0.9)' }}>
                <AlertCircle className="h-3 w-3 inline mr-1" />
                יתרה חלקית — {fmt(totalAvailableCents)} מכוסים, {fmt(shortfallCents)} ישולמו בכרטיס אשראי
              </span>
            )}
          </div>

          {/* CTA */}
          <Button
            className="w-full h-11 text-sm font-semibold rounded-xl transition-all"
            style={{
              background:    'linear-gradient(90deg, #B8941F 0%, #D4AF37 50%, #F0D060 100%)',
              color:         '#0a0a0a',
              border:        'none',
              boxShadow:     '0 4px 16px rgba(212,175,55,0.3)',
              opacity:       redeemMutation.isPending ? 0.7 : 1,
            }}
            onClick={() => redeemMutation.mutate()}
            disabled={redeemMutation.isPending || totalAvailableCents === 0}
          >
            {redeemMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : null}
            {redeemMutation.isPending
              ? 'מעבד תשלום...'
              : canCover
                ? `שלם ${fmt(amountGross)} עם הפאס`
                : `שלם ${fmt(totalAvailableCents)} עם הפאס + ${fmt(shortfallCents)} כרטיס`
            }
          </Button>
        </div>
      )}
    </div>
  );
}
