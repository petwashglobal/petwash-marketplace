import { useState, useCallback, useRef, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export type TransactionType =
  | 'egift_purchase'
  | 'wallet_topup'
  | 'payment_method_change'
  | 'large_booking'
  | 'loyalty_redemption'
  | 'password_change'
  | 'email_change'
  | 'provider_payout'
  | 'bank_details_change'
  | 'profile_phone_change';

interface SendOTPResponse {
  success: boolean;
  sessionId?: string;
  sentVia?: string[];
  expiresIn?: number;
  error?: string;
  message: string;
}

interface VerifyOTPResponse {
  success: boolean;
  verified: boolean;
  transactionToken?: string;
  error?: string;
  message: string;
  remainingAttempts?: number;
}

type OTPPhase = 'idle' | 'sending' | 'awaiting_code' | 'verifying' | 'verified' | 'error';

interface UseTransactionOTPOptions {
  transactionType: TransactionType;
  amount?: string;
  currency?: string;
  language?: string;
  onVerified?: (transactionToken: string) => void;
  onError?: (error: string) => void;
}

export function useTransactionOTP(options: UseTransactionOTPOptions) {
  const [phase, setPhase] = useState<OTPPhase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sentVia, setSentVia] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [countdown, setCountdown] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [transactionToken, setTransactionToken] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCountdown = useCallback((seconds: number) => {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const sendOTP = useCallback(async () => {
    setPhase('sending');
    setMessage('');
    try {
      const res = await apiRequest('POST', '/api/transaction-otp/send', {
        transactionType: options.transactionType,
        amount: options.amount,
        currency: options.currency,
        language: options.language || 'he',
      });
      const data: SendOTPResponse = await res.json();

      if (data.success && data.sessionId) {
        setSessionId(data.sessionId);
        setSentVia(data.sentVia || []);
        setPhase('awaiting_code');
        setMessage(data.message);
        setRemainingAttempts(5);
        startCountdown(data.expiresIn || 300);
        startCooldown();
      } else {
        setPhase('error');
        setMessage(data.message);
        if (data.error === 'cooldown_active') {
          startCooldown();
        }
        options.onError?.(data.error || 'send_failed');
      }
    } catch (err: any) {
      setPhase('error');
      setMessage(options.language?.startsWith('he') ? 'שגיאה בשליחת קוד האימות' : 'Error sending verification code');
      options.onError?.('network_error');
    }
  }, [options, startCountdown, startCooldown]);

  const verifyOTP = useCallback(async (code: string) => {
    if (!sessionId) return;
    setPhase('verifying');
    try {
      const res = await apiRequest('POST', '/api/transaction-otp/verify', {
        sessionId,
        code,
        language: options.language || 'he',
      });
      const data: VerifyOTPResponse = await res.json();

      if (data.success && data.verified && data.transactionToken) {
        setPhase('verified');
        setMessage(data.message);
        setTransactionToken(data.transactionToken);
        if (timerRef.current) clearInterval(timerRef.current);
        options.onVerified?.(data.transactionToken);
      } else {
        setPhase('awaiting_code');
        setMessage(data.message);
        if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }
        if (data.error === 'too_many_attempts' || data.error === 'expired_or_missing') {
          setPhase('error');
        }
        options.onError?.(data.error || 'verify_failed');
      }
    } catch (err: any) {
      setPhase('awaiting_code');
      setMessage(options.language?.startsWith('he') ? 'שגיאה באימות הקוד' : 'Error verifying code');
      options.onError?.('network_error');
    }
  }, [sessionId, options]);

  const resendOTP = useCallback(async () => {
    if (cooldown > 0) return;
    await sendOTP();
  }, [cooldown, sendOTP]);

  const reset = useCallback(() => {
    setPhase('idle');
    setSessionId(null);
    setSentVia([]);
    setMessage('');
    setRemainingAttempts(5);
    setCountdown(0);
    setCooldown(0);
    setTransactionToken(null);
    if (timerRef.current) clearInterval(timerRef.current);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  }, []);

  return {
    phase,
    sessionId,
    sentVia,
    message,
    remainingAttempts,
    countdown,
    cooldown,
    transactionToken,
    sendOTP,
    verifyOTP,
    resendOTP,
    reset,
    isOpen: phase !== 'idle',
  };
}
