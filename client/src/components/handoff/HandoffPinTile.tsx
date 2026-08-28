/**
 * HandoffPinTile — customer-side surface for /api/jobs/handoff/*.
 *
 * Reads status; if no live code, the customer taps "Show PIN" to issue
 * one via POST /handoff/issue. The 4-digit code is returned in the
 * response body ONCE and rendered in-tile with a live countdown. Refresh
 * regenerates and REVOKES the previous credential (server-side), so a
 * stale QR/screenshot can't be replayed. Revoke removes the credential
 * entirely.
 *
 * Green-marble tokens shared with the passport family.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { RefreshCw, ShieldCheck, XCircle, KeyRound } from 'lucide-react';

const GREEN = '#063B22';
const GOLD = '#D6B56D';
const MARBLE = '#FAFAF7';
const BORDER = '#ECE6D8';
const INK = '#121212';
const MUTED = '#6B6E6A';

interface Props {
  /** JobPassport source hint (e.g. 'booking_requests', 'sitter_bookings'). */
  source: string;
  /** The booking authority id. */
  bookingId: string;
  /** Handoff purpose the customer will show to the fulfiller. */
  purpose: 'PICKUP' | 'ENTRY' | 'START' | 'REDEMPTION';
  /** Optional label override. */
  labelEn?: string;
  labelHe?: string;
}

interface HandoffStatus {
  ok: boolean;
  jobRef?: string;
  purpose?: string;
  present?: boolean;
  expiresAt?: string;
  consumed?: boolean;
  revoked?: boolean;
  attempts?: number;
}

interface IssueResponse {
  ok: boolean;
  jobRef?: string;
  purpose?: string;
  code?: string;
  expiresAt?: string;
}

export function HandoffPinTile({ source, bookingId, purpose, labelEn, labelHe }: Props) {
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);
  const label = tr(labelEn ?? 'Handoff PIN', labelHe ?? 'קוד העברה');
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const status = useQuery<HandoffStatus>({
    queryKey: [`/api/jobs/handoff/status`, source, bookingId, purpose],
    queryFn: async () => {
      const qs = new URLSearchParams({ source, bookingId, purpose });
      const r = await apiRequest('GET', `/api/jobs/handoff/status?${qs.toString()}`);
      return r.json();
    },
  });

  const issue = useMutation<IssueResponse>({
    mutationFn: async () => {
      const r = await apiRequest('POST', '/api/jobs/handoff/issue', { source, bookingId, purpose });
      const body = await r.json();
      if (!r.ok || !body.ok) throw new Error(body.error || 'ISSUE_FAILED');
      return body;
    },
    onSuccess: (body) => {
      setCode(body.code ?? null);
      setExpiresAt(body.expiresAt ?? null);
    },
  });

  const revoke = useMutation({
    mutationFn: async () => {
      const r = await apiRequest('POST', '/api/jobs/handoff/revoke', { source, bookingId, purpose });
      const body = await r.json();
      if (!r.ok || !body.ok) throw new Error(body.error || 'REVOKE_FAILED');
      return body;
    },
    onSuccess: () => {
      setCode(null);
      setExpiresAt(null);
      status.refetch();
    },
  });

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const secondsLeft = useMemo(() => {
    if (!expiresAt) return null;
    const ms = new Date(expiresAt).getTime() - now;
    return Math.max(0, Math.floor(ms / 1000));
  }, [expiresAt, now]);

  const expired = secondsLeft === 0;
  const codeVisible = code && !expired;
  const showsPending = status.data?.present && !status.data.consumed && !status.data.revoked && !code;

  return (
    <div
      className="rounded-[16px] p-4"
      style={{ background: 'white', border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="w-4 h-4" style={{ color: GREEN }} />
        <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
          {label}
        </span>
      </div>

      {codeVisible ? (
        <>
          <div className="flex items-center justify-between">
            <div
              className="tabular-nums font-mono font-extrabold tracking-[0.35em] text-[32px]"
              style={{ color: INK }}
              aria-label={tr('Handoff PIN', 'קוד העברה')}
              dir="ltr"
            >
              {code}
            </div>
            <span
              className="rounded-full px-2 py-1 text-[11px] font-semibold"
              style={{ background: MARBLE, color: GREEN, border: `1px solid ${BORDER}` }}
              dir="ltr"
            >
              {secondsLeft != null
                ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
                : '—'}
            </span>
          </div>
          <p className="mt-2 text-[12px]" style={{ color: MUTED }}>
            {tr(
              'Share this PIN with the person picking up or starting your service. It expires shortly and is single-use.',
              'שתפו את הקוד עם מי שאוסף את חיית המחמד או מתחיל בשירות. הקוד תקף לזמן קצר וחד־פעמי.',
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => issue.mutate()}
              disabled={issue.isPending}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold"
              style={{ background: GREEN, color: GOLD }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${issue.isPending ? 'animate-spin' : ''}`} />
              {tr('New PIN', 'קוד חדש')}
            </button>
            <button
              type="button"
              onClick={() => revoke.mutate()}
              disabled={revoke.isPending}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold"
              style={{ background: 'white', color: GREEN, border: `1px solid ${GREEN}` }}
            >
              <XCircle className="w-3.5 h-3.5" />
              {tr('Revoke', 'ביטול')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px]" style={{ color: INK }}>
            {showsPending
              ? tr(
                  'A PIN was issued but is no longer visible on this device. Tap New PIN to reveal.',
                  'קוד קיים אך אינו מוצג במכשיר זה. הקישו על "קוד חדש" כדי להנפיק חדש.',
                )
              : tr(
                  'When you\'re ready to hand off, issue a short-lived PIN the fulfiller will confirm.',
                  'ברגע שתהיו מוכנים להעברה, הנפיקו קוד קצר שהגורם יאמת.',
                )}
          </p>
          {issue.isError && (
            <p className="mt-2 text-[12px] font-semibold" style={{ color: '#8A0A0A' }}>
              {tr("Couldn't issue the PIN. Try again.", 'הנפקת הקוד נכשלה. נסו שוב.')}
            </p>
          )}
          <button
            type="button"
            onClick={() => issue.mutate()}
            disabled={issue.isPending}
            className="mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[13px] font-bold"
            style={{ background: GREEN, color: GOLD }}
          >
            <ShieldCheck className="w-4 h-4" />
            {issue.isPending ? tr('Issuing…', 'מנפיק…') : tr('Show PIN', 'הצג קוד')}
          </button>
        </>
      )}
    </div>
  );
}
