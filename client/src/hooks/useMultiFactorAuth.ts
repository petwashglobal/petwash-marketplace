import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { 
  multiFactor, 
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  type MultiFactorResolver,
  type MultiFactorInfo,
  type MultiFactorSession
} from 'firebase/auth';
import { logger } from '@/lib/logger';

interface EnrollMFAParams {
  phoneNumber: string;
  displayName?: string;
}

interface VerifyMFAParams {
  verificationId: string;
  verificationCode: string;
}

/**
 * React hook for Multi-Factor Authentication (MFA)
 * Supports SMS-based second factor authentication
 */
export function useMultiFactorAuth() {
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  /**
   * Initialize reCAPTCHA verifier for phone verification
   */
  const initRecaptcha = (containerId: string = 'recaptcha-container-mfa'): RecaptchaVerifier => {
    if (recaptchaVerifier) {
      return recaptchaVerifier;
    }

    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        logger.info('[MFA] reCAPTCHA solved');
      },
      'expired-callback': () => {
        logger.warn('[MFA] reCAPTCHA expired');
      }
    });

    setRecaptchaVerifier(verifier);
    return verifier;
  };

  /**
   * Step 1: Send SMS verification code to enroll MFA
   */
  const sendEnrollmentCode = async ({ phoneNumber, displayName }: EnrollMFAParams): Promise<string> => {
    if (!auth.currentUser) {
      throw new Error('User must be signed in to enroll MFA');
    }

    setEnrolling(true);

    try {
      // Get multi-factor session
      const session = await multiFactor(auth.currentUser).getSession();

      // Initialize phone auth provider
      const phoneAuthProvider = new PhoneAuthProvider(auth);

      // Initialize reCAPTCHA
      const verifier = initRecaptcha();

      // Send verification code
      const verId = await phoneAuthProvider.verifyPhoneNumber(
        {
          phoneNumber,
          session: session as MultiFactorSession
        },
        verifier
      );

      setVerificationId(verId);
      logger.info('[MFA] Enrollment code sent to:', phoneNumber);

      return verId;
    } catch (error: any) {
      logger.error('[MFA] Failed to send enrollment code:', error);
      throw error;
    } finally {
      setEnrolling(false);
    }
  };

  /**
   * Step 2: Complete MFA enrollment with verification code
   */
  const completeEnrollment = async ({ verificationId: verId, verificationCode }: VerifyMFAParams): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('User must be signed in to enroll MFA');
    }

    setEnrolling(true);

    try {
      const vid = verId || verificationId;
      if (!vid) {
        throw new Error('Verification ID is required');
      }

      // Create phone credential
      const phoneCredential = PhoneAuthProvider.credential(vid, verificationCode);

      // Create multi-factor assertion
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(phoneCredential);

      // Finalize enrollment
      await multiFactor(auth.currentUser).enroll(multiFactorAssertion, 'Phone Number');

      logger.info('[MFA] Enrollment completed successfully');
      setVerificationId(null);
    } catch (error: any) {
      logger.error('[MFA] Failed to complete enrollment:', error);
      throw error;
    } finally {
      setEnrolling(false);
    }
  };

  /**
   * Verify MFA during sign-in (when MFA is required)
   */
  const verifyMFA = async (
    resolver: MultiFactorResolver,
    verificationCode: string
  ): Promise<void> => {
    setVerifying(true);

    try {
      // Get selected hint (first phone factor)
      const phoneInfoOptions = resolver.hints.find(
        hint => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID
      );

      if (!phoneInfoOptions) {
        throw new Error('No phone MFA factor found');
      }

      // Initialize phone auth provider
      const phoneAuthProvider = new PhoneAuthProvider(auth);

      // Initialize reCAPTCHA
      const verifier = initRecaptcha();

      // Send verification code
      const verId = await phoneAuthProvider.verifyPhoneNumber(
        {
          multiFactorHint: phoneInfoOptions,
          session: resolver.session
        },
        verifier
      );

      // Create credential
      const phoneCredential = PhoneAuthProvider.credential(verId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(phoneCredential);

      // Complete sign-in
      await resolver.resolveSignIn(multiFactorAssertion);

      logger.info('[MFA] Verification completed successfully');
    } catch (error: any) {
      logger.error('[MFA] Verification failed:', error);
      throw error;
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Get enrolled MFA factors for current user
   */
  const getEnrolledFactors = (): MultiFactorInfo[] => {
    if (!auth.currentUser) {
      return [];
    }

    return multiFactor(auth.currentUser).enrolledFactors;
  };

  /**
   * Unenroll (remove) a specific MFA factor
   */
  const unenrollFactor = async (factorUid: string): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('User must be signed in to unenroll MFA');
    }

    try {
      const factors = multiFactor(auth.currentUser).enrolledFactors;
      const factor = factors.find(f => f.uid === factorUid);

      if (!factor) {
        throw new Error('Factor not found');
      }

      await multiFactor(auth.currentUser).unenroll(factor);
      logger.info('[MFA] Factor unenrolled successfully:', factorUid);
    } catch (error: any) {
      logger.error('[MFA] Failed to unenroll factor:', error);
      throw error;
    }
  };

  /**
   * Clean up reCAPTCHA verifier
   */
  const cleanup = () => {
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      setRecaptchaVerifier(null);
    }
  };

  return {
    // State
    enrolling,
    verifying,
    verificationId,

    // Enrollment
    sendEnrollmentCode,
    completeEnrollment,

    // Verification (sign-in)
    verifyMFA,

    // Management
    getEnrolledFactors,
    unenrollFactor,

    // Utilities
    initRecaptcha,
    cleanup,
  };
}
