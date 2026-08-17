/**
 * PR-AUTH-SECURITY-9 §6 — Public /auth/change-email/confirm page.
 *
 * Lands here from the verification email link. Reads `?token=…` from the URL,
 * posts to /api/auth/change-email/confirm. On success, the user's refresh
 * tokens are revoked server-side; we redirect them to /signin to re-auth.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function AuthChangeEmailConfirm() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const token = params.get('token');
    if (!token) {
      setState('err');
      setMessage('Missing verification token.');
      return;
    }
    (async () => {
      try {
        const res = await apiRequest('POST', '/api/auth/change-email/confirm', { token });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState('err');
          setMessage(data?.error || 'Confirmation failed.');
          return;
        }
        setState('ok');
        setMessage(data?.message || 'Email updated. Please sign in again.');
        // Bounce to /signin after 2s so the user re-auths with the new email.
        setTimeout(() => navigate('/signin?from=/my-account'), 2000);
      } catch (err: any) {
        setState('err');
        setMessage(err?.message || 'Network error. Please try again.');
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full text-center space-y-4">
        {state === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-amber-500 mx-auto animate-spin" />
            <h1 className="text-lg font-semibold">Confirming your new email…</h1>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <h1 className="text-lg font-semibold">Email updated ✓</h1>
            <p className="text-sm text-gray-600">{message}</p>
            <p className="text-xs text-gray-400">Redirecting to sign-in…</p>
          </>
        )}
        {state === 'err' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h1 className="text-lg font-semibold">Couldn't confirm the change</h1>
            <p className="text-sm text-gray-600">{message}</p>
            <a href="/my-account" className="text-sm text-amber-600 underline">Back to account</a>
          </>
        )}
      </div>
    </div>
  );
}
