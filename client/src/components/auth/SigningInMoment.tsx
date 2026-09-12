import { PetWashLogo } from '@/components/brand/PetWashLogo';

/**
 * SigningInMoment — screen 3 of the CEO's "Returning User – Sign in with
 * Google" flow (2026-09-12): logo, a green ring, "Nice to see you again!" /
 * "Signing you in…", and a dog looking up at you from the bottom of the
 * screen. Shown full-screen while /api/auth/post-login decides where the
 * member goes, so the seconds between Google and the app feel like PetWash
 * and not like a blank form.
 *
 * `returning` is decided BEFORE the server answers, from the Firebase user
 * record itself (creationTime vs lastSignInTime), so the copy is right from
 * the first frame: a brand-new account gets "Welcome!" instead.
 *
 * Photo: the founder's own mascot (client/public/brand/kenzo-avatar.jpeg) —
 * the same Kenzo the assistant widget uses. Centred text is inline on purpose
 * (Tailwind text-center is dead under html[lang="he"]).
 */
export const SIGNING_IN_PHOTO = '/brand/kenzo-avatar.jpeg';

export function SigningInMoment({ he, returning }: { he: boolean; returning: boolean }) {
  const headline = returning
    ? (he ? 'כיף לראות אותך שוב!' : 'Nice to see you again!')
    : (he ? 'ברוכים הבאים!' : 'Welcome!');
  const sub = he ? 'מחברים אותך…' : 'Signing you in…';
  return (
    <div
      dir={he ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[60] bg-white flex flex-col items-center"
      role="status"
      aria-live="polite"
      data-testid="signing-in-moment"
    >
      <div className="pt-14">
        <PetWashLogo size={44} priority />
      </div>

      <div className="mt-10 relative w-14 h-14" aria-hidden>
        <div className="absolute inset-0 rounded-full border-4 border-[#0c6b48]/15" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#0c6b48] animate-spin" />
      </div>

      <h1 className="mt-7 text-[22px] font-semibold text-gray-900" style={{ textAlign: 'center' }} data-testid="signing-in-headline">
        {headline}
      </h1>
      <p className="mt-1 text-gray-500" style={{ textAlign: 'center' }}>{sub}</p>

      <div className="mt-auto w-full flex justify-center overflow-hidden" style={{ maxHeight: '46vh' }}>
        <img
          src={SIGNING_IN_PHOTO}
          alt=""
          className="w-full max-w-md object-cover object-top"
          style={{ height: '46vh' }}
          loading="eager"
          decoding="async"
          draggable={false}
        />
      </div>
    </div>
  );
}

export default SigningInMoment;
