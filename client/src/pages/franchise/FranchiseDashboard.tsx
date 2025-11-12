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
      <div className="min-h-screen bg-white p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            {t('franchise.loading', language)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {t('franchise.welcome', language)} {stats?.locationName || 'Franchise Partner'}
          </h1>
          <p className="text-gray-600">
            {t('franchise.performanceOverview', language)}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('franchise.todaysWashes', language)}
              </CardTitle>
              <Package className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalWashes || 0}</div>
              <p className="text-xs text-gray-500 mt-1">
                {t('franchise.washes', language)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('franchise.thisMonthRevenue', language)}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₪{stats?.revenue.thisMonth.toLocaleString() || '0'}</div>
              <p className="text-xs text-gray-500 mt-1">
                {t('franchise.totalRevenue', language)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('franchise.loyaltyRedemption', language)}
              </CardTitle>
              <Users className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.loyaltyRedemptionRate || 0}%</div>
              <p className="text-xs text-gray-500 mt-1">
                {t('franchise.redemptionRate', language)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('franchise.monthlyGrowth', language)}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.revenue.thisMonth && stats?.revenue.lastMonth
                  ? `${Math.round(((stats.revenue.thisMonth - stats.revenue.lastMonth) / stats.revenue.lastMonth) * 100)}%`
                  : '0%'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('franchise.vsLastMonth', language)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Machine Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t('franchise.machineStatus', language)}</CardTitle>
              <CardDescription>
                {t('franchise.realTimeStatus', language)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.machineStatus && stats.machineStatus.length > 0 ? (
                  stats.machineStatus.map((machine) => (
                    <div
                      key={machine.machineId}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getMachineStatusIcon(machine.status)}
                        <div>
                          <p className="font-medium text-sm">{machine.machineId}</p>
                          <p className="text-xs text-gray-500">
                            {t('franchise.lastWash', language)} {new Date(machine.lastWash).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={machine.status === 'online' ? 'default' : 'secondary'}>
                        {getMachineStatusText(machine.status)}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    {t('franchise.noMachines', language)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card>
            <CardHeader>
              <CardTitle>{t('franchise.announcements', language)}</CardTitle>
              <CardDescription>
                {t('franchise.headquarters', language)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {announcements.length > 0 ? (
                  announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg"
                    >
                      <h4 className="font-semibold text-sm mb-1">{announcement.title}</h4>
                      <div 
                        className="text-xs text-gray-600 line-clamp-2" 
                        dangerouslySetInnerHTML={{ __html: announcement.bodyHtml }}
                      />
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(announcement.createdAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    {t('franchise.noAnnouncements', language)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
