import { useLocation } from "wouter";
import { useFirebaseAuth, type UserRole } from "./AuthProvider";

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
}

export default function RoleProtectedRoute({ children, minRole, fallbackPath = '/' }: RoleProtectedRouteProps) {
  const { user, loading, claims, claimsLoading } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  if (loading || claimsLoading) {
    return null;
  }

  if (!user) {
    setLocation('/signin');
    return null;
  }

  const userLevel = ROLE_HIERARCHY[claims.role] || 1;
  const requiredLevel = ROLE_HIERARCHY[minRole] || 1;

  if (userLevel < requiredLevel) {
    setLocation(fallbackPath);
    return null;
  }

  return children;
}
