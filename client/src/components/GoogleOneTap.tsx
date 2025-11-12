import { useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { useLocation } from 'wouter';

interface GoogleOneTapProps {
  enabled?: boolean;
  autoPrompt?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Google One Tap Sign-In Component
 * Shows the modern "One Tap" UI for seamless Google authentication
 */
export function GoogleOneTap({ 
  enabled = true, 
  autoPrompt = true,
  onSuccess,
  onError 
}: GoogleOneTapProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const scriptLoaded = useRef(false);
  const oneTapInitialized = useRef(false);

  // Get Google Client ID from environment
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!enabled || !GOOGLE_CLIENT_ID) {
      if (!GOOGLE_CLIENT_ID) {
        logger.info('[Google One Tap] VITE_GOOGLE_CLIENT_ID not configured - One Tap disabled');
      }
      return;
    }

    // Load Google Identity Services script
    if (!scriptLoaded.current) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        scriptLoaded.current = true;
        initializeOneTap();
      };
      document.head.appendChild(script);
    } else if (!oneTapInitialized.current) {
      initializeOneTap();
    }

    return () => {
      // Cancel One Tap prompt on unmount
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [enabled, GOOGLE_CLIENT_ID]);

  const initializeOneTap = () => {
    if (!window.google?.accounts?.id || oneTapInitialized.current) {
      return;
    }

    try {
      // Initialize Google One Tap
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID!,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
        ux_mode: 'popup',
      });

      // Show One Tap prompt
      if (autoPrompt) {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed()) {
            logger.info('[Google One Tap] Prompt not displayed:', notification.getNotDisplayedReason());
          } else if (notification.isSkippedMoment()) {
            logger.info('[Google One Tap] User skipped prompt:', notification.getSkippedReason());
          } else if (notification.isDismissedMoment()) {
            logger.info('[Google One Tap] User dismissed prompt:', notification.getDismissedReason());
          }
        });
      }

      oneTapInitialized.current = true;
      logger.info('[Google One Tap] Initialized successfully');
    } catch (error) {
      logger.error('[Google One Tap] Initialization failed:', error);
    }
  };

  const handleGoogleCredential = async (response: any) => {
    try {
      logger.info('[Google One Tap] Credential received');
      
      const idToken = response.credential;
      
      // Create Firebase credential using Google ID token
      const googleCredential = GoogleAuthProvider.credential(idToken);

      // Sign in to Firebase
      const userCredential = await signInWithCredential(auth, googleCredential);

      logger.info('[Google One Tap] Sign-in successful:', userCredential.user.email);

      // Create session cookie
      const firebaseIdToken = await userCredential.user.getIdToken();
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken: firebaseIdToken }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create session');
      }

      toast({
        title: '🎉 Welcome!',
        description: `Signed in successfully with Google`,
      });

      // Track analytics
      const { trackLogin } = await import('@/lib/analytics');
      trackLogin('google_one_tap', userCredential.user.uid);

      if (onSuccess) {
        onSuccess();
      } else {
        // Redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 500);
      }
    } catch (error: any) {
      logger.error('[Google One Tap] Sign-in failed:', error);
      
      toast({
        variant: 'destructive',
        title: 'Sign-in failed',
        description: error.message || 'Failed to sign in with Google',
      });

      if (onError) {
        onError(error);
      }
    }
  };

  // Render One Tap button (optional, for manual trigger)
  const renderButton = () => {
    if (!GOOGLE_CLIENT_ID || !scriptLoaded.current) {
      return null;
    }

    return (
      <div
        id="g_id_signin"
        className="g_id_signin"
        data-type="standard"
        data-size="large"
        data-theme="outline"
        data-text="signin_with"
        data-shape="rectangular"
        data-logo_alignment="left"
      />
    );
  };

  // One Tap is invisible by default, so we don't render anything
  // The prompt appears automatically if autoPrompt is true
  return null;
}

// TypeScript declarations for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          cancel: () => void;
          renderButton: (parent: HTMLElement, options: any) => void;
        };
      };
    };
  }
}
