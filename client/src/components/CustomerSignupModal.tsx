import { useEffect } from 'react';
import { useLocation } from 'wouter';

interface CustomerSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Legacy registration modal replaced with redirect to canonical /signup flow.
 * The old implementation called /api/customer/register (a non-Firebase, legacy endpoint)
 * which created rows in the customers table without Firebase auth.
 * All registration must go through: Firebase Auth → /api/users/create-profile → /api/auth/session.
 */
export function CustomerSignupModal({ isOpen, onClose }: CustomerSignupModalProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isOpen) {
      onClose();
      setLocation('/signup');
    }
  }, [isOpen, onClose, setLocation]);

  return null;
}
