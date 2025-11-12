import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudSnow,
  Wind,
  Droplets,
  ThermometerSun,
  Calendar,
  MapPin,
  Sparkles,
  Star,
  Search
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface DayForecast {
  date: string;
  dayOfWeek: string;
  temperature: { max: number; min: number };
  weatherCode: number;
  condition: { condition: string; icon: string };
  precipitationProbability: number;
  uvIndex: number;
  windSpeed: number;
  washScore: number;
  recommendation: {
    rating: 'excellent' | 'good' | 'moderate' | 'poor';
    emoji: string;
    title: string;
    message: string;
    color: string;
    action: string;
    priority: string;
  };
}

interface PublicWeatherData {
  success: boolean;
  location: {
    city: string;
    country: string;
    formattedAddress: string;
    latitude: number;
    longitude: number;
  };
  forecast: DayForecast[];
  bestWashDay: DayForecast;
  marketingMessage: string;
  locale: string;
  language: string;
  direction: 'ltr' | 'rtl';
}

interface Props {
  data: PublicWeatherData;
  location: string;
  onLocationChange: (location: string) => void;
}

const RATING_GRADIENT = {
  excellent: 'from-emerald-500 via-green-400 to-teal-400',
  good: 'from-blue-500 via-cyan-400 to-sky-400',
  moderate: 'from-amber-500 via-yellow-400 to-orange-400',
  poor: 'from-red-500 via-rose-400 to-pink-400',
};

const getWeatherIcon = (code: number) => {
  if (code === 0 || code === 1) return <Sun className="w-12 h-12 text-yellow-400" />;
  if (code === 2 || code === 3) return <Cloud className="w-12 h-12 text-gray-400" />;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return <CloudRain className="w-12 h-12 text-blue-400" />;
  if ([71, 73, 75, 85, 86].includes(code)) return <CloudSnow className="w-12 h-12 text-blue-200" />;
  return <Cloud className="w-12 h-12 text-gray-400" />;
};

export default function PublicWeatherView({ data, location, onLocationChange }: Props) {
  const [searchInput, setSearchInput] = useState(location);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onLocationChange(searchInput.trim());
    }
  };

  return (
    <div className="container mx-auto px-4 py-12" dir={data.direction}>
      {/* Header with Search */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-12 text-center"
      >
        <h1 className="text-6xl md:text-7xl font-black mb-4 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
          Pet Wash™
        </h1>
        <p className="text-2xl text-gray-300 mb-8">7-Day Premium Wash Planner</p>
        
        {/* Location Search */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              data-testid="input-location-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={data.language === 'he' ? 'הזינו שם עיר' : data.language === 'ar' ? 'أدخل اسم المدينة' : 'Enter city name'}
              className="pl-12 h-14 text-lg bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/15"
            />
          </div>
          <Button 
            data-testid="button-search-location"
            type="submit" 
            size="lg" 
            className="h-14 px-8 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600"
          >
            <Search className="w-5 h-5 mr-2" />
            {data.language === 'he' ? 'חיפוש' : data.language === 'ar' ? 'بحث' : 'Search'}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-center gap-2 text-gray-400">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">{data.location.formattedAddress}</span>
        </div>
      </motion.div>

      {/* Best Wash Day Highlight */}
      {data.bestWashDay && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-4xl mx-auto mb-12"
        >
          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500/20 via-green-500/10 to-teal-500/20 border-emerald-500/30 backdrop-blur-md">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-full blur-3xl" />
            <div className="relative p-8">
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-8 h-8 text-emerald-400" />
                <h2 className="text-3xl font-bold">{data.language === 'he' ? 'יום הרחצה הטוב ביותר' : data.language === 'ar' ? 'أفضل يوم للغسيل' : 'BEST WASH DAY'}</h2>
                <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    {getWeatherIcon(data.bestWashDay.weatherCode)}
                    <div>
                      <div className="text-2xl font-bold">{data.bestWashDay.dayOfWeek}</div>
                      <div className="text-gray-300">{new Date(data.bestWashDay.date).toLocaleDateString(data.locale, { month: 'long', day: 'numeric' })}</div>
                    </div>
                  </div>
                  <div className="text-5xl font-black bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    {data.bestWashDay.temperature.max}°
                  </div>
                </div>
                
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-4xl">{data.bestWashDay.recommendation.emoji}</div>
                    <div className="text-2xl font-bold">{data.bestWashDay.recommendation.title}</div>
                  </div>
                  <p className="text-gray-300 mb-4">{data.bestWashDay.recommendation.action}</p>
                  <Button
                    data-testid="button-book-best-day"
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                    size="lg"
                  >
                    <Calendar className="w-5 h-5 mr-2" />
                    {data.marketingMessage}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* 7-Day Forecast Grid */}
      <div className="max-w-7xl mx-auto">
        <h3 className="text-2xl font-bold mb-6 text-center">
          {data.language === 'he' ? 'תחזית ל-7 ימים' : data.language === 'ar' ? 'توقعات لمدة 7 أيام' : '7-Day Forecast'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {data.forecast.map((day, index) => (
              <motion.div
                key={day.date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                data-testid={`forecast-card-${index}`}
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

                    {/* Weather Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-blue-400" />
                        <span>{day.precipitationProbability}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-yellow-400" />
                        <span>UV {day.uvIndex.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wind className="w-4 h-4 text-gray-400" />
                        <span>{day.windSpeed} km/h</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ThermometerSun className="w-4 h-4 text-orange-400" />
                        <span>{day.temperature.max}°</span>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className={`p-3 rounded-lg bg-gradient-to-r ${RATING_GRADIENT[day.recommendation.rating]}/20 border border-white/10`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{day.recommendation.emoji}</span>
                        <span className="font-semibold text-sm">{day.recommendation.title}</span>
                      </div>
                      <p className="text-xs text-gray-300">{day.recommendation.message}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
