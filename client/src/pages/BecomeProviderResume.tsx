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
 * This is a REPLACEMENT for the older BecomeProviderRedirect in App.tsx
 * which always sent signed-in users to /provider-onboarding regardless
 * of their existing application state. Wire the /become-provider route
 * to render this component instead.
 */

import { useEffect, useState } from 'react';
import { useLocation, Redirect } from 'wouter';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { Loader2 } from 'lucide-react';

type ResumeTarget = string;

/** Provider type whitelist matches becomeProvider.ts. */
const PROVIDER_TYPE_WHITELIST = new Set([
  'walker', 'sitter', 'driver', 'trainer', 'station_operator', 'pet_trek',
]);

function readProviderTypeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('type');
  if (raw && PROVIDER_TYPE_WHITELIST.has(raw)) return raw;
  return null;
}

function onboardingHref(type: string | null): ResumeTarget {
  return type ? `/provider-onboarding?type=${encodeURIComponent(type)}` : '/provider-onboarding';
}

/**
 * Map a server application record to the correct destination path.
 * Kept side-effect-free + typed narrowly so future callers can reuse it.
 */
export function resumeTargetFromApplication(
  application: { status?: string | null; stage?: string | null } | null,
  providerType: string | null,
): ResumeTarget {
  if (!application) return onboardingHref(providerType);
  const status = (application.status || '').toString().toLowerCase();
  // Approved wins over stage — server may mark stage='approved' before
  // status is finalized, but "approved" as a status is the terminal grant.
  if (status === 'approved' || application.stage === 'approved') return '/provider/today';
  if (status === 'rejected' || application.stage === 'rejected') return '/provider/rejected';
  if (status === 'withdrawn') return onboardingHref(providerType);
  // Audit fix C5 (2026-08-24): the canonical /apply INSERT (server/routes/
  // provider-onboarding.ts) writes status='pending'. Missing this branch
  // meant every applicant who submitted through the canonical flow was
  // bounced back into the blank onboarding form when they re-opened
  // /become-provider — the exact "fail to register new providers" the CEO
  // reported. 'processing' and 'pending_resubmission' are also live
  // server states the pending page handles.
  if (
    status === 'pending' ||
    status === 'pending_review' ||
    status === 'under_review' ||
    status === 'processing' ||
    status === 'pending_resubmission'
  ) return '/provider/pending';
  // draft OR unrecognized status → resume the onboarding flow.
  return onboardingHref(providerType);
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
    const providerType = readProviderTypeFromUrl();

    // Anonymous user → sign in, then bounce back through this same route
    // so the resume decision runs against the newly-authenticated user.
    if (!user) {
      const back = `/become-provider${providerType ? `?type=${encodeURIComponent(providerType)}` : ''}`;
      setTarget(`/sign-in?redirect=${encodeURIComponent(back)}`);
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
          setTarget(onboardingHref(providerType));
          return;
        }
        if (!res.ok) {
          // Any other failure → send to onboarding rather than dead-end.
          // The onboarding page will re-read the application itself.
          setTarget(onboardingHref(providerType));
          return;
        }
        const data = await res.json().catch(() => null);
        setTarget(resumeTargetFromApplication(data, providerType));
      } catch {
        if (!cancelled) {
          setError(isHe ? 'שגיאה זמנית — מנווט להמשך יישום…' : 'Temporary error — redirecting…');
          setTarget(onboardingHref(providerType));
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
