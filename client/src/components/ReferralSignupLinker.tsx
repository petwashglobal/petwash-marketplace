import { useEffect, useRef } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { apiRequest } from '@/lib/queryClient';
import { clearReferralCode, readReferralCode } from '@/lib/referralCapture';

/**
 * Once a user is signed in, attach a captured referral code exactly once
 * (POST /api/referral/link-signup, Bearer-authenticated). Any server answer —
 * linked, unknown code, already linked, self-referral — clears the code so we
 * never retry forever; only a network failure keeps it for the next session.
 */
export function ReferralSignupLinker() {
  const { user } = useFirebaseAuth();
  const attempted = useRef(false);

  useEffect(() => {
    if (!user || attempted.current) return;
    const code = readReferralCode();
    if (!code) return;
    attempted.current = true;
    apiRequest('POST', '/api/referral/link-signup', { referralCode: code })
      .then(() => clearReferralCode())
      .catch((err: any) => {
        // apiRequest throws ApiError{status} on a server answer (final: clear);
        // a network failure has no status and keeps the code for next session.
        if (typeof err?.status === 'number') clearReferralCode();
      });
  }, [user]);

  return null;
}
