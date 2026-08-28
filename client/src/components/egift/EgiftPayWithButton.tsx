/**
 * EgiftPayWithButton — CEO §12, §13.
 *
 * Drop-in green-marble button any commercial flow can render to
 * reserve eGift value before authorising the commercial event.
 *
 * States mirror the reservation lifecycle (§22-24):
 *   idle       "Pay with eGift ₪X" (available balance ≥ X)
 *              or "Insufficient eGift balance" (available < X)
 *   reserving  "Reserving…"
 *   reserved   "₪X held for {intended}"  with 'Cancel hold' → release()
 *   committed  "₪X committed"            terminal
 *   released   "₪X released"             terminal
 *   error      surfaces the enumerated errorCode
 *
 * Callers wire onReserved(reservationId) to commit later or subscribe
 * to onStateChange for a state machine. §28 preserved: cancelling a
 * reserved hold NEVER shows a refund message; the caller's flow
 * decides what UI to render after release.
 */
import { useEffect } from 'react';
import { useEgiftReservation, type ReservationErrorCode } from '@/hooks/useEgiftReservation';
import { useLanguage } from '@/lib/languageStore';
import { Loader2, ShieldCheck, XCircle, Wallet } from 'lucide-react';

const GREEN = '#063B22';
const GOLD = '#D6B56D';
const MARBLE = '#FAFAF7';
const BORDER = '#ECE6D8';
const INK = '#121212';
const MUTED = '#6B6E6A';

interface Props {
  egiftId: string;
  amountCents: number;
  intendedCommercial:
    | 'K9000_WASH' | 'SHOP_ITEM'
    | 'PROVIDER_BOOKING_SITTER' | 'PROVIDER_BOOKING_WALK'
    | 'PROVIDER_BOOKING_ACADEMY' | 'PROVIDER_BOOKING_PETTREK';
  intendedSourceType?: string;
  intendedSourceId?: string;
  /** Called with the reservationId once RESERVED is confirmed. */
  onReserved?: (reservationId: string) => void;
  /** Called after RELEASED — caller decides UI. §28 not a refund. */
  onReleased?: () => void;
  /** Deterministic id when the caller wants replay-safe reserves. */
  idempotencyKey?: string;
}

function errorCopy(code: ReservationErrorCode | null, isHe: boolean): string {
  const tr = (en: string, he: string) => (isHe ? he : en);
  switch (code) {
    case 'INSUFFICIENT_AVAILABLE': return tr('Not enough eGift value available.', 'אין די יתרה זמינה ב-eGift.');
    case 'EGIFT_FROZEN':           return tr('This eGift is frozen — contact support.', 'ה-eGift קפוא — פנו לתמיכה.');
    case 'EGIFT_NOT_FOUND':        return tr('eGift not found.', 'לא נמצא eGift.');
    case 'INVALID_AMOUNT':         return tr('Invalid amount.', 'סכום לא תקין.');
    case 'RACE_CONDITION':         return tr('Another reservation is in flight. Try again.', 'שמירה נוספת בביצוע. נסו שוב.');
    case 'NETWORK':                return tr('Network error. Try again.', 'שגיאת רשת. נסו שוב.');
    default:                       return tr('Reservation failed.', 'השמירה נכשלה.');
  }
}

function fmt(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}

export function EgiftPayWithButton(props: Props) {
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);

  const r = useEgiftReservation({
    egiftId: props.egiftId,
    intendedCommercial: props.intendedCommercial,
    intendedSourceType: props.intendedSourceType,
    intendedSourceId: props.intendedSourceId,
  });

  const available = r.balance?.availableCents ?? 0;
  const canReserve = available >= props.amountCents && !r.balance?.frozen;
  const inFlight = r.isReserving || r.isCommitting || r.isReleasing;

  const status = r.handle?.status ?? 'idle';

  // ── Terminal states ───────────────────────────────────────────────
  if (status === 'COMMITTED') {
    return (
      <div
        className="rounded-[16px] p-3 flex items-center gap-2"
        style={{ background: '#E7F1EA', border: `1px solid ${GREEN}`, color: GREEN }}
      >
        <ShieldCheck className="w-4 h-4" />
        <span className="text-[13px] font-bold">
          {tr(`${fmt(props.amountCents)} committed`, `${fmt(props.amountCents)} נצבר`)}
        </span>
      </div>
    );
  }
  if (status === 'RELEASED') {
    return (
      <div className="rounded-[16px] p-3 text-[13px] font-semibold" style={{ color: MUTED, background: MARBLE, border: `1px solid ${BORDER}` }}>
        {tr('Hold released — not a refund.', 'השמירה בוטלה — לא בוצע החזר.')}
      </div>
    );
  }

  // ── RESERVED — hold visible, offer cancel ────────────────────────
  if (status === 'RESERVED' && r.handle) {
    return (
      <div className="rounded-[16px] p-3 flex items-center justify-between gap-3" style={{ background: '#F7F3E7', border: `1px solid ${BORDER}` }}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: GREEN }}>
            <Wallet className="w-3.5 h-3.5" />
            {tr(`${fmt(r.handle.amountCents)} held for ${props.intendedCommercial.replace(/_/g, ' ')}`,
                `${fmt(r.handle.amountCents)} נשמרו עבור ${props.intendedCommercial.replace(/_/g, ' ')}`)}
          </div>
          <div className="text-[11px] mt-0.5 font-mono" dir="ltr" style={{ color: MUTED }}>
            {r.handle.reservationId}
          </div>
        </div>
        <button
          type="button"
          disabled={inFlight}
          onClick={() => { r.release(); props.onReleased?.(); }}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold"
          style={{ background: 'white', color: GREEN, border: `1px solid ${GREEN}` }}
        >
          {r.isReleasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          {tr('Cancel hold', 'ביטול שמירה')}
        </button>
      </div>
    );
  }

  // ── idle — primary CTA ──────────────────────────────────────────────
  return (
    <div>
      <button
        type="button"
        disabled={!canReserve || inFlight}
        onClick={() => {
          r.reserve({ amountCents: props.amountCents, idempotencyKey: props.idempotencyKey });
        }}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3 font-bold disabled:opacity-60"
        style={{ background: GREEN, color: GOLD }}
        aria-label={tr('Pay with eGift', 'תשלום עם eGift')}
      >
        {r.isReserving && <Loader2 className="w-4 h-4 animate-spin" />}
        <Wallet className="w-4 h-4" />
        {tr(`Pay with eGift · ${fmt(props.amountCents)}`, `תשלום עם eGift · ${fmt(props.amountCents)}`)}
      </button>

      {r.balance && (
        <p className="mt-1 text-center text-[11px]" style={{ color: MUTED }}>
          {tr(`Available ${fmt(available)}`, `זמין ${fmt(available)}`)}
        </p>
      )}
      {r.errorCode && (
        <p className="mt-2 text-center text-[12px] font-semibold" style={{ color: '#8A0A0A' }}>
          {errorCopy(r.errorCode, isHe)}
        </p>
      )}

      {/* Emit the reservationId to the caller once RESERVED */}
      {r.handle?.status === 'RESERVED' && props.onReserved && (
        <ReservedSignal reservationId={r.handle.reservationId} onReserved={props.onReserved} />
      )}
    </div>
  );
}

/** Fire-and-forget bridge so the parent gets exactly one onReserved
 *  call per transition into RESERVED. Wrapping the callback inside an
 *  effect avoids running it during render. */
function ReservedSignal({ reservationId, onReserved }: { reservationId: string; onReserved: (id: string) => void }) {
  useEffect(() => { onReserved(reservationId); }, [reservationId, onReserved]);
  return null;
}
