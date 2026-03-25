import { useLocation } from "wouter";
import { useFirebaseAuth, type UserRole } from "./AuthProvider";
import { useWhoami, type DashboardType } from "./useWhoami";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  public: 1,
  provider: 2,
  franchise_owner: 3,
  staff: 4,
  admin: 6,
  management: 8,
  super_admin: 10,
};

interface RoleProtectedRouteProps {
  children: JSX.Element;
  minRole: UserRole;
  fallbackPath?: string;
  requiredDashboard?: DashboardType;
}

export default function RoleProtectedRoute({ children, minRole, fallbackPath = '/', requiredDashboard }: RoleProtectedRouteProps) {
  const { user, loading } = useFirebaseAuth();
  const { isLoading: whoamiLoading, isAuthenticated, dashboardsAllowed, role: serverRole } = useWhoami();
  const [, setLocation] = useLocation();

  // Show spinner while Firebase or the server whoami check are still in-flight.
  if (loading || whoamiLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Both Firebase and the server have resolved.
  // Server `isAuthenticated` is authoritative — trust it even if the Firebase
  // client state is momentarily stale (e.g. token refresh race on remount).
  // Only redirect when the server explicitly says the user is NOT authenticated
  // AND there is also no local Firebase user (fully logged out / expired session).
  if (!isAuthenticated && !user) {
    setLocation('/signin');
    return null;
  }

  // Firebase user exists but server session has expired — force re-login.
  if (!isAuthenticated && user) {
    setLocation('/signin');
    return null;
  }

  // Server confirmed authenticated. Enforce role.
  const serverLevel = ROLE_HIERARCHY[serverRole as UserRole] ?? 1;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 1;

  if (serverLevel < requiredLevel) {
    setLocation(fallbackPath);
    return null;
  }

  if (requiredDashboard && !dashboardsAllowed.includes(requiredDashboard)) {
    setLocation(fallbackPath);
    return null;
  }

  return children;
}
