/**
 * PR-AUTH-SECURITY-9 §6 — Change Email panel.
 *
 * Two-step verified flow:
 *   1. User enters new email → POST /api/auth/change-email/request
 *      (server sends verification link to the NEW address)
 *   2. User clicks the link in that email → server confirms via
 *      POST /api/auth/change-email/confirm
 *
 * This panel handles step 1 only. The link lands on /auth/change-email/confirm
 * which is a dedicated page; that page posts the token to the confirm endpoint.
 *
 * The panel refuses to submit unless the caller has a fresh Firebase session
 * (recent-auth window enforced server-side). On REAUTH_REQUIRED the user is
 * routed to sign in again with `?from=` set to bring them back here.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CheckCircle2, Mail } from 'lucide-react';

type Props = {
  currentEmail: string | null;
  language?: 'en' | 'he';
};

export function ChangeEmailPanel({ currentEmail, language = 'en' }: Props) {
  const isHe = language === 'he';
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/change-email/request', {
        newEmail: newEmail.trim().toLowerCase(),
        language,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err: any = new Error(data?.error || 'Request failed');
        err.code = data?.code;
        err.status = res.status;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      setSent(newEmail.trim().toLowerCase());
      toast({
        title: isHe ? 'קישור אימות נשלח' : 'Verification link sent',
        description: isHe
          ? 'פתחו את המייל בכתובת החדשה ולחצו על הקישור להשלמת השינוי.'
          : 'Open the email at the NEW address and click the link to complete the change.',
      });
    },
    onError: (err: any) => {
      if (err.code === 'REAUTH_REQUIRED') {
        toast({
          title: isHe ? 'נדרש אימות מחודש' : 'Recent sign-in required',
          description: isHe
            ? 'לצורך שינוי אימייל יש להתחבר מחדש. הפנייה לדף כניסה…'
            : 'To change your email, please sign in again.',
          variant: 'destructive',
        });
        const current = typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/';
        window.location.href = `/signin?from=${encodeURIComponent(current)}`;
        return;
      }
      toast({
        title: isHe ? 'לא הצלחנו לשלוח' : "Couldn't send",
        description: err?.message || (isHe ? 'נסו שוב.' : 'Please try again.'),
        variant: 'destructive',
      });
    },
  });

  if (sent) {
    return (
      <Card data-testid="change-email-sent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            {isHe ? 'קישור אימות בדרך' : 'Verification link on the way'}
          </CardTitle>
          <CardDescription>
            {isHe
              ? `שלחנו קישור לאימות אל ${sent}. הקישור בתוקף למשך 30 דקות.`
              : `We sent a verification link to ${sent}. The link is valid for 30 minutes.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => { setSent(null); setNewEmail(''); }}
            data-testid="button-change-email-again"
          >
            {isHe ? 'שלחו אל כתובת אחרת' : 'Send to a different address'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="change-email-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          {isHe ? 'שינוי כתובת אימייל' : 'Change email address'}
        </CardTitle>
        <CardDescription>
          {isHe
            ? `הכתובת הנוכחית: ${currentEmail ?? '—'}. הכתובת החדשה תאומת לפני החלפה.`
            : `Current: ${currentEmail ?? '—'}. The new address is verified before it's applied.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => { e.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}
          className="space-y-3"
          data-testid="change-email-form"
        >
          <div>
            <Label htmlFor="new-email">{isHe ? 'אימייל חדש' : 'New email'}</Label>
            <Input
              id="new-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              maxLength={320}
              data-testid="input-new-email"
            />
          </div>
          <Button
            type="submit"
            disabled={mutation.isPending || !newEmail.trim()}
            data-testid="button-submit-change-email"
          >
            {mutation.isPending
              ? (isHe ? 'שולח…' : 'Sending…')
              : (isHe ? 'שלח קישור אימות' : 'Send verification link')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
