// SMOKING GUN FIX 2026-08-21: this hook used to poll `/api/auth/user`, which
// is only registered by the legacy `setupCustomAuth()` block in
// server/customAuth.ts — and that block is NEVER called on boot. So every
// page consuming `useAuth()` (14+ files: ProviderBrowseGrid, ProviderProfilePage,
// AppleWalletButton, ClaimVoucher, Hub, AdminVouchers, MarketplaceReviewPage,
// TeamInbox, walk-my-pet/OwnerDashboard, …) got `{ user: undefined,
// isAuthenticated: false }` FOREVER — even after a successful Firebase login
// — because the endpoint 404s and TanStack Query kept `user` undefined. From
// the user's chair: "I signed in but the browse page / wallet / hub keeps
// showing me signed out." That's the CEO's "hiding something old" symptom.
//
// The correct source of truth is `useFirebaseAuth` from AuthProvider — the
// single Firebase Auth singleton the whole app already builds around. Same
// `user` field name so no downstream page needs to change.
import { useFirebaseAuth } from '@/auth/AuthProvider';

export function useAuth() {
  const { user, loading } = useFirebaseAuth();
  return {
    user,
    isLoading: loading,
    isAuthenticated: !!user,
  };
}
