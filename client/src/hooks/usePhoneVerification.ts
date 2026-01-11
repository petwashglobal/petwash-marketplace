import { useState, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { 
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential,
  updatePhoneNumber,
  PhoneAuthCredential
} from 'firebase/auth';
import { logger } from '@/lib/logger';

interface PhoneVerificationState {
  step: 'idle' | 'sending' | 'verifying' | 'success' | 'error';
  verificationId: string | null;
  error: string | null;
}

export function usePhoneVerification() {
  const [state, setState] = useState<PhoneVerificationState>({
    step: 'idle',
    verificationId: null,
    error: null,
  });
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  const initRecaptcha = useCallback((containerId: string = 'recaptcha-container-phone'): RecaptchaVerifier => {
    if (recaptchaVerifier) {
      return recaptchaVerifier;
    }

    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        logger.info('[PhoneVerification] reCAPTCHA solved');
      },
      'expired-callback': () => {
        logger.warn('[PhoneVerification] reCAPTCHA expired');
        setState(prev => ({ ...prev, error: 'reCAPTCHA expired, please try again' }));
      }
    });

    setRecaptchaVerifier(verifier);
    return verifier;
  }, [recaptchaVerifier]);

  const sendVerificationCode = useCallback(async (phoneNumber: string): Promise<string | null> => {
    if (!auth.currentUser) {
      setState({ step: 'error', verificationId: null, error: 'User must be signed in' });
      return null;
    }

    setState({ step: 'sending', verificationId: null, error: null });

    try {
      const verifier = initRecaptcha();
      const phoneProvider = new PhoneAuthProvider(auth);
      
      const verificationId = await phoneProvider.verifyPhoneNumber(phoneNumber, verifier);
      
      setState({ step: 'verifying', verificationId, error: null });
      logger.info('[PhoneVerification] Code sent to:', phoneNumber);
      
      return verificationId;
    } catch (error: any) {
      logger.error('[PhoneVerification] Failed to send code:', error);
      
      let errorMessage = 'Failed to send verification code';
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (error.code === 'auth/captcha-check-failed') {
        errorMessage = 'reCAPTCHA verification failed';
      }
      
      setState({ step: 'error', verificationId: null, error: errorMessage });
      return null;
    }
  }, [initRecaptcha]);

  const verifyCode = useCallback(async (code: string): Promise<boolean> => {
    if (!state.verificationId) {
      setState(prev => ({ ...prev, step: 'error', error: 'No verification in progress' }));
      return false;
    }

    if (!auth.currentUser) {
      setState(prev => ({ ...prev, step: 'error', error: 'User must be signed in' }));
      return false;
    }

    try {
      const credential = PhoneAuthProvider.credential(state.verificationId, code);
      
      await updatePhoneNumber(auth.currentUser, credential as PhoneAuthCredential);
      
      setState({ step: 'success', verificationId: null, error: null });
      logger.info('[PhoneVerification] Phone verified successfully');
      
      return true;
    } catch (error: any) {
      logger.error('[PhoneVerification] Verification failed:', error);
      
      let errorMessage = 'Verification failed';
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'Verification code expired';
      } else if (error.code === 'auth/credential-already-in-use') {
        errorMessage = 'This phone number is already linked to another account';
      }
      
      setState(prev => ({ ...prev, step: 'error', error: errorMessage }));
      return false;
    }
  }, [state.verificationId]);

  const reset = useCallback(() => {
    setState({ step: 'idle', verificationId: null, error: null });
  }, []);

  const cleanup = useCallback(() => {
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      setRecaptchaVerifier(null);
    }
    reset();
  }, [recaptchaVerifier, reset]);

  return {
    ...state,
    isSending: state.step === 'sending',
    isVerifying: state.step === 'verifying',
    isSuccess: state.step === 'success',
    sendVerificationCode,
    verifyCode,
    reset,
    cleanup,
    initRecaptcha,
  };
}
