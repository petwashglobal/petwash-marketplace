import { motion } from 'framer-motion';
import { MapPin, AlertTriangle, TrendingUp, Sun, Cloud, CloudRain, Star, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmployeeStationData {
  success: boolean;
  employeeId: string;
  employeeName: string;
  role: string;
  assignedStations: Array<{
    stationId: string;
    stationName: string;
    location: {
      city: string;
      country: string;
      formattedAddress: string;
      latitude: number;
      longitude: number;
    };
    forecast: Array<{
      date: string;
      dayOfWeek: string;
      temperature: { max: number; min: number };
      weatherCode: number;
      condition: { condition: string; icon: string };
      washScore: number;
      precipitationProbability: number;
      uvIndex: number;
      windSpeed: number;
      recommendation: {
        rating: 'excellent' | 'good' | 'moderate' | 'poor';
        emoji: string;
        title: string;
        message: string;
      };
    }>;
    bestWashDay: any;
    alerts: Array<{
      type: string;
      severity: string;
      message: string;
      date: string;
    }>;
  }>;
  dailySummary: string;
  locale: string;
  language: string;
  direction: 'ltr' | 'rtl';
}

interface Props {
  data: EmployeeStationData;
}

const RATING_GRADIENT = {
  excellent: 'from-emerald-500 via-green-400 to-teal-400',
  good: 'from-blue-500 via-cyan-400 to-sky-400',
  moderate: 'from-amber-500 via-yellow-400 to-orange-400',
  poor: 'from-red-500 via-rose-400 to-pink-400',
};

const getWeatherIcon = (code: number) => {
  if (code === 0 || code === 1) return <Sun className="w-6 h-6 text-yellow-400" />;
  if (code === 2 || code === 3) return <Cloud className="w-6 h-6 text-gray-400" />;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return <CloudRain className="w-6 h-6 text-blue-400" />;
  return <Cloud className="w-6 h-6 text-gray-400" />;
};

export default function EmployeeStationView({ data }: Props) {
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
            <h1 className="text-4xl md:text-5xl font-black mb-2 bg-gradient-to-r from-blue-300 via-cyan-200 to-blue-300 bg-clip-text text-transparent">
              {data.language === 'he' ? 'תחזית תחנות' : data.language === 'ar' ? 'توقعات المحطة' : 'Station Forecast'}
            </h1>
            <p className="text-xl text-gray-300">
              {data.language === 'he' ? `שלום ${data.employeeName}` : data.language === 'ar' ? `مرحبا ${data.employeeName}` : `Hello, ${data.employeeName}`}
            </p>
          </div>
          <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 px-4 py-2 text-lg">
            {data.role}
          </Badge>
        </div>
        <p className="text-gray-400">{data.dailySummary}</p>
      </motion.div>

      {/* Assigned Stations */}
      <div className="max-w-7xl mx-auto space-y-12">
        {data.assignedStations.map((station, stationIdx) => (
          <motion.div
            key={station.stationId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: stationIdx * 0.1 }}
          >
            {/* Station Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="w-8 h-8 text-blue-400" />
                <h2 className="text-3xl font-bold">{station.stationName}</h2>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>{station.location.formattedAddress}</span>
              </div>
            </div>

            {/* Weather Alerts */}
            {station.alerts.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  {data.language === 'he' ? 'התראות מזג אוויר' : data.language === 'ar' ? 'تنبيهات الطقس' : 'Weather Alerts'}
                </h3>
                <div className="space-y-2">
                  {station.alerts.map((alert, idx) => (
                    <Alert key={idx} className="bg-amber-500/10 border-amber-500/30" data-testid={`weather-alert-${idx}`}>
                      <AlertDescription className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {alert.message}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {/* Best Wash Day for Station */}
            {station.bestWashDay && (
              <Card className="mb-6 bg-gradient-to-br from-emerald-500/20 via-green-500/10 to-teal-500/20 border-emerald-500/30 backdrop-blur-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Star className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-xl font-bold">
                    {data.language === 'he' ? 'יום רחצה מומלץ' : data.language === 'ar' ? 'يوم الغسيل الموصى به' : 'Recommended Wash Day'}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    {getWeatherIcon(station.bestWashDay.weatherCode)}
                    <div>
                      <div className="text-lg font-bold">{station.bestWashDay.dayOfWeek}</div>
                      <div className="text-sm text-gray-400">{station.bestWashDay.condition.condition}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{station.bestWashDay.temperature.max}°</div>
                    <div className="text-sm text-gray-400">{data.language === 'he' ? 'טמפרטורה מקסימלית' : data.language === 'ar' ? 'أعلى درجة حرارة' : 'Max Temp'}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-400">{station.bestWashDay.washScore}</div>
                    <div className="text-sm text-gray-400">{data.language === 'he' ? 'ציון רחצה' : data.language === 'ar' ? 'نقاط الغسيل' : 'Wash Score'}</div>
                  </div>
                </div>
              </Card>
            )}

            {/* 7-Day Forecast Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {station.forecast.map((day, dayIdx) => (
                <Card
                  key={day.date}
                  data-testid={`station-forecast-${stationIdx}-${dayIdx}`}
                  className={`bg-gradient-to-br ${
                    day.washScore >= 80 ? 'from-emerald-500/10 to-green-500/5 border-emerald-500/30' :
                    day.washScore >= 60 ? 'from-blue-500/10 to-cyan-500/5 border-blue-500/30' :
                    day.washScore >= 40 ? 'from-amber-500/10 to-yellow-500/5 border-amber-500/30' :
                    'from-red-500/10 to-rose-500/5 border-red-500/30'
                  } backdrop-blur-md p-4`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold">{day.dayOfWeek}</div>
                      <div className="text-xs text-gray-400">{new Date(day.date).toLocaleDateString(data.locale, { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <Badge className={`bg-gradient-to-r ${RATING_GRADIENT[day.recommendation.rating]} text-white border-0 text-xs`}>
                      {day.washScore}
                    </Badge>
                  </div>

                  {/* Weather Icon & Temp */}
                  <div className="flex items-center justify-between mb-3">
                    {getWeatherIcon(day.weatherCode)}
                    <div className="text-right">
                      <div className="text-2xl font-bold">{day.temperature.max}°</div>
                      <div className="text-xs text-gray-400">{day.temperature.min}°</div>
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="text-center mb-2 text-sm font-semibold">{day.condition.condition}</div>

                  {/* Recommendation */}
                  <div className={`p-2 rounded bg-gradient-to-r ${RATING_GRADIENT[day.recommendation.rating]}/20 border border-white/10 text-center`}>
                    <span className="text-lg mr-1">{day.recommendation.emoji}</span>
                    <span className="text-xs font-semibold">{day.recommendation.title}</span>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
