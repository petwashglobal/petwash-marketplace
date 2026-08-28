/**
 * HandoffPinVerifyDialog — provider-side surface for /api/jobs/handoff/verify.
 *
 * Modal a fulfiller opens to confirm the customer's 4-digit PIN. Never
 * charges, never moves money — verification is operational evidence
 * per §46. Enumerated error codes map to human copy so a provider sees
 * why (expired / already used / wrong job / rate limited) without
 * leaking whether the code exists or not on somebody else's job.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';

const GREEN = '#063B22';
const GOLD = '#D6B56D';
const BORDER = '#ECE6D8';
const INK = '#121212';
const MUTED = '#6B6E6A';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: string;
  bookingId: string;
  purpose: 'PICKUP' | 'ENTRY' | 'START' | 'REDEMPTION';
  onVerified?: () => void;
}

type ErrorCode =
  | 'CODE_NOT_FOUND' | 'CODE_EXPIRED' | 'CODE_ALREADY_CONSUMED'
  | 'CODE_REVOKED' | 'CODE_WRONG_PURPOSE' | 'CODE_WRONG_JOB'
  | 'RATE_LIMITED' | 'AUTH_REQUIRED' | 'NOT_FOUND' | 'UNKNOWN_PURPOSE';

function errorCopy(code: ErrorCode | undefined, isHe: boolean) {
  const tr = (en: string, he: string) => (isHe ? he : en);
  switch (code) {
    case 'CODE_EXPIRED':          return tr('The PIN has expired. Ask for a fresh one.', 'הקוד פג תוקף. בקשו קוד חדש.');
    case 'CODE_ALREADY_CONSUMED': return tr('This PIN was already used.', 'הקוד כבר נוצל.');
    case 'CODE_REVOKED':          return tr('This PIN has been revoked.', 'הקוד בוטל.');
    case 'CODE_WRONG_PURPOSE':    return tr('This PIN is for a different action.', 'הקוד מיועד לפעולה אחרת.');
    case 'CODE_WRONG_JOB':        return tr('This PIN doesn\'t belong to this job.', 'הקוד אינו שייך לעבודה הזו.');
    case 'RATE_LIMITED':          return tr('Too many attempts. Wait a moment and try again.', 'ניסיונות רבים מדי. המתינו ונסו שוב.');
    case 'CODE_NOT_FOUND':        return tr('Wrong code.', 'קוד שגוי.');
    case 'NOT_FOUND':             return tr("Job not found on your account.", 'העבודה לא נמצאה בחשבון שלכם.');
    default:                      return tr('Verification failed. Try again.', 'האימות נכשל. נסו שוב.');
  }
}

export function HandoffPinVerifyDialog({ open, onOpenChange, source, bookingId, purpose, onVerified }: Props) {
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);
  const [code, setCode] = useState('');
  const [success, setSuccess] = useState(false);

  const verify = useMutation({
    mutationFn: async () => {
      const r = await apiRequest('POST', '/api/jobs/handoff/verify', {
        source, bookingId, purpose, code,
      });
      const body = await r.json();
      if (!r.ok || !body.ok) {
        const err: any = new Error(body?.errorCode || body?.error || 'VERIFY_FAILED');
        err.errorCode = body?.errorCode || body?.error;
        throw err;
      }
      return body;
    },
    onSuccess: () => {
      setSuccess(true);
      onVerified?.();
    },
  });

  if (!open) return null;
  const errorCode = (verify.error as any)?.errorCode as ErrorCode | undefined;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="dialog">
      <div
        dir={isHe ? 'rtl' : 'ltr'}
        className="w-full max-w-sm rounded-[22px] p-5"
        style={{ background: 'white', border: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4" style={{ color: GREEN }} />
          <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
            {tr('Verify handoff PIN', 'אימות קוד העברה')}
          </span>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <CheckCircle2 className="w-8 h-8" style={{ color: GREEN }} />
            <p className="text-[15px] font-bold" style={{ color: INK }}>
              {tr('Verified', 'אומת בהצלחה')}
            </p>
            <button
              type="button"
              onClick={() => { setCode(''); setSuccess(false); onOpenChange(false); }}
              className="mt-2 rounded-full px-5 py-2 text-[13px] font-semibold"
              style={{ background: GREEN, color: GOLD }}
            >
              {tr('Close', 'סגירה')}
            </button>
          </div>
        ) : (
          <>
            <p className="text-[13px]" style={{ color: MUTED }}>
              {tr(
                'Ask the customer for the 4-digit handoff PIN and enter it below.',
                'בקשו מהלקוח את קוד ההעברה בן ארבע הספרות והזינו כאן.',
              )}
            </p>
            <div className="mt-3 flex justify-center">
              <InputOTP
                maxLength={4}
                value={code}
                onChange={(v) => setCode(v)}
                inputMode="numeric"
                pattern="[0-9]*"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {verify.isError && (
              <div className="mt-3 rounded-lg p-2 text-[12px] font-semibold text-center"
                   style={{ background: '#FEECEC', color: '#8A0A0A', border: '1px solid #8A0A0A' }}>
                <XCircle className="w-3.5 h-3.5 inline mr-1" />
                {errorCopy(errorCode, isHe)}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => { setCode(''); onOpenChange(false); }}
                className="flex-1 rounded-full py-2.5 text-[13px] font-semibold"
                style={{ background: 'white', color: INK, border: `1px solid ${BORDER}` }}
              >
                {tr('Cancel', 'ביטול')}
              </button>
              <button
                type="button"
                onClick={() => verify.mutate()}
                disabled={code.length !== 4 || verify.isPending}
                className="flex-1 rounded-full py-2.5 text-[13px] font-bold disabled:opacity-60"
                style={{ background: GREEN, color: GOLD }}
              >
                {verify.isPending ? tr('Verifying…', 'מאמת…') : tr('Verify', 'אימות')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
