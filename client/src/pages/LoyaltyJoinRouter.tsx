/**
 * LoyaltyJoinRouter — routes /loyalty/join, /privilege, /vito to the
 * correct destination based on the CALLER'S AUTH STATE.
 *
 * CEO P0 LIVE FIX 2026-08-29:
 *   Before this router, all three paths unconditionally redirected an
 *   already-signed-in Pet Parent to `/signup?flow=prestige`, and the
 *   post-login resolver then sent them back to `/pet-parent/home`.
 *   The user experienced a loop and never actually enrolled.
 *
 * Contract:
 *   • authenticated + already Prestige → /prestige-club (member surface)
 *   • authenticated + NOT Prestige     → /prestige/enroll (in-app upgrade)
 *   • signed out                       → /signup?flow=prestige&redirect=/prestige/enroll
 *   • auth still loading               → spinner (never route through signup by accident)
 *
 * "Join Prestige" is an entitlement upgrade for an existing PetWash
 * user, NOT a second registration. Never send an authenticated user
 * through /signup / /signin / /login for this journey.
 */
import { Redirect } from 'wouter';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useWhoami } from '@/auth/useWhoami';

export default function LoyaltyJoinRouter() {
  const { user, loading: authLoading } = useFirebaseAuth();
  const { whoami, isLoading: whoamiLoading } = useWhoami();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Signed-out person: preserve the intent so /signup can return them
    // to /prestige/enroll after they finish authentication (CEO §13).
    const search = window.location.search
      ? `&${window.location.search.slice(1)}`
      : '';
    return (
      <Redirect
        to={`/signup?flow=prestige&redirect=${encodeURIComponent('/prestige/enroll')}${search}`}
      />
    );
  }

  // Authenticated. Wait for whoami so we don't send an already-Prestige
  // user to the enrollment form.
  if (whoamiLoading || !whoami) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (whoami.prestigeStatus === 'active') {
    return <Redirect to="/prestige-club" />;
  }

  return <Redirect to="/prestige/enroll" />;
}
