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
import { designTokens } from '@/lib/designTokens';

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

  // Fetch real-time stats for badges
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
      color: designTokens.colors.accent.info,
      badge: stats?.lowStockItems,
      description: 'Manage stations & inventory'
    },
    {
      id: 'customers',
      title: 'Customers',
      icon: Users,
      path: '/admin/customers',
      color: designTokens.colors.accent.success,
      badge: stats?.totalUsers,
      description: 'View & manage customers'
    },
    {
      id: 'crm',
      title: 'CRM',
      icon: MessageSquare,
      path: '/admin/crm',
      color: designTokens.colors.accent.info,
      description: 'Customer communications'
    },
    {
      id: 'inbox',
      title: 'Inbox',
      icon: Mail,
      path: '/admin/inbox',
      color: designTokens.colors.accent.warning,
      description: 'Send broadcasts'
    },
    {
      id: 'payments',
      title: 'Payments',
      icon: CreditCard,
      path: '/admin/nayax',
      color: designTokens.colors.accent.success,
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
      color: designTokens.colors.accent.info,
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
      color: designTokens.colors.accent.error,
      description: 'Verify documents'
    },
    {
      id: 'ops-today',
      title: 'Ops Today',
      icon: Calendar,
      path: '/ops/today',
      color: designTokens.colors.accent.info,
      description: 'Daily operations view'
    },
    {
      id: 'ops-dashboard',
      title: 'Ops Dashboard',
      icon: Zap,
      path: '/ops/dashboard',
      color: designTokens.colors.accent.warning,
      description: 'Full operations panel'
    },
    {
      id: 'monitoring',
      title: 'Monitoring',
      icon: Activity,
      path: '/admin/monitoring',
      color: designTokens.colors.accent.success,
      description: 'System health'
    }
  ];

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: designTokens.colors.background.primary,
        paddingBottom: '80px' // Space for bottom nav
      }}
    >
      {/* Header */}
      <div 
        className="sticky top-0 z-40"
        style={{
          background: designTokens.colors.background.secondary,
          borderBottom: `1px solid ${designTokens.colors.border.default}`
        }}
      >
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 
                className="text-xl font-bold"
                style={{ color: designTokens.colors.text.primary }}
              >
                🐾 Operations Hub
              </h1>
              <p 
                className="text-sm"
                style={{ color: designTokens.colors.text.secondary }}
              >
                Quick access to all backend tools
              </p>
            </div>
            <button
              onClick={() => setLocation('/admin')}
              className="p-2 rounded-lg"
              style={{ 
                background: designTokens.colors.background.secondary,
                color: designTokens.colors.text.secondary
              }}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      {stats && (
        <div className="px-4 py-3" style={{ background: designTokens.colors.background.secondary }}>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-xs" style={{ color: designTokens.colors.text.secondary }}>Users</div>
              <div className="text-lg font-bold" style={{ color: designTokens.colors.text.primary }}>
                {stats.totalUsers}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: designTokens.colors.text.secondary }}>Revenue</div>
              <div className="text-lg font-bold" style={{ color: designTokens.colors.accent.success }}>
                ₪{(stats.monthlyRevenue / 1000).toFixed(0)}k
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: designTokens.colors.text.secondary }}>Low Stock</div>
              <div className="text-lg font-bold" style={{ color: designTokens.colors.accent.warning }}>
                {stats.lowStockItems || 0}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: designTokens.colors.text.secondary }}>Pending</div>
              <div className="text-lg font-bold" style={{ color: designTokens.colors.accent.error }}>
                {stats.pendingDocuments || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => setLocation(action.path)}
                className="relative rounded-xl p-4 text-left transition-all active:scale-95"
                style={{
                  background: designTokens.colors.background.secondary,
                  border: `1px solid ${designTokens.colors.border.default}`,
                  boxShadow: designTokens.shadows.sm
                }}
                data-testid={`mobile-ops-${action.id}`}
              >
                {/* Badge */}
                {action.badge !== undefined && action.badge > 0 && (
                  <div 
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: designTokens.colors.accent.error,
                      color: '#FFFFFF'
                    }}
                  >
                    {action.badge > 99 ? '99+' : action.badge}
                  </div>
                )}

                {/* Icon */}
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                  style={{
                    background: `${action.color}15`
                  }}
                >
                  <Icon className="w-6 h-6" style={{ color: action.color }} />
                </div>

                {/* Title */}
                <h3 
                  className="font-semibold text-sm mb-1"
                  style={{ color: designTokens.colors.text.primary }}
                >
                  {action.title}
                </h3>

                {/* Description */}
                <p 
                  className="text-xs line-clamp-2"
                  style={{ color: designTokens.colors.text.secondary }}
                >
                  {action.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Emergency Actions */}
      <div className="px-4 pb-4">
        <div 
          className="rounded-xl p-4"
          style={{
            background: `${designTokens.colors.accent.error}10`,
            border: `1px solid ${designTokens.colors.accent.error}30`
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle 
              className="w-5 h-5 flex-shrink-0 mt-0.5" 
              style={{ color: designTokens.colors.accent.error }} 
            />
            <div className="flex-1">
              <h3 
                className="font-semibold text-sm mb-1"
                style={{ color: designTokens.colors.text.primary }}
              >
                Emergency Contacts
              </h3>
              <div className="space-y-1 text-xs" style={{ color: designTokens.colors.text.secondary }}>
                <div>Support: <a href="tel:+972123456789" className="font-mono underline">+972-12-345-6789</a></div>
                <div>Tech: <a href="tel:+972987654321" className="font-mono underline">+972-98-765-4321</a></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: designTokens.colors.background.secondary,
          borderTop: `1px solid ${designTokens.colors.border.default}`,
          boxShadow: designTokens.shadows.base
        }}
      >
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          <button
            onClick={() => setLocation('/mobile/ops')}
            className="flex flex-col items-center gap-1 p-2 rounded-lg"
            style={{ background: designTokens.colors.background.tertiary }}
          >
            <Zap className="w-5 h-5" style={{ color: designTokens.colors.accent.info }} />
            <span className="text-xs font-medium" style={{ color: designTokens.colors.accent.info }}>Ops</span>
          </button>
          <button
            onClick={() => setLocation('/mobile/stations')}
            className="flex flex-col items-center gap-1 p-2 rounded-lg"
          >
            <MapPin className="w-5 h-5" style={{ color: designTokens.colors.text.secondary }} />
            <span className="text-xs" style={{ color: designTokens.colors.text.secondary }}>Stations</span>
          </button>
          <button
            onClick={() => setLocation('/admin/analytics')}
            className="flex flex-col items-center gap-1 p-2 rounded-lg"
          >
            <TrendingUp className="w-5 h-5" style={{ color: designTokens.colors.text.secondary }} />
            <span className="text-xs" style={{ color: designTokens.colors.text.secondary }}>Analytics</span>
          </button>
          <button
            onClick={() => setLocation('/admin')}
            className="flex flex-col items-center gap-1 p-2 rounded-lg"
          >
            <Settings className="w-5 h-5" style={{ color: designTokens.colors.text.secondary }} />
            <span className="text-xs" style={{ color: designTokens.colors.text.secondary }}>More</span>
          </button>
        </div>
      </div>
    </div>
  );
}
