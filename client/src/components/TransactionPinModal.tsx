import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckCircle2, X, ChevronLeft, Delete } from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { apiRequest } from '@/lib/queryClient';

interface TransactionPinModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  title?: string;
  amount?: string;
  currency?: string;
  recipientName?: string;
  description?: string;
  language?: 'he' | 'en';
}

const PIN_LENGTH = 6;

const LABELS = {
  he: {
    readyToPay: 'מוכן לתשלום?',
    enterPin: 'הזינו את קוד הגישה שלכם',
    forgotPin: 'שכחתי קוד',
    cancel: 'ביטול',
    back: 'חזרה',
    verifying: 'מאמת...',
    success: 'התשלום אושר',
    wrongPin: 'קוד שגוי',
    attemptsLeft: (n: number) => `נותרו ${n} ניסיונות`,
    locked: (m: number) => `החשבון נעול. נסו שוב בעוד ${m} דקות`,
    noPin: 'לא הוגדר קוד גישה לחשבון זה',
    error: 'שגיאה. נסו שנית',
    from: 'מ',
  },
  en: {
    readyToPay: 'Ready to pay?',
    enterPin: 'Enter your Access PIN',
    forgotPin: 'Forgot PIN',
    cancel: 'Cancel',
    back: 'Back',
    verifying: 'Verifying...',
    success: 'Payment approved',
    wrongPin: 'Incorrect PIN',
    attemptsLeft: (n: number) => `${n} attempts remaining`,
    locked: (m: number) => `Account locked. Try again in ${m} minutes`,
    noPin: 'No PIN set up for this account',
    error: 'Something went wrong. Try again.',
    from: 'From',
  },
};

type Phase = 'input' | 'verifying' | 'success' | 'error';

export function TransactionPinModal({
  open,
  onClose,
  onVerified,
  title,
  amount,
  currency = '₪',
  recipientName,
  description,
  language = 'he',
}: TransactionPinModalProps) {
  const { user } = useFirebaseAuth();
  const t = LABELS[language];
  const isRTL = language === 'he';

  const [pin, setPin] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setPin('');
      setPhase('input');
      setErrorMsg('');
      setAttemptsLeft(null);
      setLockoutMinutes(null);
    }
  }, [open]);

  const verifyPin = useCallback(async (enteredPin: string) => {
    if (!user?.email) return;
    setPhase('verifying');
    setErrorMsg('');

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/pin-auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ pin: enteredPin, email: user.email }),
      });

      const data = await res.json();

      if (data.success) {
        setPhase('success');
        setTimeout(() => {
          onVerified();
          onClose();
        }, 900);
        return;
      }

      if (data.code === 'ACCOUNT_LOCKED') {
        setLockoutMinutes(data.lockoutMinutes ?? 15);
        setErrorMsg(t.locked(data.lockoutMinutes ?? 15));
        setPhase('error');
        return;
      }

      if (data.code === 'PIN_NOT_SETUP') {
        setErrorMsg(t.noPin);
        setPhase('error');
        return;
      }

      setAttemptsLeft(data.attemptsRemaining ?? null);
      setErrorMsg(
        data.attemptsRemaining != null
          ? `${t.wrongPin} — ${t.attemptsLeft(data.attemptsRemaining)}`
          : t.wrongPin
      );
      setPin('');
      setPhase('input');
    } catch {
      setErrorMsg(t.error);
      setPin('');
      setPhase('input');
    }
  }, [user, t, onVerified, onClose]);

  const handleDigit = useCallback((digit: string) => {
    if (phase !== 'input') return;
    setErrorMsg('');
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + digit;
      if (next.length === PIN_LENGTH) {
        setTimeout(() => verifyPin(next), 80);
      }
      return next;
    });
  }, [phase, verifyPin]);

  const handleBackspace = useCallback(() => {
    if (phase !== 'input') return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  }, [phase]);

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

  const amountDisplay = amount ? `${currency}${parseFloat(amount).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && phase !== 'verifying') onClose(); }}>
      <DialogContent
        className="p-0 overflow-hidden bg-white max-w-[380px] w-full rounded-3xl shadow-2xl border-0"
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <button
            onClick={onClose}
            disabled={phase === 'verifying'}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          >
            {isRTL ? <ChevronLeft className="w-4 h-4 rotate-180" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <span className="text-sm font-medium text-gray-500">{t.back}</span>
          <button
            onClick={onClose}
            disabled={phase === 'verifying'}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Transaction summary */}
        {(recipientName || amountDisplay || description) && (
          <div className="px-6 pt-2 pb-4 text-center space-y-1">
            {recipientName && (
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                {title || (language === 'he' ? 'תשלום ל' : 'Payment to')}
              </p>
            )}
            {recipientName && (
              <p className="text-base font-semibold text-gray-800">{recipientName}</p>
            )}
            {amountDisplay && (
              <p className="text-3xl font-bold text-gray-900 tracking-tight">{amountDisplay}</p>
            )}
            {description && (
              <span className="inline-block bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full mt-1">
                {description}
              </span>
            )}
          </div>
        )}

        <div className="bg-white rounded-t-3xl pb-8">
          {phase === 'success' ? (
            /* Success state */
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <p className="text-base font-medium text-green-700">{t.success}</p>
            </div>
          ) : (
            <>
              {/* PIN prompt */}
              <div className="text-center pt-2 pb-5 px-6">
                <p className="text-lg font-semibold text-gray-900 mb-0.5">
                  {t.enterPin}
                </p>

                {/* PIN dots */}
                <div className="flex items-center justify-center gap-3 mt-4">
                  {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full transition-all duration-150 ${
                        i < pin.length
                          ? 'bg-blue-600 scale-110'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>

                {/* Error message */}
                {errorMsg && (
                  <p className="text-sm text-red-500 mt-3 font-medium">{errorMsg}</p>
                )}

                {phase === 'verifying' && (
                  <p className="text-sm text-gray-400 mt-3">{t.verifying}</p>
                )}
              </div>

              {/* Number pad */}
              <div className="px-6">
                <div className="grid grid-cols-3 gap-3">
                  {KEYS.map((key, idx) => {
                    if (key === '') {
                      return <div key={idx} />;
                    }

                    if (key === 'back') {
                      return (
                        <button
                          key={idx}
                          onPointerDown={(e) => { e.preventDefault(); handleBackspace(); }}
                          disabled={phase === 'verifying' || pin.length === 0}
                          className="flex items-center justify-center h-16 rounded-full text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-30"
                        >
                          <Delete className="w-6 h-6" />
                        </button>
                      );
                    }

                    const subLabels: Record<string, string> = {
                      '2': 'ABC', '3': 'DEF', '4': 'GHI',
                      '5': 'JKL', '6': 'MNO', '7': 'PQRS',
                      '8': 'TUV', '9': 'WXYZ',
                    };

                    return (
                      <button
                        key={idx}
                        onPointerDown={(e) => { e.preventDefault(); handleDigit(key); }}
                        disabled={phase === 'verifying'}
                        className="flex flex-col items-center justify-center h-16 rounded-full bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40 select-none"
                      >
                        <span className="text-2xl font-light text-gray-900 leading-none">{key}</span>
                        {subLabels[key] && (
                          <span className="text-[9px] font-medium text-gray-400 tracking-widest mt-0.5">
                            {subLabels[key]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer links */}
              <div className="flex items-center justify-between px-8 mt-5">
                <button
                  onClick={onClose}
                  disabled={phase === 'verifying'}
                  className="text-sm text-blue-600 font-medium disabled:opacity-40"
                >
                  {t.forgotPin}
                </button>
                <button
                  onClick={onClose}
                  disabled={phase === 'verifying'}
                  className="text-sm text-blue-600 font-medium disabled:opacity-40"
                >
                  {t.cancel}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
