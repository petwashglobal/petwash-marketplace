/**
 * AI-B1 — Conversational booking intake input.
 *
 * Drops onto the existing ProviderMatchScreen idle state ABOVE the service
 * chip card. Customer types ("walk my dog tomorrow morning in Tel Aviv" or
 * "אני צריך דוגווקר מחר בבוקר"), backend Gemini parses into structured
 * BookingRequest fields, customer reviews + continues into the existing
 * matching/booking flow. Never submits a booking from here; never confirms;
 * never assigns a provider.
 *
 * Backend gate: ff.ai.booking_intake.enabled (default OFF). When OFF the
 * backend returns 503 feature_disabled and this component renders nothing
 * (graceful invisibility — no broken affordance).
 *
 * Backend fallback: if Gemini is unavailable, the route returns 200 with
 * fallback:true + empty parse. This component shows a friendly "I couldn't
 * understand everything, please add details" line and the customer keeps
 * using the manual service chips below.
 *
 * Brand: cream/white luxury card, soft gold accents, RTL-aware, respects
 * prefers-reduced-motion.
 */

import { memo, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';

// Mirrors server/routes/ai-booking.ts ParsedIntake.
export interface ParsedIntake {
  serviceType:
    | 'dog_walking'
    | 'pet_sitting'
    | 'pet_wash'
    | 'grooming'
    | 'mobile_wash'
    | 'training'
    | 'academy'
    | 'unknown';
  petType: 'dog' | 'cat' | 'bird' | 'other' | 'unknown';
  petName: string | null;
  petSize: 'small' | 'medium' | 'large' | 'giant' | 'unknown';
  city: string | null;
  addressText: string | null;
  dateText: string | null;
  timeWindow: 'morning' | 'afternoon' | 'evening' | 'anytime' | 'exact' | 'unknown';
  urgency: 'low' | 'normal' | 'urgent';
  careNotes: string[];
  preferredProviderTraits: string[];
  missingFields: string[];
  confidence: number;
}

interface ApiResponse {
  ok: boolean;
  parsed?: ParsedIntake;
  fallback?: boolean;
  reason?: string;
  error?: string;
}

// ── Brand tokens (kept in sync with ProviderMatchScreen) ───────────────────
const INK = '#0B0B0B';
const INK_SOFT = '#5C5C5C';
const INK_MUTED = '#9A958C';
const GOLD = '#C5A55A';
const GOLD_SOFT = 'rgba(197,165,90,0.08)';
const GOLD_LINE = 'rgba(197,165,90,0.35)';

const COPY = {
  en: {
    title: 'Tell us what you need',
    sub: 'Describe the service in your own words. PetWash will help prepare your booking request.',
    placeholder: 'Walk my dog tomorrow morning in Tel Aviv',
    cta: 'Smart fill booking',
    loading: 'Reading your request…',
    successPrefix: 'Got it.',
    successCta: 'Review booking request',
    fallbackMsg: 'I couldn’t understand everything. Please add a few more details below.',
    flagHint: 'Optional — you can skip this and pick a service below.',
    sparkleLabel: 'AI assistant',
  },
  he: {
    title: 'ספרו לנו מה אתם צריכים',
    sub: 'תארו את השירות במילים שלכם. PetWash תכין עבורכם בקשה להזמנה.',
    placeholder: 'אני צריך דוגווקר מחר בבוקר בתל אביב',
    cta: 'מילוי חכם של הזמנה',
    loading: 'קוראים את הבקשה שלכם…',
    successPrefix: 'הבנתי.',
    successCta: 'מעבר לסקירת ההזמנה',
    fallbackMsg: 'לא הצלחתי להבין הכל. אפשר להוסיף פרטים נוספים למטה.',
    flagHint: 'אופציונלי — אפשר לדלג ולבחור שירות למטה.',
    sparkleLabel: 'עוזר AI',
  },
} as const;

interface Props {
  language: 'en' | 'he';
  onParsed: (intake: ParsedIntake) => void;
}

// Map AI serviceType → our 3 supported chip values on ProviderMatchScreen.
// dog_walking → walking, pet_wash/mobile_wash/grooming → grooming, k9000 unreachable.
// pet_sitting / training / academy → no current chip; parent decides what to do.
export function mapAiServiceToChip(
  s: ParsedIntake['serviceType'],
): 'grooming' | 'walking' | 'k9000' | null {
  switch (s) {
    case 'dog_walking':
      return 'walking';
    case 'grooming':
    case 'mobile_wash':
    case 'pet_wash':
      return 'grooming';
    default:
      return null;
  }
}

export const ConversationalBookingIntake = memo(function ConversationalBookingIntake({
  language,
  onParsed,
}: Props) {
  const t = COPY[language === 'he' ? 'he' : 'en'];
  const isRtl = language === 'he';
  const reduced = useReducedMotion();

  // 'hidden' = feature off OR endpoint disabled; render nothing.
  // 'idle' / 'loading' / 'success' / 'fallback' = visible states.
  const [phase, setPhase] = useState<'unknown' | 'hidden' | 'idle' | 'loading' | 'success' | 'fallback'>('unknown');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedIntake | null>(null);

  // Probe the endpoint on mount. If 503 → hide. If 200 (even on a no-op
  // empty-body 400) → show. We send a tiny HEAD-like body to avoid burning
  // an AI call. 400 invalid_body is fine — it tells us the route is alive.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const probe = await fetch('/api/ai/booking/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '' }), // intentionally invalid; cheap probe
          credentials: 'include',
        });
        if (cancelled) return;
        if (probe.status === 503) {
          setPhase('hidden');
        } else {
          setPhase('idle');
        }
      } catch {
        if (!cancelled) setPhase('hidden'); // network error → hide silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPhase('loading');
    try {
      const res = await fetch('/api/ai/booking/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          locale: language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        credentials: 'include',
      });
      if (res.status === 503) {
        setPhase('hidden');
        return;
      }
      const data: ApiResponse = await res.json();
      if (!data.ok || !data.parsed) {
        setPhase('fallback');
        return;
      }
      setParsed(data.parsed);
      // Bubble parsed intake up immediately so the parent can prefill chips.
      onParsed(data.parsed);
      setPhase(data.fallback ? 'fallback' : 'success');
    } catch {
      setPhase('fallback');
    }
  }

  if (phase === 'unknown' || phase === 'hidden') return null;

  return (
    <motion.div
      dir={isRtl ? 'rtl' : 'ltr'}
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full mb-4"
      style={{
        backgroundColor: 'white',
        border: `1px solid ${GOLD_LINE}`,
        borderRadius: 20,
        padding: 22,
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.02), 0 12px 32px rgba(11,11,11,0.06)',
      }}
    >
      {/* AI label */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          paddingInline: 10,
          paddingBlock: 4,
          borderRadius: 999,
          backgroundColor: GOLD_SOFT,
          color: GOLD,
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        <Sparkles size={11} aria-hidden />
        {t.sparkleLabel}
      </div>

      <p
        style={{
          color: INK,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          marginBottom: 4,
        }}
      >
        {t.title}
      </p>
      <p
        style={{
          color: INK_SOFT,
          fontSize: 12,
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        {t.sub}
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (phase === 'success' || phase === 'fallback') setPhase('idle');
        }}
        placeholder={t.placeholder}
        rows={2}
        maxLength={1000}
        aria-label={t.title}
        style={{
          width: '100%',
          resize: 'vertical',
          minHeight: 56,
          padding: '12px 14px',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 12,
          fontSize: 13,
          lineHeight: 1.4,
          color: INK,
          backgroundColor: 'rgba(0,0,0,0.015)',
          outline: 'none',
          fontFamily: 'inherit',
        }}
        disabled={phase === 'loading'}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button
          onClick={submit}
          disabled={phase === 'loading' || text.trim().length === 0}
          style={{
            touchAction: 'manipulation',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            paddingInline: 16,
            paddingBlock: 11,
            backgroundColor: INK,
            color: 'white',
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            borderRadius: 12,
            opacity: phase === 'loading' || text.trim().length === 0 ? 0.55 : 1,
            transition: 'opacity 120ms ease, transform 100ms ease',
          }}
        >
          {phase === 'loading' ? t.loading : t.cta}
          {phase !== 'loading' && (
            <ArrowRight
              size={13}
              style={{ transform: isRtl ? 'scaleX(-1)' : undefined }}
              aria-hidden
            />
          )}
        </button>

        <span style={{ color: INK_MUTED, fontSize: 11, letterSpacing: '0.02em' }}>
          {t.flagHint}
        </span>
      </div>

      {/* Parsed-fields chip strip — appears on success/fallback after a parse */}
      {parsed && (phase === 'success' || phase === 'fallback') && (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          <ParsedChip
            visible={parsed.serviceType !== 'unknown'}
            label={parsed.serviceType.replace(/_/g, ' ')}
          />
          <ParsedChip visible={parsed.petType !== 'unknown'} label={parsed.petType} />
          <ParsedChip visible={!!parsed.city} label={parsed.city ?? ''} />
          <ParsedChip visible={!!parsed.dateText} label={parsed.dateText ?? ''} />
          <ParsedChip
            visible={parsed.timeWindow !== 'unknown'}
            label={parsed.timeWindow}
          />
          {parsed.careNotes.slice(0, 4).map((tag) => (
            <ParsedChip key={tag} visible label={tag.replace(/_/g, ' ')} accent />
          ))}
        </div>
      )}

      {/* Fallback message: friendly, never alarming */}
      {phase === 'fallback' && (
        <p
          style={{
            marginTop: 12,
            color: INK_MUTED,
            fontSize: 12,
            lineHeight: 1.5,
          }}
          role="status"
          aria-live="polite"
        >
          {t.fallbackMsg}
        </p>
      )}

      {/* Success message — only appears when we actually parsed something */}
      {phase === 'success' && (
        <p
          style={{
            marginTop: 12,
            color: INK_SOFT,
            fontSize: 12,
            lineHeight: 1.5,
          }}
          role="status"
          aria-live="polite"
        >
          {t.successPrefix} {t.successCta} ↓
        </p>
      )}
    </motion.div>
  );
});

function ParsedChip({
  label,
  visible,
  accent,
}: {
  label: string;
  visible: boolean;
  accent?: boolean;
}) {
  if (!visible || !label.trim()) return null;
  return (
    <span
      style={{
        paddingInline: 10,
        paddingBlock: 5,
        borderRadius: 999,
        fontSize: 11,
        letterSpacing: '0.02em',
        color: accent ? GOLD : INK_SOFT,
        backgroundColor: accent ? GOLD_SOFT : '#F4F1EB',
        border: `1px solid ${accent ? GOLD_LINE : 'rgba(0,0,0,0.05)'}`,
        textTransform: 'capitalize',
      }}
    >
      {label}
    </span>
  );
}
