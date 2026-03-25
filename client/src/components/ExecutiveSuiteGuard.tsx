import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Redirect } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExecutiveSuiteGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  fallbackPath?: string;
}

const ROLE_ACCESS_MAP: Record<string, string[]> = {
  ceo: ['admin', 'ceo', 'owner'],
  cfo: ['admin', 'cfo', 'finance', 'owner'],
  finance: ['admin', 'cfo', 'finance', 'owner'],
  kyc: ['admin', 'kyc_officer', 'compliance', 'owner'],
  compliance: ['admin', 'compliance_officer', 'compliance', 'owner'],
  audit: ['admin', 'auditor', 'compliance', 'owner'],
  enterprise: ['admin', 'executive', 'enterprise_ops', 'owner'],
};

export function ExecutiveSuiteGuard({ 
  children, 
  requiredRoles, 
  fallbackPath = "/" 
}: ExecutiveSuiteGuardProps) {
  const { user, loading } = useFirebaseAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-black">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Verifying executive access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to={`/signin?redirect=${encodeURIComponent(window.location.pathname)}`} />;
  }

  const userRole = (user as any).role || 'user';
  const isAdmin = userRole === 'admin' || userRole === 'owner';
  
  if (requiredRoles && requiredRoles.length > 0) {
    const hasAccess = requiredRoles.some(role => {
      const allowedRoles = ROLE_ACCESS_MAP[role] || [];
      return allowedRoles.includes(userRole);
    });

    if (!hasAccess && !isAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-black p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <div>
                  <CardTitle>Access Restricted</CardTitle>
                  <CardDescription>Executive-level authorization required</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This page is restricted to authorized executive personnel only. Your current role 
                <span className="font-semibold text-foreground"> ({userRole})</span> does not have 
                access to this section.
              </p>
              <p className="text-sm text-muted-foreground">
                Contact your system administrator if you believe you should have access to the 
                Pet Wash Ltd Executive Suite.
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  onClick={() => window.location.href = fallbackPath}
                  className="flex-1"
                >
                  Return Home
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = "/dashboard"}
                  className="flex-1"
                >
                  My Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return <>{children}</>;
}
