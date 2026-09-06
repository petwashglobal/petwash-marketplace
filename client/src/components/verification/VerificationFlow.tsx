/**
 * VerificationFlow — THE Pet Wash verification screen.
 *
 * One component for every purpose: signup, login, eGift, email change, phone
 * change, 2FA, account closure, payout. If a new surface needs a code, it
 * renders this; it does not build another form.
 *
 * The screen answers, in order, the questions a customer actually has:
 *   why am I verifying      -> purpose title + lede
 *   where was it sent       -> server-masked destination, never a raw address
 *   what do I enter         -> one accessible 6-digit input
 *   what if it didn't come  -> resend, on a server-driven countdown
 *   can I use another way   -> only channels the SERVER allows for this purpose
 *   what happens next       -> the purpose's "next" line, shown up front
 *
 * A note on the digits: this uses a SINGLE underlying <input> (the `input-otp`
 * package) rendered as six slots, not six separate <input>s. One input means
 * one thing for a screen reader to announce, paste works without redistributing
 * characters by hand, and iOS one-time-code autofill fills the value rather
 * than one box. The six-box component elsewhere in the tree stays where it is
 * until its surfaces migrate here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import {
  CHANNEL_NOUN,
  UI_COPY,
  purposeCopy,
  verificationErrorMessage,
  type CopyLanguage,
  type VerificationChannel,
  type VerificationPurpose,
} from '@/lib/verification/purposeCopy';
import {
  useVerificationChallenge,
  type PublicChallenge,
  type VerificationTransport,
} from '@/lib/verification/useVerificationChallenge';

const CODE_LENGTH = 6;

export interface VerificationFlowProps {
  purpose: VerificationPurpose;
  /** Where the code should go. The SERVER decides whether the channel is allowed. */
  destination: string;
  /**
   * Preferred channel. Treated as a REQUEST, not a decision — if the server
   * refuses it for this purpose the flow surfaces CHANNEL_NOT_ALLOWED rather
   * than silently downgrading. Defaults to email, which costs nothing.
   */
  preferredChannel?: VerificationChannel;
  /** Channels to offer as fallbacks. Must come from the server's policy for this purpose. */
  allowedChannels?: readonly VerificationChannel[];
  /** Extra context the purpose's execute() needs (voucherId, language, …). */
  context?: Record<string, unknown>;
  language?: CopyLanguage;
  /** Called with the verify response once the server accepts the code. */
  onVerified: (result: any, challenge: PublicChallenge) => void;
  /** "Change email" / "Change number" — omitted when the caller has nowhere to go back to. */
  onChangeDestination?: () => void;
  /** Rendered as a plain Back control. */
  onBack?: () => void;
  /** Switch to a different channel — the caller collects the new destination. */
  onSwitchChannel?: (channel: VerificationChannel) => void;
  className?: string;
  /**
   * Start the challenge on mount. Set false when the caller already started
   * one — signup does, because its /start is behind a Turnstile guard the
   * page owns. Pass that challenge as `existingChallenge`.
   */
  autoStart?: boolean;
  existingChallenge?: PublicChallenge | null;
  /**
   * How this surface reaches the verification service. Defaults to
   * /api/verification/*. Signup/login supply /api/auth/email/* because that
   * route carries the Turnstile bot guard the generic endpoint does not —
   * a different transport, not a different implementation.
   */
  transport?: VerificationTransport;
}

function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function VerificationFlow({
  purpose,
  destination,
  preferredChannel = 'email',
  allowedChannels,
  context,
  language = 'en',
  onVerified,
  onChangeDestination,
  onBack,
  onSwitchChannel,
  className,
  autoStart = true,
  existingChallenge = null,
  transport,
}: VerificationFlowProps) {
  const he = language === 'he';
  const copy = purposeCopy(purpose, language);
  const { phase, challenge, failure, resendIn, justResent, start, adopt, verify, resend } =
    useVerificationChallenge(transport);

  const [code, setCode] = useState('');
  const startedFor = useRef<string | null>(null);
  const autoSubmitted = useRef<string | null>(null);

  // Adopt a caller-started challenge. Same one-shot guard as start(): a
  // re-render must not re-adopt and reset the customer's typing.
  useEffect(() => {
    if (!existingChallenge) return;
    const key = `adopt|${existingChallenge.challengeId}`;
    if (startedFor.current === key) return;
    startedFor.current = key;
    adopt(existingChallenge);
  }, [existingChallenge, adopt]);

  // Start exactly once per (purpose, channel, destination). Without this guard
  // a re-render would open a second challenge and invalidate the code already
  // sitting in the customer's inbox.
  useEffect(() => {
    if (!autoStart || existingChallenge) return;
    const key = `${purpose}|${preferredChannel}|${destination}`;
    if (startedFor.current === key) return;
    startedFor.current = key;
    void start({ purpose, channel: preferredChannel, destination, payload: { ...context, language } });
  }, [autoStart, existingChallenge, purpose, preferredChannel, destination, context, language, start]);

  const submit = useCallback(async (value: string) => {
    if (value.length !== CODE_LENGTH) return;
    const result = await verify(value);
    if (result) onVerified(result, challenge as PublicChallenge);
  }, [verify, onVerified, challenge]);

  // Auto-submit only when it is SAFE: six digits, nothing already in flight,
  // and never twice for the same value. Re-typing the same wrong code has to
  // be a deliberate act, or a customer burns their five attempts on autopilot.
  useEffect(() => {
    if (code.length !== CODE_LENGTH) return;
    if (phase !== 'awaiting_code') return;
    if (autoSubmitted.current === code) return;
    autoSubmitted.current = code;
    void submit(code);
  }, [code, phase, submit]);

  // A new code invalidates whatever is typed — clear it so the customer is not
  // staring at six stale digits after pressing Resend.
  useEffect(() => {
    if (justResent) { setCode(''); autoSubmitted.current = null; }
  }, [justResent]);

  const busy = phase === 'starting' || phase === 'verifying' || phase === 'resending';
  const channel = challenge?.channel ?? preferredChannel;
  const channelNoun = CHANNEL_NOUN[channel]?.[language] ?? CHANNEL_NOUN.email[language];

  const fallbacks = useMemo(() => {
    const policy = allowedChannels ?? [];
    return policy.filter((c) => c !== channel && (c === 'sms' || c === 'whatsapp' || c === 'email'));
  }, [allowedChannels, channel]);

  const errorText = failure ? verificationErrorMessage(failure.reasonCode, language) : null;
  // An expired or exhausted code is fixed by a NEW code, not by retyping —
  // so the input goes away and Resend becomes the obvious next move.
  const needsNewCode =
    failure?.reasonCode === 'CHALLENGE_EXPIRED'
    || failure?.reasonCode === 'TOO_MANY_ATTEMPTS'
    || failure?.reasonCode === 'CHALLENGE_NOT_PENDING';

  return (
    <section
      dir={he ? 'rtl' : 'ltr'}
      className={cn(
        'w-full max-w-md mx-auto px-5 py-8 text-neutral-900',
        he && 'text-right',
        className,
      )}
      data-testid="verification-flow"
      data-purpose={purpose}
      data-channel={channel}
      aria-busy={busy}
    >
      <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{copy.lede}</p>

      {/* Where it went. The masked value is produced by the server. */}
      <p className="mt-5 text-[15px] text-neutral-600">
        {UI_COPY.sentTo[language](channelNoun)}
      </p>
      <p
        className="mt-1 text-[17px] font-medium tabular-nums"
        dir="ltr"
        data-testid="verification-destination"
      >
        {challenge?.maskedDestination ?? '•••'}
      </p>

      {!needsNewCode && (
        <div className="mt-6">
          {/* The digit row is always LTR — a code is a code in every language. */}
          <div dir="ltr" className={cn('flex', he ? 'justify-end' : 'justify-start')}>
            <InputOTP
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(v: string) => {
                setCode(v);
                if (v.length < CODE_LENGTH) autoSubmitted.current = null;
              }}
              disabled={busy || phase === 'verified'}
              // iOS/Android one-time-code autofill lands on the single input.
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label={UI_COPY.codeLabel[language]}
              data-testid="verification-code-input"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' && code.length === CODE_LENGTH) {
                  e.preventDefault();
                  void submit(code);
                }
              }}
            >
              <InputOTPGroup className="gap-2">
                {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className={cn(
                      'h-14 w-12 rounded-xl border-2 text-xl font-semibold',
                      'first:rounded-l-xl last:rounded-r-xl border-l',
                      errorText ? 'border-red-500' : 'border-neutral-300',
                    )}
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <button
            type="button"
            onClick={() => void submit(code)}
            disabled={busy || code.length !== CODE_LENGTH}
            data-testid="verification-continue"
            className={cn(
              'mt-6 w-full min-h-[52px] py-3.5 rounded-xl text-[15px] font-semibold transition-colors',
              'bg-neutral-900 text-white disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {phase === 'verifying' ? UI_COPY.verifying[language] : copy.cta}
          </button>
        </div>
      )}

      {errorText && (
        <p role="alert" className="mt-4 text-sm text-red-600" data-testid="verification-error">
          {errorText}
        </p>
      )}

      {justResent && (
        <p role="status" className="mt-4 text-sm text-emerald-700" data-testid="verification-resent">
          {UI_COPY.resent[language]}
        </p>
      )}

      {/* What if it didn't arrive. */}
      <div className="mt-7 border-t border-neutral-200 pt-5 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-neutral-600">{UI_COPY.didntGetIt[language]}</span>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={busy || resendIn > 0}
            data-testid="verification-resend"
            className="font-medium underline underline-offset-4 disabled:no-underline disabled:text-neutral-400 disabled:cursor-not-allowed"
          >
            {resendIn > 0
              ? UI_COPY.resendIn[language](mmss(resendIn))
              : phase === 'resending'
                ? UI_COPY.sending[language]
                : UI_COPY.resend[language]}
          </button>
        </div>

        {/* Only channels the SERVER permits for this purpose. */}
        {fallbacks.length > 0 && onSwitchChannel && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {fallbacks.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onSwitchChannel(c)}
                data-testid={`verification-switch-${c}`}
                className="font-medium underline underline-offset-4"
              >
                {c === 'sms'
                  ? UI_COPY.useSms[language]
                  : c === 'whatsapp'
                    ? UI_COPY.useWhatsapp[language]
                    : UI_COPY.useEmail[language]}
              </button>
            ))}
          </div>
        )}

        {onChangeDestination && (
          <button
            type="button"
            onClick={onChangeDestination}
            data-testid="verification-change-destination"
            className="font-medium underline underline-offset-4"
          >
            {channel === 'email' ? UI_COPY.changeEmail[language] : UI_COPY.changePhone[language]}
          </button>
        )}
      </div>

      {/* What happens next — stated up front, not after the fact. */}
      <p className="mt-6 text-xs leading-relaxed text-neutral-500">{copy.next}</p>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          data-testid="verification-back"
          className="mt-6 text-sm text-neutral-500 underline underline-offset-4"
        >
          {UI_COPY.back[language]}
        </button>
      )}
    </section>
  );
}

export default VerificationFlow;
