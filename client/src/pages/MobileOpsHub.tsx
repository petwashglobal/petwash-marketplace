import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  Package, 
  MapPin,
  MessageSquare, 
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  Mail,
  Gift,
  AlertTriangle,
  Zap,
  Database,
  TrendingUp,
  FileText,
  Calendar,
  Heart,
  Bell,
  Activity
} from 'lucide-react';

interface QuickAction {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  path: string;
  color: string;
  badge?: number;
  description: string;
}

export default function MobileOpsHub() {
  const [, setLocation] = useLocation();

  const { data: stats } = useQuery<any>({
    queryKey: ['/api/admin/dashboard/stats'],
    refetchInterval: 30000,
  });

  const quickActions: QuickAction[] = [
    {
      id: 'stations',
      title: 'Stations',
      icon: MapPin,
      path: '/mobile/stations',
      color: '#667eea',
      badge: stats?.lowStockItems,
      description: 'Manage stations & inventory'
    },
    {
      id: 'customers',
      title: 'Customers',
      icon: Users,
      path: '/admin/customers',
      color: '#10b981',
      badge: stats?.totalUsers,
      description: 'View & manage customers'
    },
    {
      id: 'crm',
      title: 'CRM',
      icon: MessageSquare,
      path: '/admin/crm',
      color: '#667eea',
      description: 'Customer communications'
    },
    {
      id: 'inbox',
      title: 'Inbox',
      icon: Mail,
      path: '/admin/inbox',
      color: '#f59e0b',
      description: 'Send broadcasts'
    },
    {
      id: 'payments',
      title: 'Payments',
      icon: CreditCard,
      path: '/admin/nayax',
      color: '#10b981',
      description: 'Nayax monitoring'
    },
    {
      id: 'vouchers',
      title: 'Vouchers',
      icon: Gift,
      path: '/admin/vouchers',
      color: '#9C27B0',
      description: 'Manage vouchers'
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: BarChart3,
      path: '/admin/analytics',
      color: '#667eea',
      description: 'View reports & stats'
    },
    {
      id: 'loyalty',
      title: 'Loyalty',
      icon: Heart,
      path: '/admin/loyalty',
      color: '#E91E63',
      description: 'Loyalty program'
    },
    {
      id: 'kyc',
      title: 'KYC',
      icon: Shield,
      path: '/admin/kyc',
      badge: stats?.pendingDocuments,
      color: '#ef4444',
      description: 'Verify documents'
    },
    {
      id: 'ops-today',
      title: 'Ops Today',
      icon: Calendar,
      path: '/ops/today',
      color: '#667eea',
      description: 'Daily operations view'
    },
    {
      id: 'ops-dashboard',
      title: 'Ops Dashboard',
      icon: Zap,
      path: '/ops/dashboard',
      color: '#f59e0b',
      description: 'Full operations panel'
    },
    {
      id: 'monitoring',
      title: 'Monitoring',
      icon: Activity,
      path: '/admin/monitoring',
      color: '#10b981',
      description: 'System health'
    }
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh pb-24">
      {/* Header */}
      <div className="luxury-glass-card luxury-shadow-lg sticky top-0 z-40 rounded-none md:rounded-t-2xl">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="luxury-heading-lg">🐾 Operations Hub</h1>
              <p className="luxury-text-small mt-1">
                Quick access to all backend tools
              </p>
            </div>
            <button
              onClick={() => setLocation('/admin')}
              className="p-3 rounded-xl luxury-glass-minimal luxury-hover-lift transition-all"
            >
              <Settings className="w-5 h-5 text-purple-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      {stats && (
        <div className="luxury-glass-panel mx-4 mt-4 p-4 luxury-animate-fade-in luxury-delay-1">
          <div className="luxury-grid-4">
            <div className="text-center">
              <div className="luxury-text-small mb-1">Users</div>
              <div className="text-2xl font-bold luxury-text-gradient">{stats.totalUsers}</div>
            </div>
            <div className="text-center">
              <div className="luxury-text-small mb-1">Revenue</div>
              <div className="text-2xl font-bold text-green-600">₪{(stats.monthlyRevenue / 1000).toFixed(0)}k</div>
            </div>
            <div className="text-center">
              <div className="luxury-text-small mb-1">Low Stock</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.lowStockItems || 0}</div>
            </div>
            <div className="text-center">
              <div className="luxury-text-small mb-1">Pending</div>
              <div className="text-2xl font-bold text-red-600">{stats.pendingDocuments || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Action Grid */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => setLocation(action.path)}
                className="relative luxury-glass-card luxury-shadow-lg luxury-hover-lift p-5 rounded-2xl text-left transition-all duration-300 luxury-animate-slide-up"
                data-testid={`mobile-ops-${action.id}`}
                style={{ animationDelay: `${(index + 2) * 0.05}s` }}
              >
                {/* Badge */}
                {action.badge !== undefined && action.badge > 0 && (
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-lg">
                    {action.badge > 99 ? '99+' : action.badge}
                  </div>
                )}

                {/* Icon */}
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md"
                  style={{
                    background: `linear-gradient(135deg, ${action.color}15 0%, ${action.color}30 100%)`
                  }}
                >
                  <Icon className="w-7 h-7" style={{ color: action.color }} />
                </div>

                {/* Title */}
                <h3 className="font-bold text-sm mb-1 luxury-text-gradient">
                  {action.title}
                </h3>

                {/* Description */}
                <p className="luxury-text-small line-clamp-2">
                  {action.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Emergency Actions */}
      <div className="px-4 mt-6 mb-6 luxury-animate-fade-in luxury-delay-10">
        <div className="luxury-glass-card luxury-shadow-lg p-5 rounded-2xl border-2 border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm mb-2 text-gray-900">
                Emergency Contacts
              </h3>
              <div className="space-y-1 text-xs luxury-text-small">
                <div>Support: <a href="tel:+972123456789" className="font-mono underline luxury-text-gradient ltr-inline" dir="ltr">+972 12-345-6789</a></div>
                <div>Tech: <a href="tel:+972987654321" className="font-mono underline luxury-text-gradient ltr-inline" dir="ltr">+972 98-765-4321</a></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 luxury-glass-card luxury-shadow-xl rounded-none md:rounded-t-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="grid grid-cols-4 gap-1 px-2 py-3">
          <button
            onClick={() => setLocation('/mobile/ops')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl luxury-glass-panel"
          >
            <Zap className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-semibold luxury-text-gradient">Ops</span>
          </button>
          <button
            onClick={() => setLocation('/mobile/stations')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl"
          >
            <MapPin className="w-5 h-5 text-gray-500" />
            <span className="text-xs text-gray-600">Stations</span>
          </button>
          <button
            onClick={() => setLocation('/admin/analytics')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl"
          >
            <TrendingUp className="w-5 h-5 text-gray-500" />
            <span className="text-xs text-gray-600">Analytics</span>
          </button>
          <button
            onClick={() => setLocation('/admin')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl"
          >
            <Settings className="w-5 h-5 text-gray-500" />
            <span className="text-xs text-gray-600">More</span>
          </button>
        </div>
      </div>
    </div>
  );
}
