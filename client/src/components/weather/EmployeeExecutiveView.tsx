import { motion } from 'framer-motion';
import { TrendingUp, Building2, AlertCircle, MapPin, Sun, Cloud, CloudRain, BarChart3, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EmployeeExecutiveData {
  success: boolean;
  employeeId: string;
  employeeName: string;
  role: string;
  allFranchiseLocations: Array<{
    franchiseId: string;
    franchiseName: string;
    location: {
      city: string;
      country: string;
      formattedAddress: string;
    };
    forecast: Array<{
      date: string;
      dayOfWeek: string;
      temperature: { max: number; min: number };
      weatherCode: number;
      condition: { condition: string };
      washScore: number;
    }>;
    bestWashDay: any;
    alerts: Array<{ type: string; severity: string; message: string }>;
  }>;
  analytics: {
    totalLocations: number;
    averageWashScore: number;
    weatherAlerts: string[];
    weeklyTrends: {
      averageTemperature: number;
      totalPrecipitation: number;
      optimalWashDays: number;
    };
  };
  globalRecommendations: string[];
  locale: string;
  language: string;
  direction: 'ltr' | 'rtl';
}

interface Props {
  data: EmployeeExecutiveData;
}

const getWeatherIcon = (code: number) => {
  if (code === 0 || code === 1) return <Sun className="w-5 h-5 text-yellow-400" />;
  if (code === 2 || code === 3) return <Cloud className="w-5 h-5 text-gray-400" />;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return <CloudRain className="w-5 h-5 text-blue-400" />;
  return <Cloud className="w-5 h-5 text-gray-400" />;
};

export default function EmployeeExecutiveView({ data }: Props) {
  return (
    <div className="container mx-auto px-4 py-12" dir={data.direction}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-12"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-2 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
              {data.language === 'he' ? 'תחזית כללית' : data.language === 'ar' ? 'توقعات إجمالية' : 'Global Forecast'}
            </h1>
            <p className="text-xl text-gray-300">
              {data.language === 'he' ? `שלום ${data.employeeName}` : data.language === 'ar' ? `مرحبا ${data.employeeName}` : `Hello, ${data.employeeName}`}
            </p>
          </div>
          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black border-0 px-4 py-2 text-lg font-bold">
            {data.role.toUpperCase()}
          </Badge>
        </div>
      </motion.div>

      {/* Analytics Dashboard */}
      <div className="max-w-7xl mx-auto mb-12">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          {data.language === 'he' ? 'ניתוח נתונים' : data.language === 'ar' ? 'التحليلات' : 'Analytics'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border-blue-500/30 backdrop-blur-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-8 h-8 text-blue-400" />
              <div>
                <div className="text-3xl font-bold">{data.analytics.totalLocations}</div>
                <div className="text-sm text-gray-400">
                  {data.language === 'he' ? 'מיקומים' : data.language === 'ar' ? 'المواقع' : 'Locations'}
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/20 to-green-500/10 border-emerald-500/30 backdrop-blur-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-emerald-400" />
              <div>
                <div className="text-3xl font-bold">{data.analytics.averageWashScore}</div>
                <div className="text-sm text-gray-400">
                  {data.language === 'he' ? 'ציון ממוצע' : data.language === 'ar' ? 'متوسط النقاط' : 'Avg Score'}
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border-amber-500/30 backdrop-blur-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Sun className="w-8 h-8 text-amber-400" />
              <div>
                <div className="text-3xl font-bold">{data.analytics.weeklyTrends.averageTemperature}°</div>
                <div className="text-sm text-gray-400">
                  {data.language === 'he' ? 'טמפ\' ממוצעת' : data.language === 'ar' ? 'متوسط درجة الحرارة' : 'Avg Temp'}
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 border-purple-500/30 backdrop-blur-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-8 h-8 text-purple-400" />
              <div>
                <div className="text-3xl font-bold">{data.analytics.weeklyTrends.optimalWashDays}</div>
                <div className="text-sm text-gray-400">
                  {data.language === 'he' ? 'ימים אופטימליים' : data.language === 'ar' ? 'أيام مثالية' : 'Optimal Days'}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Global Recommendations */}
      <div className="max-w-7xl mx-auto mb-12">
        <h2 className="text-2xl font-bold mb-6">
          {data.language === 'he' ? 'המלצות גלובליות' : data.language === 'ar' ? 'التوصيات العالمية' : 'Global Recommendations'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.globalRecommendations.map((rec, idx) => (
            <Card key={idx} className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/30 backdrop-blur-md p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-amber-400" />
                <p className="text-gray-200">{rec}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Weather Alerts */}
      {data.analytics.weatherAlerts.length > 0 && (
        <div className="max-w-7xl mx-auto mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-400" />
            {data.language === 'he' ? 'התראות פעילות' : data.language === 'ar' ? 'تنبيهات نشطة' : 'Active Alerts'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.analytics.weatherAlerts.map((alert, idx) => (
              <Card key={idx} className="bg-gradient-to-br from-red-500/10 to-rose-500/5 border-red-500/30 backdrop-blur-md p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <p className="text-sm text-gray-200">{alert}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Franchise Locations */}
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">
          {data.language === 'he' ? 'כל מיקומי הזכיינות' : data.language === 'ar' ? 'جميع مواقع الامتياز' : 'All Franchise Locations'}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.allFranchiseLocations.map((franchise, idx) => (
            <Card
              key={franchise.franchiseId}
              data-testid={`franchise-location-${idx}`}
              className="bg-gradient-to-br from-white/5 to-white/0 border-white/10 backdrop-blur-md p-6"
            >
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-6 h-6 text-blue-400" />
                  <h3 className="text-xl font-bold">{franchise.franchiseName}</h3>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span>{franchise.location.formattedAddress}</span>
                </div>
              </div>

              {/* Best Day */}
              {franchise.bestWashDay && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getWeatherIcon(franchise.bestWashDay.weatherCode)}
                      <div>
                        <div className="text-sm font-bold">{franchise.bestWashDay.dayOfWeek}</div>
                        <div className="text-xs text-gray-400">{franchise.bestWashDay.condition.condition}</div>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0">
                      {franchise.bestWashDay.washScore}
                    </Badge>
                  </div>
                </div>
              )}

              {/* 7-Day Summary */}
              <div className="grid grid-cols-7 gap-1">
                {franchise.forecast.map((day) => (
                  <div key={day.date} className="text-center">
                    <div className="text-xs text-gray-400 mb-1">{day.dayOfWeek.slice(0, 1)}</div>
                    <div className="flex justify-center mb-1">
                      {getWeatherIcon(day.weatherCode)}
                    </div>
                    <div className="text-xs font-bold">{day.temperature.max}°</div>
                    <div className={`w-full h-1 rounded mt-1 ${
                      day.washScore >= 80 ? 'bg-emerald-500' :
                      day.washScore >= 60 ? 'bg-blue-500' :
                      day.washScore >= 40 ? 'bg-amber-500' :
                      'bg-red-500'
                    }`} />
                  </div>
                ))}
              </div>

              {/* Alerts Count */}
              {franchise.alerts.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-sm text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>{franchise.alerts.length} {data.language === 'he' ? 'התראות' : data.language === 'ar' ? 'تنبيهات' : 'alerts'}</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
