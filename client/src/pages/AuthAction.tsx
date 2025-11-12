import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { auth } from '@/lib/firebase';
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

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
        case 'recoverEmail':
          setError('Email recovery is not yet configured.');
          setLoading(false);
          break;
        default:
          setError('Invalid action requested.');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-6xl mb-4">🐾</div>
          <CardTitle className="text-2xl font-bold">Pet Wash™</CardTitle>
          <CardDescription>
            {mode === 'resetPassword' && 'Reset Your Password'}
            {mode === 'verifyEmail' && 'Email Verification'}
            {mode === 'recoverEmail' && 'Email Recovery'}
            {!mode && 'Account Action'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
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
            <Alert className="bg-green-50 border-green-500 dark:bg-green-900/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {showPasswordForm && !loading && !success && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {email && (
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  Resetting password for: <strong>{email}</strong>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-confirm-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
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
        </CardContent>
      </Card>
    </div>
  );
}
