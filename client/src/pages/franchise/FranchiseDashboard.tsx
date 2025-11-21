import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { useFranchiseId } from '@/hooks/useFranchiseId';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Package, 
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { trackFranchiseDashboardOpened } from '@/lib/analytics';
import { t } from '@/lib/i18n';
import sanitizeHtml from 'sanitize-html';

interface DashboardStats {
  locationName: string;
  totalWashes: number;
  revenue: {
    today: number;
    thisMonth: number;
    lastMonth: number;
  };
  loyaltyRedemptionRate: number;
  machineStatus: Array<{
    machineId: string;
    status: 'online' | 'offline' | 'maintenance';
    lastWash: string;
  }>;
}

interface Announcement {
  id: string;
  title: string;
  bodyHtml: string;
  category: string;
  createdAt: Date;
  readAt: Date | null;
}

export default function FranchiseDashboard() {
  const { user } = useFirebaseAuth();
  const { language, dir } = useLanguage();
  const { franchiseId, isLoading: franchiseLoading, error: franchiseError } = useFranchiseId();

  useEffect(() => {
    if (user && franchiseId) {
      trackFranchiseDashboardOpened(franchiseId, user.uid);
    }
  }, [user, franchiseId]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/franchise/dashboard/stats', franchiseId],
    enabled: !!franchiseId,
  });

  const { data: announcementsData, isLoading: announcementsLoading } = useQuery<{ announcements: Announcement[] }>({
    queryKey: ['/api/franchise/dashboard/announcements', franchiseId],
    enabled: !!franchiseId,
  });

  const announcements = announcementsData?.announcements || [];

  const getMachineStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'offline':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'maintenance':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getMachineStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      online: t('franchise.statusOnline', language),
      offline: t('franchise.statusOffline', language),
      maintenance: t('franchise.statusMaintenance', language),
    };
    return statusMap[status] || status;
  };

  if (statsLoading || announcementsLoading) {
    return (
      <div className="min-h-screen luxury-bg-mesh p-4 md:p-6 flex items-center justify-center">
        <div className="text-center luxury-animate-fade-in">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="luxury-text-body">
            {t('franchise.loading', language)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-3">
            {t('franchise.welcome', language)} {stats?.locationName || 'Franchise Partner'}
          </h1>
          <p className="luxury-text-body">
            {t('franchise.performanceOverview', language)}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="luxury-heading-sm">
                {t('franchise.todaysWashes', language)}
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient">{stats?.totalWashes || 0}</div>
              <p className="luxury-text-small mt-1">
                {t('franchise.washes', language)}
              </p>
            </CardContent>
          </div>

          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="luxury-heading-sm">
                {t('franchise.thisMonthRevenue', language)}
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient">₪{stats?.revenue.thisMonth.toLocaleString() || '0'}</div>
              <p className="luxury-text-small mt-1">
                {t('franchise.totalRevenue', language)}
              </p>
            </CardContent>
          </div>

          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="luxury-heading-sm">
                {t('franchise.loyaltyRedemption', language)}
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient">{stats?.loyaltyRedemptionRate || 0}%</div>
              <p className="luxury-text-small mt-1">
                {t('franchise.redemptionRate', language)}
              </p>
            </CardContent>
          </div>

          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="luxury-heading-sm">
                {t('franchise.monthlyGrowth', language)}
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient">
                {stats?.revenue.thisMonth && stats?.revenue.lastMonth
                  ? `${Math.round(((stats.revenue.thisMonth - stats.revenue.lastMonth) / stats.revenue.lastMonth) * 100)}%`
                  : '0%'}
              </div>
              <p className="luxury-text-small mt-1">
                {t('franchise.vsLastMonth', language)}
              </p>
            </CardContent>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Machine Status */}
          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-5">
            <CardHeader>
              <CardTitle className="luxury-heading-md">{t('franchise.machineStatus', language)}</CardTitle>
              <CardDescription className="luxury-text-small">
                {t('franchise.realTimeStatus', language)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.machineStatus && stats.machineStatus.length > 0 ? (
                  stats.machineStatus.map((machine, index) => (
                    <div
                      key={machine.machineId}
                      className="luxury-glass-minimal flex items-center justify-between p-4 transition-all duration-300 hover:scale-105 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        {getMachineStatusIcon(machine.status)}
                        <div>
                          <p className="font-semibold text-sm">{machine.machineId}</p>
                          <p className="luxury-text-small">
                            {t('franchise.lastWash', language)} {new Date(machine.lastWash).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={machine.status === 'online' ? 'default' : 'secondary'} className="luxury-badge">
                        {getMachineStatusText(machine.status)}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="luxury-text-body text-center py-4">
                    {t('franchise.noMachines', language)}
                  </p>
                )}
              </div>
            </CardContent>
          </div>

          {/* Announcements */}
          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-6">
            <CardHeader>
              <CardTitle className="luxury-heading-md">{t('franchise.announcements', language)}</CardTitle>
              <CardDescription className="luxury-text-small">
                {t('franchise.headquarters', language)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {announcements.length > 0 ? (
                  announcements.map((announcement, index) => (
                    <div
                      key={announcement.id}
                      className="luxury-glass-minimal p-4 border border-purple-100 transition-all duration-300 hover:scale-105 hover:shadow-md"
                    >
                      <h4 className="font-semibold text-sm mb-1 luxury-text-gradient">{announcement.title}</h4>
                      <div 
                        className="luxury-text-small line-clamp-2" 
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(announcement.bodyHtml, {
                          allowedTags: ['p', 'br', 'strong', 'em', 'u', 'span'],
                          allowedAttributes: {}
                        }) }}
                      />
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(announcement.createdAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="luxury-text-body text-center py-4">
                    {t('franchise.noAnnouncements', language)}
                  </p>
                )}
              </div>
            </CardContent>
          </div>
        </div>
      </div>
    </div>
  );
}
