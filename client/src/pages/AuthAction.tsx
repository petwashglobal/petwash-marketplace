import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { auth } from '@/lib/firebase';
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
  signInWithEmailLink,
  isSignInWithEmailLink,
} from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { applyIntentFromUrl } from '@/lib/intentParam';
import { getApiUrl } from '@/lib/apiConfig';

export default function AuthAction() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<string | null>(null);
  const [actionCode, setActionCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  
  // For password reset
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    // PR-FRES-6: email-link return flows (verifyEmail, resetPassword,
    // signIn) carry the same ?intent= URL contract. Recover signup_intent
    // before any post-login routing fires so users who started as
    // ?intent=provider in their email link land on /provider-onboarding,
    // not /home as customers.
    applyIntentFromUrl();

    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    const codeParam = urlParams.get('oobCode');

    setMode(modeParam);
    setActionCode(codeParam);

    if (!codeParam) {
      setError('Missing action code. Please check your link.');
      setLoading(false);
      return;
    }

    handleAction(modeParam, codeParam);
  }, []);

  const handleAction = async (mode: string | null, code: string) => {
    setLoading(true);
    setError(null);

    try {
      switch (mode) {
        case 'resetPassword':
          await handlePasswordReset(code);
          break;
        case 'verifyEmail':
          await handleEmailVerification(code);
          break;
        case 'signIn':
          // PR-AUTH-FIX-AUTHACTION-4: Firebase email-link sign-in.
          // Missing pre-fix — clicking a magic-link email landed on
          // the generic default-case error below and dead-ended users.
          await handleEmailLinkSignIn();
          break;
        case 'recoverEmail':
          setError('Email recovery is not yet configured.');
          setLoading(false);
          break;
        default:
          // PR-AUTH-FIX-AUTHACTION-4: honest error — surface the actual
          // mode value + a hint about what to do. The pre-fix message
          // dead-ended users with no clue whether the link was tampered
          // with, expired, or a mode we don't yet handle.
          setError(
            mode
              ? `The link's action ("${mode}") is not handled by this page. Open the link on the device that requested it, or request a fresh one from PetWash.`
              : 'Missing action mode. Please open the link from your email exactly as it was received.'
          );
          setLoading(false);
          break;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handlePasswordReset = async (code: string) => {
    try {
      const userEmail = await verifyPasswordResetCode(auth, code);
      setEmail(userEmail);
      setShowPasswordForm(true);
      setLoading(false);
    } catch (err: any) {
      setError('Invalid or expired password reset link. Please request a new one.');
      setLoading(false);
    }
  };

  const handleEmailVerification = async (code: string) => {
    try {
      await applyActionCode(auth, code);
      setSuccess('Your email has been verified successfully! You can now sign in.');
      setLoading(false);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation('/login');
      }, 3000);
    } catch (err: any) {
      setError('Email verification failed. The link may be expired.');
      setLoading(false);
    }
  };

  /**
   * PR-AUTH-FIX-AUTHACTION-4 — handle Firebase email-link sign-in
   * (mode=signIn). Previously missing; the switch above defaulted
   * every magic-link click to a generic dead-end error message.
   * This handler:
   *   1. Verifies the current URL is a real Firebase email-link.
   *   2. Recovers the email the link was originally sent to (Firebase
   *      requires it for the sign-in call; localStorage is checked
   *      under both the PetWash sender key (@/auth/client.ts) and the
   *      Firebase default (`emailForSignIn`) to cover any sender).
   *   3. Calls signInWithEmailLink → mints Firebase auth state.
   *   4. Mints the pw_session cookie via POST /api/auth/session
   *      (SAME contract as PR-AUTH-FIX-PASSKEY-RACE-2 — Firebase custom
   *      credentials never set the cookie themselves; the client owns
   *      the mint).
   *   5. Routes to /home. The user effect in SignUpLuxury also handles
   *      routing on auth-state change, so a double-navigate is safe.
   */
  const handleEmailLinkSignIn = async () => {
    try {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setError('This link is not a valid email sign-in link. Please request a fresh one.');
        setLoading(false);
        return;
      }

      // Recover the email the link was sent to. Check both the PetWash
      // sender key and the Firebase default so any sender works.
      let storedEmail: string | null = null;
      try {
        storedEmail =
          window.localStorage.getItem('pw_admin_pending_email') ||
          window.localStorage.getItem('emailForSignIn');
      } catch {
        /* private mode / storage disabled → storedEmail stays null */
      }

      if (!storedEmail) {
        setError(
          'Please open this link on the device you requested it from — we need to confirm your email to complete sign-in.'
        );
        setLoading(false);
        return;
      }

      const cred = await signInWithEmailLink(auth, storedEmail, window.location.href);

      // Mint pw_session cookie (SAME contract as PR-AUTH-FIX-PASSKEY-RACE-2:
      // the server does not set the cookie for custom-token / email-link
      // sign-ins — the client must POST /api/auth/session { idToken }
      // so subsequent RequireAuth guards do not 401-bounce the user
      // back to /signin).
      try {
        const idToken = await cred.user.getIdToken(true);
        await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch (sessErr) {
        // Non-fatal — resolvePostLogin has a Bearer-carry fallback.
        console.warn('[AuthAction] session mint failed (non-fatal):', sessErr);
      }

      // Clear the stored email — it is single-use.
      try {
        window.localStorage.removeItem('pw_admin_pending_email');
        window.localStorage.removeItem('emailForSignIn');
      } catch { /* ignore */ }

      setSuccess('You are signed in. Redirecting…');
      setLoading(false);
      setTimeout(() => {
        setLocation('/home');
      }, 1500);
    } catch (err: any) {
      setError(
        err?.code === 'auth/invalid-action-code'
          ? 'This sign-in link is invalid or has already been used. Please request a fresh one.'
          : err?.message || 'Sign-in failed. Please request a fresh email link.'
      );
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!actionCode) {
      setError('Invalid action code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await confirmPasswordReset(auth, actionCode, newPassword);
      setSuccess('Your password has been reset successfully! Redirecting to login...');
      setShowPasswordForm(false);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen luxury-bg-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-md luxury-glass-card luxury-shadow-xl p-8 space-y-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-br from-[#B8932F] to-[#B8932F] rounded-3xl mx-auto flex items-center justify-center luxury-shadow-xl">
            <div className="text-4xl">🐾</div>
          </div>
          <h1 className="luxury-heading-xl">⁦PetWash™⁩</h1>
          <p className="text-gray-600">
            {mode === 'resetPassword' && 'Reset Your Password'}
            {mode === 'verifyEmail' && 'Email Verification'}
            {mode === 'signIn' && 'Sign In'}
            {mode === 'recoverEmail' && 'Email Recovery'}
            {(!mode ||
              (mode !== 'resetPassword' &&
                mode !== 'verifyEmail' &&
                mode !== 'signIn' &&
                mode !== 'recoverEmail')) &&
              'Account Action'}
          </p>
        </div>
        
        <div className="space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-12 h-12 animate-spin text-[#D4AF37] mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Processing...</p>
            </div>
          )}

          {error && !loading && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-500 dark:bg-white">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {showPasswordForm && !loading && !success && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {email && (
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-[#D4AF37] dark:bg-white p-3 rounded-lg">
                  Resetting password for: <strong>{email}</strong>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-gray-700 font-medium">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="luxury-glass-minimal"
                  data-testid="input-new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-gray-700 font-medium">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="luxury-glass-minimal"
                  data-testid="input-confirm-password"
                />
              </div>

              <Button
                type="submit"
                className="luxury-btn-primary luxury-shadow-xl w-full h-14 font-medium"
                disabled={loading}
                data-testid="button-reset-password"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          )}

          {!loading && !showPasswordForm && !success && !error && (
            <div className="text-center py-8">
              <Button
                variant="outline"
                onClick={() => setLocation('/login')}
                data-testid="button-go-to-login"
              >
                Go to Login
              </Button>
            </div>
          )}

          {(success || error) && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => setLocation('/login')}
                className="mt-4"
                data-testid="button-back-to-login"
              >
                Back to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
