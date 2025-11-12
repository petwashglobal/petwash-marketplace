import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Building2, Home, Users, FileText, Wrench, BarChart3, Shield, LogOut } from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";

interface EnterpriseLayoutProps {
  children: ReactNode;
}

export function EnterpriseLayout({ children }: EnterpriseLayoutProps) {
  const [location] = useLocation();
  const { user, signOut } = useFirebaseAuth();

  const navigation = [
    { name: "HQ Dashboard", href: "/enterprise/hq", icon: Home },
    { name: "Stations", href: "/enterprise/stations", icon: Building2 },
    { name: "Franchisees", href: "/enterprise/franchisees", icon: Users },
    { name: "Documents", href: "/enterprise/documents", icon: FileText },
    { name: "Work Orders", href: "/enterprise/work-orders", icon: Wrench },
    { name: "Analytics", href: "/enterprise/analytics", icon: BarChart3 },
    { name: "Security & Access", href: "/enterprise/rbac", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Enterprise-Grade Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Pet Wash™ Enterprise</h1>
                  <p className="text-xs text-gray-600">Global Operations Center</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.displayName || user?.email}</p>
                <p className="text-xs text-gray-600">Super Administrator</p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                data-testid="button-logout"
              >
                <LogOut className="h-5 w-5 text-red-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Enterprise Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href || location.startsWith(item.href + "/");
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                    ${isActive
                      ? "bg-blue-50 border border-blue-200 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }
                  `}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "text-blue-600" : ""}`} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>

      {/* Enterprise Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 px-6 mt-auto">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>© 2025 Pet Wash™ Enterprise. All rights reserved.</p>
          <p>Version 2.0.0 | Build {new Date().getFullYear()}.{new Date().getMonth() + 1}.{new Date().getDate()}</p>
        </div>
      </footer>
    </div>
  );
}
