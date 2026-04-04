/**
 * OtpCodeInput — SMS verification code entry
 *
 * Renders 6 individual <input> boxes.
 * The first box has autocomplete="one-time-code" so iOS and Android
 * can offer the incoming SMS code as a one-tap suggestion above the keyboard.
 *
 * How iOS autofill works:
 *  1. iPhone receives the SMS containing the code.
 *  2. iOS scans for a number matching standard OTP patterns.
 *  3. A banner appears above the keyboard: "From Messages: 123456".
 *  4. The user taps it — iOS fills the first input with "123456".
 *  5. Our onChange handler distributes the digits across all 6 boxes and
 *     fires onComplete automatically.
 *
 * How WebOTP (Chrome / Android) works:
 *  - navigator.credentials.get({ otp: { transport: ['sms'] } }) is called.
 *  - The SMS must end with:  @domain.com #CODE
 *  - Chrome intercepts it and resolves the promise with the code automatically.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/apiConfig';

interface OtpCodeInputProps {
  length?: number;
  onComplete: (code: string) => void;
  loading?: boolean;
  error?: string;
  title?: string;
  subtitle?: string;
  language?: 'en' | 'he';
}

export function OtpCodeInput({
  length = 6,
  onComplete,
  loading = false,
  error,
  title,
  subtitle,
  language = 'en',
}: OtpCodeInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    setDigits(Array(length).fill(''));
    setTimeout(() => inputRefs.current[0]?.focus(), 120);
  }, [error, length]);

  // WebOTP API — Chrome / Android autofill
  useEffect(() => {
    if (!('OTPCredential' in window)) return;
    const controller = new AbortController();
    (navigator.credentials as any)
      .get({ otp: { transport: ['sms'] }, signal: controller.signal })
      .then((otp: any) => {
        if (otp?.code && !completedRef.current) {
          const cleaned = otp.code.replace(/\D/g, '').slice(0, length);
          const filled = cleaned.split('');
          const next = Array(length).fill('');
          filled.forEach((d: string, i: number) => { next[i] = d; });
          setDigits(next);
          if (next.every(d => d !== '')) {
            completedRef.current = true;
            onComplete(next.join(''));
          }
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [length, onComplete]);

  const distribute = useCallback((raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, length);
    const next = Array(length).fill('');
    cleaned.split('').forEach((d, i) => { next[i] = d; });
    setDigits(next);
    const lastIdx = Math.min(cleaned.length - 1, length - 1);
    inputRefs.current[lastIdx]?.focus();
    if (next.every(d => d !== '') && !completedRef.current) {
      completedRef.current = true;
      onComplete(next.join(''));
    }
  }, [length, onComplete]);

  const handleChange = useCallback((index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length > 1) {
      distribute(cleaned);
      return;
    }
    if (cleaned.length === 1) {
      const next = [...digits];
      next[index] = cleaned;
      setDigits(next);
      if (index < length - 1) inputRefs.current[index + 1]?.focus();
      if (next.every(d => d !== '') && !completedRef.current) {
        completedRef.current = true;
        onComplete(next.join(''));
      }
    }
  }, [digits, length, onComplete, distribute]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      completedRef.current = false;
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits, length]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    distribute(e.clipboardData.getData('text'));
  }, [distribute]);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {title && (
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-black text-center">
          {title}
        </h2>
      )}
      {subtitle && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center px-4">
          {subtitle}
        </p>
      )}

      {/* 6 input boxes — always LTR regardless of page language */}
      <div className="flex gap-2 justify-center" dir="ltr">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={i === 0 ? length : 1}
            value={digits[i]}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            onPaste={handlePaste}
            disabled={loading}
            aria-label={`Digit ${i + 1} of ${length}`}
            className={cn(
              'w-11 h-14 text-center text-2xl font-bold rounded-lg border-2 transition-all duration-150 bg-white dark:bg-white',
              'focus:outline-none focus:ring-0',
              digits[i]
                ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-black'
                : 'border-neutral-300 text-neutral-400 dark:border-neutral-600',
              error ? 'border-red-400 dark:border-red-500 animate-shake' : 'focus:border-neutral-900 dark:focus:border-white',
              loading ? 'opacity-50 cursor-not-allowed' : 'cursor-text'
            )}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
          {language === 'he' ? 'מאמת...' : 'Verifying...'}
        </div>
      )}
    </div>
  );
}

export default OtpCodeInput;
