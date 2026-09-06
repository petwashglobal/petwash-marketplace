/**
 * A minimal page that mounts the REAL VerificationFlow.
 *
 * WHY THIS EXISTS, honestly stated: the full production SPA does not boot when
 * served statically (one of main.tsx's three parallel dynamic imports resolves
 * to undefined — "Cannot read properties of undefined (reading 'default')").
 * That is a real finding, logged separately; it is not the verification flow,
 * and waiting to fix the whole app's static-serve path before proving this
 * screen in a browser would mean never proving it.
 *
 * WHAT THIS DOES COVER: the shipped VerificationFlow component, the shipped
 * useVerificationChallenge hook and the shipped authEmailTransport, driven by
 * a real browser — real focus, real keyboard, real paste, real one-input OTP
 * behaviour, real RTL shaping, real reload and back-navigation.
 *
 * WHAT IT DOES NOT COVER: the signup page's own composition around it (method
 * choice, consent gates, the stage 2-4 session chain). Those are pinned by the
 * source contract tests, and need the SPA boot fixed for a browser pass.
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { VerificationFlow } from '../../../../client/src/components/verification/VerificationFlow';
import { createAuthEmailTransport } from '../../../../client/src/lib/verification/authEmailTransport';

declare global {
  interface Window { __verified__: any[]; __changeDestination__: number }
}
window.__verified__ = [];
window.__changeDestination__ = 0;

function Harness() {
  const params = new URLSearchParams(window.location.search);
  const lang = (params.get('lang') === 'he' ? 'he' : 'en') as 'en' | 'he';
  const purpose = (params.get('purpose') || 'signup') as any;
  const email = params.get('email') || 'petwash@example.com';
  const [done, setDone] = useState<string | null>(null);

  const transport = createAuthEmailTransport({
    purpose: purpose === 'login' ? 'login' : 'signup',
    language: lang,
    getEmail: () => email,
  });

  return (
    <div style={{ padding: 12 }}>
      {done && <div data-testid="harness-done">{done}</div>}
      <VerificationFlow
        purpose={purpose}
        destination={email}
        preferredChannel="email"
        allowedChannels={['email']}
        language={lang}
        transport={transport}
        onVerified={(result) => {
          window.__verified__.push(result);
          setDone('verified:' + (result?.sessionToken ?? 'no-token'));
        }}
        onChangeDestination={() => { window.__changeDestination__ += 1; }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
