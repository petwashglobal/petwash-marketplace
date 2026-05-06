import { useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { getApiUrl } from '@/lib/apiConfig';
import { useLocation } from 'wouter';

interface GoogleOneTapProps {
  enabled?: boolean;
  autoPrompt?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

function adminEmailMatch(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

function getSignupIntent(): string | undefined {
  try {
    return localStorage.getItem('signup_intent') || undefined;
  } catch {
    return undefined;
  }
}

function clearConsumedSignupIntent(): void {
  try {
    localStorage.removeItem('signup_intent');
  } catch {
    // ignore
  }
}

/**
 * Google One Tap Sign-In Component
 * Shows the modern "One Tap" UI for seamless Google authentication.
 *
 * Important: One Tap is a third Google login path. It must follow the same
 * routing contract as normal Google sign-in:
 *   - create session with credentials included
 *   - attach Bearer token to post-login so iOS/Safari cookie loss does not break routing
 *   - pass signup_intent when present so provider/loyalty flows do not become normal customer flows
 *   - use admin email fast-path so allowlisted internal users do not get trapped at /home
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
      const sessionResponse = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        credentials: 'include',
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
        // Allowlisted admin emails must not wait for server role sync. If the
        // server post-login decider still sees a new/customer DB row, it can
        // return /home. Client fast-path keeps admin access usable after OAuth.
        if (adminEmailMatch(userCredential.user.email)) {
          clearConsumedSignupIntent();
          navigate('/admin/dashboard');
          return;
        }

        // Use post-login decider so providers go to provider flow, staff to admin, etc.
        // Attach both session cookie and Bearer token. Also pass signup_intent so
        // provider/loyalty One Tap signup does not collapse into a normal customer path.
        setTimeout(async () => {
          try {
            const intent = getSignupIntent();
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${firebaseIdToken}`,
            };
            const res = await fetch(getApiUrl('/api/auth/post-login'), {
              method: 'POST',
              credentials: 'include',
              headers,
              body: JSON.stringify(intent ? { intent } : {}),
            });
            const data = await res.json().catch(() => null);
            const nextUrl = data?.nextUrl || data?.redirectTo || '/home';
            clearConsumedSignupIntent();
            navigate(nextUrl);
          } catch {
            navigate('/home');
          }
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
