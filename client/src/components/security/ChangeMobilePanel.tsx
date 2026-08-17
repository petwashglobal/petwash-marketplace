/**
 * PR-AUTH-SECURITY-9 §7 — Change Mobile panel.
 *
 * Two-step SMS-verified flow, both steps in this same panel:
 *   1. POST /api/auth/change-mobile/request — enters new number, receives OTP
 *   2. POST /api/auth/change-mobile/verify  — enters OTP, atomic flip
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Smartphone } from 'lucide-react';

type Props = {
  currentMobile: string | null;
  language?: 'en' | 'he';
};

export function ChangeMobilePanel({ currentMobile, language = 'en' }: Props) {
  const isHe = language === 'he';
  const { toast } = useToast();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [newMobile, setNewMobile] = useState('');
  const [otp, setOtp] = useState('');

  const routeToSignin = () => {
    const current = typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : '/';
    window.location.href = `/signin?from=${encodeURIComponent(current)}`;
  };

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/change-mobile/request', {
        newMobile: newMobile.trim(),
        language,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err: any = new Error(data?.error || 'Request failed');
        err.code = data?.code;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      setStep('verify');
      toast({
        title: isHe ? 'קוד נשלח' : 'Code sent',
        description: isHe
          ? 'הזינו את הקוד בן 6 הספרות מה-SMS.'
          : 'Enter the 6-digit code from the SMS.',
      });
    },
    onError: (err: any) => {
      if (err.code === 'REAUTH_REQUIRED') {
        toast({
          title: isHe ? 'נדרש אימות מחודש' : 'Recent sign-in required',
          description: isHe ? 'הפנייה לדף כניסה…' : 'Redirecting to sign-in.',
          variant: 'destructive',
        });
        routeToSignin();
        return;
      }
      toast({
        title: isHe ? 'לא הצלחנו לשלוח SMS' : "Couldn't send SMS",
        description: err?.message || (isHe ? 'נסו שוב.' : 'Please try again.'),
        variant: 'destructive',
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/change-mobile/verify', {
        otp: otp.trim(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err: any = new Error(data?.error || 'Verify failed');
        err.code = data?.code;
        err.attemptsRemaining = data?.attemptsRemaining;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: isHe ? 'מספר עודכן' : 'Mobile updated',
        description: isHe
          ? 'המספר החדש נשמר. יש להתחבר מחדש.'
          : 'New number saved. Please sign in again.',
      });
      // Refresh-token was revoked server-side; force sign-in flow.
      routeToSignin();
    },
    onError: (err: any) => {
      if (err.code === 'REAUTH_REQUIRED') {
        routeToSignin();
        return;
      }
      const suffix = typeof err.attemptsRemaining === 'number'
        ? ` (${err.attemptsRemaining} ${isHe ? 'ניסיונות נותרו' : 'attempts left'})`
        : '';
      toast({
        title: isHe ? 'אימות נכשל' : 'Verification failed',
        description: (err?.message || (isHe ? 'קוד שגוי.' : 'Wrong code.')) + suffix,
        variant: 'destructive',
      });
    },
  });

  return (
    <Card data-testid="change-mobile-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          {isHe ? 'שינוי מספר נייד' : 'Change mobile number'}
        </CardTitle>
        <CardDescription>
          {isHe
            ? `הנוכחי: ${currentMobile ?? '—'}. המספר החדש יאומת ב-SMS.`
            : `Current: ${currentMobile ?? '—'}. The new number is verified via SMS.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'request' ? (
          <form
            onSubmit={(e) => { e.preventDefault(); if (!requestMutation.isPending) requestMutation.mutate(); }}
            className="space-y-3"
            data-testid="change-mobile-request-form"
          >
            <div>
              <Label htmlFor="new-mobile">{isHe ? 'מספר חדש' : 'New mobile'}</Label>
              <Input
                id="new-mobile"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder={isHe ? '+972541234567 או 0541234567' : '+972541234567 or 0541234567'}
                value={newMobile}
                onChange={(e) => setNewMobile(e.target.value)}
                required
                data-testid="input-new-mobile"
              />
            </div>
            <Button
              type="submit"
              disabled={requestMutation.isPending || !newMobile.trim()}
              data-testid="button-submit-change-mobile"
            >
              {requestMutation.isPending
                ? (isHe ? 'שולח…' : 'Sending…')
                : (isHe ? 'שלחו קוד ל-SMS' : 'Send SMS code')}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); if (!verifyMutation.isPending) verifyMutation.mutate(); }}
            className="space-y-3"
            data-testid="change-mobile-verify-form"
          >
            <div>
              <Label htmlFor="otp-code">{isHe ? 'קוד אימות' : 'Verification code'}</Label>
              <Input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="——————"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                data-testid="input-mobile-otp"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={verifyMutation.isPending || otp.length !== 6}
                data-testid="button-verify-change-mobile"
              >
                {verifyMutation.isPending
                  ? (isHe ? 'מאמת…' : 'Verifying…')
                  : (isHe ? 'אשר' : 'Verify')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setStep('request'); setOtp(''); }}
                data-testid="button-back-change-mobile"
              >
                {isHe ? 'חזור' : 'Back'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
