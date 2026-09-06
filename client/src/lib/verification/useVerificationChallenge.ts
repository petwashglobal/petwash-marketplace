/**
 * The single client-side owner of a verification challenge.
 *
 * Every surface used to hand-roll this: its own fetch, its own countdown, its
 * own guesses about cooldowns, its own idea of what an error meant. That is
 * how twelve slightly-different OTP screens happen. This hook is the one
 * place that talks to /api/verification, so a fix lands everywhere at once.
 *
 * Contract notes that matter:
 *  - The server returns `maskedDestination`, never the raw address. We render
 *    what it gives us and never mask anything ourselves.
 *  - The server returns `resendAvailableAt`. The countdown is driven by that,
 *    not by a hard-coded 30 or 60 in the UI, so the button re-enables exactly
 *    when the server would actually accept a resend.
 *  - A failed verify NEVER clears the challenge. The customer keeps their
 *    place; only the six digits are theirs to retype.
 *
 * TRANSPORTS. The default talks to /api/verification/*. A caller may supply
 * its own, and signup/login do — NOT to have a second OTP implementation, but
 * because /api/auth/email/* carries the Turnstile bot guard that the generic
 * endpoint does not, and dropping that from the most-attacked surface in the
 * product to tidy up a URL would be a bad trade. Both transports return the
 * same masked challenge shape, so everything above this line is identical.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiUrl } from '@/lib/apiConfig';
import type { VerificationChannel, VerificationPurpose } from './purposeCopy';

export interface PublicChallenge {
  challengeId: string;
  purpose: VerificationPurpose;
  channel: VerificationChannel;
  maskedDestination: string;
  status: 'pending' | 'verified' | 'expired' | 'failed' | string;
  expiresAt: string;
  resendAvailableAt: string;
  attempts: number;
  maxAttempts: number;
}

export interface VerificationFailure {
  reasonCode: string;
  status?: number;
}

type Phase = 'idle' | 'starting' | 'awaiting_code' | 'verifying' | 'resending' | 'verified';

interface StartArgs {
  purpose: VerificationPurpose;
  channel: VerificationChannel;
  destination: string;
  payload?: Record<string, unknown>;
}

/**
 * How a surface reaches the verification service.
 *
 * `start` receives the same args the canonical endpoint takes; a transport is
 * free to ignore what it does not need (auth-email derives the purpose from
 * its own body shape, for instance) as long as it returns `{ challenge }`.
 */
export interface VerificationTransport {
  start: (args: StartArgs) => Promise<{ status: number; json: any }>;
  verify: (args: { challengeId: string; code: string; challenge: PublicChallenge }) => Promise<{ status: number; json: any }>;
  resend: (args: { challengeId: string; channel?: VerificationChannel; challenge: PublicChallenge }) => Promise<{ status: number; json: any }>;
}

async function postJson(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function failureFrom(status: number, json: any): VerificationFailure {
  const reasonCode =
    (typeof json?.reasonCode === 'string' && json.reasonCode)
    || (typeof json?.error === 'string' && json.error)
    || 'UNKNOWN';
  return { reasonCode, status };
}

/** The canonical transport: /api/verification/*. */
export const canonicalVerificationTransport: VerificationTransport = {
  start: (a) => postJson('/api/verification/start', {
    purpose: a.purpose, channel: a.channel, destination: a.destination, payload: a.payload,
  }),
  verify: (a) => postJson('/api/verification/verify', { challengeId: a.challengeId, code: a.code }),
  resend: (a) => postJson('/api/verification/resend', { challengeId: a.challengeId, channel: a.channel }),
};

export interface UseVerificationChallenge {
  phase: Phase;
  challenge: PublicChallenge | null;
  failure: VerificationFailure | null;
  /** Seconds until a resend will be accepted. 0 = available now. */
  resendIn: number;
  /** True right after a successful resend, so the UI can confirm it. */
  justResent: boolean;
  start: (args: StartArgs) => Promise<PublicChallenge | null>;
  /**
   * Adopt a challenge someone else already created.
   *
   * Signup needs this: /api/auth/email/start is behind a Turnstile guard, and
   * solving that widget is the page's job (it knows when to render it). So the
   * page starts the challenge and the shared flow takes over from code entry
   * onward — rather than the flow re-implementing a bot check, or worse,
   * starting a SECOND challenge and invalidating the code already sent.
   */
  adopt: (challenge: PublicChallenge) => void;
  verify: (code: string) => Promise<any | null>;
  resend: (channel?: VerificationChannel) => Promise<boolean>;
  reset: () => void;
}

export function useVerificationChallenge(
  transportOverride?: VerificationTransport,
): UseVerificationChallenge {
  const transport = transportOverride ?? canonicalVerificationTransport;
  const [phase, setPhase] = useState<Phase>('idle');
  const [challenge, setChallenge] = useState<PublicChallenge | null>(null);
  const [failure, setFailure] = useState<VerificationFailure | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [justResent, setJustResent] = useState(false);

  // Guards a double-submit: two clicks on Continue, or an auto-submit racing
  // a manual one, must not spend two of the five allowed attempts.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Server-driven countdown.
  useEffect(() => {
    if (!challenge?.resendAvailableAt) { setResendIn(0); return; }
    const target = new Date(challenge.resendAvailableAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setResendIn(left);
      return left;
    };
    if (tick() === 0) return;
    const id = window.setInterval(() => { if (tick() === 0) window.clearInterval(id); }, 1000);
    return () => window.clearInterval(id);
  }, [challenge?.resendAvailableAt]);

  useEffect(() => {
    if (!justResent) return;
    const id = window.setTimeout(() => mounted.current && setJustResent(false), 4000);
    return () => window.clearTimeout(id);
  }, [justResent]);

  const start = useCallback(async (args: StartArgs) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setPhase('starting');
    setFailure(null);
    try {
      const { status, json } = await transport.start(args);
      if (!mounted.current) return null;
      if (status >= 400 || !json?.ok) {
        setFailure(failureFrom(status, json));
        setPhase('idle');
        return null;
      }
      const next = json.challenge as PublicChallenge;
      setChallenge(next);
      setPhase('awaiting_code');
      return next;
    } catch {
      if (mounted.current) { setFailure({ reasonCode: 'NETWORK' }); setPhase('idle'); }
      return null;
    } finally {
      inFlight.current = false;
    }
  }, [transport]);

  const verify = useCallback(async (code: string) => {
    if (inFlight.current || !challenge) return null;
    inFlight.current = true;
    setPhase('verifying');
    setFailure(null);
    try {
      const { status, json } = await transport.verify({
        challengeId: challenge.challengeId, code, challenge,
      });
      if (!mounted.current) return null;
      if (status >= 400 || !json?.ok) {
        setFailure(failureFrom(status, json));
        // Keep the challenge. A wrong digit must not throw the customer back
        // to the start of the flow — they only need to retype six characters.
        if (json?.challenge) setChallenge(json.challenge as PublicChallenge);
        setPhase('awaiting_code');
        return null;
      }
      setPhase('verified');
      return json;
    } catch {
      if (mounted.current) { setFailure({ reasonCode: 'NETWORK' }); setPhase('awaiting_code'); }
      return null;
    } finally {
      inFlight.current = false;
    }
  }, [challenge, transport]);

  const resend = useCallback(async (channel?: VerificationChannel) => {
    if (inFlight.current || !challenge || resendIn > 0) return false;
    inFlight.current = true;
    setPhase('resending');
    setFailure(null);
    try {
      const { status, json } = await transport.resend({
        challengeId: challenge.challengeId, channel, challenge,
      });
      if (!mounted.current) return false;
      if (status >= 400 || !json?.ok) {
        setFailure(failureFrom(status, json));
        setPhase('awaiting_code');
        return false;
      }
      setChallenge(json.challenge as PublicChallenge);
      setJustResent(true);
      setPhase('awaiting_code');
      return true;
    } catch {
      if (mounted.current) { setFailure({ reasonCode: 'NETWORK' }); setPhase('awaiting_code'); }
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [challenge, resendIn, transport]);

  const adopt = useCallback((next: PublicChallenge) => {
    setChallenge(next);
    setFailure(null);
    setPhase('awaiting_code');
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setChallenge(null);
    setFailure(null);
    setResendIn(0);
    setJustResent(false);
  }, []);

  return { phase, challenge, failure, resendIn, justResent, start, adopt, verify, resend, reset };
}
