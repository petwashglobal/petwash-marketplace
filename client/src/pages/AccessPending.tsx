import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getApiUrl } from '@/lib/apiConfig';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';

// PR-AUTH-FIX-DEADEND-SCREENS (2026-05-11) — Agent A HIGH #4.
// Pre-fix the 'rejected' / null (fetch-error OR no-request) branches
// rendered a message with ZERO CTAs. Any user landing there was
// completely stuck — no home link, no support link, no reapply, no
// retry. Per CEO complaint (2026-05-11) every dead-end screen must
// show what happened + what to do next + where to go. This module
// adds those CTAs to every branch AND distinguishes the fetch-error
// state (network hiccup) from the "no request exists" state so a
// transient blip does not read as "you were never in the queue".
type RequestStatus = 'pending' | 'approved' | 'rejected' | null;
type FetchState = 'ok' | 'error';
const SUPPORT_MAILTO = 'mailto:support@petwash.co.il?subject=Access%20Request';

interface AccessRequest {
  id: number;
  userId: string;
  requestedRole: string;
  status: string;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  reason: string | null;
}

export default function AccessPending() {
  const [, navigate] = useLocation();
  const { user, getIdToken } = useFirebaseAuth();
  const [status, setStatus] = useState<RequestStatus>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // PR-AUTH-FIX-DEADEND-SCREENS: track whether the fetch itself failed
  // so we can render a distinct "we couldn't load your status" message
  // (with a retry) instead of collapsing to the "no request found" copy.
  const [fetchState, setFetchState] = useState<FetchState>('ok');
  const [retryTick, setRetryTick] = useState(0);

  const lang = (typeof window !== 'undefined' && localStorage.getItem('i18nextLng')) || 'en';
  const isHe = lang === 'he';

  const t = {
    title: isHe ? 'בקשת גישה' : 'Access Request',
    pendingTitle: isHe ? 'הבקשה שלך ממתינה לאישור' : 'Your request is pending approval',
    pendingDesc: isHe
      ? 'הבקשה שלך לגישת צוות נשלחה ומחכה לאישור מנהל. נעדכן אותך כשתהיה תשובה.'
      : 'Your staff access request has been submitted and is awaiting admin approval. We will notify you when there is a response.',
    approvedTitle: isHe ? 'הבקשה אושרה!' : 'Request Approved!',
    approvedDesc: isHe
      ? 'הבקשה שלך לגישת צוות אושרה. כעת תוכל לגשת ללוח הבקרה.'
      : 'Your staff access request has been approved. You can now access the dashboard.',
    goToDashboard: isHe ? 'עבור ללוח הבקרה' : 'Go to Dashboard',
    rejectedTitle: isHe ? 'הבקשה נדחתה' : 'Request Rejected',
    rejectedDesc: isHe ? 'לצערנו, בקשת הגישה שלך נדחתה.' : 'Unfortunately, your access request has been rejected.',
    rejectionReason: isHe ? 'סיבה:' : 'Reason:',
    noRequest: isHe ? 'לא נמצאה בקשת גישה' : 'No access request found',
    // PR-AUTH-FIX-DEADEND-SCREENS: CTAs added to every terminal branch.
    backHome: isHe ? 'חזרה לדף הבית' : 'Back to Home',
    contactSupport: isHe ? 'פנייה לתמיכה' : 'Contact Support',
    reapply: isHe ? 'שלח בקשה חדשה' : 'Submit a new request',
    errorTitle: isHe ? 'לא הצלחנו לטעון את הסטטוס' : 'We could not load your status',
    errorDesc: isHe
      ? 'ייתכן שהחיבור נקטע. נסה שוב, ואם הבעיה נמשכת פנה לתמיכה.'
      : 'This may be a temporary network issue. Please retry — if it keeps failing, contact support.',
    retry: isHe ? 'נסה שוב' : 'Retry',
  };

  useEffect(() => {
    async function fetchStatus() {
      setFetchState('ok');
      try {
        const token = await getIdToken?.();
        const res = await fetch(getApiUrl('/api/access-requests/mine'), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const req: AccessRequest | null = data.request;
        if (req) {
          setStatus(req.status as RequestStatus);
          setReason(req.reason);
        } else {
          setStatus(null);
        }
      } catch {
        // PR-AUTH-FIX-DEADEND-SCREENS: distinguish "no request exists"
        // from "we couldn't load your status" — collapsing both to
        // status=null gave a hostile "you were never in the queue"
        // message on a network hiccup.
        setStatus(null);
        setFetchState('error');
      } finally {
        setLoading(false);
      }
    }
    if (user) fetchStatus();
    else setLoading(false);
  }, [user, retryTick]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir={isHe ? 'rtl' : 'ltr'}>
        <Loader2 className="w-8 h-8 animate-spin text-[#B8932F]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" dir={isHe ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <h1 className="text-xl font-bold text-gray-900">{t.title}</h1>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === 'pending' && (
            <>
              <Clock className="w-16 h-16 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold text-amber-700">{t.pendingTitle}</h2>
              <p className="text-gray-600 text-sm">{t.pendingDesc}</p>
              {/* PR-AUTH-FIX-DEADEND-SCREENS: pending state had zero CTAs. */}
              <div className="flex flex-col gap-2 pt-3">
                <Button variant="outline" onClick={() => navigate('/')} className="w-full" data-testid="button-back-home">
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

          {status === 'approved' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold text-green-700">{t.approvedTitle}</h2>
              <p className="text-gray-600 text-sm">{t.approvedDesc}</p>
              <Button onClick={() => navigate('/admin/dashboard')} className="w-full mt-4">
                {t.goToDashboard}
              </Button>
            </>
          )}

          {status === 'rejected' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-lg font-semibold text-red-700">{t.rejectedTitle}</h2>
              <p className="text-gray-600 text-sm">{t.rejectedDesc}</p>
              {reason && (
                <p className="text-sm text-gray-500 mt-2">
                  <span className="font-medium">{t.rejectionReason}</span> {reason}
                </p>
              )}
              {/* PR-AUTH-FIX-DEADEND-SCREENS: rejected state had zero CTAs — true dead-end. */}
              <div className="flex flex-col gap-2 pt-3">
                <a
                  href={SUPPORT_MAILTO}
                  className="w-full inline-flex items-center justify-center rounded-md bg-[#B8932F] text-white px-4 py-2 text-sm font-medium hover:bg-[#907126]"
                  data-testid="link-support"
                >
                  {t.contactSupport}
                </a>
                <Button variant="outline" onClick={() => navigate('/')} className="w-full" data-testid="button-back-home">
                  {t.backHome}
                </Button>
              </div>
            </>
          )}

          {status === null && fetchState === 'ok' && (
            <>
              <p className="text-gray-500 text-sm">{t.noRequest}</p>
              {/* PR-AUTH-FIX-DEADEND-SCREENS: no-request state had zero CTAs. */}
              <div className="flex flex-col gap-2 pt-3">
                <Button onClick={() => navigate('/request-staff-access')} className="w-full" data-testid="button-reapply">
                  {t.reapply}
                </Button>
                <Button variant="outline" onClick={() => navigate('/')} className="w-full" data-testid="button-back-home">
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

          {status === null && fetchState === 'error' && (
            <>
              {/* PR-AUTH-FIX-DEADEND-SCREENS: distinct error state — a
                  network blip previously read as "no request found". */}
              <AlertTriangle className="w-16 h-16 text-amber-600 mx-auto" />
              <h2 className="text-lg font-semibold text-amber-700">{t.errorTitle}</h2>
              <p className="text-gray-600 text-sm">{t.errorDesc}</p>
              <div className="flex flex-col gap-2 pt-3">
                <Button onClick={() => setRetryTick((n) => n + 1)} className="w-full" data-testid="button-retry">
                  {t.retry}
                </Button>
                <Button variant="outline" onClick={() => navigate('/')} className="w-full" data-testid="button-back-home">
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
