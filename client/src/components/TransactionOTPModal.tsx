import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Shield, CheckCircle2, AlertTriangle, Clock, Smartphone, Mail, RefreshCw, Loader2 } from 'lucide-react';
import { useTransactionOTP, type TransactionType } from '@/hooks/useTransactionOTP';
import { useTranslation } from 'react-i18next';
import { REGEXP_ONLY_DIGITS } from 'input-otp';

const TRANSACTION_LABELS: Record<TransactionType, { he: string; en: string }> = {
  egift_purchase: { he: 'רכישת כרטיס מתנה דיגיטלי', en: 'E-Gift Card Purchase' },
  wallet_topup: { he: 'טעינת ארנק דיגיטלי', en: 'Wallet Top-Up' },
  payment_method_change: { he: 'שינוי אמצעי תשלום', en: 'Payment Method Change' },
  large_booking: { he: 'הזמנה בסכום גבוה', en: 'Large Booking' },
  loyalty_redemption: { he: 'מימוש נקודות נאמנות', en: 'Loyalty Points Redemption' },
  password_change: { he: 'שינוי סיסמה', en: 'Password Change' },
  email_change: { he: 'שינוי כתובת אימייל', en: 'Email Address Change' },
  provider_payout: { he: 'בקשת תשלום לספק', en: 'Provider Payout Request' },
  bank_details_change: { he: 'שינוי פרטי חשבון בנק', en: 'Bank Details Change' },
  profile_phone_change: { he: 'שינוי מספר טלפון', en: 'Phone Number Change' },
};

interface TransactionOTPModalProps {
  open: boolean;
  onClose: () => void;
  transactionType: TransactionType;
  amount?: string;
  currency?: string;
  onVerified: (transactionToken: string) => void;
  onCancel?: () => void;
}

export function TransactionOTPModal({
  open,
  onClose,
  transactionType,
  amount,
  currency,
  onVerified,
  onCancel,
}: TransactionOTPModalProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('he') ? 'he' : 'en';
  const isHebrew = lang === 'he';
  const [otpValue, setOtpValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    phase,
    sentVia,
    message,
    remainingAttempts,
    countdown,
    cooldown,
    sendOTP,
    verifyOTP,
    resendOTP,
    reset,
  } = useTransactionOTP({
    transactionType,
    amount,
    currency,
    language: lang,
    onVerified: (token) => {
      onVerified(token);
    },
    onError: () => {},
  });

  useEffect(() => {
    if (open && phase === 'idle') {
      sendOTP();
    }
  }, [open, phase, sendOTP]);

  useEffect(() => {
    if (!open) {
      setOtpValue('');
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (otpValue.length === 6 && phase === 'awaiting_code') {
      verifyOTP(otpValue);
    }
  }, [otpValue, phase, verifyOTP]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    onCancel?.();
    onClose();
  };

  const label = TRANSACTION_LABELS[transactionType]?.[lang] || transactionType;
  const amountDisplay = amount && currency ? `${currency} ${amount}` : '';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[440px] bg-white p-0 overflow-hidden" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-6 py-5 relative">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#c9a96e] via-[#e8d5a3] to-[#c9a96e]" />
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-white text-lg font-normal flex items-center gap-2 font-serif">
              <Shield className="w-5 h-5 text-[#e8d5a3]" />
              {isHebrew ? 'אימות פעולה מאובטח' : 'Secure Transaction Verification'}
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-sm">
              {label}{amountDisplay ? ` — ${amountDisplay}` : ''}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {phase === 'sending' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#c9a96e]" />
              <p className="text-sm text-slate-600">
                {isHebrew ? 'שולח קוד אימות...' : 'Sending verification code...'}
              </p>
            </div>
          )}

          {phase === 'awaiting_code' && (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm text-slate-600">
                  {isHebrew ? 'הזינו את הקוד בן 6 הספרות שנשלח אל:' : 'Enter the 6-digit code sent to:'}
                </p>
                <div className="flex items-center justify-center gap-3 text-sm">
                  {sentVia.includes('sms') && (
                    <span className="flex items-center gap-1 text-slate-700 bg-white px-3 py-1 rounded-full">
                      <Smartphone className="w-3.5 h-3.5" /> {isHebrew ? 'SMS' : 'SMS'}
                    </span>
                  )}
                  {sentVia.includes('email') && (
                    <span className="flex items-center gap-1 text-slate-700 bg-white px-3 py-1 rounded-full">
                      <Mail className="w-3.5 h-3.5" /> {isHebrew ? 'אימייל' : 'Email'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-center" dir="ltr">
                <InputOTP
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otpValue}
                  onChange={setOtpValue}
                  autoComplete="one-time-code"
                  ref={inputRef}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-12 h-14 text-xl border-[#c9a96e]/30 focus:border-[#c9a96e]" />
                    <InputOTPSlot index={1} className="w-12 h-14 text-xl border-[#c9a96e]/30 focus:border-[#c9a96e]" />
                    <InputOTPSlot index={2} className="w-12 h-14 text-xl border-[#c9a96e]/30 focus:border-[#c9a96e]" />
                  </InputOTPGroup>
                  <div className="mx-1" />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} className="w-12 h-14 text-xl border-[#c9a96e]/30 focus:border-[#c9a96e]" />
                    <InputOTPSlot index={4} className="w-12 h-14 text-xl border-[#c9a96e]/30 focus:border-[#c9a96e]" />
                    <InputOTPSlot index={5} className="w-12 h-14 text-xl border-[#c9a96e]/30 focus:border-[#c9a96e]" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {message && (
                <p className={`text-center text-sm ${message.includes('שגוי') || message.includes('Invalid') ? 'text-red-600' : 'text-slate-500'}`}>
                  {message}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {countdown > 0 ? (
                    <span>{isHebrew ? `פג תוקף בעוד ${formatTime(countdown)}` : `Expires in ${formatTime(countdown)}`}</span>
                  ) : (
                    <span className="text-red-500">{isHebrew ? 'הקוד פג תוקף' : 'Code expired'}</span>
                  )}
                </div>
                <span>{isHebrew ? `${remainingAttempts} ניסיונות נותרו` : `${remainingAttempts} attempts left`}</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resendOTP}
                  disabled={cooldown > 0}
                  className="text-[#c9a96e] hover:text-[#b8943f] text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 me-1" />
                  {cooldown > 0
                    ? (isHebrew ? `שלחו שוב (${cooldown}s)` : `Resend (${cooldown}s)`)
                    : (isHebrew ? 'שלחו קוד חדש' : 'Resend code')}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs text-slate-400">
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </Button>
              </div>
            </>
          )}

          {phase === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#c9a96e]" />
              <p className="text-sm text-slate-600">
                {isHebrew ? 'מאמת...' : 'Verifying...'}
              </p>
            </div>
          )}

          {phase === 'verified' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <p className="text-lg font-medium text-green-700">
                {isHebrew ? 'אימות הושלם בהצלחה!' : 'Verification Complete!'}
              </p>
              <p className="text-sm text-slate-500">
                {isHebrew ? 'הפעולה אושרה. ממשיכים...' : 'Transaction approved. Proceeding...'}
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <p className="text-sm text-center text-slate-600">{message}</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setOtpValue('');
                    sendOTP();
                  }}
                  className="bg-[#c9a96e] hover:bg-[#b8943f] text-white"
                >
                  {isHebrew ? 'נסו שנית' : 'Try Again'}
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white px-6 py-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 text-center">
            {isHebrew
              ? 'לעולם אל תשתפו קוד זה עם אף אחד. \u2066Pet Wash\u2122\u2069 לעולם לא יבקשו ממכם קוד אימות.'
              : 'Never share this code. \u2066Pet Wash\u2122\u2069 will never ask for your verification code.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
