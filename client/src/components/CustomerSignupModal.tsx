import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * @deprecated — This shim is no longer imported anywhere.
 *
 * Legacy registration modal replaced with a redirect to the canonical /signup flow.
 * The old implementation called /api/customer/register (a non-Firebase, legacy endpoint)
 * which created rows in the customers table without Firebase auth.
 * All registration must go through: Firebase Auth → /api/auth/session → /api/users/create-profile.
 *
 * Props retained for backwards-compat in case a stale import surfaces during a merge.
 */
export function CustomerSignupModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isOpen) {
      onClose();
      setLocation('/signup');
    }
  }, [isOpen, onClose, setLocation]);

  return null;
}
