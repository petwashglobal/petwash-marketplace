/**
 * Pet Wash™ — App-Flavor Terms Gate
 *
 * Lightweight, FAIL-OPEN consent gate that runs ONLY inside the matching native
 * Capacitor app flavor (customer vs provider). It ensures a signed-in user has
 * accepted the terms document required for that app before the destination
 * dashboard renders:
 *   • Customer app (com.petwash.il)        → "terms"          (Customer Terms)
 *   • Provider app (il.co.petwash.provider) → "provider_terms" (Provider Agreement)
 *
 * Design rules (HARD):
 *   - WEB IS UNCHANGED. On web (no Capacitor) the gate is a pass-through.
 *   - FLAVOR-SCOPED. The customer gate never fires in the provider app and
 *     vice-versa — if the running flavor doesn't match `flavor`, render children.
 *   - FAIL-OPEN. Any error, timeout, missing doc, or unauthenticated state →
 *     render children. We NEVER lock an existing user out of their dashboard.
 *
 * It reuses the existing consent backend:
 *   GET  /api/consent/status  → { ok, allGiven, missing: string[] }
 *   POST /api/consent/accept  → records consent (auto-creates a snapshot fallback
 *                                server-side, so it works even if the doc isn't seeded)
 */

import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '@/lib/apiConfig';
import { getAppFlavor } from '@/lib/app-flavor';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import type { Language } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ArrowRight, ArrowLeft, ExternalLink } from 'lucide-react';

type AppFlavor = 'customer' | 'provider';

// The consent document each app is responsible for. Matches the server-side
// ROLE_CONSENTS map (server/services/consentEngine.ts): customers require
// "terms" + "privacy"; providers additionally require "provider_terms".
const FLAVOR_DOC: Record<AppFlavor, string> = {
  customer: 'terms',
  provider: 'provider_terms',
};

const CONSENT_VERSION = 'v1.0';

interface GateCopy {
  title: string;
  body: string;
  accept: string;
  view: string;
  busy: string;
}

const COPY: Record<AppFlavor, Record<'he' | 'en', GateCopy>> = {
  customer: {
    he: {
      title: 'תנאי השימוש של Pet Wash™',
      body: 'כדי להמשיך אל החשבון שלך, יש לאשר את תנאי השימוש ומדיניות הפרטיות של Pet Wash™.',
      accept: 'אני מאשר/ת וממשיך/ה',
      view: 'צפייה בתנאים המלאים',
      busy: 'מאשר…',
    },
    en: {
      title: 'Pet Wash™ Terms of Service',
      body: 'To continue to your account, please accept the Pet Wash™ Terms of Service and Privacy Policy.',
      accept: 'I agree & continue',
      view: 'View full terms',
      busy: 'Accepting…',
    },
  },
  provider: {
    he: {
      title: 'הסכם נותני השירות של Pet Wash™',
      body: 'כדי להמשיך אל מערכת נותני השירות, יש לאשר את הסכם נותני השירות של Pet Wash™.',
      accept: 'אני מאשר/ת את ההסכם',
      view: 'צפייה בהסכם המלא',
      busy: 'מאשר…',
    },
    en: {
      title: 'Pet Wash™ Provider Agreement',
      body: 'To continue to Provider OS, please accept the Pet Wash™ Provider Agreement.',
      accept: 'I accept the agreement',
      view: 'View full agreement',
      busy: 'Accepting…',
    },
  },
};

type GateState = 'checking' | 'needs_accept' | 'pass';

/**
 * Resolve the running native app flavor exactly once. Returns 'web' when there
 * is no Capacitor runtime (browser) — the gate is then a pass-through.
 *
 * Delegates to the single source of truth in client/src/lib/app-flavor.ts so the
 * bundle-id → flavor mapping lives in exactly one place (SDD §3.2).
 */
async function detectFlavor(): Promise<AppFlavor | 'web'> {
  return getAppFlavor();
}

export default function AppTermsGate({
  flavor,
  language,
  children,
}: {
  flavor: AppFlavor;
  language: Language;
  children: JSX.Element;
}) {
  const { user, loading } = useFirebaseAuth();
  const [state, setState] = useState<GateState>('checking');
  const [submitting, setSubmitting] = useState(false);
  const ranRef = useRef(false);

  const lang: 'he' | 'en' = language === 'he' ? 'he' : 'en';
  const copy = COPY[flavor][lang];
  const doc = FLAVOR_DOC[flavor];

  useEffect(() => {
    // Wait until auth has resolved. We never gate a signed-out user — RequireAuth
    // / RoleProtectedRoute already handle that; here we simply pass through.
    if (loading) return;
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

    (async () => {
      // Pass-through if signed out (let the auth wrapper redirect).
      if (!user) {
        if (!cancelled) setState('pass');
        return;
      }

      // Pass-through on web or in the OTHER app flavor — flavor-scoped only.
      const running = await detectFlavor();
      if (running === 'web' || running !== flavor) {
        if (!cancelled) setState('pass');
        return;
      }

      // FAIL-OPEN consent status check (5s budget; any failure → pass).
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(getApiUrl('/api/consent/status'), {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          if (!cancelled) setState('pass'); // fail-open
          return;
        }

        const data = await res.json().catch(() => null);
        const missing: string[] = Array.isArray(data?.missing) ? data.missing : [];
        // Only gate on THIS app's own doc. If anything is off, fail open.
        if (data?.ok && missing.includes(doc)) {
          if (!cancelled) setState('needs_accept');
        } else {
          if (!cancelled) setState('pass');
        }
      } catch {
        if (!cancelled) setState('pass'); // fail-open on network/timeout error
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, flavor, doc]);

  const handleAccept = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      // The single "I Accept" covers the full legal set (the Terms document AND
      // the Privacy Policy). Record consent evidence for BOTH — previously only
      // the flavor's terms doc was recorded, so there was no stored proof the
      // user accepted the privacy policy. Additive: it does not change what the
      // gate REQUIRES, so no existing user is re-blocked.
      const acceptDocs = Array.from(new Set([doc, 'privacy']));
      await Promise.all(
        acceptDocs.map((d) =>
          fetch(getApiUrl('/api/consent/accept'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              consentType: d,
              version: CONSENT_VERSION,
              locale: lang,
              method: 'in_app',
            }),
          }).catch(() => {
            /* fail-open: proceed even if a record didn't persist */
          }),
        ),
      );
      clearTimeout(timer);
    } finally {
      // Always proceed — never trap the user on the gate.
      setState('pass');
      setSubmitting(false);
    }
  };

  // While the check is in flight we render a tiny spinner so the gate is
  // invisible for the common (already-accepted) case.
  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(212,175,55,0.25)', borderTopColor: '#D4AF37' }}
        />
      </div>
    );
  }

  if (state === 'pass') return children;

  // needs_accept — lightweight luxury terms card (white / black / gold).
  const Arrow = lang === 'he' ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      className="min-h-screen flex items-center justify-center bg-white px-5 py-10"
    >
      <div className="w-full max-w-md">
        <div
          className="rounded-3xl bg-white p-8 text-center"
          style={{
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 20px 60px -20px rgba(0,0,0,0.18)',
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#D4AF37,#b8932f)' }}
          >
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-2xl font-semibold text-black mb-3">{copy.title}</h1>
          <p className="text-base text-gray-600 leading-relaxed mb-8">{copy.body}</p>

          <Button
            onClick={handleAccept}
            disabled={submitting}
            className="w-full h-14 text-lg font-medium text-black border-0"
            style={{ background: 'linear-gradient(135deg,#D4AF37,#c9a430)' }}
            data-testid="button-accept-app-terms"
          >
            {submitting ? (
              copy.busy
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                {copy.accept}
                <Arrow className="w-5 h-5" />
              </span>
            )}
          </Button>

          <a
            href="/legal/terms"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-black transition-colors"
            data-testid="link-view-app-terms"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {copy.view}
          </a>
        </div>
      </div>
    </div>
  );
}
