/**
 * SignedInRoot — what a SIGNED-IN visitor gets at "/" and "/home" on the web.
 *
 * CEO 2026-09-19 ("why is the Pet Passport not in my dashboard?"): on the web
 * a signed-in member who tapped the Home tab, or opened petwash.co.il, landed
 * on the marketing Landing page — a page with no navigation at all. Their real
 * home (/pet-parent/home, with the Pet Passport tile, wallet, bookings) was
 * reachable only through Account → workspace switcher. The native app never
 * had this problem: it redirects "/" to the Pet Parent home during render.
 *
 * This asks the same decider the sign-in flow uses — POST /api/auth/post-login,
 * via the single-flight, 30-second-cached resolvePostLogin() — and goes where
 * it says: /pet-parent/home for a member, /provider-os for a provider,
 * /admin/dashboard for staff, /mode for a multi-role account, and the gating
 * screens (/verify-email, /complete-profile, /provider/pending…) when the
 * server says the account is not ready. One rule for "where is my home",
 * owned by the server, not a second copy of it in the client.
 *
 * Fail-safe: if the decider is unreachable, answers 401, or names "/" or
 * "/home" (which would loop), the visitor sees exactly what they saw before —
 * the Landing page. Never a blank screen, never a redirect loop.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useLocation } from 'wouter';
import { auth } from '@/lib/firebase';
import { resolvePostLogin } from '@/lib/postLoginCoordinator';
import { decideSignedInRoot } from '@/lib/signedInRoot';

export default function SignedInRoot({
  fallback,
  loader,
}: {
  /** What to render if the decider cannot answer — the pre-2026-09-19 behaviour. */
  fallback: ReactElement;
  /** What to render while the decider is answering (typically <PageLoader />). */
  loader: ReactElement;
}) {
  const [, navigate] = useLocation();
  const [resolved, setResolved] = useState<'pending' | 'fallback'>('pending');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let idToken: string | undefined;
        try {
          idToken = await auth.currentUser?.getIdToken();
        } catch {
          // No token — the session cookie may still carry the request.
        }
        const result = await resolvePostLogin({ idToken });
        if (!alive) return;
        const target = decideSignedInRoot(result);
        if (target) {
          navigate(target, { replace: true });
          return;
        }
      } catch {
        // Network / coordinator error — fall through to the fallback.
      }
      if (alive) setResolved('fallback');
    })();
    return () => {
      alive = false;
    };
    // Runs once per mount: the coordinator de-duplicates and caches, so a
    // re-render never re-fires the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return resolved === 'pending' ? loader : fallback;
}
