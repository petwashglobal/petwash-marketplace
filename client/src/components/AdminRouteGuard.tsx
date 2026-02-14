import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user: firebaseUser, loading: firebaseLoading, claims, claimsLoading } = useFirebaseAuth();
  const { admin, isLoading: adminLoading, isError } = useAdminAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!firebaseLoading && !firebaseUser) {
      console.log('[AdminGuard] No Firebase user, redirecting to /admin/login');
      setLocation("/admin/login");
      return;
    }

    if (!claimsLoading && firebaseUser && (claims.role === 'public' || claims.role === 'provider')) {
      console.log('[AdminGuard] Public/provider user blocked from admin area, role:', claims.role);
      setLocation("/admin/access-denied");
      return;
    }

    if (!adminLoading && firebaseUser && (!admin || !admin.isActive || isError)) {
      console.log('[AdminGuard] Admin check failed, redirecting to access denied', { 
        hasAdmin: !!admin, 
        isActive: admin?.isActive, 
        isError 
      });
      setLocation("/admin/access-denied");
      return;
    }

    const allowedRoles = ['admin', 'ops'];
    if (!adminLoading && firebaseUser && admin && !allowedRoles.includes(admin.role)) {
      console.log('[AdminGuard] Insufficient permissions, role:', admin.role);
      setLocation("/admin/access-denied");
      return;
    }

    if (!adminLoading && !firebaseLoading && admin && admin.isActive && allowedRoles.includes(admin.role)) {
      console.log('[AdminGuard] Access granted:', admin.email, admin.role);
    }
  }, [firebaseLoading, firebaseUser, adminLoading, admin, isError, setLocation, claims, claimsLoading]);

  if (firebaseLoading || adminLoading || claimsLoading) {
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

  // Don't render content until all checks pass
  const allowedRoles = ['admin', 'ops'];
  if (!firebaseUser || !admin || !admin.isActive || isError || !allowedRoles.includes(admin.role)) {
    return null;
  }

  // All checks passed → render admin content
  return <>{children}</>;
}