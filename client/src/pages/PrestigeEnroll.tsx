/**
 * PrestigeEnroll — authenticated Prestige enrollment (P0 LIVE FIX 2026-08-29).
 *
 * The previous flow routed the "Join PetWash Prestige" CTA to
 * /loyalty/join, which unconditionally redirected to /signup?flow=prestige
 * — bouncing an already-signed-in Pet Parent through the signup shell,
 * where the post-login resolver sent them back to the same home. The
 * user experienced this as a loop that never actually enrolled them.
 *
 * CEO rules for this surface:
 *   • Signed-in Pet Parent joining Prestige is an ENTITLEMENT UPGRADE,
 *     not a registration. Never send them to /signup, /signin, /login.
 *   • Reuse canonical account data (name, email, phone) — do not ask
 *     the user to type any field the server already knows.
 *   • Server derives identity from the Firebase Bearer session. The
 *     enrollment POST does NOT carry a UID in the body as an identity
 *     claim.
 *   • If the user is already Prestige, this surface must NOT render a
 *     Join button. Send them directly to the Prestige member surface.
 *   • Pet-profile completeness (Bruno needs a photo, etc.) is a SEPARATE
 *     concern — it must not block Prestige enrollment.
 *
 * Endpoint: POST /api/prestige/join
 *   Body: { firstName, lastName, email, phone, tier?, language }
 *   Auth: Firebase Bearer (server reads firebaseUser.uid — CEO §7).
 */
import { useEffect, useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, Check, Loader2 } from 'lucide-react';
import { useWhoami } from '@/auth/useWhoami';
import { apiRequest } from '@/lib/queryClient';

const GOLD = '#D4AF37';

interface Whoami {
  uid?: string;
  email?: string;
  phone?: string | null;
  displayName?: string;
  prestigeStatus?: 'none' | 'active';
  language?: string | null;
}

function splitDisplayName(name: string | undefined): { firstName: string; lastName: string } {
  const trimmed = (name || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
}

export default function PrestigeEnroll() {
  const [, navigate] = useLocation();
  const { whoami, isLoading, refetch } = useWhoami();
  const queryClient = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already-Prestige: never render the Join button on this surface —
  // send them straight to the member home (CEO §14).
  if (whoami && (whoami as Whoami).prestigeStatus === 'active') {
    return <Redirect to="/prestige-club" />;
  }

  const w = (whoami || {}) as Whoami;
  const { firstName, lastName } = splitDisplayName(w.displayName);
  const email = w.email || '';
  const phone = w.phone || '';
  const canSubmit = consent && !!firstName && !!lastName && !!email && !!phone;

  const join = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        firstName,
        lastName,
        email,
        phone,
        tier: 'pearl',
        language: w.language === 'en' ? 'en' : 'he',
      };
      const res = await apiRequest('POST', '/api/prestige/join', body);
      const data = await res.json();
      if (!data?.ok) {
        throw new Error(data?.error || 'Enrollment failed');
      }
      return data;
    },
    onSuccess: async () => {
      // Server capability + whoami are the sources of truth for the
      // "user is Prestige now" state — refresh before we navigate so
      // Pet Parent home no longer shows Join Prestige.
      await queryClient.invalidateQueries({ queryKey: ['/api/session/whoami'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/me/capabilities'] });
      await refetch();
      // Return to canonical customer home (CEO §2 / §9). Deep-link
      // survivors (?redirect=/foo) are honored, but only if same-origin.
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      const safeRedirect = redirect && redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : '/pet-parent/home';
      navigate(safeRedirect);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Enrollment failed';
      setError(msg);
    },
  });

  useEffect(() => {
    // Best-effort observability marker (CEO §16). No PII in payload.
    try {
      window.dispatchEvent(new CustomEvent('petwash:analytics', {
        detail: { event: 'PRESTIGE_ENROLLMENT_OPENED' },
      }));
    } catch { /* non-fatal */ }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="prestige-enroll-root">
      <div className="max-w-md mx-auto px-4 pt-8 pb-24">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-7 h-7" style={{ color: GOLD }} />
          <h1 className="text-2xl font-semibold text-gray-900">Join PetWash Prestige</h1>
        </div>

        <p className="text-sm text-gray-600 mb-6" data-testid="prestige-enroll-account-notice">
          You&rsquo;re already a PetWash member. We&rsquo;ll use your existing account details
          &mdash; no need to sign up again.
        </p>

        <section
          className="rounded-2xl border border-gray-200 bg-gray-50 p-4 mb-6"
          data-testid="prestige-enroll-account-summary"
        >
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="col-span-1 text-gray-500">Name</dt>
            <dd className="col-span-2 text-gray-900 font-medium" data-testid="prestige-enroll-name">
              {firstName || '—'} {lastName || ''}
            </dd>
            <dt className="col-span-1 text-gray-500">Email</dt>
            <dd className="col-span-2 text-gray-900 font-medium" data-testid="prestige-enroll-email">
              {email || '—'}
            </dd>
            <dt className="col-span-1 text-gray-500">Mobile</dt>
            <dd className="col-span-2 text-gray-900 font-medium" data-testid="prestige-enroll-phone">
              {phone || '—'}
            </dd>
          </dl>
        </section>

        <section className="rounded-2xl border border-[#ECDFB4] bg-[#FFFDF7] p-4 mb-6">
          <h2 className="text-base font-semibold text-[#9a7d2e] mb-2">Prestige benefits</h2>
          <ul className="space-y-1 text-sm text-gray-700">
            <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5" style={{ color: GOLD }} />100 welcome points</li>
            <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5" style={{ color: GOLD }} />Free wash on your first visit</li>
            <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5" style={{ color: GOLD }} />Prestige tier progression</li>
            <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5" style={{ color: GOLD }} />Prestige digital pass</li>
          </ul>
        </section>

        <label className="flex items-start gap-3 mb-6 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
            data-testid="prestige-enroll-consent"
          />
          <span>
            I agree to the PetWash Prestige membership terms and privacy policy.
          </span>
        </label>

        {error && (
          <div
            className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700"
            data-testid="prestige-enroll-error"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit || join.isPending}
          onClick={() => {
            setError(null);
            try {
              window.dispatchEvent(new CustomEvent('petwash:analytics', {
                detail: { event: 'PRESTIGE_ENROLLMENT_SUBMITTED' },
              }));
            } catch { /* non-fatal */ }
            join.mutate();
          }}
          className="w-full rounded-full py-3 font-medium text-white transition disabled:opacity-50"
          style={{ background: canSubmit ? '#0c6b48' : '#9ca3af' }}
          data-testid="prestige-enroll-submit"
        >
          {join.isPending ? 'Joining…' : 'Join Prestige'}
        </button>

        <p className="mt-4 text-xs text-gray-400 text-center">
          Same account. Same profile. Prestige added on top.
        </p>
      </div>
    </div>
  );
}
