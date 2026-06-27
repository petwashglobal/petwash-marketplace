import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useWhoami } from "@/auth/useWhoami";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { isAdminRole } from "@shared/adminRoles";
import { useLanguage } from "@/lib/languageStore";
import { t } from "@/lib/i18n";

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user: firebaseUser, loading: firebaseLoading, claims, claimsLoading } = useFirebaseAuth();
  const { admin, isLoading: adminLoading, isError } = useAdminAuth();
  const { whoami, isLoading: whoamiLoading, isSuperAdmin, role: whoamiRole } = useWhoami();
  const [, setLocation] = useLocation();
  const { language } = useLanguage();

  const allLoading = firebaseLoading || claimsLoading || (adminLoading && whoamiLoading);

  useEffect(() => {
    if (allLoading) return;

    if (!firebaseUser) {
      setLocation("/admin/login");
      return;
    }

    if (isSuperAdmin) return;

    const whoamiHasAccess = whoami && isAdminRole(whoamiRole);
    const adminHasAccess = admin && admin.isActive && isAdminRole(admin.role);
    const claimsHasAccess = claims.role && isAdminRole(claims.role);

    if (whoamiHasAccess || adminHasAccess || claimsHasAccess) return;

    // Logged in but NOT an admin → do NOT bounce to /admin/login (that loops a
    // signed-in non-admin). Fall through to render the friendly access-denied
    // screen below (spec §21). Only the not-logged-in case redirects to login.
  }, [firebaseLoading, firebaseUser, adminLoading, admin, isError, setLocation, claims, claimsLoading, whoami, whoamiLoading, isSuperAdmin, whoamiRole, allLoading]);

  if (allLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#B8932F] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            {firebaseLoading
              ? t('common.loading', language)
              : (language === 'he' ? 'בודק הרשאות מנהל...' : language === 'ar' ? 'التحقق من صلاحيات المسؤول...' : 'Verifying admin access...')}
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) return null;

  if (isSuperAdmin) return <>{children}</>;

  const whoamiHasAccess = whoami && isAdminRole(whoamiRole);
  const adminHasAccess = admin && admin.isActive && isAdminRole(admin.role);
  const claimsHasAccess = claims.role && isAdminRole(claims.role);

  if (whoamiHasAccess || adminHasAccess || claimsHasAccess) {
    return <>{children}</>;
  }

  // Signed in, but this account is NOT authorised for the PetWash admin backend.
  // Show a clear message (never a blank screen or a redirect loop) — Google/mobile
  // login proves identity, not admin authorization.
  const he = language === 'he';
  const ar = language === 'ar';
  return (
    <div dir={he || ar ? 'rtl' : 'ltr'} className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-2xl font-semibold text-black mb-3">
          {he ? 'אין הרשאת גישה' : ar ? 'لا يوجد إذن بالوصول' : 'Access not authorised'}
        </h1>
        <p className="text-black/60 leading-relaxed mb-6">
          {he
            ? 'החשבון הזה אינו מורשה לאזור הניהול של PetWash. התחברות עם Google או נייד מאמתת זהות בלבד — גישת מנהל ניתנת רק לצוות מאושר.'
            : ar
            ? 'هذا الحساب غير مخوّل للوحة إدارة PetWash. تسجيل الدخول يثبت الهوية فقط — صلاحية الإدارة للموظفين المعتمدين.'
            : 'This account is not authorised for the PetWash admin area. Signing in with Google or mobile proves your identity — admin access is granted only to approved staff.'}
        </p>
        <button
          onClick={() => setLocation('/')}
          className="px-6 py-3 rounded-xl bg-black text-white font-medium hover:opacity-90 transition-opacity"
          data-testid="button-admin-denied-home"
        >
          {he ? 'חזרה לדף הבית' : ar ? 'العودة إلى الصفحة الرئيسية' : 'Back to homepage'}
        </button>
      </div>
    </div>
  );
}
