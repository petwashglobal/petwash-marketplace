/**
 * BecomeProviderResume — resume router for the "Become a Provider" flow.
 *
 * Per CEO 2026-08-18 §8: an authenticated existing user tapping "Become a
 * Provider" must never be sent through full signup again. Route them by
 * the SERVER-KNOWN application state:
 *
 *   No application          → /provider-onboarding (new draft)
 *   status = draft          → /provider-onboarding (resume)
 *   status = pending_review → /provider/pending
 *   status = under_review   → /provider/pending
 *   status = approved       → /provider/today (CEO benchmark surface)
 *   status = rejected       → /provider/rejected
 *   status = withdrawn      → /provider-onboarding (reapply)
 *
 * Anonymous user → /sign-in?redirect=<canonical target>. The sign-in
 * flow honors the redirect and lands the user right where they started.
 *
 * Reads /api/provider-applications/my — the same endpoint ProviderPending
 * uses. Server is authority for the application state; the client never
 * invents.
 *
 * CEO MASTER §3 §4 (2026-08-29 correction) — this router is the ONE gate
 * every provider CTA routes through. It reads the CANONICAL vocabulary
 * (`?requestedService=pet_sitting` — the CEO §A7 code) via the shared
 * normaliser, and PRESERVES the FULL canonical return-to (query string
 * intact, UTM/campaign intact) through the anonymous sign-in bounce so a
 * customer arriving from Google → Sitter → Become a Sitter → sign-up
 * → Google resumes with the intent still attached, not on generic home.
 *
 * Legacy `?type=sitter` and `?role=trainer` are STILL accepted at the
 * edge — the normaliser handles every alias. New CTAs should emit the
 * canonical form via `urlForProviderIntent()` in `@/lib/ctaActions`.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { Loader2 } from 'lucide-react';
import {
  normaliseToProviderServiceCode,
  type ProviderServiceCode,
} from '@shared/lib/providerServiceVocabulary';
import { safeInternalReturnTo } from '@/lib/ctaActions';
import {
  ATTRIBUTION_KEYS,
  canonicalBecomeProviderUrl,
  legacyProviderTypeFor,
  onboardingHref,
  resumeTargetFromApplication,
  type ResumeTarget,
} from './becomeProviderResume.helpers';

// Re-export the helpers so existing consumers keep resolving.
export { legacyProviderTypeFor, resumeTargetFromApplication };

/**
 * Read the requested service intent from the URL. Accepts the canonical
 * `?requestedService=pet_sitting` (CEO §A7) plus the legacy
 * `?type=sitter` / `?role=trainer` aliases, using the shared
 * normaliser — no local whitelist duplication.
 */
function readRequestedServiceFromUrl(): ProviderServiceCode | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  for (const key of ['requestedService', 'type', 'role']) {
    const v = p.get(key);
    const code = normaliseToProviderServiceCode(v);
    if (code) return code;
  }
  return null;
}

/**
 * Read whitelisted attribution params from the URL. Only the exact
 * allowlist matches Lane E's `CtaUrlAttribution` — nothing else survives
 * the round-trip. CEO §A5.
 */
function readAttributionFromUrl(): URLSearchParams {
  const out = new URLSearchParams();
  if (typeof window === 'undefined') return out;
  const p = new URLSearchParams(window.location.search);
  for (const k of ATTRIBUTION_KEYS) {
    const v = p.get(k);
    if (typeof v === 'string' && v.length > 0 && v.length <= 512) out.set(k, v);
  }
  return out;
}

export default function BecomeProviderResume() {
  const { user, loading } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<ResumeTarget | null>(null);

  useEffect(() => {
    if (loading) return;

    const service = readRequestedServiceFromUrl();
    const attribution = readAttributionFromUrl();

    // Anonymous user → sign in, PRESERVING the FULL canonical
    // /become-provider URL (service + attribution) as the safe
    // return-to. CEO §4 — do NOT reduce to `/provider-onboarding`
    // and lose state. `safeInternalReturnTo` validates the redirect
    // is an internal path (§5).
    if (!user) {
      const back = canonicalBecomeProviderUrl(service, attribution);
      const validated = safeInternalReturnTo(back);
      const safe = validated ?? '/become-provider';
      setTarget(`/sign-in?redirect=${encodeURIComponent(safe)}`);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/provider-applications/my', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        if (cancelled) return;

        if (res.status === 404) {
          setTarget(onboardingHref(service));
          return;
        }
        if (!res.ok) {
          setTarget(onboardingHref(service));
          return;
        }
        const data = await res.json().catch(() => null);
        setTarget(resumeTargetFromApplication(data, service));
      } catch {
        if (!cancelled) {
          setError(isHe ? 'שגיאה זמנית — מנווט להמשך יישום…' : 'Temporary error — redirecting…');
          setTarget(onboardingHref(service));
        }
      }
    })();

    return () => { cancelled = true; };
    // isHe intentionally excluded — the effect runs once per user change,
    // not on every language flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  useEffect(() => {
    if (target) navigate(target);
  }, [target, navigate]);

  return (
    <div
      className="flex min-h-[50vh] items-center justify-center px-4"
      dir={isHe ? 'rtl' : 'ltr'}
      data-testid="become-provider-resume"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-gray-700">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">
          {error ??
            (isHe
              ? 'בודקים את מצב היישום שלך…'
              : 'Checking your application status…')}
        </span>
      </div>
    </div>
  );
}
