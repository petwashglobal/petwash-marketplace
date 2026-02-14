import { useLocation } from "wouter";
import { useFirebaseAuth, type UserRole } from "./AuthProvider";
import { useWhoami, type DashboardType } from "./useWhoami";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  public: 1,
  provider: 2,
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
  const { whoami, isLoading: whoamiLoading, isAuthenticated, dashboardsAllowed, role: serverRole } = useWhoami();
  const [, setLocation] = useLocation();

  if (loading || whoamiLoading) {
    return null;
  }

  if (!user) {
    setLocation('/signin');
    return null;
  }

  if (whoami && isAuthenticated) {
    const serverLevel = ROLE_HIERARCHY[serverRole as UserRole] || 1;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 1;

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

  return children;
}
