import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { getApiUrl } from '@/lib/apiConfig';
import { readReturnTo } from '@/auth/returnTo';
import { PetWashLogo } from '@/components/brand/PetWashLogo';
// The founder's own brand photo (client/public/brand/hero-dog-lux.jpg): the
// PetWash bandana dog. Served from /brand like the logo, no bundling needed.
const WELCOME_HERO = '/brand/hero-dog-lux.jpg';

/**
 * /welcome-back — the moment between "signed in" and "home" for a RETURNING
 * member (CEO flow "Returning User – Sign in with Google", screen 4).
 *
 * Google is identity only. A member whose profile is already complete must
 * never see the completion form again — but they should be greeted by name
 * before landing on their home. This page: greets, shows the brand for a
 * beat, then continues to ?next (a validated internal path) — on tap or on
 * its own after a short pause. "Not you?" signs out to the door.
 *
 * Text is centred with inline styles on purpose: Tailwind's text-center is
 * dead under html[lang="he"] (see OtpCodeInput).
 */
const AUTO_CONTINUE_MS = 2800;

export default function WelcomeBack() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { language } = useLanguage();
  const he = language === 'he';
  // readReturnTo — the canonical `returnTo` key written by SignUpLuxury.
  const next = readReturnTo(search) || '/pet-parent/home';
  const [firstName, setFirstName] = useState<string>('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Same probe /complete-profile uses: the member's OWN first name from the
        // profile row, falling back to the sign-in provider's display name.
        const r = await fetch(getApiUrl('/api/auth/whoami'), { credentials: 'include' });
        if (!r.ok) return;
        const d = await r.json();
        const name: string =
          d?.user?.firstName || d?.firstName || (d?.user?.displayName || d?.displayName || '').split(' ')[0] || '';
        if (!cancelled && name) setFirstName(name);
      } catch { /* greeting without a name is still a greeting */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    timer.current = window.setTimeout(() => navigate(next), AUTO_CONTINUE_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [next, navigate]);

  const go = () => { if (timer.current) window.clearTimeout(timer.current); navigate(next); };
  // "Not you?" — a REAL sign-out (server session + Firebase), then the door.
  // The AuthProvider's logout() hard-redirects to "/", so this mirrors its
  // steps with the same canonical helper and lands on /signin instead.
  const notYou = async () => {
    if (timer.current) window.clearTimeout(timer.current);
    try {
      const [{ auth }, { signOut }, { performServerSignOut }, { invalidatePostLoginCache }, { getApiUrl: apiUrl }] =
        await Promise.all([
          import('@/lib/firebase'),
          import('firebase/auth'),
          import('@/auth/serverSignOut'),
          import('@/lib/postLoginCoordinator'),
          import('@/lib/apiConfig'),
        ]);
      invalidatePostLoginCache();
      await performServerSignOut({
        uid: auth.currentUser?.uid ?? null,
        getIdToken: async () => { try { return (await auth.currentUser?.getIdToken()) ?? null; } catch { return null; } },
        forceRefreshIdToken: async () => { try { return (await auth.currentUser?.getIdToken(true)) ?? null; } catch { return null; } },
        deps: { endpoint: apiUrl('/api/auth/signout') },
      });
      await signOut(auth);
    } catch { /* still go to the door */ }
    window.location.replace('/signin');
  };

  const Arrow = he ? ArrowLeft : ArrowRight;
  const greeting = firstName
    ? (he ? `ברוך שובך, ${firstName}!` : `Welcome back, ${firstName}!`)
    : (he ? 'ברוך שובך!' : 'Welcome back!');

  return (
    <div dir={he ? 'rtl' : 'ltr'} className="min-h-screen bg-white flex flex-col" data-testid="welcome-back">
      <header className="flex items-center justify-between px-5 pt-5">
        <PetWashLogo className="h-9" />
        {firstName && (
          <div
            className="w-9 h-9 rounded-full bg-[#0c6b48] text-white flex items-center justify-center font-semibold"
            aria-hidden
            data-testid="welcome-back-avatar"
          >
            {firstName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
        <h1
          className="text-[32px] leading-tight font-semibold text-gray-900 mt-6"
          style={{ textAlign: 'center' }}
          data-testid="welcome-back-title"
        >
          {greeting}
        </h1>
        <p className="text-gray-500 mt-2" style={{ textAlign: 'center' }}>
          {he ? 'כיף לראות אותך שוב ב־PetWash™‎' : 'Nice to see you again at PetWash™‎'}
        </p>

        <figure className="relative w-full max-w-sm mt-8 rounded-[28px] overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]">
          <img src={WELCOME_HERO} alt="" className="w-full h-[300px] object-cover object-top" loading="eager" decoding="async" draggable={false} />
          <figcaption className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/70 to-transparent text-white">
            <div className="text-2xl font-semibold leading-tight" style={{ textAlign: he ? 'right' : 'left' }}>
              {he ? 'חיות נקיות' : 'Clean pets'}<br />{he ? 'חיים שמחים' : 'happier lives'}
            </div>
            <div className="text-[10px] tracking-[0.2em] mt-2 opacity-80" dir="ltr" style={{ textAlign: he ? 'right' : 'left' }}>CLEAN PETS. HAPPIER LIVES.</div>
          </figcaption>
        </figure>

        <button
          type="button"
          onClick={go}
          className="mt-8 w-full max-w-sm rounded-full bg-black text-white py-4 text-base font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition"
          data-testid="welcome-back-continue"
        >
          {he ? 'המשך לאפליקציה' : 'Continue to the app'} <Arrow className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={notYou}
          className="mt-4 text-sm text-gray-500 underline-offset-4 hover:underline"
          data-testid="welcome-back-not-you"
        >
          {he ? 'לא אתה? התחבר עם חשבון אחר' : 'Not you? Sign in with another account'}
        </button>
      </main>
    </div>
  );
}
