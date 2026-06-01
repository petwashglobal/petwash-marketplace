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

    if (!adminLoading && !whoamiLoading) {
      setLocation("/admin/login");
    }
  }, [firebaseLoading, firebaseUser, adminLoading, admin, isError, setLocation, claims, claimsLoading, whoami, whoamiLoading, isSuperAdmin, whoamiRole, allLoading]);

  if (allLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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

  return null;
}
