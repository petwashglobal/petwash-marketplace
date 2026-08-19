import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getApiUrl } from '@/lib/apiConfig';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Clock, CheckCircle, XCircle, Loader2, Home, Mail, LogOut } from 'lucide-react';

type RequestStatus = 'pending' | 'approved' | 'rejected' | null;

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
  const { user, getIdToken, signOut } = useFirebaseAuth() as any;
  const [status, setStatus] = useState<RequestStatus>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const goHome = () => navigate('/');
  const openSupportEmail = () => {
    if (typeof window !== 'undefined') window.location.href = 'mailto:support@petwash.co.il';
  };
  const doSignOut = async () => {
    try { if (typeof signOut === 'function') await signOut(); } catch { /* fall through */ }
    navigate('/signin');
  };

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
    noRequestDesc: isHe
      ? 'עדיין לא הגשת בקשת גישה. אם התכוונת להשתמש בפטוואש בתור לקוח, חזרו לעמוד הראשי.'
      : "You haven't submitted an access request yet. If you meant to use PetWash as a customer, head back to the home page.",
    error: isHe ? 'שגיאה בטעינת הנתונים' : 'Error loading data',
    backHome: isHe ? 'חזרה לעמוד הראשי' : 'Back to Home',
    contactSupport: isHe ? 'צור קשר עם התמיכה' : 'Contact support',
    signOut: isHe ? 'התנתקות' : 'Sign out',
  };

  useEffect(() => {
    async function fetchStatus() {
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
        setStatus(null);
      } finally {
        setLoading(false);
      }
    }
    if (user) fetchStatus();
    else setLoading(false);
  }, [user]);

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
            </>
          )}

          {status === 'approved' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold text-green-700">{t.approvedTitle}</h2>
              <p className="text-gray-600 text-sm">{t.approvedDesc}</p>
              <Button onClick={() => navigate('/admin/dashboard')} className="w-full mt-4" data-testid="button-access-approved-dashboard">
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
            </>
          )}

          {status === null && (
            <>
              <XCircle className="w-16 h-16 text-gray-400 mx-auto" />
              <h2 className="text-lg font-semibold text-gray-700">{t.noRequest}</h2>
              <p className="text-gray-500 text-sm">{t.noRequestDesc}</p>
            </>
          )}

          {/* Always-visible escape hatches. Signup-friction audit 2026-08-19 SEV-1 #2:
              pending/rejected/null states were literal dead ends — no home, no
              support, no sign-out. Every terminal auth state must offer at least
              a way back to the app and a way to reach a human. */}
          <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={goHome}
              className="w-full"
              data-testid="button-access-pending-home"
            >
              <Home className="w-4 h-4 me-2" />
              {t.backHome}
            </Button>
            <Button
              variant="outline"
              onClick={openSupportEmail}
              className="w-full"
              data-testid="button-access-pending-support"
            >
              <Mail className="w-4 h-4 me-2" />
              {t.contactSupport}
            </Button>
            {status === 'rejected' && (
              <Button
                variant="ghost"
                onClick={doSignOut}
                className="w-full text-gray-500"
                data-testid="button-access-pending-signout"
              >
                <LogOut className="w-4 h-4 me-2" />
                {t.signOut}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
