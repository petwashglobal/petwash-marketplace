import { Link } from "wouter";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  TrendingUp, 
  Shield, 
  FileCheck, 
  ScrollText, 
  BarChart3,
  ArrowRight,
  Sparkles
} from "lucide-react";

interface DashboardLink {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  requiredRoles: string[];
  badge?: string;
}

const EXECUTIVE_DASHBOARDS: DashboardLink[] = [
  {
    title: "CEO Dashboard",
    description: "Executive overview, 2FA voucher management, strategic metrics",
    path: "/pet-wash-ltd/executive/ceo",
    icon: <Sparkles className="w-6 h-6" />,
    requiredRoles: ['admin', 'ceo', 'owner'],
    badge: "C-Suite"
  },
  {
    title: "Finance Dashboard",
    description: "Israeli tax compliance, accounts receivable/payable, revenue tracking",
    path: "/pet-wash-ltd/executive/finance",
    icon: <TrendingUp className="w-6 h-6" />,
    requiredRoles: ['admin', 'cfo', 'finance', 'owner'],
    badge: "62KB"
  },
  {
    title: "KYC & Verification",
    description: "Passport verification, provider onboarding, identity management",
    path: "/pet-wash-ltd/executive/kyc",
    icon: <FileCheck className="w-6 h-6" />,
    requiredRoles: ['admin', 'kyc_officer', 'compliance', 'owner']
  },
  {
    title: "Compliance Control Tower",
    description: "AI-driven legal compliance, regulatory management, risk monitoring",
    path: "/pet-wash-ltd/executive/compliance",
    icon: <Shield className="w-6 h-6" />,
    requiredRoles: ['admin', 'compliance_officer', 'compliance', 'owner']
  },
  {
    title: "Audit Trail",
    description: "Immutable blockchain-style audit logs, fraud prevention",
    path: "/pet-wash-ltd/executive/audit",
    icon: <ScrollText className="w-6 h-6" />,
    requiredRoles: ['admin', 'auditor', 'compliance', 'owner']
  },
  {
    title: "Enterprise HQ",
    description: "Multi-franchise operations, enterprise-grade management",
    path: "/pet-wash-ltd/executive/enterprise",
    icon: <Building2 className="w-6 h-6" />,
    requiredRoles: ['admin', 'executive', 'enterprise_ops', 'owner']
  }
];

export default function ExecutiveSuiteHome() {
  const { user } = useFirebaseAuth();
  const userRole = (user as any)?.role || 'user';

  const accessibleDashboards = EXECUTIVE_DASHBOARDS.filter(dashboard => {
    if (userRole === 'admin' || userRole === 'owner') return true;
    return dashboard.requiredRoles.includes(userRole);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-900 dark:via-black dark:to-gray-900">
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                Pet Wash Ltd™
              </h1>
              <p className="text-lg text-muted-foreground">Executive Suite</p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-3xl">
            Centralized command center for executive-level operations, financial management, 
            compliance monitoring, and enterprise-wide oversight across all 6 business units.
          </p>
        </div>

        {/* Dashboards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accessibleDashboards.map((dashboard) => (
            <Card 
              key={dashboard.path}
              className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] relative overflow-hidden"
            >
              {dashboard.badge && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                  {dashboard.badge}
                </div>
              )}
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    {dashboard.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {dashboard.title}
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm">
                      {dashboard.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link href={dashboard.path}>
                  <Button 
                    className="w-full group/btn" 
                    variant="default"
                    data-testid={`link-${dashboard.path.split('/').pop()}`}
                  >
                    <span>Open Dashboard</span>
                    <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Access Notice for Limited Roles */}
        {accessibleDashboards.length < EXECUTIVE_DASHBOARDS.length && (
          <Card className="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    Limited Access Notice
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Some dashboards are hidden based on your role ({userRole}). 
                    Contact your system administrator for expanded access.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="flex gap-4 justify-center pt-4">
          <Link href="/admin/dashboard">
            <Button variant="outline" data-testid="link-admin-dashboard">
              Admin Dashboard
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" data-testid="link-main-dashboard">
              Main Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
