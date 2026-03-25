import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useWhoami } from "@/auth/useWhoami";
import { useLocation } from "wouter";
import { useEffect } from "react";

const ADMIN_ALLOWED_ROLES = ['admin', 'ops', 'super_admin', 'management', 'staff'];

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user: firebaseUser, loading: firebaseLoading, claims, claimsLoading } = useFirebaseAuth();
  const { admin, isLoading: adminLoading, isError } = useAdminAuth();
  const { whoami, isLoading: whoamiLoading, isSuperAdmin, role: whoamiRole } = useWhoami();
  const [, setLocation] = useLocation();

  const allLoading = firebaseLoading || claimsLoading || (adminLoading && whoamiLoading);

  useEffect(() => {
    if (allLoading) return;

    if (!firebaseUser) {
      setLocation("/signin");
      return;
    }

    if (isSuperAdmin) return;

    const whoamiHasAccess = whoami && ADMIN_ALLOWED_ROLES.includes(whoamiRole);
    const adminHasAccess = admin && admin.isActive && ADMIN_ALLOWED_ROLES.includes(admin.role);
    const claimsHasAccess = claims.role && ADMIN_ALLOWED_ROLES.includes(claims.role);

    if (whoamiHasAccess || adminHasAccess || claimsHasAccess) return;

    if (!adminLoading && !whoamiLoading) {
      setLocation("/signin");
    }
  }, [firebaseLoading, firebaseUser, adminLoading, admin, isError, setLocation, claims, claimsLoading, whoami, whoamiLoading, isSuperAdmin, whoamiRole, allLoading]);

  if (allLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            {firebaseLoading ? 'Loading...' : 'Verifying admin access...'}
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) return null;

  if (isSuperAdmin) return <>{children}</>;

  const whoamiHasAccess = whoami && ADMIN_ALLOWED_ROLES.includes(whoamiRole);
  const adminHasAccess = admin && admin.isActive && ADMIN_ALLOWED_ROLES.includes(admin.role);
  const claimsHasAccess = claims.role && ADMIN_ALLOWED_ROLES.includes(claims.role);

  if (whoamiHasAccess || adminHasAccess || claimsHasAccess) {
    return <>{children}</>;
  }

  return null;
}
