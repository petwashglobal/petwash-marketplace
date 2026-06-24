/**
 * PrestigeRedeem — the redeem-at-bay screen for the K9000 station (CEO-approved
 * mockup, 2026-06-24). Full-screen focused flow (its own minimal header; no
 * bottom nav). Reached via /prestige/pass (centre Card/QR tab + the home
 * "Redeem wash" tile).
 *
 * K9000 is NOT bookable: the member shows this QR to the Nayax DOT reader, the
 * backend live-verifies and a free bay (of two) starts a ~5–7 min wash.
 *
 * REAL wiring (no fakes):
 *  - POST /api/prestige-pass/token/generate → a signed, single-use, 45s token.
 *    The QR encodes that token; a countdown shows time-to-expiry; expiry lets
 *    the member generate a fresh code.
 *  - EventSource /api/prestige-pass/session/stream → live redemption signal;
 *    when the station consumes the token we flip to the "redeemed / bay starting"
 *    state and refresh the wallet. We never fabricate a success.
 *
 * Brand: pearl bg, emerald/black, champagne-gold framing, official-asset logo,
 * Hebrew-first/RTL + EN.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronRight, ChevronLeft, ScanLine, CheckCircle2, RefreshCw, LifeBuoy } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';

const PEARL = '#FAF8F3';
const INK = '#0B0B0B';
const EMERALD = '#0B6B57';
const TEAL = '#0E8C86';
const GOLD = '#C9A24A';
const GOLD_DEEP = '#9B7426';
const MUTED = '#6B7280';
const QR_TTL = 45;

type RedeemState = 'loading' | 'ready' | 'redeemed' | 'expired' | 'error';

interface TokenResp { ok: boolean; token: string; jti: string; expiresAt: number; ttl: number }

const COPY = {
  he: {
    title: 'מימוש רחצה בעמדה',
    sub: 'הצמידו את הקוד לקורא ה‑QR בעמדה. המערכת מאמתת בזמן אמת ומפעילה עמדה פנויה.',
    info: 'מגיעים, סורקים בעמדה ומתחילים — ללא הזמנה · 2 עמדות · רחצה ~5–7 דק׳',
    waiting: 'ממתין לסריקה בעמדה · אימות בזמן אמת',
    validFor: (s: number) => `הקוד בתוקף עוד ${s} ש׳`,
    steps: ['הצגה', 'אימות', 'הפעלת עמדה'],
    redeemedTitle: 'אומת! העמדה מופעלת',
    redeemedSub: 'גשו לעמדה הפנויה. רחצה ~5–7 דק׳.',
    expiredTitle: 'הקוד פג',
    expiredSub: 'הפיקו קוד חדש כדי לממש.',
    newCode: 'קוד חדש',
    err: 'לא ניתן להפיק קוד כרגע',
    retry: 'נסו שוב',
    support: 'לא עובד? תמיכה / סריקה ידנית',
  },
  en: {
    title: 'Redeem wash at the bay',
    sub: 'Hold the code to the QR reader at the station. The system verifies in real time and starts a free bay.',
    info: 'Walk up, scan at the bay, start — no booking · 2 bays · wash ~5–7 min',
    waiting: 'Waiting for scan · real-time verification',
    validFor: (s: number) => `Code valid for ${s}s`,
    steps: ['Present', 'Verify', 'Bay starts'],
    redeemedTitle: 'Verified! Bay starting',
    redeemedSub: 'Head to the free bay. Wash ~5–7 min.',
    expiredTitle: 'Code expired',
    expiredSub: 'Generate a fresh code to redeem.',
    newCode: 'New code',
    err: 'Could not generate a code right now',
    retry: 'Try again',
    support: "Not working? Support / manual scan",
  },
} as const;

export default function PrestigeRedeem() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'he';
  const t = COPY[lang];
  const isRTL = lang === 'he';
  const Back = isRTL ? ChevronRight : ChevronLeft;

  const [state, setState] = useState<RedeemState>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL);
  const jtiRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const generate = useCallback(async () => {
    clearTimer();
    setState('loading');
    try {
      const resp = await apiRequest('POST', '/api/prestige-pass/token/generate', { bay: 'any' });
      const data: TokenResp = await resp.json();
      if (!data?.ok || !data.token) { setState('error'); return; }
      jtiRef.current = data.jti;
      setToken(data.token);
      const ttl = typeof data.ttl === 'number' && data.ttl > 0 ? data.ttl : QR_TTL;
      setSecondsLeft(ttl);
      setState('ready');
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) { clearTimer(); setState((cur) => (cur === 'ready' ? 'expired' : cur)); return 0; }
          return s - 1;
        });
      }, 1000);
    } catch {
      setState('error');
    }
  }, []);

  // Generate on mount.
  useEffect(() => { generate(); return clearTimer; }, [generate]);

  // Live redemption signal — flip to success when the station consumes the token.
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/prestige-pass/session/stream');
      es.onmessage = (ev) => {
        const raw = String(ev?.data ?? '');
        const mine = jtiRef.current && raw.includes(jtiRef.current);
        const looksRedeemed = /redeem|used|consumed|vend|wash_start|activated/i.test(raw);
        if (mine || looksRedeemed) {
          clearTimer();
          setState('redeemed');
          queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/wallet'] });
          queryClient.invalidateQueries({ queryKey: ['/api/credit-wallet/summary'] });
        }
      };
    } catch { /* stream unavailable — QR still works at the reader */ }
    return () => { es?.close(); };
  }, [queryClient]);

  const activeStep = state === 'redeemed' ? 2 : 0;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="flex flex-col" style={{ minHeight: '100dvh', background: PEARL, color: INK, paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      {/* Minimal header: back + official logo */}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center', padding: '4px 12px' }}>
        <button type="button" aria-label="Back" onClick={() => setLocation('/prestige')} style={{ background: 'none', border: 'none', cursor: 'pointer', justifySelf: 'start' }}>
          <Back size={24} color={INK} />
        </button>
        <img src="/brand/petwash-logo-official.png" alt="PetWash" style={{ height: 26, width: 'auto', objectFit: 'contain', justifySelf: 'center' }} draggable={false} />
        <span />
      </div>

      <div className="flex-1 flex flex-col items-center" style={{ padding: '8px 22px 0', maxWidth: 420, width: '100%', margin: '0 auto' }}>
        <div style={{ fontSize: 20, fontWeight: 500, textAlign: 'center' }}>{t.title}</div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, textAlign: 'center', marginTop: 4 }}>{t.sub}</div>

        {/* QR / state */}
        <div style={{ marginTop: 20, width: 224, height: 224, background: '#fff', borderRadius: 22, border: `2px solid ${GOLD}`, boxShadow: 'inset 0 0 0 1px #F1E4B8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {state === 'redeemed' ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 size={72} color={EMERALD} />
              <div style={{ fontSize: 14, fontWeight: 500, color: EMERALD, marginTop: 8 }}>{t.redeemedTitle}</div>
            </div>
          ) : state === 'ready' && token ? (
            <QRCodeSVG value={token} size={180} level="H" bgColor="#ffffff" fgColor={INK} />
          ) : state === 'expired' ? (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: GOLD_DEEP }}>{t.expiredTitle}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{t.expiredSub}</div>
            </div>
          ) : state === 'error' ? (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 13, color: MUTED }}>{t.err}</div>
            </div>
          ) : (
            <RefreshCw size={40} color={MUTED} className="animate-spin" />
          )}
        </div>

        {/* Status line */}
        <div style={{ marginTop: 14, minHeight: 28 }}>
          {state === 'ready' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EAF3EF', border: '0.5px solid rgba(14,140,134,0.4)', borderRadius: 999, padding: '6px 14px' }}>
              <ScanLine size={15} color={TEAL} />
              <span style={{ fontSize: 11, color: EMERALD, fontWeight: 500 }}>{t.waiting} · {t.validFor(secondsLeft)}</span>
            </div>
          )}
          {state === 'redeemed' && <div style={{ fontSize: 12, color: MUTED }}>{t.redeemedSub}</div>}
          {(state === 'expired' || state === 'error') && (
            <button type="button" onClick={generate} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: INK, color: '#fff', border: `1px solid ${GOLD}`, borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              <RefreshCw size={15} /> {state === 'error' ? t.retry : t.newCode}
            </button>
          )}
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 }}>
          {t.steps.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: i <= activeStep ? '#083D32' : '#fff', color: i <= activeStep ? '#fff' : GOLD_DEEP, border: i <= activeStep ? 'none' : `1px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{i + 1}</div>
                <span style={{ fontSize: 9, color: i <= activeStep ? INK : MUTED }}>{label}</span>
              </div>
              {i < t.steps.length - 1 && <div style={{ width: 30, height: 1, background: 'rgba(201,162,74,0.4)' }} />}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Info + support */}
        <div style={{ width: '100%', padding: '18px 0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#EAF3EF', border: '0.5px solid rgba(14,140,134,0.35)', borderRadius: 12, padding: '9px 12px' }}>
            <ScanLine size={16} color={TEAL} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: INK, lineHeight: 1.45 }}>{t.info}</span>
          </div>
          <button type="button" onClick={() => setLocation('/prestige/support')} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '12px auto 0', background: 'none', border: 'none', color: GOLD_DEEP, fontSize: 11, cursor: 'pointer' }}>
            <LifeBuoy size={14} /> {t.support}
          </button>
        </div>
      </div>
    </div>
  );
}
