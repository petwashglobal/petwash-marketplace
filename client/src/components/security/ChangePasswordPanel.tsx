/**
 * PR-AUTH-SECURITY-9 §5 — Change password panel.
 *
 * Firebase-primitive flow, no server round-trip except for the session mint:
 *   1. User signs in via reauthenticateWithCredential (STRONG re-auth).
 *   2. updatePassword(newPassword).
 *   3. Refresh the id token so the /api/session/whoami claims are current.
 *
 * If the user is a Google / Apple / mobile account with NO password provider,
 * the same panel switches to `linkWithCredential(EmailAuthProvider.credential(...))`
 * to ADD a password to the same canonical identity. No duplicate account is
 * ever created — the passwordless credential stays intact.
 *
 * Password is NEVER stored in localStorage / sessionStorage / cookies / logs.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auth as firebaseAuth } from '@/lib/firebase';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  linkWithCredential,
} from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Lock } from 'lucide-react';

type Props = {
  language: string;
  /** From /api/security/status; drives the "Add password" vs "Change password" mode. */
  hasPassword: boolean;
};

export function ChangePasswordPanel({ language, hasPassword }: Props) {
  const he = language === 'he';
  const { toast } = useToast();
  const qc = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const mode: 'change' | 'add' = hasPassword ? 'change' : 'add';

  const mutation = useMutation({
    mutationFn: async () => {
      const user = firebaseAuth.currentUser;
      if (!user || !user.email) throw new Error('NOT_SIGNED_IN');
      if (newPassword.length < 8) throw new Error('WEAK_PASSWORD');
      if (newPassword !== confirmNew) throw new Error('PIN_MISMATCH');

      if (mode === 'change') {
        // STRONG re-auth: currentPassword must be present + correct.
        const cred = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, newPassword);
      } else {
        // ADD password to a Google / Apple / mobile-only identity —
        // linkWithCredential attaches the password credential to the SAME
        // canonical Firebase user (no new account is created).
        const cred = EmailAuthProvider.credential(user.email, newPassword);
        await linkWithCredential(user, cred);
      }

      // Refresh the id token so claims + providerData observers see the update.
      await user.getIdToken(true);
    },
    onSuccess: () => {
      // Clear the fields so the (short-lived) plaintext password is dropped
      // from React state immediately. It never touches localStorage/sessionStorage.
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNew('');
      // Bounce the security-status card so the "Password: Set" pill refreshes.
      qc.invalidateQueries({ queryKey: ['/api/security/status'] });
      toast({
        title: mode === 'change'
          ? (he ? 'הסיסמה עודכנה' : 'Password updated')
          : (he ? 'סיסמה נוספה' : 'Password added'),
        description: he ? 'תוכל להיכנס עם הסיסמה החדשה בפעם הבאה.' : 'You can sign in with your new password next time.',
      });
    },
    onError: (err: any) => {
      const code = err?.code || err?.message || '';
      let msg = he ? 'לא ניתן לעדכן את הסיסמה. נסו שוב.' : 'Could not update your password. Please try again.';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        msg = he ? 'הסיסמה הנוכחית שגויה.' : 'Your current password is incorrect.';
      } else if (code === 'auth/weak-password' || code === 'WEAK_PASSWORD') {
        msg = he ? 'הסיסמה חייבת להיות באורך 8 תווים לפחות.' : 'Password must be at least 8 characters.';
      } else if (code === 'PIN_MISMATCH') {
        msg = he ? 'הסיסמאות לא תואמות.' : 'The two new passwords do not match.';
      } else if (code === 'auth/requires-recent-login') {
        msg = he ? 'נדרש כניסה מחדש. צאו והתחברו שוב.' : 'Please sign out and back in, then try again.';
      } else if (code === 'auth/credential-already-in-use') {
        msg = he ? 'סיסמה כבר קיימת לחשבון הזה.' : 'This account already has a password credential.';
      }
      logger.warn('[ChangePassword] failed', { code });
      toast({ variant: 'destructive', title: he ? 'שגיאה' : 'Error', description: msg });
    },
  });

  const canSubmit = mode === 'change'
    ? currentPassword.length >= 1 && newPassword.length >= 8 && confirmNew.length >= 8
    : newPassword.length >= 8 && confirmNew.length >= 8;

  return (
    <Card className="luxury-glass-card luxury-shadow-lg" data-testid="password-panel">
      <CardHeader>
        <CardTitle className="luxury-heading-sm flex items-center gap-2" data-testid="password-panel-title">
          <Lock className="h-5 w-5" />
          {mode === 'change'
            ? (he ? 'שנה סיסמה' : 'Change password')
            : (he ? 'הוסף סיסמה' : 'Add password')}
        </CardTitle>
        <CardDescription className="luxury-text-small">
          {mode === 'change'
            ? (he ? 'נדרש אימות עם הסיסמה הנוכחית.' : 'You must re-authenticate with your current password.')
            : (he ? 'נוסיף סיסמה לחשבון הזה — Google/Apple/נייד עדיין יעבדו.' : 'Adds a password to this account — Google / Apple / mobile still work.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => { e.preventDefault(); if (canSubmit && !mutation.isPending) mutation.mutate(); }}
          className="space-y-4"
          autoComplete="off"
        >
          {mode === 'change' && (
            <div className="space-y-1">
              <Label htmlFor="current-password">{he ? 'סיסמה נוכחית' : 'Current password'}</Label>
              <Input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                data-testid="current-password-input"
                required
              />
              <button type="button" className="text-xs opacity-70 underline" onClick={() => setShowCurrent((s) => !s)}>
                {showCurrent ? (he ? 'הסתר' : 'Hide') : (he ? 'הצג' : 'Show')}
              </button>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="new-password">{he ? 'סיסמה חדשה' : 'New password'}</Label>
            <Input
              id="new-password"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              data-testid="new-password-input"
              minLength={8}
              required
            />
            <button type="button" className="text-xs opacity-70 underline" onClick={() => setShowNew((s) => !s)}>
              {showNew ? (he ? 'הסתר' : 'Hide') : (he ? 'הצג' : 'Show')}
            </button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-new-password">{he ? 'אישור סיסמה חדשה' : 'Confirm new password'}</Label>
            <Input
              id="confirm-new-password"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmNew}
              onChange={(e) => setConfirmNew(e.target.value)}
              data-testid="confirm-new-password-input"
              minLength={8}
              required
            />
          </div>
          <Button
            type="submit"
            className="luxury-btn-primary w-full"
            disabled={!canSubmit || mutation.isPending}
            data-testid="password-submit"
          >
            {mutation.isPending
              ? (he ? 'מעדכן…' : 'Updating…')
              : mode === 'change'
                ? (he ? 'עדכן סיסמה' : 'Update password')
                : (he ? 'הוסף סיסמה' : 'Add password')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default ChangePasswordPanel;
