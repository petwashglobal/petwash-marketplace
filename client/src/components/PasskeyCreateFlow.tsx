/**
 * PasskeyCreateFlow — the ONE way a member creates a passkey (2026-09-14).
 *
 * Handshake pattern from the FIDO Alliance / Passkey Central design guidelines
 * (Apple and Google follow the same model):
 *   1. our own consent screen first: what a passkey is, where it lives, that
 *      biometrics never leave the device, and that anyone who can unlock the
 *      device can sign in;
 *   2. the member presses the confirm button (or "Not now");
 *   3. only then the system Face ID / fingerprint sheet (navigator.credentials.create);
 *   4. a success confirmation.
 * The consent version travels to the server, which refuses enrolment without it
 * and records the acceptance (PASSKEY_CONSENT_ACCEPTED) in the audit trail.
 */
import { useState } from 'react';
import { Fingerprint, Check, Loader2, ShieldCheck, Smartphone, KeyRound } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { auth } from '@/lib/firebase';
import { registerPasskey, getBiometricMethodName } from '@/auth/passkey';
import { PASSKEY_CONSENT_TEXT, PASSKEY_CONSENT_VERSION } from '@shared/lib/passkeyConsent';

type Step = 'consent' | 'working' | 'success' | 'error';

export interface PasskeyCreateFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
  /** Called once the server has stored the passkey. */
  onCreated?: () => void;
  deviceName?: string;
}

const GOLD = '#D4AF37';

export function PasskeyCreateFlow({ open, onOpenChange, language, onCreated, deviceName }: PasskeyCreateFlowProps) {
  const he = language === 'he';
  const T = PASSKEY_CONSENT_TEXT[he ? 'he' : 'en'];
  const [step, setStep] = useState<Step>('consent');
  const [error, setError] = useState<string | null>(null);
  const icons = [Smartphone, ShieldCheck, KeyRound];

  const close = () => {
    onOpenChange(false);
    // reset after the close animation so the next open starts at consent
    setTimeout(() => { setStep('consent'); setError(null); }, 200);
  };

  async function confirm() {
    setStep('working');
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error(he ? 'יש להתחבר קודם.' : 'Please sign in first.');
      const token = await user.getIdToken(true);
      const name = deviceName || `${getBiometricMethodName()} · ${new Date().toLocaleDateString(he ? 'he-IL' : 'en-US')}`;
      const r = await registerPasskey(token, name, PASSKEY_CONSENT_VERSION);
      if (r.success) {
        setStep('success');
        onCreated?.();
      } else if (r.cancelled) {
        setStep('consent');
      } else {
        setError(r.error || (he ? 'יצירת ה-Passkey נכשלה.' : 'Could not create the passkey.'));
        setStep('error');
      }
    } catch (e: any) {
      setError(e?.message || (he ? 'יצירת ה-Passkey נכשלה.' : 'Could not create the passkey.'));
      setStep('error');
    }
  }

  const align = { textAlign: he ? 'right' : 'left' } as const;

  return (
    <AlertDialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <AlertDialogContent dir={he ? 'rtl' : 'ltr'} className="max-w-md rounded-3xl" data-testid="passkey-create-flow">
        {step === 'success' ? (
          <>
            <AlertDialogHeader>
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <Check className="h-7 w-7 text-green-700" aria-hidden />
              </div>
              <AlertDialogTitle style={{ textAlign: 'center' }}>{T.successTitle}</AlertDialogTitle>
              <AlertDialogDescription style={{ textAlign: 'center' }}>{T.successBody}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <button type="button" onClick={close} className="w-full rounded-full py-3 font-semibold text-white" style={{ fontSize: 16, textAlign: 'center', backgroundColor: '#000' }} data-testid="passkey-create-done">
                {T.done}
              </button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(212,175,55,0.15)' }}>
                <Fingerprint className="h-7 w-7" style={{ color: GOLD }} aria-hidden />
              </div>
              <AlertDialogTitle style={{ textAlign: 'center' }}>{T.title}</AlertDialogTitle>
              <AlertDialogDescription style={{ textAlign: 'center' }}>{T.lead}</AlertDialogDescription>
            </AlertDialogHeader>

            <ul className="space-y-3 py-1">
              {T.points.map((pt, i) => {
                const Icon = icons[i] ?? ShieldCheck;
                return (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700" style={align}>
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} aria-hidden />
                    <span>{pt}</span>
                  </li>
                );
              })}
            </ul>

            <p className="rounded-xl p-3 text-xs" style={{ ...align, backgroundColor: '#FFF8E6', color: '#7A4B00', border: '1px solid rgba(212,175,55,0.45)' }} data-testid="passkey-consent-disclosure">
              {T.disclosure}
            </p>

            {step === 'error' && error && (
              <p role="alert" className="text-sm text-red-600" style={{ textAlign: 'center' }} data-testid="passkey-create-error">{error}</p>
            )}

            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <button
                type="button"
                onClick={confirm}
                disabled={step === 'working'}
                className="flex w-full items-center justify-center gap-2 rounded-full py-3 font-semibold text-black disabled:opacity-70"
                style={{ backgroundColor: GOLD, fontSize: 16 }}
                data-testid="passkey-consent-confirm"
              >
                {step === 'working' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Fingerprint className="h-5 w-5" aria-hidden />}
                {T.confirm}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={step === 'working'}
                className="flex w-full items-center justify-center rounded-full border border-gray-300 py-3 font-medium text-gray-800"
                style={{ fontSize: 16, textAlign: 'center' }}
                data-testid="passkey-consent-cancel"
              >
                {T.cancel}
              </button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default PasskeyCreateFlow;
