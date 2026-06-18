import { useLocation } from "wouter";
import { useFirebaseAuth, type UserRole } from "./AuthProvider";
import { useWhoami, type DashboardType } from "./useWhoami";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  public: 1,
  provider: 2,
  franchise_owner: 3,
  staff: 4,
  hr: 5,
  ops: 5,
  finance: 6,
  admin: 6,
  management: 8,
  ceo: 9,
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
  const { isLoading: whoamiLoading, isError: whoamiError, isAuthenticated, dashboardsAllowed, role: serverRole, refetch } = useWhoami();
  const [, setLocation] = useLocation();

  // Show spinner while Firebase or the server whoami check are still in-flight.
  if (loading || whoamiLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // BUGFIX 2026-06-18: whoami REQUEST ERRORED (network/5xx/transient) but Firebase
  // still has a valid user — this is NOT a logout. Previously this collapsed to
  // !isAuthenticated and kicked the user to /signin on a single blip (e.g. window
  // refocus refetch). Keep them in place and retry instead of bouncing.
  if (whoamiError && user) {
    refetch();
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Both Firebase and the server have resolved.
  // Only redirect when the server EXPLICITLY says NOT authenticated (clean response,
  // not an error) — and there is also no local Firebase user (fully logged out).
  if (!isAuthenticated && !user) {
    setLocation('/signin');
    return null;
  }

  // Firebase user exists but the server CLEANLY reports the session is gone/expired
  // (not a transient error — that's handled above) — force re-login.
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
