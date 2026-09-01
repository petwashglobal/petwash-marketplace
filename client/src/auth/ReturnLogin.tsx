/**
 * ReturnLogin — the ONE returning-user door (Phase 4, CEO auth-rebuild
 * directive 2026-09-01).
 *
 *   PET WASH™
 *   Welcome back, Nir
 *   [ Continue with Face ID ]
 *   Use another account
 *
 * Progressive disclosure per CEO §7:
 *   - If we have a passkey hint (email in localStorage) AND the platform
 *     authenticator is available, the primary CTA is "Continue with
 *     Face ID". Everything else is behind "Use another account".
 *   - If passkey is unavailable, we fall through to Apple/Google/email
 *     recovery methods — reused via a lightweight <FallbackMethods />
 *     block that navigates to /signin with ?returnTo preserved.
 *
 * DESIGN PROPERTIES (per CEO briefs §1–§9):
 *   1. No new authentication method — this component consumes
 *      auth/passkey.ts (signInWithPasskey → server /api/webauthn/login/*
 *      → mints Firebase custom token → /api/auth/session).
 *   2. Never trusts localStorage as identity. The hint is only a UX
 *      convenience (which email to show, whether to render the button);
 *      the server always re-verifies.
 *   3. No SMS is sent by opening this page. Zero Twilio calls.
 *   4. Deep-link preservation via canonical `?returnTo=` helper. On
 *      successful sign-in the caller's postLoginCoordinator routes to
 *      the preserved destination — implemented in Phase 4.b.
 *   5. Fallback flow: "Use another account" → /signin (existing
 *      SignUpLuxury) so users are never dead-ended.
 *
 * Route + flag wiring lives in App.tsx alongside the existing signin
 * routes; this file is additive and does not require App.tsx changes
 * to compile. When ff.returning_user.new_door.enabled goes live, the
 * /signin route swaps in ReturnLogin as the default when a hint is
 * present.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { buildReturnToParam, readReturnTo } from './returnTo';
import {
  signInWithPasskey,
  isPlatformAuthenticatorAvailable,
} from './passkey';

type Phase = 'checking' | 'ready' | 'authenticating' | 'error' | 'fallback';

interface ReturnLoginProps {
  /** Optional override for tests. Defaults to reading `localStorage['petwash_passkey_email']`. */
  hintOverride?: string | null;
}

const PASSKEY_HINT_KEY = 'petwash_passkey_email';

function readPasskeyEmailHint(): string | null {
  try {
    return localStorage.getItem(PASSKEY_HINT_KEY);
  } catch {
    return null;
  }
}

/** First name from an email hint. Purely for the greeting — never used as identity. */
function greetingFromEmailHint(email: string | null): string | null {
  if (!email) return null;
  const local = email.split('@')[0] || '';
  const first = local.split(/[._-]/)[0] || '';
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export default function ReturnLogin({ hintOverride }: ReturnLoginProps = {}) {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>('checking');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const hint = hintOverride !== undefined ? hintOverride : readPasskeyEmailHint();
  const greeting = greetingFromEmailHint(hint);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const available = await isPlatformAuthenticatorAvailable();
      if (cancelled) return;
      // If we have neither a hint nor a platform authenticator, fall
      // through to the "Use another account" surface — nothing to
      // recognise the caller by.
      if (!hint || !available) {
        setPhase('fallback');
        return;
      }
      setPhase('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [hint]);

  async function onContinueWithPasskey() {
    setPhase('authenticating');
    setErrMsg(null);
    try {
      const result = await signInWithPasskey(hint || undefined);
      if (!result?.ok) {
        setPhase('error');
        setErrMsg(result?.error || 'Sign-in failed. Try another way.');
        return;
      }
      // Deep-link preservation — same helper as RequireAuth/RoleProtectedRoute.
      const returnTo = readReturnTo(window.location.search) || '/';
      navigate(returnTo);
    } catch (err) {
      setPhase('error');
      setErrMsg(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  }

  function onUseAnotherAccount() {
    // Preserve any ?returnTo= currently on the URL when handing off to /signin.
    const currentReturnTo = readReturnTo(window.location.search);
    const params = currentReturnTo ? buildReturnToParam(currentReturnTo) : '';
    navigate(`/signin${params}`);
  }

  if (phase === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#B8932F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === 'fallback') {
    // No hint / no platform authenticator — silently forward to the
    // existing sign-in surface. Preserves returnTo. Users never see
    // "we can't recognise you" — they just land in /signin.
    const params = buildReturnToParam(readReturnTo(window.location.search) || '');
    if (typeof window !== 'undefined') {
      window.location.replace(`/signin${params}`);
    }
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm text-center">
        {/* Brand mark — the existing logo asset is referenced elsewhere;
            here we keep the type-set wordmark clean per §0 brand rules. */}
        <div className="text-[11px] tracking-[0.28em] uppercase text-black/60 mb-8">
          PET&nbsp;WASH™
        </div>

        <h1 className="text-[28px] font-normal text-black leading-tight mb-1">
          {greeting ? `Welcome back, ${greeting}` : 'Welcome back'}
        </h1>
        {hint ? (
          <p className="text-sm text-black/50 mb-10" data-testid="return-login-hint-email">
            {hint}
          </p>
        ) : (
          <div className="mb-10" />
        )}

        <button
          type="button"
          onClick={onContinueWithPasskey}
          disabled={phase === 'authenticating'}
          className="w-full py-4 rounded-full bg-black text-white text-base font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          data-testid="button-return-login-passkey"
        >
          {phase === 'authenticating' ? 'Authenticating…' : 'Continue with Face ID'}
        </button>

        {errMsg && (
          <p className="mt-4 text-sm text-red-700" role="alert" data-testid="return-login-error">
            {errMsg}
          </p>
        )}

        <button
          type="button"
          onClick={onUseAnotherAccount}
          className="mt-6 text-sm text-black/60 underline underline-offset-4 hover:text-black transition-colors"
          data-testid="button-return-login-fallback"
        >
          Use another account
        </button>

        <p className="mt-12 text-[11px] text-black/40 leading-relaxed">
          Face&nbsp;ID is verified by your device. Pet&nbsp;Wash never sees
          your face — only a passkey stored securely on this device.
        </p>
      </div>
    </div>
  );
}
