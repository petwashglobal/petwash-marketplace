import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

// PR-AUTH-FIX-STAFFPENDING-DEADEND (2026-08-15) — Agent A HIGH #5.
// The pre-fix page was a static stub: a single "your request is being
// reviewed" line with only a "Back to Home" button. It did NOT fetch
// the user's actual application state, so a user who had been
// REJECTED still saw "pending" forever with no path forward, and an
// APPROVED user landed on the same dead-end. Per the same 2026-05-11
// CEO rule that drove PR-AUTH-FIX-DEADEND-SCREENS: every dead-end
// screen must show what happened + what to do next + where to go.
//
// Fix: mirror ProviderPending's pattern (and the fixed AccessPending
// pattern) — fetch state from GET /api/staff/applications/mine and
// render each branch with real CTAs. Distinct fetchState so a network
// hiccup does not read as "you were never in the queue".

type StaffAppStatus =
  | 'pending'
  | 'documents_required'
  | 'under_review'
  | 'background_check'
  | 'approved'
  | 'rejected';
type FetchState = 'ok' | 'error';
const SUPPORT_MAILTO = 'mailto:support@petwash.co.il?subject=Staff%20Application';

interface StaffApplication {
  id: number;
  applicationType: string;
  status: string;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
}

const isHebrew = () => {
  try {
    return localStorage.getItem('i18nextLng')?.startsWith('he');
  } catch {
    return false;
  }
};

export default function StaffPending() {
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const he = isHebrew();
  const [app, setApp] = useState<StaffApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchState, setFetchState] = useState<FetchState>('ok');
  const [retryTick, setRetryTick] = useState(0);

  const t = {
    title: he ? 'בקשת גיוס' : 'Staff Application',
    pendingTitle: he ? 'הבקשה שלך מתקבלת' : 'Application Received',
    pendingDesc: he
      ? 'בקשתך התקבלה ותיבדק על ידי הצוות שלנו. נעדכן אותך ברגע שיש עדכון.'
      : 'Your application has been received and will be reviewed by our team. We will notify you as soon as there is an update.',
    docsRequiredTitle: he ? 'נדרשים מסמכים נוספים' : 'Documents Required',
    docsRequiredDesc: he
      ? 'הבקשה שלך התקבלה. עליך לספק מסמכים נוספים כדי להמשיך את התהליך.'
      : 'Your application has been received. Additional documents are needed to continue the process.',
    underReviewTitle: he ? 'הבקשה בבדיקה' : 'Under Review',
    underReviewDesc: he
      ? 'הצוות שלנו בוחן את בקשתך. בדרך כלל זה לוקח עד 48 שעות עסקיות.'
      : 'Our team is reviewing your application. This usually takes up to 48 business hours.',
    backgroundCheckTitle: he ? 'בדיקת רקע בתהליך' : 'Background Check In Progress',
    backgroundCheckDesc: he
      ? 'הבקשה שלך עברה לשלב בדיקת הרקע. תהליך זה עשוי לקחת מספר ימי עסקים.'
      : 'Your application has entered the background check stage. This can take several business days.',
    approvedTitle: he ? 'הבקשה אושרה!' : 'Application Approved!',
    approvedDesc: he
      ? 'ברוך הבא לצוות. תקבל אימייל עם השלבים הבאים.'
      : 'Welcome to the team. You will receive an email with next steps.',
    goHome: he ? 'עבור לדף הבית' : 'Go to Home',
    rejectedTitle: he ? 'הבקשה לא אושרה' : 'Application Not Approved',
    rejectedDesc: he
      ? 'לצערנו הבקשה שלך לא אושרה בשלב זה.'
      : 'Unfortunately your application was not approved at this time.',
    rejectionReason: he ? 'סיבה:' : 'Reason:',
    noApplicationTitle: he ? 'לא נמצאה בקשה' : 'No Application Found',
    noApplicationDesc: he
      ? 'לא מצאנו בקשת גיוס משויכת לחשבון שלך. תוכל להגיש בקשה חדשה כעת.'
      : 'We could not find a staff application linked to your account. You can submit a new application now.',
    // PR-AUTH-FIX-STAFFPENDING-DEADEND: CTAs added to every branch.
    backHome: he ? 'חזרה לדף הבית' : 'Back to Home',
    contactSupport: he ? 'פנייה לתמיכה' : 'Contact Support',
    apply: he ? 'הגש בקשה' : 'Submit an Application',
    refresh: he ? 'רענן סטטוס' : 'Refresh Status',
    errorTitle: he ? 'לא הצלחנו לטעון את הסטטוס' : 'We could not load your status',
    errorDesc: he
      ? 'ייתכן שהחיבור נקטע. נסה שוב, ואם הבעיה נמשכת פנה לתמיכה.'
      : 'This may be a temporary network issue. Please retry — if it keeps failing, contact support.',
    retry: he ? 'נסה שוב' : 'Retry',
  };

  useEffect(() => {
    async function fetchApp() {
      setFetchState('ok');
      try {
        // Client-audit HIGH-5 (2026-08-24): add credentials:'include' so the
        // Firebase session cookie ALSO reaches the server. Bearer alone works
        // in most paths, but requireAuth on this route falls back to the
        // session cookie when the Bearer channel misses — see server/
        // middleware/auth.ts. Without credentials:'include' the request
        // silently 401'd on any cross-origin subdomain deploy and users saw
        // the "no application" dead-end (PR-AUTH-FIX-STAFFPENDING-DEADEND).
        const token = user ? await user.getIdToken() : null;
        const res = await fetch('/api/staff/applications/mine', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setApp(data?.application ?? null);
      } catch {
        // PR-AUTH-FIX-STAFFPENDING-DEADEND: distinguish "no application"
        // from "we couldn't load your status" — collapsing both to
        // null gave the same hostile "you have no application" message
        // on a plain network blip.
        setApp(null);
        setFetchState('error');
      } finally {
        setLoading(false);
      }
    }
    if (user) fetchApp();
    else setLoading(false);
  }, [user, retryTick]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir={he ? 'rtl' : 'ltr'}>
        <Loader2 className="w-8 h-8 animate-spin text-[#B8932F]" />
      </div>
    );
  }

  const status = (app?.status ?? null) as StaffAppStatus | null;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" dir={he ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl font-bold text-gray-900">{t.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {/* pending — application just received, not yet triaged */}
          {status === 'pending' && (
            <>
              <Clock className="w-16 h-16 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold text-amber-700">{t.pendingTitle}</h2>
              <p className="text-gray-600 text-sm">{t.pendingDesc}</p>
              <div className="flex flex-col gap-2 pt-3">
                <Button variant="outline" onClick={() => setRetryTick((n) => n + 1)} className="w-full" data-testid="button-refresh-status">
                  <RefreshCw className="w-4 h-4 mr-2" /> {t.refresh}
                </Button>
                <Button variant="outline" onClick={() => setLocation('/')} className="w-full" data-testid="button-back-home">
                  {t.backHome}
                </Button>
                <a
                  href={SUPPORT_MAILTO}
                  className="text-sm text-[#B8932F] underline hover:text-[#907126]"
                  data-testid="link-support"
                >
                  {t.contactSupport}
                </a>
              </div>
            </>
          )}

          {/* documents_required — waiting on the applicant */}
          {status === 'documents_required' && (
            <>
              <AlertTriangle className="w-16 h-16 text-amber-600 mx-auto" />
              <h2 className="text-lg font-semibold text-amber-700">{t.docsRequiredTitle}</h2>
              <p className="text-gray-600 text-sm">{t.docsRequiredDesc}</p>
              <div className="flex flex-col gap-2 pt-3">
                <Button variant="outline" onClick={() => setLocation('/')} className="w-full" data-testid="button-back-home">
                  {t.backHome}
                </Button>
                <a
                  href={SUPPORT_MAILTO}
                  className="text-sm text-[#B8932F] underline hover:text-[#907126]"
                  data-testid="link-support"
                >
                  {t.contactSupport}
                </a>
              </div>
            </>
          )}

          {/* under_review — actively being reviewed */}
          {status === 'under_review' && (
            <>
              <Clock className="w-16 h-16 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold text-amber-700">{t.underReviewTitle}</h2>
              <p className="text-gray-600 text-sm">{t.underReviewDesc}</p>
              <div className="flex flex-col gap-2 pt-3">
                <Button variant="outline" onClick={() => setRetryTick((n) => n + 1)} className="w-full" data-testid="button-refresh-status">
                  <RefreshCw className="w-4 h-4 mr-2" /> {t.refresh}
                </Button>
                <Button variant="outline" onClick={() => setLocation('/')} className="w-full" data-testid="button-back-home">
                  {t.backHome}
                </Button>
                <a
                  href={SUPPORT_MAILTO}
                  className="text-sm text-[#B8932F] underline hover:text-[#907126]"
                  data-testid="link-support"
                >
                  {t.contactSupport}
                </a>
              </div>
            </>
          )}

          {/* background_check — later review stage */}
          {status === 'background_check' && (
            <>
              <Clock className="w-16 h-16 text-blue-500 mx-auto" />
              <h2 className="text-lg font-semibold text-blue-700">{t.backgroundCheckTitle}</h2>
              <p className="text-gray-600 text-sm">{t.backgroundCheckDesc}</p>
              <div className="flex flex-col gap-2 pt-3">
                <Button variant="outline" onClick={() => setRetryTick((n) => n + 1)} className="w-full" data-testid="button-refresh-status">
                  <RefreshCw className="w-4 h-4 mr-2" /> {t.refresh}
                </Button>
                <Button variant="outline" onClick={() => setLocation('/')} className="w-full" data-testid="button-back-home">
                  {t.backHome}
                </Button>
                <a
                  href={SUPPORT_MAILTO}
                  className="text-sm text-[#B8932F] underline hover:text-[#907126]"
                  data-testid="link-support"
                >
                  {t.contactSupport}
                </a>
              </div>
            </>
          )}

          {/* approved — congratulations, next steps by email */}
          {status === 'approved' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold text-green-700">{t.approvedTitle}</h2>
              <p className="text-gray-600 text-sm">{t.approvedDesc}</p>
              <div className="flex flex-col gap-2 pt-3">
                <Button onClick={() => setLocation('/')} className="w-full" data-testid="button-back-home">
                  {t.goHome}
                </Button>
                <a
                  href={SUPPORT_MAILTO}
                  className="text-sm text-[#B8932F] underline hover:text-[#907126]"
                  data-testid="link-support"
                >
                  {t.contactSupport}
                </a>
              </div>
            </>
          )}

          {/* rejected — show the reason + support + back home; NO reapply
              (pre-fix design decision: rejected staff should talk to
              support, not silently resubmit until they win the lottery) */}
          {status === 'rejected' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-lg font-semibold text-red-700">{t.rejectedTitle}</h2>
              <p className="text-gray-600 text-sm">{t.rejectedDesc}</p>
              {app?.rejectionReason && (
                <p className="text-sm text-gray-500 mt-2">
                  <span className="font-medium">{t.rejectionReason}</span> {app.rejectionReason}
                </p>
              )}
              <div className="flex flex-col gap-2 pt-3">
                <a
                  href={SUPPORT_MAILTO}
                  className="w-full inline-flex items-center justify-center rounded-md bg-[#B8932F] text-white px-4 py-2 text-sm font-medium hover:bg-[#907126]"
                  data-testid="link-support"
                >
                  {t.contactSupport}
                </a>
                <Button variant="outline" onClick={() => setLocation('/')} className="w-full" data-testid="button-back-home">
                  {t.backHome}
                </Button>
              </div>
            </>
          )}

          {/* no application on file (fetch succeeded, empty result) —
              offer to apply, plus back home + support */}
          {status === null && fetchState === 'ok' && (
            <>
              <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold text-amber-700">{t.noApplicationTitle}</h2>
              <p className="text-gray-600 text-sm">{t.noApplicationDesc}</p>
              <div className="flex flex-col gap-2 pt-3">
                <Button onClick={() => setLocation('/careers/apply')} className="w-full" data-testid="button-apply">
                  {t.apply}
                </Button>
                <Button variant="outline" onClick={() => setLocation('/')} className="w-full" data-testid="button-back-home">
                  {t.backHome}
                </Button>
                <a
                  href={SUPPORT_MAILTO}
                  className="text-sm text-[#B8932F] underline hover:text-[#907126]"
                  data-testid="link-support"
                >
                  {t.contactSupport}
                </a>
              </div>
            </>
          )}

          {/* fetch error (distinct from "no application") — retry + back home + support */}
          {status === null && fetchState === 'error' && (
            <>
              <AlertTriangle className="w-16 h-16 text-amber-600 mx-auto" />
              <h2 className="text-lg font-semibold text-amber-700">{t.errorTitle}</h2>
              <p className="text-gray-600 text-sm">{t.errorDesc}</p>
              <div className="flex flex-col gap-2 pt-3">
                <Button onClick={() => setRetryTick((n) => n + 1)} className="w-full" data-testid="button-retry">
                  {t.retry}
                </Button>
                <Button variant="outline" onClick={() => setLocation('/')} className="w-full" data-testid="button-back-home">
                  {t.backHome}
                </Button>
                <a
                  href={SUPPORT_MAILTO}
                  className="text-sm text-[#B8932F] underline hover:text-[#907126]"
                  data-testid="link-support"
                >
                  {t.contactSupport}
                </a>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
