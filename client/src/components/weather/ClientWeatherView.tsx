import { motion } from 'framer-motion';
import { Calendar, MapPin, Star, TrendingUp, Sun, Cloud, CloudRain } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ClientWeatherData {
  success: boolean;
  userId: string;
  upcomingAppointments: any[];
  personalRecommendations: string[];
  bestDaysThisWeek: Array<{
    date: string;
    dayOfWeek: string;
    temperature: { max: number; min: number };
    weatherCode: number;
    condition: { condition: string; icon: string };
    washScore: number;
    recommendation: {
      rating: 'excellent' | 'good' | 'moderate' | 'poor';
      emoji: string;
      title: string;
    };
  }>;
  locale: string;
  language: string;
  direction: 'ltr' | 'rtl';
}

interface Props {
  data: ClientWeatherData;
}

const RATING_GRADIENT = {
  excellent: 'from-emerald-500 via-green-400 to-teal-400',
  good: 'from-blue-500 via-cyan-400 to-sky-400',
  moderate: 'from-amber-500 via-yellow-400 to-orange-400',
  poor: 'from-red-500 via-rose-400 to-pink-400',
};

const getWeatherIcon = (code: number) => {
  if (code === 0 || code === 1) return <Sun className="w-8 h-8 text-yellow-400" />;
  if (code === 2 || code === 3) return <Cloud className="w-8 h-8 text-gray-400" />;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return <CloudRain className="w-8 h-8 text-blue-400" />;
  return <Cloud className="w-8 h-8 text-gray-400" />;
};

export default function ClientWeatherView({ data }: Props) {
  return (
    <div className="container mx-auto px-4 py-12" dir={data.direction}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto mb-12 text-center"
      >
        <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-purple-300 via-pink-200 to-purple-300 bg-clip-text text-transparent">
          My Wash Calendar
        </h1>
        <p className="text-xl text-gray-300">
          {data.language === 'he' ? 'תחזית אישית ליומן הרחצה שלך' : data.language === 'ar' ? 'توقعات شخصية لتقويم الغسيل الخاص بك' : 'Personalized forecast for your wash schedule'}
        </p>
      </motion.div>

      {/* Personal Recommendations */}
      <div className="max-w-6xl mx-auto mb-12">
        <h2 className="text-2xl font-bold mb-6">
          {data.language === 'he' ? 'המלצות אישיות' : data.language === 'ar' ? 'التوصيات الشخصية' : 'Personal Recommendations'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.personalRecommendations.map((rec, idx) => (
            <Card key={idx} className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border-purple-500/30 backdrop-blur-md p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-purple-400" />
                <p className="text-gray-200">{rec}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Best Days This Week */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">
          {data.language === 'he' ? 'הימים הטובים ביותר השבוע' : data.language === 'ar' ? 'أفضل الأيام هذا الأسبوع' : 'Best Days This Week'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.bestDaysThisWeek.map((day, index) => (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              data-testid={`client-forecast-${index}`}
            >
              <Card className={`relative overflow-hidden bg-gradient-to-br ${
                day.washScore >= 80 ? 'from-emerald-500/10 to-green-500/5 border-emerald-500/30' :
                day.washScore >= 60 ? 'from-blue-500/10 to-cyan-500/5 border-blue-500/30' :
                day.washScore >= 40 ? 'from-amber-500/10 to-yellow-500/5 border-amber-500/30' :
                'from-red-500/10 to-rose-500/5 border-red-500/30'
              } backdrop-blur-md hover:scale-105 transition-transform duration-300`}>
                <div className="p-6">
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-lg font-bold">{day.dayOfWeek}</div>
                      <div className="text-sm text-gray-400">{new Date(day.date).toLocaleDateString(data.locale, { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <Badge className={`bg-gradient-to-r ${RATING_GRADIENT[day.recommendation.rating]} text-white border-0`}>
                      {day.washScore}
                    </Badge>
                  </div>

                  {/* Weather Icon & Temp */}
                  <div className="flex items-center justify-between mb-4">
                    {getWeatherIcon(day.weatherCode)}
                    <div className="text-right">
                      <div className="text-3xl font-bold">{day.temperature.max}°</div>
                      <div className="text-sm text-gray-400">{day.temperature.min}°</div>
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="text-center mb-4">
                    <div className="text-lg font-semibold">{day.condition.condition}</div>
                  </div>

                  {/* Recommendation Badge */}
                  <div className={`p-3 rounded-lg bg-gradient-to-r ${RATING_GRADIENT[day.recommendation.rating]}/20 border border-white/10 text-center`}>
                    <span className="text-xl mr-2">{day.recommendation.emoji}</span>
                    <span className="font-semibold text-sm">{day.recommendation.title}</span>
                  </div>

                  {/* Book Button */}
                  <Button
                    data-testid={`button-book-day-${index}`}
                    className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    size="sm"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {data.language === 'he' ? 'הזמינו' : data.language === 'ar' ? 'احجز' : 'Book Now'}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
