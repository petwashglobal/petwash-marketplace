/**
 * PUBLIC: /provider-application/resubmit?token=…
 *
 * THIS PAGE DID NOT EXIST. (2026-09-10)
 *
 * When a reviewer asks an applicant for better documents, the server emails
 * `${appUrl}/provider-application/resubmit?token=…`
 * (server/routes/provider-onboarding.ts) and `/my/status` returns the same
 * string as `resubmitUrl`, which ProviderApplicationStatus renders as a link.
 * There was no such route in App.tsx and no page file, so every one of those
 * links landed on the SPA's NotFound.
 *
 * That was the only sanctioned way back in: `pending_resubmission` is also in
 * the existing-application list that blocks a fresh POST /apply, so an
 * applicant who was asked for documents could neither upload them nor start
 * again. This page is the other half of an endpoint that was already built.
 *
 * AUTH: none. The secure token IS the credential — the server claims it
 * atomically (WHERE fulfilled_at IS NULL) so it is single-use, and it expires.
 * We therefore never ask this visitor to sign in, and we send nothing but the
 * two files and the token.
 */
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Layout } from '@/components/Layout';
import { getApiUrl } from '@/lib/apiConfig';
import { useLanguage } from '@/lib/languageStore';

type Phase = 'form' | 'sending' | 'done';

/** Every errorCode the endpoint can return, said in the applicant's language. */
function messageFor(code: string | undefined, he: boolean): string {
  switch (code) {
    case 'INVALID_TOKEN':
    case 'TOKEN_NOT_FOUND':
      return he
        ? 'הקישור אינו תקין. בקשו מאיתנו קישור חדש במייל.'
        : 'This link is not valid. Ask us to send a new one.';
    case 'TOKEN_EXPIRED':
      return he
        ? 'תוקף הקישור פג. בקשו מאיתנו קישור חדש במייל.'
        : 'This link has expired. Ask us to send a new one.';
    case 'TOKEN_ALREADY_USED':
      return he
        ? 'כבר העליתם מסמכים דרך הקישור הזה. אנחנו בודקים אותם.'
        : 'Documents were already uploaded with this link. We are reviewing them.';
    case 'INVALID_STATE_FOR_RESUBMISSION':
      return he
        ? 'הבקשה שלכם כבר אינה ממתינה למסמכים.'
        : 'Your application is no longer waiting for documents.';
    case 'APPLICATION_NOT_FOUND':
      return he ? 'לא מצאנו את הבקשה.' : 'We could not find that application.';
    case 'NO_FILES':
      return he ? 'בחרו לפחות קובץ אחד.' : 'Choose at least one file.';
    default:
      return he
        ? 'ההעלאה נכשלה. נסו שוב בעוד רגע.'
        : 'The upload failed. Please try again in a moment.';
  }
}

export default function ProviderApplicationResubmit() {
  const { language } = useLanguage();
  const he = language === 'he';

  // The token lives in the query string the email built. Read it once.
  const token = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('token') || '';
    } catch {
      return '';
    }
  }, []);

  const [selfie, setSelfie] = useState<File | null>(null);
  const [govId, setGovId] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string>('');

  const submit = async () => {
    setError('');
    if (!selfie && !govId) {
      setError(messageFor('NO_FILES', he));
      return;
    }
    setPhase('sending');
    try {
      const body = new FormData();
      if (selfie) body.append('selfiePhoto', selfie);
      if (govId) body.append('governmentId', govId);
      // No Authorization header on purpose — the token is the credential.
      const res = await fetch(getApiUrl(`/api/provider-onboarding/resubmit/${encodeURIComponent(token)}`), {
        method: 'POST',
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(messageFor(data?.errorCode, he));
        setPhase('form');
        return;
      }
      setPhase('done');
    } catch {
      setError(he ? 'שגיאת רשת. נסו שוב.' : 'Network error. Please try again.');
      setPhase('form');
    }
  };

  // A link with no token cannot be recovered here — say so rather than
  // showing an upload form that is guaranteed to fail.
  if (!token || token.length < 20) {
    return (
      <Layout>
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            {he ? 'הקישור אינו תקין' : 'This link is not valid'}
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            {he
              ? 'פתחו את הקישור המלא מהמייל ששלחנו, או פנו אלינו ונשלח קישור חדש.'
              : 'Open the full link from the email we sent, or contact us and we will send a new one.'}
          </p>
          <Link href="/provider-application/status" className="mt-6 inline-block text-sm underline">
            {he ? 'מצב הבקשה שלי' : 'My application status'}
          </Link>
        </main>
      </Layout>
    );
  }

  if (phase === 'done') {
    return (
      <Layout>
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            {he ? 'קיבלנו את המסמכים' : 'We have your documents'}
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            {he
              ? 'הבדיקה מחדש התחילה. נעדכן אתכם במייל.'
              : 'Re-verification has started. We will email you.'}
          </p>
          <Link href="/provider-application/status" className="mt-6 inline-block text-sm underline">
            {he ? 'מצב הבקשה שלי' : 'My application status'}
          </Link>
        </main>
      </Layout>
    );
  }

  const busy = phase === 'sending';

  return (
    <Layout>
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-2xl font-semibold text-gray-900">
          {he ? 'העלאת מסמכים מחדש' : 'Upload your documents again'}
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          {he
            ? 'ביקשנו מכם תמונה ברורה יותר. אפשר להעלות אחד מהם או את שניהם — הקישור הזה תקף לשימוש אחד.'
            : 'We asked for a clearer picture. Upload either one or both — this link works once.'}
        </p>

        <div className="mt-8 space-y-6">
          <div>
            <label htmlFor="resubmit-selfie" className="block text-sm font-medium text-gray-900">
              {he ? 'תמונת סלפי' : 'Selfie photo'}
            </label>
            <input
              id="resubmit-selfie"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm"
            />
          </div>

          <div>
            <label htmlFor="resubmit-govid" className="block text-sm font-medium text-gray-900">
              {he ? 'תעודה מזהה' : 'Government ID'}
            </label>
            <input
              id="resubmit-govid"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => setGovId(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={busy || (!selfie && !govId)}
            className="w-full rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? (he ? 'שולח…' : 'Sending…') : he ? 'שליחה' : 'Send'}
          </button>
        </div>
      </main>
    </Layout>
  );
}
