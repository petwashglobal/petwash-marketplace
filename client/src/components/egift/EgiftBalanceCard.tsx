/**
 * EgiftBalanceCard — customer §31 surface for a single eGift.
 *
 * Renders Original / Available / Reserved / Redeemed / Restored derived
 * from the append-only ledger via GET /api/egift/:egiftId/balance.
 *
 * §31 discipline: reserved value MUST be visible. This card never
 * hides reserved cents in the "available" number — a customer whose
 * ₪20 is sitting in a live Walk reservation sees ₪35 available AND
 * ₪20 reserved, not "₪35" alone.
 *
 * Green-marble tokens matched to the rest of the passport family.
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { Wallet, Snowflake, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';

const GREEN = '#063B22';
const GOLD = '#D6B56D';
const MARBLE = '#FAFAF7';
const BORDER = '#ECE6D8';
const INK = '#121212';
const MUTED = '#6B6E6A';

interface EgiftBalance {
  egiftId: string;
  currency: 'ILS';
  originalCents: number;
  availableCents: number;
  reservedCents: number;
  redeemedCents: number;
  restoredCents: number;
  frozen: boolean;
  openReservations: Array<{
    reservationId: string;
    amountCents: number;
    intendedCommercial: string;
    reservedAt: string;
    expiresAt: string;
  }>;
  hasOrphanRefundWarning: boolean;
}

interface Props {
  egiftId: string;
  title?: string;
}

function fmt(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}

function fmtWhen(iso: string, isHe: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(isHe ? 'he-IL' : 'en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function EgiftBalanceCard({ egiftId, title }: Props) {
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);

  const { data, isLoading, isError } = useQuery<{ ok: boolean; projection: EgiftBalance }>({
    queryKey: [`/api/egift/${egiftId}/balance`],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/egift/${egiftId}/balance`);
      return r.json();
    },
    enabled: !!egiftId,
  });

  if (isLoading) {
    return (
      <div className="rounded-[22px] p-5 flex items-center justify-center" style={{ background: 'white', border: `1px solid ${BORDER}` }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: GREEN }} />
      </div>
    );
  }
  if (isError || !data?.projection) {
    return (
      <div className="rounded-[22px] p-5" style={{ background: 'white', border: `1px solid ${BORDER}` }}>
        <p className="text-[13px]" style={{ color: MUTED }}>
          {tr("Couldn't load this eGift's balance.", 'לא הצלחנו לטעון את יתרת ה-eGift.')}
        </p>
      </div>
    );
  }

  const p = data.projection;

  return (
    <div className="rounded-[22px] shadow-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
      {/* Green-marble hero */}
      <div className="p-5" style={{ background: GREEN }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: GOLD }}>
            <Wallet className="w-3.5 h-3.5" />
            <span>{title ?? tr('PetWash™ · eGift balance', 'PetWash™ · יתרת eGift')}</span>
          </div>
          {p.frozen && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5"
              style={{ background: 'rgba(255,255,255,0.15)', color: GOLD, border: `1px solid ${GOLD}` }}
            >
              <Snowflake className="w-3 h-3" />
              {tr('Frozen', 'קפוא')}
            </span>
          )}
        </div>
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {tr('Available', 'זמין')}
          </div>
          <div dir="ltr" className="mt-0.5 text-[32px] font-extrabold" style={{ color: GOLD }}>
            {fmt(p.availableCents)}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-white">
          <MiniMetric label={tr('Original', 'מקורי')} value={fmt(p.originalCents)} />
          <MiniMetric label={tr('Reserved', 'שמור')} value={fmt(p.reservedCents)} highlight />
          <MiniMetric label={tr('Redeemed', 'נוצל')} value={fmt(p.redeemedCents)} />
        </div>
      </div>

      {/* Reservations detail — §31 keeps reserved visible */}
      {p.openReservations.length > 0 && (
        <div className="p-5 bg-white">
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-3" style={{ color: GREEN }}>
            {tr('Live reservations', 'שמירות פעילות')}
          </div>
          <ul className="space-y-2">
            {p.openReservations.map((r) => (
              <li
                key={r.reservationId}
                className="rounded-xl px-3 py-2.5"
                style={{ background: MARBLE, border: `1px solid ${BORDER}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold" style={{ color: INK }}>
                    {r.intendedCommercial.replace(/_/g, ' ')}
                  </span>
                  <span dir="ltr" className="text-[14px] font-extrabold" style={{ color: INK }}>
                    {fmt(r.amountCents)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[11px]" style={{ color: MUTED }}>
                  <span>{fmtWhen(r.reservedAt, isHe)}</span>
                  <span>{tr('expires', 'תוקף')} {fmtWhen(r.expiresAt, isHe)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Restored + orphan-warning line */}
      {(p.restoredCents > 0 || p.hasOrphanRefundWarning) && (
        <div
          className="px-5 py-3 flex items-center justify-between text-[12px]"
          style={{ background: MARBLE, borderTop: `1px solid ${BORDER}` }}
        >
          {p.restoredCents > 0 && (
            <span className="inline-flex items-center gap-1" style={{ color: GREEN }}>
              <RotateCcw className="w-3.5 h-3.5" />
              {tr('Value restored', 'שווי הוחזר')} <span dir="ltr" className="font-mono">{fmt(p.restoredCents)}</span>
            </span>
          )}
          {p.hasOrphanRefundWarning && (
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#8A5A00' }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {tr('Credit doc pending', 'זיכוי פיסקלי בהמתנה')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MiniMetric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</div>
      <div
        dir="ltr"
        className="mt-0.5 text-[14px] font-bold"
        style={{ color: highlight ? GOLD : 'white' }}
      >
        {value}
      </div>
    </div>
  );
}
