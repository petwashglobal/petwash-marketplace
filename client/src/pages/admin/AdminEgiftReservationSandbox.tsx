/**
 * AdminEgiftReservationSandbox — CEO §22-24, §28-29 admin dev tool.
 *
 * Route: /admin/egift-reservation-sandbox
 * Purpose: end-to-end exercise of the reservation kit shipped as
 *   useEgiftReservation + EgiftPayWithButton against the real service
 *   without wiring it into a production commercial flow. Pre-activation
 *   admin tooling — no CEO gate needed. Staff-only via RoleProtectedRoute.
 *
 * The sandbox lets an operator:
 *   • Paste any egiftId → sees the honest projection via EgiftBalanceCard
 *   • Choose an intendedCommercial + amount → runs reserve → RESERVED
 *   • Choose commit or release → COMMITTED / RELEASED terminal
 *   • Watch the balance card update live to prove §22-23 discipline
 *
 * §28 vs §29 stays visible: release renders "Hold released — not a
 * refund", commit renders "committed". A double-commit hits
 * RESERVATION_NOT_ACTIVE.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ShieldCheck, Wallet, Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import { EgiftBalanceCard } from '@/components/egift/EgiftBalanceCard';
import { useEgiftReservation, type ReservationErrorCode } from '@/hooks/useEgiftReservation';
import { useLanguage } from '@/lib/languageStore';

const GREEN = '#063B22';
const GOLD = '#D6B56D';
const MARBLE = '#FAFAF7';
const BORDER = '#ECE6D8';
const INK = '#121212';
const MUTED = '#6B6E6A';

const INTENDED_OPTIONS = [
  'K9000_WASH',
  'SHOP_ITEM',
  'PROVIDER_BOOKING_SITTER',
  'PROVIDER_BOOKING_WALK',
  'PROVIDER_BOOKING_ACADEMY',
  'PROVIDER_BOOKING_PETTREK',
] as const;

function errorCopy(code: ReservationErrorCode | null): string {
  if (!code) return '';
  return code.replace(/_/g, ' ').toLowerCase();
}

function fmt(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}

export default function AdminEgiftReservationSandbox() {
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);

  const [egiftIdInput, setEgiftIdInput] = useState('');
  const [amountInput, setAmountInput] = useState('5500');
  const [intended, setIntended] = useState<(typeof INTENDED_OPTIONS)[number]>('K9000_WASH');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [committedEgiftId, setCommittedEgiftId] = useState('');

  const activeEgiftId = committedEgiftId;

  const r = useEgiftReservation({
    egiftId: activeEgiftId,
    intendedCommercial: intended,
  });

  const applyEgiftId = () => {
    const trimmed = egiftIdInput.trim();
    if (!trimmed) return;
    r.reset();
    setCommittedEgiftId(trimmed);
  };

  const amountCents = Math.max(0, Number.parseInt(amountInput || '0', 10));
  const status = r.handle?.status;
  const inFlight = r.isReserving || r.isCommitting || r.isReleasing;

  return (
    <div className="min-h-screen" style={{ background: MARBLE }}>
      <header className="px-4 py-3 flex items-center gap-2" style={{ background: GREEN, color: GOLD }}>
        <Link href="/" className="p-1"><ArrowLeft className="w-5 h-5" /></Link>
        <ShieldCheck className="w-5 h-5" />
        <h1 className="text-[13px] uppercase tracking-[0.22em] font-bold">
          {tr('eGift Reservation Sandbox', 'ארגז חול · שמירת eGift')}
        </h1>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div
          className="rounded-[16px] p-3 text-[12px]"
          style={{ background: '#F7F3E7', border: `1px solid ${BORDER}`, color: INK }}
        >
          {tr(
            'Pre-activation surface. This sandbox exercises the real reserve → commit → release lifecycle against the real service. No commercial flow is authorised from here.',
            'משטח טרום-הפעלה. הכלי מפעיל את מחזור החיים האמיתי מול השירות האמיתי. אין הפעלה מסחרית מכאן.',
          )}
        </div>

        {/* — 1. Pick eGift ————————————————————————————— */}
        <section
          className="rounded-[22px] p-4"
          style={{ background: 'white', border: `1px solid ${BORDER}` }}
        >
          <label className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
            {tr('1 · eGift ID', '1 · מזהה eGift')}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={egiftIdInput}
              onChange={(e) => setEgiftIdInput(e.target.value)}
              placeholder={tr('paste any egiftId', 'הדביקו egiftId')}
              className="flex-1 px-3 py-2 rounded-lg text-[13px] font-mono"
              style={{ background: MARBLE, border: `1px solid ${BORDER}`, color: INK }}
              dir="ltr"
            />
            <button
              type="button"
              onClick={applyEgiftId}
              disabled={!egiftIdInput.trim()}
              className="px-4 py-2 rounded-lg text-[12px] font-bold disabled:opacity-50"
              style={{ background: GREEN, color: GOLD }}
            >
              {tr('Load', 'טעינה')}
            </button>
          </div>
        </section>

        {/* — 2. Balance card ————————————————————————————— */}
        {activeEgiftId && (
          <section>
            <EgiftBalanceCard
              egiftId={activeEgiftId}
              title={tr('Live projection', 'הקרנה חיה')}
            />
          </section>
        )}

        {/* — 3. Reservation controls ————————————————————————————— */}
        {activeEgiftId && (
          <section
            className="rounded-[22px] p-4 space-y-3"
            style={{ background: 'white', border: `1px solid ${BORDER}` }}
          >
            <label className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
              {tr('2 · Reservation controls', '2 · בקרות שמירה')}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
                  {tr('amount cents', 'סנטים')}
                </label>
                <input
                  type="number"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg text-[13px] font-mono"
                  style={{ background: MARBLE, border: `1px solid ${BORDER}`, color: INK }}
                  dir="ltr"
                  min={1}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
                  {tr('intendedCommercial', 'שימוש מיועד')}
                </label>
                <select
                  value={intended}
                  onChange={(e) => setIntended(e.target.value as (typeof INTENDED_OPTIONS)[number])}
                  className="mt-1 w-full px-3 py-2 rounded-lg text-[13px]"
                  style={{ background: MARBLE, border: `1px solid ${BORDER}`, color: INK }}
                >
                  {INTENDED_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
                  {tr('idempotencyKey (opt)', 'מפתח אידמפוטנטי (רשות)')}
                </label>
                <input
                  type="text"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  placeholder="k9000-…"
                  className="mt-1 w-full px-3 py-2 rounded-lg text-[13px] font-mono"
                  style={{ background: MARBLE, border: `1px solid ${BORDER}`, color: INK }}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={inFlight || !amountCents || !!r.handle}
                onClick={() => r.reserve({ amountCents, idempotencyKey: idempotencyKey || undefined })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold disabled:opacity-50"
                style={{ background: GREEN, color: GOLD }}
              >
                {r.isReserving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                {tr(`Reserve ${fmt(amountCents)}`, `שמור ${fmt(amountCents)}`)}
              </button>

              <button
                type="button"
                disabled={inFlight || status !== 'RESERVED'}
                onClick={() => r.commit({})}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold disabled:opacity-50"
                style={{ background: 'white', color: GREEN, border: `1px solid ${GREEN}` }}
              >
                {r.isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {tr('Commit (§29 REDEEMED)', 'קיבוע (§29 נצבר)')}
              </button>

              <button
                type="button"
                disabled={inFlight || status !== 'RESERVED'}
                onClick={() => r.release()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold disabled:opacity-50"
                style={{ background: 'white', color: '#8A0A0A', border: `1px solid #8A0A0A` }}
              >
                {r.isReleasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                {tr('Release (§28 not a refund)', 'שחרור (§28 לא החזר)')}
              </button>

              <button
                type="button"
                onClick={() => r.reset()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-[12px] font-semibold"
                style={{ color: MUTED, border: `1px solid ${BORDER}` }}
              >
                {tr('Clear local state', 'ניקוי מקומי')}
              </button>
            </div>

            {/* State readout */}
            <div
              className="rounded-lg px-3 py-2 text-[12px] font-mono"
              style={{ background: MARBLE, border: `1px solid ${BORDER}`, color: INK }}
              dir="ltr"
            >
              <div>status: <strong>{status ?? 'idle'}</strong></div>
              {r.handle && (
                <>
                  <div>reservationId: {r.handle.reservationId}</div>
                  <div>amountCents: {r.handle.amountCents}</div>
                  <div>expiresAt: {r.handle.expiresAt}</div>
                </>
              )}
              {r.errorCode && (
                <div style={{ color: '#8A0A0A' }}>errorCode: {r.errorCode} — {errorCopy(r.errorCode)}</div>
              )}
            </div>
          </section>
        )}

        <footer className="text-center text-[10px] py-3" style={{ color: MUTED }}>
          {tr(
            '§22 pre-check via projection · §23 in-tx race guard · §28 release ≠ refund · §29 commit is single-shot',
            '§22 בדיקה מקדימה · §23 מנעול תוך-טרנזאקציה · §28 שחרור ≠ החזר · §29 קיבוע חד-פעמי',
          )}
        </footer>
      </main>
    </div>
  );
}
